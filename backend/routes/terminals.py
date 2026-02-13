"""Terminal management routes"""
from fastapi import APIRouter, Depends
from typing import Optional
from models.enums import UserRole
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import require_role

router = APIRouter(prefix="/terminals", tags=["Terminals"])


@router.get("")
async def get_terminals(
    search: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get all terminals (users with terminal_id) with optional search"""
    db = get_db()
    query = {"terminal_id": {"$ne": None, "$exists": True}}
    
    if current_user["role"] == UserRole.ADMIN.value:
        query["created_by"] = current_user["id"]
    
    if search:
        query["$or"] = [
            {"terminal_id": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    terminals = await db.users.find(query).sort("terminal_id", 1).to_list(1000)
    return serialize_doc(terminals)


@router.get("/next-id")
async def get_next_terminal_id(current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    """Generate the next available terminal ID"""
    db = get_db()
    last_terminal = await db.users.find(
        {"terminal_id": {"$regex": "^T\\d+$"}}
    ).sort("terminal_id", -1).limit(1).to_list(1)
    
    if last_terminal:
        last_id = last_terminal[0].get("terminal_id", "T000")
        num = int(last_id[1:]) + 1
    else:
        num = 1
    
    return {"next_terminal_id": f"T{num:03d}"}
