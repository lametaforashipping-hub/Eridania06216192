"""Favorite numbers routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import uuid
from typing import Optional
from models.schemas import CreateFavoriteWithPlays
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import get_current_user

router = APIRouter(prefix="/favorites", tags=["Favorites"])


@router.post("")
async def add_favorite(data: CreateFavoriteWithPlays, current_user: dict = Depends(get_current_user)):
    """Add favorite numbers combination with multiple plays"""
    db = get_db()
    
    existing = await db.favorites.find_one({"user_id": current_user["id"], "name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un favorito con ese nombre")
    
    fav_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "name": data.name,
        "plays": [p.dict() for p in data.plays],
        "currency": data.currency,
        "created_at": datetime.utcnow(),
        "use_count": 0,
        "last_used": None
    }
    await db.favorites.insert_one(fav_doc)
    return serialize_doc(fav_doc)


@router.get("")
async def get_favorites(lottery_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get user's favorite numbers"""
    db = get_db()
    query = {"user_id": current_user["id"]}
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    favorites = await db.favorites.find(query).sort("use_count", -1).to_list(100)
    return serialize_doc(favorites)


@router.delete("/{favorite_id}")
async def delete_favorite(favorite_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a favorite"""
    db = get_db()
    result = await db.favorites.delete_one({"id": favorite_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorito no encontrado")
    return {"message": "Favorito eliminado"}


@router.post("/{favorite_id}/use")
async def use_favorite(favorite_id: str, current_user: dict = Depends(get_current_user)):
    """Increment use count for a favorite"""
    db = get_db()
    await db.favorites.update_one(
        {"id": favorite_id, "user_id": current_user["id"]},
        {"$inc": {"use_count": 1}}
    )
    return {"message": "Uso registrado"}
