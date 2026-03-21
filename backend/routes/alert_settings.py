"""Alert settings routes for configuring sales milestones and notification thresholds"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from utils.database import get_db
from utils.auth import require_role
from models.enums import UserRole
from datetime import datetime
import uuid

router = APIRouter(prefix="/alert-settings", tags=["Alert Settings"])


class AlertThreshold(BaseModel):
    milestone_rd: float = 50000.0
    milestone_usd: float = 1000.0
    daily_target_rd: float = 100000.0
    daily_target_usd: float = 2000.0
    notify_on_winner: bool = True
    notify_on_milestone: bool = True
    notify_on_daily_target: bool = True


@router.get("")
async def get_alert_settings(
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get current alert configuration"""
    db = get_db()
    settings = await db.alert_settings.find_one({"type": "global"}, {"_id": 0})
    if not settings:
        settings = {
            "type": "global",
            "milestone_rd": 50000.0,
            "milestone_usd": 1000.0,
            "daily_target_rd": 100000.0,
            "daily_target_usd": 2000.0,
            "notify_on_winner": True,
            "notify_on_milestone": True,
            "notify_on_daily_target": True
        }
        await db.alert_settings.insert_one(settings)
        settings.pop("_id", None)
    return settings


@router.put("")
async def update_alert_settings(
    data: AlertThreshold,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Update alert thresholds (super admin only)"""
    db = get_db()
    update_data = data.dict()
    update_data["type"] = "global"
    update_data["updated_at"] = datetime.utcnow()
    update_data["updated_by"] = current_user["id"]
    
    await db.alert_settings.update_one(
        {"type": "global"},
        {"$set": update_data},
        upsert=True
    )
    return {"message": "Configuración de alertas actualizada", **update_data}


@router.get("/recent-alerts")
async def get_recent_alerts(
    limit: int = 30,
    alert_type: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get recent alerts/notifications for the admin dashboard"""
    db = get_db()
    query = {}
    if alert_type:
        query["type"] = alert_type
    
    # Get notifications targeted at this user or global ones
    query["$or"] = [
        {"user_id": current_user["id"]},
        {"user_id": {"$exists": False}},
        {"target_role": {"$in": [current_user["role"], "all"]}}
    ]
    
    alerts = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    for a in alerts:
        if "read_by" in a:
            a["is_read"] = current_user["id"] in a.get("read_by", [])
        else:
            a["is_read"] = a.get("read", False)
    
    return alerts
