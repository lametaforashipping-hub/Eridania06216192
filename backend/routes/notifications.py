"""Notification routes"""
from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def get_notifications(
    limit: int = 50, 
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD) in Dominican Republic time. Defaults to today."),
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for current user, filtered by date (defaults to today)"""
    db = get_db()
    user_id = current_user["id"]
    
    # Dominican Republic is UTC-4
    now_utc = datetime.now(timezone.utc)
    now_dr = now_utc - timedelta(hours=4)
    
    # Parse date filter or use today
    if date:
        try:
            filter_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            filter_date = now_dr.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        filter_date = now_dr.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # For Dominican Republic (UTC-4):
    # A day starts at 00:00 DR = 04:00 UTC
    # A day ends at 23:59 DR = 03:59 UTC next day
    # 
    # So for DR date 2026-03-28:
    # - Starts at 2026-03-28 04:00 UTC (midnight DR)
    # - Ends at 2026-03-29 04:00 UTC (midnight DR next day)
    
    start_utc = filter_date.replace(hour=4, minute=0, second=0, microsecond=0)  # 00:00 DR = 04:00 UTC
    end_utc = start_utc + timedelta(days=1)
    
    logger.info(f"Notifications filter: date={date or 'today'}, range={start_utc} to {end_utc}")
    
    # Base query for user's notifications
    base_query = {
        "$or": [
            {"user_id": {"$exists": False}},
            {"user_id": user_id}
        ]
    }
    
    # Get all notifications first
    all_notifications = await db.notifications.find(base_query).sort("created_at", -1).to_list(500)
    
    # Filter by date manually (more robust - handles both datetime and string)
    filtered_notifications = []
    for n in all_notifications:
        created_at = n.get("created_at")
        if created_at is None:
            continue
            
        # Handle both datetime and string formats
        if isinstance(created_at, str):
            try:
                # Parse ISO format
                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                # Convert to naive UTC
                if created_at.tzinfo:
                    created_at = created_at.astimezone(timezone.utc).replace(tzinfo=None)
            except:
                continue
        elif hasattr(created_at, 'tzinfo') and created_at.tzinfo:
            # It's a timezone-aware datetime, convert to naive UTC
            created_at = created_at.astimezone(timezone.utc).replace(tzinfo=None)
        
        # Check if within date range
        if start_utc <= created_at < end_utc:
            filtered_notifications.append(n)
    
    logger.info(f"Notifications: total={len(all_notifications)}, filtered={len(filtered_notifications)} for {date or 'today'}")
    
    # Mark read status
    for n in filtered_notifications:
        if "user_id" in n:
            n["is_read"] = n.get("read", False)
        else:
            n["is_read"] = user_id in n.get("read_by", [])
    
    # Limit results
    filtered_notifications = filtered_notifications[:limit]
    
    return serialize_doc(filtered_notifications)


@router.post("/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read"""
    db = get_db()
    
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    
    if result.modified_count == 0:
        await db.notifications.update_one(
            {"id": notification_id},
            {"$addToSet": {"read_by": current_user["id"]}}
        )
    
    return {"message": "Notificación marcada como leída"}


@router.get("/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread notifications"""
    db = get_db()
    user_id = current_user["id"]
    
    global_unread = await db.notifications.count_documents({
        "user_id": {"$exists": False},
        "read_by": {"$ne": user_id}
    })
    
    user_unread = await db.notifications.count_documents({
        "user_id": user_id,
        "read": {"$ne": True}
    })
    
    return {"unread_count": global_unread + user_unread}
