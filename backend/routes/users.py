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


@router.get("/me/monthly-report")
async def get_monthly_report(
    month: int = Query(None, ge=1, le=12),
    year: int = Query(None, ge=2020, le=2030),
    current_user: dict = Depends(get_current_user)
):
    """Get monthly sales report for the current user"""
    db = get_db()
    user_id = current_user["id"]
    
    # Default to current month if not specified
    now = datetime.utcnow()
    if month is None:
        month = now.month
    if year is None:
        year = now.year
    
    # Calculate date range for the month
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    # Get tickets for the month
    tickets = await db.tickets.find({
        "seller_id": user_id,
        "created_at": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(None)
    
    # Get transactions for the month
    transactions = await db.transactions.find({
        "user_id": user_id,
        "created_at": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(None)
    
    # Calculate daily stats
    daily_stats = {}
    for day in range(1, 32):
        try:
            date_key = datetime(year, month, day).strftime("%Y-%m-%d")
            daily_stats[date_key] = {"sales": 0, "commission": 0, "tickets": 0}
        except ValueError:
            break
    
    # Aggregate ticket data by day
    for ticket in tickets:
        date_key = ticket["created_at"].strftime("%Y-%m-%d")
        if date_key in daily_stats:
            daily_stats[date_key]["sales"] += ticket.get("total_amount", ticket.get("amount", 0))
            daily_stats[date_key]["tickets"] += 1
    
    # Aggregate commission data by day
    for tx in transactions:
        if tx.get("transaction_type") == "commission":
            date_key = tx["created_at"].strftime("%Y-%m-%d")
            if date_key in daily_stats:
                daily_stats[date_key]["commission"] += tx.get("amount", 0)
    
    # Calculate totals
    total_sales = sum(t.get("total_amount", t.get("amount", 0)) for t in tickets)
    total_tickets = len(tickets)
    total_commission = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "commission")
    total_deposits = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "deposit")
    
    # Count tickets by status
    status_counts = {}
    for ticket in tickets:
        status = ticket.get("status", "pending")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Get previous month for comparison
    if month == 1:
        prev_month, prev_year = 12, year - 1
    else:
        prev_month, prev_year = month - 1, year
    
    prev_start = datetime(prev_year, prev_month, 1)
    prev_end = start_date
    
    prev_tickets = await db.tickets.find({
        "seller_id": user_id,
        "created_at": {"$gte": prev_start, "$lt": prev_end}
    }, {"_id": 0, "total_amount": 1, "amount": 1}).to_list(None)
    
    prev_sales = sum(t.get("total_amount", t.get("amount", 0)) for t in prev_tickets)
    
    # Calculate growth percentage
    if prev_sales > 0:
        growth_percentage = ((total_sales - prev_sales) / prev_sales) * 100
    else:
        growth_percentage = 100 if total_sales > 0 else 0
    
    # Convert daily_stats to list format for charts
    daily_data = [
        {
            "date": date,
            "day": int(date.split("-")[2]),
            "sales": stats["sales"],
            "commission": stats["commission"],
            "tickets": stats["tickets"]
        }
        for date, stats in sorted(daily_stats.items())
    ]
    
    return {
        "month": month,
        "year": year,
        "month_name": ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                       "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][month],
        "summary": {
            "total_sales": total_sales,
            "total_tickets": total_tickets,
            "total_commission": total_commission,
            "total_deposits": total_deposits,
            "avg_ticket_value": total_sales / total_tickets if total_tickets > 0 else 0,
            "growth_percentage": round(growth_percentage, 1),
            "status_counts": status_counts
        },
        "daily_data": daily_data,
        "currency": current_user.get("currency", "RD$")
    }


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



@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a user (super_admin only)"""
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Solo super admin puede eliminar usuarios")
    
    if current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
    
    db = get_db()
    
    # Check if user exists
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Don't allow deleting other super_admins
    if user.get("role") == "super_admin":
        raise HTTPException(status_code=400, detail="No puedes eliminar a otro super admin")
    
    # Delete user
    result = await db.users.delete_one({"id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {"message": "Usuario eliminado exitosamente"}


@router.put("/{user_id}/password")
async def reset_user_password(
    user_id: str, 
    new_password: str,
    current_user: dict = Depends(get_current_user)
):
    """Reset a user's password (super_admin only)"""
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Solo super admin puede cambiar contraseñas")
    
    db = get_db()
    
    # Check if user exists
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Hash the new password
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(new_password)
    
    # Update password
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password": hashed_password, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Contraseña actualizada exitosamente"}


@router.get("/{user_id}/credentials")
async def get_user_credentials(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user credentials info (super_admin only) - Note: passwords are hashed and cannot be recovered"""
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Solo super admin puede ver esta información")
    
    db = get_db()
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {
        "id": user["id"],
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "role": user.get("role", ""),
        "phone": user.get("phone", ""),
        "created_at": user.get("created_at"),
        "note": "Las contraseñas están encriptadas. Use 'Resetear Contraseña' para cambiarla."
    }
