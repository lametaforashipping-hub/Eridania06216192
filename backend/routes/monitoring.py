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
    """Get live monitoring data for all users"""
    db = get_db()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    if current_user["role"] == UserRole.SUPER_ADMIN.value:
        users = await db.users.find({"role": {"$in": [UserRole.ADMIN.value, UserRole.VENDEDOR.value]}}).to_list(1000)
    else:
        users = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
    
    monitoring_data = []
    total_commission = 0
    
    for user in users:
        tickets = await db.tickets.find({
            "seller_id": user["id"],
            "created_at": {"$gte": today_start}
        }).to_list(10000)
        
        valid_tickets = [t for t in tickets if t["status"] != TicketStatus.CANCELLED.value]
        today_sales = sum(t.get("amount", 0) for t in valid_tickets)
        today_wins = sum(t.get("potential_win", 0) for t in tickets if t["status"] in [TicketStatus.WON.value, TicketStatus.PAID.value])
        
        total_tickets = len(valid_tickets)
        pending_tickets = len([t for t in tickets if t["status"] == TicketStatus.PENDING.value])
        winning_tickets = len([t for t in tickets if t["status"] == TicketStatus.WON.value])
        paid_tickets = len([t for t in tickets if t["status"] == TicketStatus.PAID.value])
        
        commission_rate = user.get("commission_rate", 10.0)
        commission_earned = today_sales * (commission_rate / 100)
        total_commission += commission_earned
        
        credit_limit = user.get("credit_limit", 999999999)
        credit_used = today_sales
        
        monitoring_data.append({
            "user_id": user["id"],
            "user_name": user["name"],
            "role": user["role"],
            "today_sales": today_sales,
            "today_wins": today_wins,
            "today_profit": today_sales - today_wins,
            "total_tickets": total_tickets,
            "pending_tickets": pending_tickets,
            "winning_tickets": winning_tickets,
            "paid_tickets": paid_tickets,
            "active": user.get("active", True),
            "last_activity": user.get("last_activity"),
            "commission_rate": commission_rate,
            "commission_earned": commission_earned,
            "credit_limit": credit_limit,
            "credit_used": credit_used
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
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        query["seller_id"] = {"$in": vendor_ids}
    
    if status:
        query["status"] = status.value
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    tickets = await db.tickets.find(query).sort("created_at", -1).to_list(500)
    return serialize_doc(tickets)


@router.get("/live-tickets")
async def get_live_tickets(
    limit: int = 50,
    since_id: Optional[str] = None,
    seller_id: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get the most recent tickets in real-time"""
    db = get_db()
    query = {}
    vendor_ids = []
    
    if current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        query["seller_id"] = {"$in": vendor_ids}
    
    if seller_id:
        query["seller_id"] = seller_id
    
    if since_id:
        ref_ticket = await db.tickets.find_one({"id": since_id})
        if ref_ticket:
            query["created_at"] = {"$gt": ref_ticket["created_at"]}
    
    tickets = await db.tickets.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_query = {"created_at": {"$gte": today_start}}
    if current_user["role"] == UserRole.ADMIN.value:
        today_query["seller_id"] = {"$in": vendor_ids}
    
    all_today = await db.tickets.find(today_query).to_list(10000)
    
    total_sales = sum(t.get("amount") or t.get("total_amount", 0) for t in all_today if t.get("status") != TicketStatus.CANCELLED.value)
    total_pending = len([t for t in all_today if t.get("status") == TicketStatus.PENDING.value])
    total_won = len([t for t in all_today if t.get("status") in [TicketStatus.WON.value, TicketStatus.PAID.value]])
    total_cancelled = len([t for t in all_today if t.get("status") == TicketStatus.CANCELLED.value])
    
    return {
        "tickets": serialize_doc(tickets),
        "stats": {
            "total_today": len(all_today),
            "total_sales": total_sales,
            "pending": total_pending,
            "won": total_won,
            "cancelled": total_cancelled
        },
        "last_update": datetime.utcnow().isoformat()
    }
