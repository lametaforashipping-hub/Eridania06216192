"""Authentication routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import uuid
from models.schemas import UserCreate, UserLogin
from models.enums import UserRole, Currency
from utils.database import get_db
from utils.helpers import hash_password, verify_password, create_token
from utils.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register")
async def register(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    """Register a new user (requires admin permissions)"""
    db = get_db()
    
    if current_user["role"] == UserRole.SUPER_ADMIN.value:
        if user_data.role not in [UserRole.ADMIN, UserRole.VENDEDOR]:
            raise HTTPException(status_code=400, detail="Super Admin solo puede crear Admin o Vendedor")
    elif current_user["role"] == UserRole.ADMIN.value:
        if user_data.role != UserRole.VENDEDOR:
            raise HTTPException(status_code=400, detail="Admin solo puede crear Vendedores")
    else:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear usuarios")
    
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")
    
    currency = Currency.USD.value if user_data.country == "US" else Currency.RD.value
    
    user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role.value,
        "credit_limit": user_data.credit_limit,
        "balance": 0.0,
        "commission_rate": user_data.commission_rate,
        "currency": currency,
        "country": user_data.country,
        "created_by": current_user["id"],
        "created_at": datetime.utcnow(),
        "active": True,
        "total_sales": 0.0,
        "total_commission": 0.0,
        "last_activity": datetime.utcnow(),
        "notification_token": None,
        "phone": user_data.phone,
        "address": user_data.address,
        "cedula": user_data.cedula,
        "terminal_id": user_data.terminal_id
    }
    await db.users.insert_one(user)
    return {"message": "Usuario creado exitosamente", "user_id": user["id"]}


@router.post("/login")
async def login(credentials: UserLogin):
    """Login and get JWT token"""
    db = get_db()
    
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales invalidas")
    if not user.get("active", True):
        raise HTTPException(status_code=401, detail="Usuario desactivado")
    
    tenant_id = user.get("tenant_id")
    trial_info = None
    if tenant_id:
        tenant = await db.tenants.find_one({"id": tenant_id})
        if tenant:
            from datetime import timezone
            trial_end = datetime.fromisoformat(tenant["trial_end"])
            if trial_end.tzinfo is None:
                trial_end = trial_end.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            days_remaining = max(0, (trial_end - now).days)
            is_expired = days_remaining <= 0
            if is_expired:
                raise HTTPException(
                    status_code=403,
                    detail="Tu prueba gratis ha expirado. Contacta al 718-916-1401 para activar tu cuenta."
                )
            trial_info = {"is_trial": True, "days_remaining": days_remaining, "trial_end": tenant["trial_end"]}
    
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_activity": datetime.utcnow()}})
    
    token = create_token(user["id"], user["role"])
    response = {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "credit_limit": user["credit_limit"],
            "balance": user["balance"],
            "commission_rate": user.get("commission_rate", 10.0),
            "currency": user["currency"],
            "country": user.get("country", "RD")
        }
    }
    if trial_info:
        response["trial"] = trial_info
    return response


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "role": current_user["role"],
        "credit_limit": current_user["credit_limit"],
        "balance": current_user["balance"],
        "commission_rate": current_user.get("commission_rate", 10.0),
        "currency": current_user["currency"],
        "country": current_user.get("country", "RD"),
        "active": current_user.get("active", True),
        "total_sales": current_user.get("total_sales", 0.0),
        "total_commission": current_user.get("total_commission", 0.0)
    }


@router.post("/refresh")
async def refresh_token(current_user: dict = Depends(get_current_user)):
    """Refresh JWT token"""
    db = get_db()
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"last_activity": datetime.utcnow()}})
    
    new_token = create_token(current_user["id"], current_user["role"])
    return {
        "token": new_token,
        "user": {
            "id": current_user["id"],
            "email": current_user["email"],
            "name": current_user["name"],
            "role": current_user["role"],
            "credit_limit": current_user["credit_limit"],
            "balance": current_user["balance"],
            "commission_rate": current_user.get("commission_rate", 10.0),
            "currency": current_user["currency"],
            "country": current_user.get("country", "RD")
        }
    }
