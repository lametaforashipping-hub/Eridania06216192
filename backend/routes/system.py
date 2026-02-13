"""System initialization and health routes"""
from fastapi import APIRouter
from datetime import datetime
import uuid
from models.enums import UserRole, Currency
from models.schemas import DEFAULT_PLAY_TYPES
from utils.database import get_db
from utils.helpers import hash_password

router = APIRouter(tags=["System"])


# Default play types for all RD lotteries
DEFAULT_RD_PLAY_TYPES = {
    "quiniela": {
        "name": "Quiniela",
        "numbers_count": 1,
        "multipliers": {"first": 70, "second": 20, "third": 10},
        "enabled": True
    },
    "pale": {
        "name": "Pale",
        "numbers_count": 2,
        "multipliers": {"first": 1000, "second": 100, "third": 50},
        "enabled": True
    },
    "tripleta": {
        "name": "Tripleta",
        "numbers_count": 3,
        "multipliers": {"first": 50000, "second": 5000, "third": 2500},
        "enabled": True
    },
    "super_pale": {
        "name": "Super Pale",
        "numbers_count": 2,
        "multipliers": {"first": 2500, "second": 250, "third": 125},
        "enabled": True
    }
}


def create_lottery(name: str, schedule: list, country: str = "RD", currency: str = "RD$"):
    """Helper to create a lottery with standard configuration"""
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "country": country,
        "min_number": 0,
        "max_number": 99,
        "price": 20.0,
        "currency": currency,
        "schedule": schedule,
        "closing_minutes_before": 15,
        "active": True,
        "opening_time": "08:00",
        "closing_time": "22:00",
        "play_types": DEFAULT_RD_PLAY_TYPES.copy(),
        "created_at": datetime.utcnow(),
        # Legacy compatibility
        "lottery_type": "multi",  # New type indicating multi-play lottery
        "allows_combined": True,
        "numbers_to_pick": 1,  # Default for quiniela
        "prize_multiplier": 70.0  # Default for quiniela
    }


@router.post("/init/super-admin")
async def init_super_admin():
    """Initialize the system with super admin and real RD lotteries"""
    db = get_db()
    
    existing = await db.users.find_one({"role": UserRole.SUPER_ADMIN.value})
    if existing:
        return {"message": "Super Admin ya existe", "email": existing["email"]}
    
    super_admin = {
        "id": str(uuid.uuid4()),
        "email": "admin@loteria.com",
        "password": hash_password("admin123"),
        "name": "Super Administrador",
        "role": UserRole.SUPER_ADMIN.value,
        "credit_limit": 999999999.0,
        "balance": 0.0,
        "commission_rate": 0.0,
        "currency": Currency.RD.value,
        "created_at": datetime.utcnow(),
        "active": True,
        "total_sales": 0.0,
        "total_commission": 0.0,
        "last_activity": datetime.utcnow()
    }
    await db.users.insert_one(super_admin)
    
    # =====================================================
    # LOTERÍAS REALES DE REPÚBLICA DOMINICANA
    # Cada lotería soporta: Quiniela, Pale, Tripleta, Super Pale
    # Cada tipo tiene 3 premios: Primero, Segundo, Tercero
    # =====================================================
    
    real_lotteries = [
        # Loterías principales
        create_lottery("Gana Más", ["12:30", "14:30", "18:00", "21:00"]),
        create_lottery("Lotería Nacional", ["12:30", "14:30", "18:00", "21:00"]),
        create_lottery("Pega 3 Más", ["12:55", "15:00", "21:00"]),
        create_lottery("Quiniela Leidsa", ["12:55", "15:00", "21:00"]),
        create_lottery("Quiniela Real", ["12:30", "15:00", "18:00", "21:00"]),
        create_lottery("Quiniela Loteka", ["12:00", "15:00", "19:00", "21:00"]),
        
        # Florida y New York
        create_lottery("Florida Día", ["13:30"]),
        create_lottery("Florida Noche", ["22:45"]),
        create_lottery("New York Tarde", ["14:30"]),
        create_lottery("New York Noche", ["22:30"]),
        
        # La Primera
        create_lottery("La Primera Día", ["11:00", "13:00"]),
        create_lottery("Primera Noche", ["17:00", "20:00"]),
        
        # La Suerte
        create_lottery("La Suerte 12:30", ["12:30"]),
        create_lottery("La Suerte 18:00", ["18:00"]),
        
        # LoteDom
        create_lottery("Quiniela LoteDom", ["12:00", "15:00", "18:00", "21:00"]),
        
        # Anguila
        create_lottery("Anguila Mañana", ["10:00"]),
        create_lottery("Anguila Medio Día", ["13:00"]),
        create_lottery("Anguila Tarde", ["16:00"]),
        create_lottery("Anguila Noche", ["21:00"]),
        
        # King Lottery
        create_lottery("King Lottery 12:30", ["12:30"]),
        create_lottery("King Lottery 7:30", ["19:30"]),
    ]
    
    for lottery in real_lotteries:
        await db.lotteries.insert_one(lottery)
    
    return {
        "message": "Sistema inicializado con loterías reales de RD",
        "super_admin_email": "admin@loteria.com",
        "super_admin_password": "admin123",
        "lotteries_created": len(real_lotteries),
        "lottery_names": [l["name"] for l in real_lotteries]
    }


@router.post("/init/reset-lotteries")
async def reset_lotteries():
    """Reset all lotteries to the real RD lotteries (Admin use only)"""
    db = get_db()
    
    # Delete existing lotteries
    await db.lotteries.delete_many({})
    
    # Create real lotteries
    real_lotteries = [
        create_lottery("Gana Más", ["12:30", "14:30", "18:00", "21:00"]),
        create_lottery("Lotería Nacional", ["12:30", "14:30", "18:00", "21:00"]),
        create_lottery("Pega 3 Más", ["12:55", "15:00", "21:00"]),
        create_lottery("Quiniela Leidsa", ["12:55", "15:00", "21:00"]),
        create_lottery("Quiniela Real", ["12:30", "15:00", "18:00", "21:00"]),
        create_lottery("Quiniela Loteka", ["12:00", "15:00", "19:00", "21:00"]),
        create_lottery("Florida Día", ["13:30"]),
        create_lottery("Florida Noche", ["22:45"]),
        create_lottery("New York Tarde", ["14:30"]),
        create_lottery("New York Noche", ["22:30"]),
        create_lottery("La Primera Día", ["11:00", "13:00"]),
        create_lottery("Primera Noche", ["17:00", "20:00"]),
        create_lottery("La Suerte 12:30", ["12:30"]),
        create_lottery("La Suerte 18:00", ["18:00"]),
        create_lottery("Quiniela LoteDom", ["12:00", "15:00", "18:00", "21:00"]),
        create_lottery("Anguila Mañana", ["10:00"]),
        create_lottery("Anguila Medio Día", ["13:00"]),
        create_lottery("Anguila Tarde", ["16:00"]),
        create_lottery("Anguila Noche", ["21:00"]),
        create_lottery("King Lottery 12:30", ["12:30"]),
        create_lottery("King Lottery 7:30", ["19:30"]),
    ]
    
    for lottery in real_lotteries:
        await db.lotteries.insert_one(lottery)
    
    return {
        "message": "Loterías reiniciadas con las loterías reales de RD",
        "lotteries_created": len(real_lotteries),
        "lottery_names": [l["name"] for l in real_lotteries]
    }


@router.get("/")
async def root():
    """API root endpoint"""
    return {"message": "Sistema de Lotería RD - Banca Completa v4", "version": "4.0"}


@router.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}
