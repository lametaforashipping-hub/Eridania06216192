"""Company profile routes"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from datetime import datetime
import uuid
import os
import shutil
from typing import Optional
from pydantic import BaseModel
from models.enums import UserRole
from utils.database import get_db
from utils.auth import get_current_user, require_role

# Directorio para guardar logos subidos
UPLOAD_DIR = "/app/frontend/public/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Upload company logo and return the public URL"""
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use JPG, PNG, GIF o WebP")
    
    # Generate unique filename
    file_ext = file.filename.split(".")[-1] if file.filename else "png"
    filename = f"company_logo_{uuid.uuid4().hex[:8]}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    try:
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Generate public URL (relative path that will be served by frontend)
        logo_url = f"/uploads/{filename}"
        
        # Update company profile with new logo URL
        db = get_db()
        existing = await db.company_profile.find_one({})
        
        if existing:
            # Delete old logo file if it exists
            if existing.get("logo_url") and existing["logo_url"].startswith("/uploads/"):
                old_file = os.path.join(UPLOAD_DIR, existing["logo_url"].replace("/uploads/", ""))
                if os.path.exists(old_file):
                    os.remove(old_file)
            
            await db.company_profile.update_one({}, {"$set": {
                "logo_url": logo_url,
                "updated_at": datetime.utcnow(),
                "updated_by": current_user["id"]
            }})
        else:
            await db.company_profile.insert_one({
                "id": str(uuid.uuid4()),
                "company_name": "Sistema de Lotería",
                "logo_url": logo_url,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "updated_by": current_user["id"]
            })
        
        return {"logo_url": logo_url, "message": "Logo actualizado correctamente"}
    
    except Exception as e:
        # Clean up file if database update fails
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error al guardar el logo: {str(e)}")
