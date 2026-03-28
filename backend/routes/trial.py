"""Trial registration and management routes"""
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import HTMLResponse, FileResponse
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, EmailStr
import uuid
import os

from utils.database import get_db
from utils.helpers import hash_password, create_token, serialize_doc
from utils.auth import get_current_user
from models.enums import UserRole, Currency

router = APIRouter(prefix="/trial", tags=["Trial"])

TRIAL_DAYS = 15
CONTACT_PHONE = "718-916-1401"


class TrialRegister(BaseModel):
    company_name: str
    email: str
    phone: str
    password: str
    country: str = "RD"


@router.get("/page", response_class=HTMLResponse)
async def trial_page():
    """Serve the free trial registration page"""
    html_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "prueba-gratis.html")
    with open(html_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@router.get("/widget", response_class=HTMLResponse)
async def trial_widget():
    """Serve the embeddable free trial widget for external sites"""
    html_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "widget-prueba-gratis.html")
    with open(html_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@router.post("/register")
async def register_trial(data: TrialRegister):
    """Register a new free trial tenant"""
    db = get_db()

    existing_user = await db.users.find_one({"email": data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Este email ya está registrado")

    existing_tenant = await db.tenants.find_one({"email": data.email})
    if existing_tenant:
        raise HTTPException(status_code=400, detail="Ya existe una prueba con este email")

    tenant_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=TRIAL_DAYS)

    tenant = {
        "id": tenant_id,
        "company_name": data.company_name,
        "email": data.email,
        "phone": data.phone,
        "country": data.country,
        "trial_start": now.isoformat(),
        "trial_end": trial_end.isoformat(),
        "status": "active",
        "created_at": now.isoformat(),
    }
    await db.tenants.insert_one(tenant)

    currency = Currency.USD.value if data.country == "US" else Currency.RD.value
    admin_id = str(uuid.uuid4())
    admin_user = {
        "id": admin_id,
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.company_name,
        "role": UserRole.ADMIN.value,
        "credit_limit": 999999,
        "balance": 0.0,
        "commission_rate": 0.0,
        "currency": currency,
        "country": data.country,
        "created_by": "system",
        "created_at": now,
        "active": True,
        "total_sales": 0.0,
        "total_commission": 0.0,
        "last_activity": now,
        "notification_token": None,
        "phone": data.phone,
        "address": "",
        "cedula": "",
        "terminal_id": None,
        "tenant_id": tenant_id,
    }
    await db.users.insert_one(admin_user)

    await db.company_profile.insert_one({
        "id": str(uuid.uuid4()),
        "company_name": data.company_name,
        "address": "Dirección de ejemplo",
        "city": "Santo Domingo",
        "rnc": "000-000-000",
        "phone": data.phone,
        "tenant_id": tenant_id,
    })

    from services.trial_seed import seed_trial_data
    await seed_trial_data(db, tenant_id, admin_id, data.country)

    token = create_token(admin_id, UserRole.ADMIN.value)

    return {
        "message": "Prueba gratis activada exitosamente",
        "token": token,
        "tenant_id": tenant_id,
        "trial_end": trial_end.isoformat(),
        "days_remaining": TRIAL_DAYS,
        "user": {
            "id": admin_id,
            "email": data.email,
            "name": data.company_name,
            "role": UserRole.ADMIN.value,
            "currency": currency,
            "country": data.country,
        }
    }


@router.get("/status")
async def trial_status(current_user: dict = Depends(get_current_user)):
    """Get trial status for current user"""
    db = get_db()
    tenant_id = current_user.get("tenant_id")

    if not tenant_id:
        return {
            "is_trial": False,
            "status": "full",
            "days_remaining": None,
            "trial_end": None,
            "contact_phone": CONTACT_PHONE,
        }

    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        return {"is_trial": False, "status": "full", "days_remaining": None, "trial_end": None, "contact_phone": CONTACT_PHONE}

    now = datetime.now(timezone.utc)
    trial_end = datetime.fromisoformat(tenant["trial_end"])
    if trial_end.tzinfo is None:
        trial_end = trial_end.replace(tzinfo=timezone.utc)
    days_remaining = max(0, (trial_end - now).days)
    is_expired = days_remaining <= 0

    if is_expired and tenant["status"] != "expired":
        await db.tenants.update_one({"id": tenant_id}, {"$set": {"status": "expired"}})

    return {
        "is_trial": True,
        "status": "expired" if is_expired else "active",
        "days_remaining": days_remaining,
        "trial_end": tenant["trial_end"],
        "trial_start": tenant["trial_start"],
        "company_name": tenant.get("company_name", ""),
        "contact_phone": CONTACT_PHONE,
    }
