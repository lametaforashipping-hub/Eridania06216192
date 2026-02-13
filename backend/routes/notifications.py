"""Notification routes"""
from fastapi import APIRouter, Depends
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def get_notifications(limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get recent notifications for current user"""
    db = get_db()
    user_id = current_user["id"]
    
    query = {
        "$or": [
            {"user_id": {"$exists": False}},
            {"user_id": user_id}
        ]
    }
    
    notifications = await db.notifications.find(query).sort("created_at", -1).to_list(limit)
    
    for n in notifications:
        if "user_id" in n:
            n["is_read"] = n.get("read", False)
        else:
            n["is_read"] = user_id in n.get("read_by", [])
    
    return serialize_doc(notifications)


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
