"""User management routes"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime
import uuid
from models.schemas import UserUpdate
from models.enums import UserRole, TransactionType
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/users", tags=["Users"])


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
