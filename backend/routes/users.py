"""User management routes"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timedelta
import uuid
from models.schemas import UserUpdate
from models.enums import UserRole, TransactionType
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me/profile")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's complete profile with stats - accessible by all authenticated users"""
    db = get_db()
    user_id = current_user["id"]
    
    # Get user data
    user = await db.users.find_one({"id": user_id}, {"password": 0, "notification_token": 0, "_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Get today's date range
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    
    # Get today's stats
    today_tickets = await db.tickets.find({
        "seller_id": user_id,
        "created_at": {"$gte": today, "$lt": tomorrow}
    }).to_list(1000)
    
    today_sales = sum(t.get("total_amount", t.get("amount", 0)) for t in today_tickets)
    today_wins = sum(t.get("win_amount", 0) for t in today_tickets if t.get("status") == "won")
    today_tickets_count = len(today_tickets)
    today_pending = len([t for t in today_tickets if t.get("status") == "pending"])
    today_won = len([t for t in today_tickets if t.get("status") == "won"])
    today_cancelled = len([t for t in today_tickets if t.get("status") == "cancelled"])
    commission_rate = user.get("commission_rate", 10)
    # Ensure commission_rate is in the user object for frontend
    user["commission_rate"] = commission_rate
    today_commission = today_sales * (commission_rate / 100)
    today_net = today_sales - today_wins - today_commission
    
    # Get recent tickets (last 20)
    recent_tickets = await db.tickets.find(
        {"seller_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Get recent transactions (last 10)
    recent_transactions = await db.transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Weekly stats
    week_ago = today - timedelta(days=7)
    week_tickets = await db.tickets.find({
        "seller_id": user_id,
        "created_at": {"$gte": week_ago}
    }).to_list(5000)
    
    week_sales = sum(t.get("total_amount", t.get("amount", 0)) for t in week_tickets)
    week_commission = week_sales * (commission_rate / 100)
    
    return {
        "user": user,
        "today_stats": {
            "sales": today_sales,
            "wins": today_wins,
            "commission": today_commission,
            "net": today_net,
            "tickets_count": today_tickets_count,
            "pending": today_pending,
            "won": today_won,
            "cancelled": today_cancelled
        },
        "week_stats": {
            "sales": week_sales,
            "commission": week_commission,
            "tickets_count": len(week_tickets)
        },
        "recent_tickets": recent_tickets,
        "recent_transactions": recent_transactions
    }


@router.put("/me/profile")
async def update_my_profile(
    name: str = None,
    phone: str = None,
    address: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Update current user's profile (limited fields) - accessible by all authenticated users"""
    db = get_db()
    
    update_data = {}
    if name:
        update_data["name"] = name
    if phone:
        update_data["phone"] = phone
    if address:
        update_data["address"] = address
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    return {"message": "Perfil actualizado correctamente"}


@router.get("")
async def get_users(current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    """Get all users (filtered by permissions) - optimized with projection"""
    db = get_db()
    query = {}
    if current_user["role"] == UserRole.ADMIN.value:
        query["created_by"] = current_user["id"]
    
    # Exclude sensitive fields from response
    projection = {"password": 0, "notification_token": 0}
    users = await db.users.find(query, projection).to_list(500)
    return serialize_doc(users)


@router.get("/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific user by ID"""
    db = get_db()
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_doc(user)


@router.put("/{user_id}")
async def update_user(user_id: str, update: UserUpdate, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    """Update user information"""
    db = get_db()
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # RESTRICCIÓN: Solo Super Admin puede modificar Administradores
    if user.get("role") == UserRole.ADMIN.value and current_user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Solo el Super Admin puede modificar administradores")
    
    # Admin solo puede modificar usuarios que él creó (vendedores)
    if current_user["role"] == UserRole.ADMIN.value and user.get("created_by") != current_user["id"]:
        raise HTTPException(status_code=403, detail="No puedes modificar este usuario")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    return {"message": "Usuario actualizado"}


@router.post("/{user_id}/deposit")
async def deposit_balance(user_id: str, amount: float = Query(...), current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    """Deposit balance to a user account"""
    db = get_db()
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    new_balance = user["balance"] + amount
    await db.users.update_one({"id": user_id}, {"$set": {"balance": new_balance}})
    
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user["name"],
        "transaction_type": TransactionType.DEPOSIT.value,
        "amount": amount,
        "currency": user["currency"],
        "description": f"Depósito de saldo por {current_user['name']}",
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(transaction)
    
    return {"message": "Depósito realizado", "new_balance": new_balance}


@router.post("/{user_id}/notification-token")
async def update_notification_token(user_id: str, token: str, current_user: dict = Depends(get_current_user)):
    """Update user's push notification token"""
    db = get_db()
    await db.users.update_one({"id": user_id}, {"$set": {"notification_token": token}})
    return {"message": "Token actualizado"}
