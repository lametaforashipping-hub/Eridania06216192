"""Sales goals management routes"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from utils.database import get_db
from utils.auth import get_current_user
import uuid

router = APIRouter(prefix="/goals", tags=["goals"])


class GoalCreate(BaseModel):
    seller_id: str
    goal_type: str  # daily, weekly, monthly
    target_amount: float
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class GoalUpdate(BaseModel):
    target_amount: Optional[float] = None
    is_active: Optional[bool] = None


@router.get("")
async def get_goals(
    seller_id: Optional[str] = None,
    goal_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all goals or filter by seller/type"""
    db = get_db()
    
    # Build query
    query = {}
    if seller_id:
        query["seller_id"] = seller_id
    if goal_type:
        query["goal_type"] = goal_type
    
    # Non-admins can only see their own goals
    if current_user["role"] not in ["super_admin", "admin"]:
        query["seller_id"] = current_user["id"]
    
    goals = await db.sales_goals.find(query).to_list(100)
    
    # Calculate progress for each goal
    result = []
    for goal in goals:
        progress = await calculate_goal_progress(db, goal)
        goal_data = {
            "id": goal["id"],
            "seller_id": goal["seller_id"],
            "seller_name": goal.get("seller_name", ""),
            "goal_type": goal["goal_type"],
            "target_amount": goal["target_amount"],
            "current_amount": progress["current_amount"],
            "progress_percentage": progress["percentage"],
            "is_achieved": progress["is_achieved"],
            "is_active": goal.get("is_active", True),
            "start_date": goal.get("start_date"),
            "end_date": goal.get("end_date"),
            "created_at": goal.get("created_at")
        }
        result.append(goal_data)
    
    return {"goals": result}


@router.get("/my-progress")
async def get_my_progress(current_user: dict = Depends(get_current_user)):
    """Get current user's goal progress"""
    db = get_db()
    
    # Get active goals for current user
    goals = await db.sales_goals.find({
        "seller_id": current_user["id"],
        "is_active": True
    }).to_list(10)
    
    result = []
    for goal in goals:
        progress = await calculate_goal_progress(db, goal)
        result.append({
            "goal_type": goal["goal_type"],
            "target_amount": goal["target_amount"],
            "current_amount": progress["current_amount"],
            "progress_percentage": progress["percentage"],
            "is_achieved": progress["is_achieved"],
            "remaining": max(0, goal["target_amount"] - progress["current_amount"])
        })
    
    return {"progress": result}


@router.post("")
async def create_goal(
    goal: GoalCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new sales goal for a seller"""
    if current_user["role"] not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Solo admins pueden crear metas")
    
    db = get_db()
    
    # Get seller info
    seller = await db.users.find_one({"id": goal.seller_id})
    if not seller:
        raise HTTPException(status_code=404, detail="Vendedor no encontrado")
    
    # Check if goal already exists for this type
    existing = await db.sales_goals.find_one({
        "seller_id": goal.seller_id,
        "goal_type": goal.goal_type,
        "is_active": True
    })
    
    if existing:
        # Update existing goal
        await db.sales_goals.update_one(
            {"id": existing["id"]},
            {"$set": {
                "target_amount": goal.target_amount,
                "updated_at": datetime.utcnow()
            }}
        )
        return {"message": "Meta actualizada", "id": existing["id"]}
    
    # Create new goal
    goal_doc = {
        "id": str(uuid.uuid4()),
        "seller_id": goal.seller_id,
        "seller_name": seller.get("name", ""),
        "goal_type": goal.goal_type,
        "target_amount": goal.target_amount,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "created_by": current_user["id"]
    }
    
    await db.sales_goals.insert_one(goal_doc)
    
    return {"message": "Meta creada exitosamente", "id": goal_doc["id"]}


@router.put("/{goal_id}")
async def update_goal(
    goal_id: str,
    goal_update: GoalUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a sales goal"""
    if current_user["role"] not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Solo admins pueden modificar metas")
    
    db = get_db()
    
    goal = await db.sales_goals.find_one({"id": goal_id})
    if not goal:
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    
    update_data = {"updated_at": datetime.utcnow()}
    if goal_update.target_amount is not None:
        update_data["target_amount"] = goal_update.target_amount
    if goal_update.is_active is not None:
        update_data["is_active"] = goal_update.is_active
    
    await db.sales_goals.update_one({"id": goal_id}, {"$set": update_data})
    
    return {"message": "Meta actualizada"}


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a sales goal"""
    if current_user["role"] not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Solo admins pueden eliminar metas")
    
    db = get_db()
    
    result = await db.sales_goals.delete_one({"id": goal_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    
    return {"message": "Meta eliminada"}


@router.get("/sellers-summary")
async def get_sellers_goals_summary(
    current_user: dict = Depends(get_current_user)
):
    """Get summary of all sellers' goal progress (admin only)"""
    if current_user["role"] not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Solo admins")
    
    db = get_db()
    
    # Get all sellers
    sellers = await db.users.find({"role": "vendedor"}).to_list(100)
    
    result = []
    for seller in sellers:
        # Get active goals for this seller
        goals = await db.sales_goals.find({
            "seller_id": seller["id"],
            "is_active": True
        }).to_list(10)
        
        seller_data = {
            "seller_id": seller["id"],
            "seller_name": seller.get("name", ""),
            "goals": []
        }
        
        for goal in goals:
            progress = await calculate_goal_progress(db, goal)
            seller_data["goals"].append({
                "goal_type": goal["goal_type"],
                "target_amount": goal["target_amount"],
                "current_amount": progress["current_amount"],
                "progress_percentage": progress["percentage"],
                "is_achieved": progress["is_achieved"]
            })
        
        result.append(seller_data)
    
    return {"sellers": result}


async def calculate_goal_progress(db, goal: dict) -> dict:
    """Calculate progress for a goal based on tickets sold"""
    now = datetime.utcnow()
    goal_type = goal["goal_type"]
    seller_id = goal["seller_id"]
    
    # Determine date range based on goal type
    if goal_type == "daily":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=1)
    elif goal_type == "weekly":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(weeks=1)
    elif goal_type == "monthly":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if now.month == 12:
            end_date = now.replace(year=now.year + 1, month=1, day=1)
        else:
            end_date = now.replace(month=now.month + 1, day=1)
    else:
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=1)
    
    # Calculate total sales in period
    pipeline = [
        {
            "$match": {
                "seller_id": seller_id,
                "created_at": {"$gte": start_date, "$lt": end_date},
                "status": {"$ne": "cancelled"}
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": {"$ifNull": ["$total_amount", "$amount"]}}
            }
        }
    ]
    
    result = await db.tickets.aggregate(pipeline).to_list(1)
    current_amount = result[0]["total"] if result else 0
    
    target = goal["target_amount"]
    percentage = min(100, (current_amount / target * 100)) if target > 0 else 0
    is_achieved = current_amount >= target
    
    return {
        "current_amount": current_amount,
        "percentage": round(percentage, 1),
        "is_achieved": is_achieved
    }
