"""System initialization and health routes"""
from fastapi import APIRouter
from datetime import datetime
import uuid
from models.enums import UserRole, Currency, LotteryType
from utils.database import get_db
from utils.helpers import hash_password

router = APIRouter(tags=["System"])


@router.post("/init/super-admin")
async def init_super_admin():
    """Initialize the system with super admin and default lotteries"""
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
    
    # Create ALL lotteries - RD and USA
    default_lotteries = [
        # República Dominicana - Lotería Nacional
        {"id": str(uuid.uuid4()), "name": "Quiniela Nacional", "country": "RD", "lottery_type": LotteryType.QUINIELA.value,
         "min_number": 0, "max_number": 99, "numbers_to_pick": 1, "price": 20.0, "currency": Currency.RD.value,
         "prize_multiplier": 70.0, "schedule": ["12:30", "14:30", "18:00", "21:00"], "closing_minutes_before": 15,
         "active": True, "allows_combined": False,
         "prize_rules": [
             {"position": "primera", "matches": 1, "multiplier": 70},
             {"position": "segunda", "matches": 1, "multiplier": 20},
             {"position": "tercera", "matches": 1, "multiplier": 10}
         ],
         "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Pale Nacional", "country": "RD", "lottery_type": LotteryType.PALE.value,
         "min_number": 0, "max_number": 99, "numbers_to_pick": 2, "price": 20.0, "currency": Currency.RD.value,
         "prize_multiplier": 1000.0, "schedule": ["12:30", "14:30", "18:00", "21:00"], "closing_minutes_before": 15,
         "active": True, "allows_combined": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Tripleta Nacional", "country": "RD", "lottery_type": LotteryType.TRIPLETA.value,
         "min_number": 0, "max_number": 99, "numbers_to_pick": 3, "price": 20.0, "currency": Currency.RD.value,
         "prize_multiplier": 50000.0, "schedule": ["12:30", "14:30", "18:00", "21:00"], "closing_minutes_before": 15,
         "active": True, "allows_combined": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Super Pale", "country": "RD", "lottery_type": LotteryType.SUPER_PALE.value,
         "min_number": 0, "max_number": 99, "numbers_to_pick": 2, "price": 25.0, "currency": Currency.RD.value,
         "prize_multiplier": 2500.0, "schedule": ["12:30", "14:30", "18:00", "21:00"], "closing_minutes_before": 15,
         "active": True, "allows_combined": True, "created_at": datetime.utcnow()},
        
        # Leidsa
        {"id": str(uuid.uuid4()), "name": "Loto Leidsa", "country": "RD", "lottery_type": LotteryType.LOTO.value,
         "min_number": 1, "max_number": 38, "numbers_to_pick": 6, "price": 50.0, "currency": Currency.RD.value,
         "prize_multiplier": 100000.0, "schedule": ["20:55"], "closing_minutes_before": 15,
         "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Pega 3 Más", "country": "RD", "lottery_type": LotteryType.PEGA3.value,
         "min_number": 0, "max_number": 9, "numbers_to_pick": 3, "price": 25.0, "currency": Currency.RD.value,
         "prize_multiplier": 500.0, "schedule": ["12:55", "15:00", "21:00"], "closing_minutes_before": 15,
         "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Pega 4 Más", "country": "RD", "lottery_type": LotteryType.PEGA4.value,
         "min_number": 0, "max_number": 9, "numbers_to_pick": 4, "price": 25.0, "currency": Currency.RD.value,
         "prize_multiplier": 5000.0, "schedule": ["12:55", "15:00", "21:00"], "closing_minutes_before": 15,
         "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Super Kino TV", "country": "RD", "lottery_type": LotteryType.SUPER_KINO.value,
         "min_number": 1, "max_number": 80, "numbers_to_pick": 10, "price": 30.0, "currency": Currency.RD.value,
         "prize_multiplier": 10000.0, "schedule": ["12:00", "15:00", "18:00", "21:00"], "closing_minutes_before": 10,
         "active": True, "created_at": datetime.utcnow()},
        
        # Loteka
        {"id": str(uuid.uuid4()), "name": "MegaChance Loteka", "country": "RD", "lottery_type": LotteryType.MEGACHANCE.value,
         "min_number": 1, "max_number": 36, "numbers_to_pick": 6, "price": 50.0, "currency": Currency.RD.value,
         "prize_multiplier": 50000.0, "schedule": ["19:55"], "closing_minutes_before": 15,
         "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "QuinieLoto", "country": "RD", "lottery_type": LotteryType.QUINIELOTO.value,
         "min_number": 0, "max_number": 99, "numbers_to_pick": 1, "price": 20.0, "currency": Currency.RD.value,
         "prize_multiplier": 70.0, "schedule": ["12:00", "15:00", "19:00", "21:00"], "closing_minutes_before": 15,
         "active": True, "created_at": datetime.utcnow()},
        
        # La Primera
        {"id": str(uuid.uuid4()), "name": "La Primera", "country": "RD", "lottery_type": LotteryType.QUINIELA.value,
         "min_number": 0, "max_number": 99, "numbers_to_pick": 1, "price": 20.0, "currency": Currency.RD.value,
         "prize_multiplier": 70.0, "schedule": ["11:00", "13:00", "17:00", "20:00"], "closing_minutes_before": 15,
         "active": True, "created_at": datetime.utcnow()},
        
        # USA Lotteries
        {"id": str(uuid.uuid4()), "name": "Powerball", "country": "US", "lottery_type": LotteryType.POWERBALL.value,
         "min_number": 1, "max_number": 69, "numbers_to_pick": 5, "price": 2.0, "currency": Currency.USD.value,
         "prize_multiplier": 1000000.0, "schedule": ["22:59"], "closing_minutes_before": 60,
         "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Mega Millions", "country": "US", "lottery_type": LotteryType.MEGA_MILLIONS.value,
         "min_number": 1, "max_number": 70, "numbers_to_pick": 5, "price": 2.0, "currency": Currency.USD.value,
         "prize_multiplier": 1000000.0, "schedule": ["23:00"], "closing_minutes_before": 60,
         "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Cash4Life", "country": "US", "lottery_type": LotteryType.CASH4LIFE.value,
         "min_number": 1, "max_number": 60, "numbers_to_pick": 5, "price": 2.0, "currency": Currency.USD.value,
         "prize_multiplier": 7000.0, "schedule": ["21:00"], "closing_minutes_before": 30,
         "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Pick 3", "country": "US", "lottery_type": LotteryType.PICK3.value,
         "min_number": 0, "max_number": 9, "numbers_to_pick": 3, "price": 1.0, "currency": Currency.USD.value,
         "prize_multiplier": 500.0, "schedule": ["12:29", "19:29"], "closing_minutes_before": 15,
         "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Pick 4", "country": "US", "lottery_type": LotteryType.PICK4.value,
         "min_number": 0, "max_number": 9, "numbers_to_pick": 4, "price": 1.0, "currency": Currency.USD.value,
         "prize_multiplier": 5000.0, "schedule": ["12:29", "19:29"], "closing_minutes_before": 15,
         "active": True, "created_at": datetime.utcnow()},
        
        # New York Numbers (USA quiniela style)
        {"id": str(uuid.uuid4()), "name": "NY Numbers Midday", "country": "US", "lottery_type": LotteryType.QUINIELA.value,
         "min_number": 0, "max_number": 99, "numbers_to_pick": 1, "price": 1.0, "currency": Currency.USD.value,
         "prize_multiplier": 70.0, "schedule": ["12:20"], "closing_minutes_before": 15,
         "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "NY Numbers Evening", "country": "US", "lottery_type": LotteryType.QUINIELA.value,
         "min_number": 0, "max_number": 99, "numbers_to_pick": 1, "price": 1.0, "currency": Currency.USD.value,
         "prize_multiplier": 70.0, "schedule": ["19:30"], "closing_minutes_before": 15,
         "active": True, "created_at": datetime.utcnow()},
    ]
    
    for lottery in default_lotteries:
        await db.lotteries.insert_one(lottery)
    
    return {
        "message": "Sistema inicializado",
        "super_admin_email": "admin@loteria.com",
        "super_admin_password": "admin123",
        "lotteries_created": len(default_lotteries)
    }


@router.get("/")
async def root():
    """API root endpoint"""
    return {"message": "Sistema de Lotería RD/USA API - Banca Completa v3", "version": "3.0"}


@router.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}
