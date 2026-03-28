"""Authentication utilities and dependencies"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import os
from datetime import datetime, timezone
from typing import List
from models.enums import UserRole
from utils.database import get_db

JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = "HS256"

CONTACT_PHONE = "718-916-1401"

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated user from JWT token"""
    db = get_db()
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
        tenant_id = user.get("tenant_id")
        if tenant_id:
            tenant = await db.tenants.find_one({"id": tenant_id})
            if tenant:
                trial_end = datetime.fromisoformat(tenant["trial_end"])
                if trial_end.tzinfo is None:
                    trial_end = trial_end.replace(tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
                if now > trial_end:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Tu prueba gratis ha expirado. Contacta al {CONTACT_PHONE} para activar tu cuenta."
                    )
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalido")

def require_role(allowed_roles: List[UserRole]):
    """Dependency factory for role-based access control"""
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in [r.value for r in allowed_roles]:
            raise HTTPException(status_code=403, detail="No tienes permisos para esta accion")
        return user
    return role_checker
