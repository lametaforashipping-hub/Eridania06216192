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
    
    # Get today's stats
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_tickets = await db.tickets.find({
        "seller_id": seller_id,
        "created_at": {"$gte": today_start}
    }).to_list(10000)
    
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
    
    # Current period tickets
    current_query = {**base_query, "created_at": {"$gte": start_date}}
    current_tickets = await db.tickets.find(current_query).to_list(10000)
    
    # Previous period tickets
    prev_query = {**base_query, "created_at": {"$gte": prev_start, "$lt": prev_end}}
    prev_tickets = await db.tickets.find(prev_query).to_list(10000)
    
    # Calculate current stats
    current_sales = sum(t.get("total_amount", t.get("amount", 0)) for t in current_tickets if t.get("status") != TicketStatus.CANCELLED.value)
    current_won = sum(t.get("total_prize", t.get("prize", 0)) or 0 for t in current_tickets if t.get("status") in [TicketStatus.WON.value, TicketStatus.PAID.value])
    current_tickets_count = len([t for t in current_tickets if t.get("status") != TicketStatus.CANCELLED.value])
    
    # Calculate previous stats
    prev_sales = sum(t.get("total_amount", t.get("amount", 0)) for t in prev_tickets if t.get("status") != TicketStatus.CANCELLED.value)
    prev_tickets_count = len([t for t in prev_tickets if t.get("status") != TicketStatus.CANCELLED.value])
    
    # Growth percentages
    sales_growth = ((current_sales - prev_sales) / prev_sales * 100) if prev_sales > 0 else 0
    tickets_growth = ((current_tickets_count - prev_tickets_count) / prev_tickets_count * 100) if prev_tickets_count > 0 else 0
    
    # Status breakdown
    status_counts = {}
    for t in current_tickets:
        status = t.get("status", "pending")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Sales by lottery
    sales_by_lottery: Dict[str, float] = {}
    for t in current_tickets:
        if t.get("status") == TicketStatus.CANCELLED.value:
            continue
        
        # Handle multi-play tickets
        if t.get("ticket_type") == "multi_play" and t.get("plays"):
            for play in t.get("plays", []):
                lottery_name = play.get("lottery_name", "Otros")
                sales_by_lottery[lottery_name] = sales_by_lottery.get(lottery_name, 0) + play.get("amount", 0)
        else:
            lottery_name = t.get("lottery_name", "Otros")
            sales_by_lottery[lottery_name] = sales_by_lottery.get(lottery_name, 0) + t.get("amount", 0)
    
    # Sort by sales and get top 10
    sorted_lotteries = sorted(sales_by_lottery.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Sales by day for charts
    daily_sales: Dict[str, float] = {}
    for t in current_tickets:
        if t.get("status") == TicketStatus.CANCELLED.value:
            continue
        date_key = t.get("created_at").strftime("%Y-%m-%d") if t.get("created_at") else "Unknown"
        amount = t.get("total_amount", t.get("amount", 0))
        daily_sales[date_key] = daily_sales.get(date_key, 0) + amount
    
    # Sort daily sales by date
    sorted_daily = sorted(daily_sales.items(), key=lambda x: x[0])
    
    # Top sellers
    sales_by_seller: Dict[str, Dict] = {}
    for t in current_tickets:
        if t.get("status") == TicketStatus.CANCELLED.value:
            continue
        seller_id = t.get("seller_id", "Unknown")
        seller_name = t.get("seller_name", "Desconocido")
        if seller_id not in sales_by_seller:
            sales_by_seller[seller_id] = {"name": seller_name, "sales": 0, "tickets": 0}
        sales_by_seller[seller_id]["sales"] += t.get("total_amount", t.get("amount", 0))
        sales_by_seller[seller_id]["tickets"] += 1
    
    top_sellers = sorted(sales_by_seller.values(), key=lambda x: x["sales"], reverse=True)[:10]
    
    # Commissions (estimate based on sales)
    total_commissions = 0
    for seller_id, data in sales_by_seller.items():
        seller = await db.users.find_one({"id": seller_id})
        rate = seller.get("commission_rate", 10) if seller else 10
        total_commissions += data["sales"] * (rate / 100)
    
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
