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
