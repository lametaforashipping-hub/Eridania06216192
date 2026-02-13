"""Company profile routes"""
from fastapi import APIRouter, Depends
from datetime import datetime
import uuid
from typing import Optional
from pydantic import BaseModel
from models.enums import UserRole
from utils.database import get_db
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/company-profile", tags=["Company"])


class CompanyProfileUpdate(BaseModel):
    company_name: str
    logo_url: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    rnc: Optional[str] = None
    slogan: Optional[str] = None
    receipt_footer: Optional[str] = None


@router.get("")
async def get_company_profile(current_user: dict = Depends(get_current_user)):
    """Get company profile settings"""
    db = get_db()
    profile = await db.company_profile.find_one({}, {"_id": 0})
    if not profile:
        return {
            "id": None,
            "company_name": "Sistema de Lotería",
            "logo_url": None,
            "address": None,
            "phone": None,
            "email": None,
            "rnc": None,
            "slogan": None,
            "receipt_footer": "Gracias por su preferencia"
        }
    return profile


@router.put("")
async def update_company_profile(
    profile_data: CompanyProfileUpdate,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Update company profile settings"""
    db = get_db()
    existing = await db.company_profile.find_one({})
    
    profile_dict = profile_data.dict()
    profile_dict["updated_at"] = datetime.utcnow()
    profile_dict["updated_by"] = current_user["id"]
    
    if existing:
        await db.company_profile.update_one({}, {"$set": profile_dict})
    else:
        profile_dict["id"] = str(uuid.uuid4())
        profile_dict["created_at"] = datetime.utcnow()
        await db.company_profile.insert_one(profile_dict)
    
    return {"message": "Perfil actualizado correctamente"}


@router.post("/logo")
async def upload_company_logo(
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Upload company logo placeholder"""
    return {"message": "Use PUT /company-profile with logo_url field for now"}
