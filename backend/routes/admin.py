"""System administration routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from typing import Dict
from pydantic import BaseModel
from models.schemas import SystemConfig
from models.enums import UserRole, TicketStatus
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import require_role

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
