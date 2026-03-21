"""Prize configuration routes - Global multipliers by country"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import uuid
from typing import Dict, Optional
from pydantic import BaseModel
from models.enums import UserRole
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/prize-config", tags=["Prize Configuration"])


# Default multipliers for each country
DEFAULT_MULTIPLIERS = {
    "RD": {
        "quiniela": {"first": 70, "second": 20, "third": 10},
        "pale": {"first": 1000, "second": 100, "third": 50},
        "tripleta": {"first": 50000, "second": 5000, "third": 2500},
        "super_pale": {"first": 2500, "second": 250, "third": 125}
    },
    "US": {
        "quiniela": {"first": 56, "second": 16, "third": 8},
        "pale": {"first": 1500, "second": 150, "third": 75},
        "tripleta": {"first": 40000, "second": 4000, "third": 2000},
        "super_pale": {"first": 2000, "second": 200, "third": 100}
    }
}


class PrizeConfigUpdate(BaseModel):
    """Model for updating prize configuration"""
    country: str
    play_type: str
    multipliers: Dict[str, float]  # {"first": 70, "second": 20, "third": 10}


class CountryPrizeConfig(BaseModel):
    """Model for full country prize configuration"""
    country: str
    quiniela: Optional[Dict[str, float]] = None
    pale: Optional[Dict[str, float]] = None
    tripleta: Optional[Dict[str, float]] = None
    super_pale: Optional[Dict[str, float]] = None


@router.get("")
async def get_all_prize_configs(current_user: dict = Depends(get_current_user)):
    """Get prize configurations for all countries"""
    db = get_db()
    
    configs = await db.prize_config.find({}, {"_id": 0}).to_list(100)
    
    # If no configs exist, return defaults
    if not configs:
        return {
            "configs": [
                {"country": "RD", **DEFAULT_MULTIPLIERS["RD"]},
                {"country": "US", **DEFAULT_MULTIPLIERS["US"]}
            ],
            "is_default": True
        }
    
    # Build response with all countries
    result = {}
    for config in configs:
        country = config.get("country")
        if country:
            result[country] = config
    
    # Ensure both RD and US exist
    for country in ["RD", "US"]:
        if country not in result:
            result[country] = {"country": country, **DEFAULT_MULTIPLIERS.get(country, DEFAULT_MULTIPLIERS["RD"])}
    
    return {
        "configs": list(result.values()),
        "is_default": False
    }


@router.get("/{country}")
async def get_prize_config(country: str, current_user: dict = Depends(get_current_user)):
    """Get prize configuration for a specific country"""
    db = get_db()
    
    config = await db.prize_config.find_one({"country": country.upper()}, {"_id": 0})
    
    if not config:
        # Return defaults if not configured
        default = DEFAULT_MULTIPLIERS.get(country.upper(), DEFAULT_MULTIPLIERS["RD"])
        return {
            "country": country.upper(),
            **default,
            "is_default": True
        }
    
    return {**config, "is_default": False}


@router.put("/{country}")
async def update_country_prize_config(
    country: str,
    config: CountryPrizeConfig,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Update all prize multipliers for a country (Super Admin only)"""
    db = get_db()
    country_upper = country.upper()
    
    # Build update document
    update_data = {
        "country": country_upper,
        "updated_at": datetime.utcnow(),
        "updated_by": current_user["id"],
        "updated_by_name": current_user["name"]
    }
    
    # Add each play type if provided
    if config.quiniela:
        update_data["quiniela"] = config.quiniela
    if config.pale:
        update_data["pale"] = config.pale
    if config.tripleta:
        update_data["tripleta"] = config.tripleta
    if config.super_pale:
        update_data["super_pale"] = config.super_pale
    
    # Check if config exists
    existing = await db.prize_config.find_one({"country": country_upper})
    
    if existing:
        await db.prize_config.update_one(
            {"country": country_upper},
            {"$set": update_data}
        )
    else:
        update_data["id"] = str(uuid.uuid4())
        update_data["created_at"] = datetime.utcnow()
        # Fill in defaults for missing play types
        defaults = DEFAULT_MULTIPLIERS.get(country_upper, DEFAULT_MULTIPLIERS["RD"])
        for play_type in ["quiniela", "pale", "tripleta", "super_pale"]:
            if play_type not in update_data:
                update_data[play_type] = defaults[play_type]
        await db.prize_config.insert_one(update_data)
    
    return {
        "message": f"Configuración de premios actualizada para {country_upper}",
        "country": country_upper
    }


@router.put("/{country}/{play_type}")
async def update_play_type_multipliers(
    country: str,
    play_type: str,
    config: PrizeConfigUpdate,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Update multipliers for a specific play type in a country"""
    db = get_db()
    country_upper = country.upper()
    play_type_lower = play_type.lower()
    
    if play_type_lower not in ["quiniela", "pale", "tripleta", "super_pale"]:
        raise HTTPException(status_code=400, detail=f"Tipo de jugada inválido: {play_type}")
    
    # Validate multipliers
    required_keys = ["first", "second", "third"]
    for key in required_keys:
        if key not in config.multipliers:
            raise HTTPException(status_code=400, detail=f"Falta multiplicador: {key}")
    
    # Check if config exists
    existing = await db.prize_config.find_one({"country": country_upper})
    
    if existing:
        await db.prize_config.update_one(
            {"country": country_upper},
            {"$set": {
                play_type_lower: config.multipliers,
                "updated_at": datetime.utcnow(),
                "updated_by": current_user["id"]
            }}
        )
    else:
        # Create new config with defaults
        defaults = DEFAULT_MULTIPLIERS.get(country_upper, DEFAULT_MULTIPLIERS["RD"])
        new_config = {
            "id": str(uuid.uuid4()),
            "country": country_upper,
            **defaults,
            play_type_lower: config.multipliers,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "updated_by": current_user["id"]
        }
        await db.prize_config.insert_one(new_config)
    
    return {
        "message": f"Multiplicadores de {play_type} actualizados para {country_upper}",
        "country": country_upper,
        "play_type": play_type_lower,
        "multipliers": config.multipliers
    }


async def get_multipliers_for_country(country: str, play_type: str) -> Dict[str, float]:
    """Helper function to get multipliers for a country and play type"""
    db = get_db()
    country_upper = country.upper() if country else "RD"
    play_type_lower = play_type.lower() if play_type else "quiniela"
    
    config = await db.prize_config.find_one({"country": country_upper})
    
    if config and play_type_lower in config:
        return config[play_type_lower]
    
    # Return defaults
    defaults = DEFAULT_MULTIPLIERS.get(country_upper, DEFAULT_MULTIPLIERS["RD"])
    return defaults.get(play_type_lower, defaults["quiniela"])
