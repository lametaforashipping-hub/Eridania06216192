"""System administration routes"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timedelta
from typing import Dict, Optional
import jwt
import os
from pydantic import BaseModel
from models.schemas import SystemConfig
from models.enums import UserRole, TicketStatus
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import require_role

JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.get("/config")
async def get_system_config(current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Get system configuration"""
    db = get_db()
    config = await db.system_config.find_one({"_id": "main"})
    if not config:
        config = {
            "high_risk_threshold_rd": 10000.0,
            "high_risk_threshold_usd": 200.0,
            "auto_refresh_interval": 5
        }
    return serialize_doc(config)


@router.put("/config")
async def update_system_config(
    config: SystemConfig,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Update system configuration"""
    db = get_db()
    await db.system_config.update_one(
        {"_id": "main"},
        {"$set": {
            "high_risk_threshold_rd": config.high_risk_threshold_rd,
            "high_risk_threshold_usd": config.high_risk_threshold_usd,
            "auto_refresh_interval": config.auto_refresh_interval,
            "updated_at": datetime.utcnow(),
            "updated_by": current_user["id"]
        }},
        upsert=True
    )
    return {"message": "Configuración actualizada"}


@router.get("/high-risk-tickets")
async def get_high_risk_tickets(
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get tickets above high risk threshold"""
    db = get_db()
    config = await db.system_config.find_one({"_id": "main"})
    threshold_rd = config.get("high_risk_threshold_rd", 10000.0) if config else 10000.0
    threshold_usd = config.get("high_risk_threshold_usd", 200.0) if config else 200.0
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    high_risk_tickets = await db.tickets.find({
        "created_at": {"$gte": today_start},
        "status": TicketStatus.PENDING.value,
        "$or": [
            {"$and": [{"currency": "RD$"}, {"$or": [{"potential_win": {"$gte": threshold_rd}}, {"total_potential_win": {"$gte": threshold_rd}}]}]},
            {"$and": [{"currency": "USD"}, {"$or": [{"potential_win": {"$gte": threshold_usd}}, {"total_potential_win": {"$gte": threshold_usd}}]}]}
        ]
    }).sort("created_at", -1).to_list(100)
    
    return {
        "high_risk_tickets": serialize_doc(high_risk_tickets),
        "threshold_rd": threshold_rd,
        "threshold_usd": threshold_usd,
        "count": len(high_risk_tickets)
    }


@router.get("/seller-profile/{seller_id}")
async def get_seller_profile_for_admin(
    seller_id: str,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get full seller profile and stats for admin management"""
    db = get_db()
    seller = await db.users.find_one({"id": seller_id})
    if not seller:
        raise HTTPException(status_code=404, detail="Vendedor no encontrado")
    
    # Admin can only view their created sellers
    if current_user["role"] == UserRole.ADMIN.value:
        if seller.get("created_by") != current_user["id"] and seller_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="No tienes acceso a este vendedor")
    
    # Get today's stats - optimized with projection
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_tickets = await db.tickets.find(
        {"seller_id": seller_id, "created_at": {"$gte": today_start}},
        {"amount": 1, "total_amount": 1, "status": 1, "prize": 1, "total_prize": 1}
    ).to_list(1000)
    
    today_sales = sum(t.get("amount") or t.get("total_amount", 0) for t in today_tickets if t.get("status") != TicketStatus.CANCELLED.value)
    today_wins = sum(t.get("prize") or t.get("total_prize", 0) for t in today_tickets if t.get("status") in [TicketStatus.WON.value, TicketStatus.PAID.value])
    commission_rate = seller.get("commission_rate", 10.0)
    today_commission = today_sales * (commission_rate / 100)
    
    # Get recent tickets
    recent_tickets = await db.tickets.find({"seller_id": seller_id}).sort("created_at", -1).limit(20).to_list(20)
    
    # Get recent transactions
    recent_transactions = await db.transactions.find({"user_id": seller_id}).sort("created_at", -1).limit(20).to_list(20)
    
    return {
        "seller": serialize_doc(seller),
        "today_stats": {
            "sales": today_sales,
            "wins": today_wins,
            "commission": today_commission,
            "net": today_sales - today_wins,
            "tickets_count": len(today_tickets),
            "pending": len([t for t in today_tickets if t.get("status") == TicketStatus.PENDING.value]),
            "won": len([t for t in today_tickets if t.get("status") in [TicketStatus.WON.value, TicketStatus.PAID.value]]),
            "cancelled": len([t for t in today_tickets if t.get("status") == TicketStatus.CANCELLED.value])
        },
        "recent_tickets": serialize_doc(recent_tickets),
        "recent_transactions": serialize_doc(recent_transactions)
    }


@router.post("/act-as-seller")
async def act_as_seller(
    seller_id: str,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Generate a temporary token to act as a seller (Super Admin only)"""
    db = get_db()
    seller = await db.users.find_one({"id": seller_id})
    if not seller:
        raise HTTPException(status_code=404, detail="Vendedor no encontrado")
    
    # Create token with seller's identity but mark it as admin-impersonation
    token_data = {
        "user_id": seller["id"],
        "role": seller["role"],
        "impersonated_by": current_user["id"],
        "impersonated_by_name": current_user["name"],
        "exp": datetime.utcnow() + timedelta(hours=2)  # Short-lived token
    }
    temp_token = jwt.encode(token_data, JWT_SECRET, algorithm="HS256")
    
    return {
        "temp_token": temp_token,
        "seller": serialize_doc(seller),
        "expires_in": "2 hours",
        "message": f"Ahora estás actuando como {seller['name']}"
    }



@router.get("/stats/dashboard")
async def get_admin_dashboard_stats(
    period: str = Query("month", description="day, week, month, year"),
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get advanced statistics for admin dashboard"""
    db = get_db()
    now = datetime.utcnow()
    
    # Calculate date ranges
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = start_date - timedelta(days=1)
        prev_end = start_date
    elif period == "week":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = start_date - timedelta(weeks=1)
        prev_end = start_date
    elif period == "year":
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_start = start_date.replace(year=start_date.year - 1)
        prev_end = start_date
    else:  # month (default)
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if now.month == 1:
            prev_start = start_date.replace(year=start_date.year - 1, month=12)
        else:
            prev_start = start_date.replace(month=start_date.month - 1)
        prev_end = start_date
    
    # Build base query for role-based filtering
    base_query = {}
    if current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        base_query["seller_id"] = {"$in": vendor_ids}
    
    # Use aggregation pipeline for current period stats
    cancelled = TicketStatus.CANCELLED.value
    won_statuses = [TicketStatus.WON.value, TicketStatus.PAID.value]
    
    current_match = {**base_query, "created_at": {"$gte": start_date}}
    
    # Aggregation: summary stats for current period
    summary_pipeline = [
        {"$match": current_match},
        {"$group": {
            "_id": None,
            "total_sales": {"$sum": {"$cond": [
                {"$ne": ["$status", cancelled]},
                {"$ifNull": ["$total_amount", {"$ifNull": ["$amount", 0]}]},
                0
            ]}},
            "total_won": {"$sum": {"$cond": [
                {"$in": ["$status", won_statuses]},
                {"$ifNull": ["$total_prize", {"$ifNull": ["$prize", 0]}]},
                0
            ]}},
            "total_tickets": {"$sum": {"$cond": [{"$ne": ["$status", cancelled]}, 1, 0]}}
        }}
    ]
    summary_result = await db.tickets.aggregate(summary_pipeline).to_list(1)
    current_sales = summary_result[0]["total_sales"] if summary_result else 0
    current_won = summary_result[0]["total_won"] if summary_result else 0
    current_tickets_count = summary_result[0]["total_tickets"] if summary_result else 0
    
    # Aggregation: summary stats for previous period
    prev_match = {**base_query, "created_at": {"$gte": prev_start, "$lt": prev_end}}
    prev_pipeline = [
        {"$match": prev_match},
        {"$group": {
            "_id": None,
            "total_sales": {"$sum": {"$cond": [
                {"$ne": ["$status", cancelled]},
                {"$ifNull": ["$total_amount", {"$ifNull": ["$amount", 0]}]},
                0
            ]}},
            "total_tickets": {"$sum": {"$cond": [{"$ne": ["$status", cancelled]}, 1, 0]}}
        }}
    ]
    prev_result = await db.tickets.aggregate(prev_pipeline).to_list(1)
    prev_sales = prev_result[0]["total_sales"] if prev_result else 0
    prev_tickets_count = prev_result[0]["total_tickets"] if prev_result else 0
    
    # Growth percentages
    sales_growth = ((current_sales - prev_sales) / prev_sales * 100) if prev_sales > 0 else 0
    tickets_growth = ((current_tickets_count - prev_tickets_count) / prev_tickets_count * 100) if prev_tickets_count > 0 else 0
    
    # Aggregation: Status breakdown
    status_pipeline = [
        {"$match": current_match},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_result = await db.tickets.aggregate(status_pipeline).to_list(20)
    status_counts = {s["_id"] or "pending": s["count"] for s in status_result}
    
    # Aggregation: Daily sales
    daily_pipeline = [
        {"$match": {**current_match, "status": {"$ne": cancelled}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "value": {"$sum": {"$ifNull": ["$total_amount", {"$ifNull": ["$amount", 0]}]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_result = await db.tickets.aggregate(daily_pipeline).to_list(366)
    sorted_daily = [(d["_id"], d["value"]) for d in daily_result]
    
    # Aggregation: Top sellers
    sellers_pipeline = [
        {"$match": {**current_match, "status": {"$ne": cancelled}}},
        {"$group": {
            "_id": "$seller_id",
            "name": {"$first": "$seller_name"},
            "sales": {"$sum": {"$ifNull": ["$total_amount", {"$ifNull": ["$amount", 0]}]}},
            "tickets": {"$sum": 1}
        }},
        {"$sort": {"sales": -1}},
        {"$limit": 10}
    ]
    top_sellers_raw = await db.tickets.aggregate(sellers_pipeline).to_list(10)
    top_sellers = [{"name": s.get("name", "Desconocido"), "sales": s["sales"], "tickets": s["tickets"]} for s in top_sellers_raw]
    
    # Aggregation: Sales by lottery (need to handle multi_play separately)
    lottery_pipeline = [
        {"$match": {**current_match, "status": {"$ne": cancelled}}},
        {"$facet": {
            "single": [
                {"$match": {"$or": [{"ticket_type": {"$ne": "multi_play"}}, {"ticket_type": {"$exists": False}}]}},
                {"$group": {"_id": {"$ifNull": ["$lottery_name", "Otros"]}, "value": {"$sum": {"$ifNull": ["$amount", 0]}}}}
            ],
            "multi": [
                {"$match": {"ticket_type": "multi_play"}},
                {"$unwind": "$plays"},
                {"$group": {"_id": {"$ifNull": ["$plays.lottery_name", "Otros"]}, "value": {"$sum": {"$ifNull": ["$plays.amount", 0]}}}}
            ]
        }}
    ]
    lottery_result = await db.tickets.aggregate(lottery_pipeline).to_list(1)
    sales_by_lottery: Dict[str, float] = {}
    if lottery_result:
        for item in lottery_result[0].get("single", []) + lottery_result[0].get("multi", []):
            name = item["_id"]
            sales_by_lottery[name] = sales_by_lottery.get(name, 0) + item["value"]
    sorted_lotteries = sorted(sales_by_lottery.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Commissions estimate - batch fetch seller commission rates
    seller_ids = [s["_id"] for s in top_sellers_raw] if top_sellers_raw else []
    total_commissions = 0
    if seller_ids:
        sellers_data = await db.users.find(
            {"id": {"$in": seller_ids}},
            {"id": 1, "commission_rate": 1, "_id": 0}
        ).to_list(len(seller_ids))
        rate_map = {s["id"]: s.get("commission_rate", 10) for s in sellers_data}
        for s in top_sellers_raw:
            rate = rate_map.get(s["_id"], 10)
            total_commissions += s["sales"] * (rate / 100)
    
    return {
        "period": period,
        "start_date": start_date.isoformat(),
        "summary": {
            "total_sales": current_sales,
            "total_won": current_won,
            "net_profit": current_sales - current_won,
            "total_tickets": current_tickets_count,
            "total_commissions": round(total_commissions, 2),
            "avg_ticket_value": round(current_sales / current_tickets_count, 2) if current_tickets_count > 0 else 0
        },
        "growth": {
            "sales_percent": round(sales_growth, 1),
            "tickets_percent": round(tickets_growth, 1),
            "prev_sales": prev_sales,
            "prev_tickets": prev_tickets_count
        },
        "status_breakdown": status_counts,
        "sales_by_lottery": [{"name": name, "value": round(value, 2)} for name, value in sorted_lotteries],
        "daily_sales": [{"date": date, "value": round(value, 2)} for date, value in sorted_daily],
        "top_sellers": top_sellers
    }


@router.get("/stats/extended")
async def get_extended_stats(
    period: str = Query("month", regex="^(day|week|month|year)$"),
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get extended statistics including client analytics"""
    from datetime import timezone
    db = get_db()
    
    now = datetime.utcnow()  # Use naive datetime for MongoDB comparison
    
    # Calculate date ranges
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = start_date - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = start_date - timedelta(weeks=1)
    elif period == "month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_start = (start_date - timedelta(days=1)).replace(day=1)
    else:  # year
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_start = start_date.replace(year=start_date.year - 1)
    
    prev_end = start_date
    
    # Client Analytics - use count instead of loading all docs
    total_clients = await db.users.count_documents({"role": "cliente"})
    
    # New clients in period - use count
    new_clients_count = await db.users.count_documents({"role": "cliente", "created_at": {"$gte": start_date}})
    
    # Previous period new clients - use count
    prev_new_clients_count = await db.users.count_documents({"role": "cliente", "created_at": {"$gte": prev_start, "$lt": prev_end}})
    
    # Active clients (with plays in period) - use distinct
    active_client_ids = await db.tickets.distinct("client_id", {
        "client_id": {"$exists": True, "$ne": None},
        "created_at": {"$gte": start_date}
    })
    active_clients_count = len(active_client_ids)
    
    # Top clients by spend - use aggregation
    top_clients_pipeline = [
        {"$match": {"client_id": {"$exists": True, "$ne": None}, "created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$client_id",
            "plays": {"$sum": 1},
            "total_spent": {"$sum": {"$ifNull": ["$total_amount", 0]}},
            "won": {"$sum": {"$cond": [{"$in": ["$status", ["won", "paid"]]}, {"$ifNull": ["$potential_win", 0]}, 0]}}
        }},
        {"$sort": {"total_spent": -1}},
        {"$limit": 10}
    ]
    top_clients_raw = await db.tickets.aggregate(top_clients_pipeline).to_list(10)
    
    # Batch fetch client names
    top_client_ids = [c["_id"] for c in top_clients_raw]
    top_clients = []
    if top_client_ids:
        clients_data = await db.users.find(
            {"id": {"$in": top_client_ids}},
            {"id": 1, "name": 1, "phone": 1, "_id": 0}
        ).to_list(len(top_client_ids))
        client_map = {c["id"]: c for c in clients_data}
        for c in top_clients_raw:
            client_info = client_map.get(c["_id"], {})
            top_clients.append({
                "name": client_info.get("name", "Cliente"),
                "phone": client_info.get("phone", ""),
                "plays": c["plays"],
                "total_spent": round(c["total_spent"], 2),
                "won": round(c["won"], 2)
            })
    
    # Conversion rate (registered -> first play)
    clients_with_plays = await db.tickets.distinct("client_id", {"client_id": {"$exists": True, "$ne": None}})
    conversion_rate = (len(clients_with_plays) / total_clients * 100) if total_clients > 0 else 0
    
    # Lottery analytics - use aggregation pipeline
    lottery_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}, "status": {"$ne": "cancelled"}}},
        {"$facet": {
            "single": [
                {"$match": {"$or": [{"ticket_type": {"$ne": "multi_play"}}, {"ticket_type": {"$exists": False}}]}},
                {"$group": {
                    "_id": {"$ifNull": ["$lottery_name", "Otros"]},
                    "tickets": {"$sum": 1},
                    "revenue": {"$sum": {"$ifNull": ["$total_amount", {"$ifNull": ["$amount", 0]}]}},
                    "winners": {"$sum": {"$cond": [{"$in": ["$status", ["won", "paid"]]}, 1, 0]}},
                    "prizes_paid": {"$sum": {"$cond": [{"$in": ["$status", ["won", "paid"]]}, {"$ifNull": ["$potential_win", 0]}, 0]}}
                }}
            ],
            "multi": [
                {"$match": {"ticket_type": "multi_play"}},
                {"$unwind": "$plays"},
                {"$group": {
                    "_id": {"$ifNull": ["$plays.lottery_name", "Otros"]},
                    "tickets": {"$sum": 1},
                    "revenue": {"$sum": {"$ifNull": ["$plays.amount", 0]}},
                    "winners": {"$sum": 0},
                    "prizes_paid": {"$sum": 0}
                }}
            ],
            "hourly": [
                {"$group": {
                    "_id": {"$hour": "$created_at"},
                    "count": {"$sum": 1}
                }}
            ],
            "weekly": [
                {"$group": {
                    "_id": {"$dayOfWeek": "$created_at"},
                    "count": {"$sum": 1}
                }}
            ]
        }}
    ]
    agg_result = await db.tickets.aggregate(lottery_pipeline).to_list(1)
    
    # Process lottery analytics
    lottery_analytics = {}
    if agg_result:
        for item in agg_result[0].get("single", []) + agg_result[0].get("multi", []):
            name = item["_id"]
            if name not in lottery_analytics:
                lottery_analytics[name] = {"tickets": 0, "revenue": 0, "winners": 0, "prizes_paid": 0}
            lottery_analytics[name]["tickets"] += item["tickets"]
            lottery_analytics[name]["revenue"] += item["revenue"]
            lottery_analytics[name]["winners"] += item["winners"]
            lottery_analytics[name]["prizes_paid"] += item["prizes_paid"]
    
    # Sort by revenue
    top_lotteries = []
    total_revenue = sum(lt["revenue"] for lt in lottery_analytics.values())
    for name, stats in sorted(lottery_analytics.items(), key=lambda x: x[1]["revenue"], reverse=True)[:15]:
        top_lotteries.append({
            "name": name,
            "tickets": stats["tickets"],
            "revenue": round(stats["revenue"], 2),
            "percentage": round(stats["revenue"] / total_revenue * 100, 1) if total_revenue > 0 else 0,
            "winners": stats["winners"],
            "prizes_paid": round(stats["prizes_paid"], 2),
            "profit_margin": round((stats["revenue"] - stats["prizes_paid"]) / stats["revenue"] * 100, 1) if stats["revenue"] > 0 else 0
        })
    
    # Hourly distribution from aggregation
    hourly_distribution = {}
    if agg_result:
        for item in agg_result[0].get("hourly", []):
            hourly_distribution[item["_id"]] = item["count"]
    hourly_data = [{"hour": h, "count": hourly_distribution.get(h, 0)} for h in range(24)]
    
    # Weekly distribution from aggregation (MongoDB dayOfWeek: 1=Sun, 7=Sat)
    weekly_distribution = {}
    day_names = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"]
    if agg_result:
        for item in agg_result[0].get("weekly", []):
            weekly_distribution[item["_id"]] = item["count"]
    # MongoDB dayOfWeek: 1=Sunday, 2=Monday, ..., 7=Saturday
    weekly_data = [{"day": day_names[d], "count": weekly_distribution.get(d + 1, 0)} for d in range(7)]
    
    return {
        "period": period,
        "client_analytics": {
            "total_clients": total_clients,
            "new_clients": new_clients_count,
            "new_clients_growth": round((new_clients_count - prev_new_clients_count) / prev_new_clients_count * 100, 1) if prev_new_clients_count > 0 else 0,
            "active_clients": active_clients_count,
            "conversion_rate": round(conversion_rate, 1),
            "top_clients": top_clients
        },
        "lottery_analytics": {
            "top_lotteries": top_lotteries,
            "total_lotteries_played": len(lottery_analytics)
        },
        "time_analytics": {
            "hourly_distribution": hourly_data,
            "weekly_distribution": weekly_data
        }
    }

