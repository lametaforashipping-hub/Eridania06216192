"""Monitoring routes"""
from fastapi import APIRouter, Depends
from datetime import datetime
from typing import Optional
from models.enums import UserRole, TicketStatus
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


@router.get("/live")
async def get_live_monitoring(current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    """Get live monitoring data for all users - optimized with aggregation"""
    db = get_db()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Fetch users with only required fields
    user_projection = {"id": 1, "name": 1, "role": 1, "commission_rate": 1, "credit_limit": 1, "active": 1, "last_activity": 1, "_id": 0}
    
    if current_user["role"] == UserRole.SUPER_ADMIN.value:
        users = await db.users.find(
            {"role": {"$in": [UserRole.ADMIN.value, UserRole.VENDEDOR.value]}},
            user_projection
        ).to_list(500)
    else:
        users = await db.users.find(
            {"created_by": current_user["id"]},
            user_projection
        ).to_list(500)
    
    user_ids = [u["id"] for u in users]
    user_map = {u["id"]: u for u in users}
    
    # Use aggregation pipeline to get stats for all users at once
    pipeline = [
        {
            "$match": {
                "seller_id": {"$in": user_ids},
                "created_at": {"$gte": today_start}
            }
        },
        {
            "$group": {
                "_id": "$seller_id",
                "total_tickets": {"$sum": 1},
                "total_amount": {
                    "$sum": {
                        "$cond": [
                            {"$ne": ["$status", TicketStatus.CANCELLED.value]},
                            {"$ifNull": [{"$ifNull": ["$amount", "$total_amount"]}, 0]},
                            0
                        ]
                    }
                },
                "pending_count": {
                    "$sum": {"$cond": [{"$eq": ["$status", TicketStatus.PENDING.value]}, 1, 0]}
                },
                "won_count": {
                    "$sum": {"$cond": [{"$in": ["$status", [TicketStatus.WON.value, TicketStatus.PAID.value]]}, 1, 0]}
                },
                "paid_count": {
                    "$sum": {"$cond": [{"$eq": ["$status", TicketStatus.PAID.value]}, 1, 0]}
                },
                "total_wins": {
                    "$sum": {
                        "$cond": [
                            {"$in": ["$status", [TicketStatus.WON.value, TicketStatus.PAID.value]]},
                            {"$ifNull": ["$potential_win", 0]},
                            0
                        ]
                    }
                },
                "valid_tickets": {
                    "$sum": {"$cond": [{"$ne": ["$status", TicketStatus.CANCELLED.value]}, 1, 0]}
                }
            }
        }
    ]
    
    stats_cursor = db.tickets.aggregate(pipeline)
    stats_list = await stats_cursor.to_list(length=500)
    stats_map = {s["_id"]: s for s in stats_list}
    
    monitoring_data = []
    total_commission = 0
    
    for user in users:
        user_stats = stats_map.get(user["id"], {})
        today_sales = user_stats.get("total_amount", 0)
        today_wins = user_stats.get("total_wins", 0)
        
        commission_rate = user.get("commission_rate", 10.0)
        commission_earned = today_sales * (commission_rate / 100)
        total_commission += commission_earned
        
        credit_limit = user.get("credit_limit", 999999999)
        
        monitoring_data.append({
            "user_id": user["id"],
            "user_name": user["name"],
            "role": user["role"],
            "today_sales": today_sales,
            "today_wins": today_wins,
            "today_profit": today_sales - today_wins,
            "total_tickets": user_stats.get("valid_tickets", 0),
            "pending_tickets": user_stats.get("pending_count", 0),
            "winning_tickets": user_stats.get("won_count", 0),
            "paid_tickets": user_stats.get("paid_count", 0),
            "active": user.get("active", True),
            "last_activity": user.get("last_activity"),
            "commission_rate": commission_rate,
            "commission_earned": commission_earned,
            "credit_limit": credit_limit,
            "credit_used": today_sales
        })
    
    monitoring_data.sort(key=lambda x: x["today_sales"], reverse=True)
    
    total_sales = sum(m["today_sales"] for m in monitoring_data)
    total_wins = sum(m["today_wins"] for m in monitoring_data)
    total_tickets = sum(m["total_tickets"] for m in monitoring_data)
    
    return {
        "users": monitoring_data,
        "global_stats": {
            "total_sales": total_sales,
            "total_wins": total_wins,
            "total_profit": total_sales - total_wins,
            "total_tickets": total_tickets,
            "active_users": len([m for m in monitoring_data if m["active"]]),
            "total_commission": total_commission
        }
    }


@router.get("/tickets")
async def get_tickets_monitoring(
    status: Optional[TicketStatus] = None,
    lottery_id: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get today's tickets for monitoring"""
    db = get_db()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    query = {"created_at": {"$gte": today_start}}
    
    if current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find(
            {"created_by": current_user["id"]},
            {"id": 1, "_id": 0}
        ).to_list(500)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        query["seller_id"] = {"$in": vendor_ids}
    
    if status:
        query["status"] = status.value
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    tickets = await db.tickets.find(query).sort("created_at", -1).to_list(200)
    return serialize_doc(tickets)


@router.get("/live-tickets")
async def get_live_tickets(
    limit: int = 50,
    since_id: Optional[str] = None,
    seller_id: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get the most recent tickets in real-time - optimized"""
    db = get_db()
    query = {}
    vendor_ids = []
    
    if current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find(
            {"created_by": current_user["id"]},
            {"id": 1, "_id": 0}
        ).to_list(500)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        query["seller_id"] = {"$in": vendor_ids}
    
    if seller_id:
        query["seller_id"] = seller_id
    
    if since_id:
        ref_ticket = await db.tickets.find_one({"id": since_id}, {"created_at": 1})
        if ref_ticket:
            query["created_at"] = {"$gt": ref_ticket["created_at"]}
    
    tickets = await db.tickets.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Use aggregation for stats instead of loading all tickets
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_query = {"created_at": {"$gte": today_start}}
    if current_user["role"] == UserRole.ADMIN.value:
        today_query["seller_id"] = {"$in": vendor_ids}
    
    stats_pipeline = [
        {"$match": today_query},
        {
            "$group": {
                "_id": None,
                "total_today": {"$sum": 1},
                "total_sales": {
                    "$sum": {
                        "$cond": [
                            {"$ne": ["$status", TicketStatus.CANCELLED.value]},
                            {"$ifNull": [{"$ifNull": ["$amount", "$total_amount"]}, 0]},
                            0
                        ]
                    }
                },
                "pending": {
                    "$sum": {"$cond": [{"$eq": ["$status", TicketStatus.PENDING.value]}, 1, 0]}
                },
                "won": {
                    "$sum": {"$cond": [{"$in": ["$status", [TicketStatus.WON.value, TicketStatus.PAID.value]]}, 1, 0]}
                },
                "cancelled": {
                    "$sum": {"$cond": [{"$eq": ["$status", TicketStatus.CANCELLED.value]}, 1, 0]}
                }
            }
        }
    ]
    
    stats_cursor = db.tickets.aggregate(stats_pipeline)
    stats_result = await stats_cursor.to_list(length=1)
    stats = stats_result[0] if stats_result else {
        "total_today": 0, "total_sales": 0, "pending": 0, "won": 0, "cancelled": 0
    }
    
    return {
        "tickets": serialize_doc(tickets),
        "stats": {
            "total_today": stats.get("total_today", 0),
            "total_sales": stats.get("total_sales", 0),
            "pending": stats.get("pending", 0),
            "won": stats.get("won", 0),
            "cancelled": stats.get("cancelled", 0)
        },
        "last_update": datetime.utcnow().isoformat() + 'Z'
    }
