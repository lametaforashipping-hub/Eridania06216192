from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
import bcrypt
import random
from enum import Enum
import asyncio
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'lottery_db')]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'lottery-super-secret-key-2024-extended')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="Sistema de Lotería RD/USA - Banca Completa v3")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== ENUMS ====================
class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    VENDEDOR = "vendedor"

class Currency(str, Enum):
    RD = "RD$"
    USD = "USD"

class LotteryType(str, Enum):
    QUINIELA = "quiniela"
    PALE = "pale"
    TRIPLETA = "tripleta"
    SUPER_PALE = "super_pale"
    LOTO = "loto"
    SUPER_KINO = "super_kino"
    PEGA3 = "pega3"
    PEGA4 = "pega4"
    POWERBALL = "powerball"
    MEGA_MILLIONS = "mega_millions"
    PICK3 = "pick3"
    PICK4 = "pick4"
    CASH4LIFE = "cash4life"
    MEGACHANCE = "megachance"
    QUINIELOTO = "quinieloto"

class TicketStatus(str, Enum):
    PENDING = "pending"
    WON = "won"
    LOST = "lost"
    CANCELLED = "cancelled"
    PAID = "paid"

class TransactionType(str, Enum):
    SALE = "sale"
    WIN = "win"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    COMMISSION = "commission"
    PAYMENT = "payment"
    CANCELLATION = "cancellation"

class DrawPosition(str, Enum):
    PRIMERA = "primera"
    SEGUNDA = "segunda"
    TERCERA = "tercera"

# ==================== MODELS ====================
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.VENDEDOR
    credit_limit: float = 10000.0
    commission_rate: float = 10.0
    currency: Currency = Currency.RD
    country: str = "RD"  # "RD" = República Dominicana, "US" = Estados Unidos
    # New fields
    phone: Optional[str] = None
    address: Optional[str] = None
    cedula: Optional[str] = None  # ID number

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    credit_limit: float
    balance: float
    commission_rate: float
    currency: Currency
    country: str = "RD"
    created_by: Optional[str] = None
    created_at: datetime
    active: bool = True
    total_sales: float = 0.0
    total_commission: float = 0.0
    # New fields
    phone: Optional[str] = None
    address: Optional[str] = None
    cedula: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    credit_limit: Optional[float] = None
    commission_rate: Optional[float] = None
    active: Optional[bool] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    cedula: Optional[str] = None
    country: Optional[str] = None

class PrizeRule(BaseModel):
    position: str  # primera, segunda, tercera, or "any"
    matches: int
    multiplier: float

# Schedule structure for weekly hours
# Example: {"monday": {"open": "08:00", "close": "22:00"}, "sunday": {"open": "10:00", "close": "20:00"}}
DEFAULT_WEEKLY_SCHEDULE = {
    "monday": {"open": "08:00", "close": "21:00"},
    "tuesday": {"open": "08:00", "close": "21:00"},
    "wednesday": {"open": "08:00", "close": "21:00"},
    "thursday": {"open": "08:00", "close": "21:00"},
    "friday": {"open": "08:00", "close": "21:00"},
    "saturday": {"open": "08:00", "close": "22:00"},
    "sunday": {"open": "10:00", "close": "20:00"},
}

class LotteryCreate(BaseModel):
    name: str
    country: str
    lottery_type: LotteryType
    min_number: int = 0
    max_number: int = 99
    numbers_to_pick: int = 1
    price: float = 20.0
    currency: Currency = Currency.RD
    prize_multiplier: float = 70.0
    schedule: List[str] = ["12:00", "15:00", "21:00"]
    closing_minutes_before: int = 15
    active: bool = True
    prize_rules: Optional[List[Dict]] = None  # Position-based prizes
    allows_combined: bool = False  # For combined pale/tripleta
    # Simple daily hours (backward compatible)
    opening_time: Optional[str] = "08:00"
    closing_time: Optional[str] = "21:00"
    # Weekly schedule (different hours per day)
    weekly_hours: Optional[Dict[str, Dict[str, str]]] = None  # {"monday": {"open": "08:00", "close": "21:00"}, ...}
    # Holidays with special hours or closed
    # Format: [{"date": "2026-12-25", "closed": true, "name": "Navidad"}, {"date": "2026-02-27", "open": "10:00", "close": "18:00", "name": "Independencia"}]
    holidays: Optional[List[Dict]] = None
    # Ticket limit per number (global, regardless of date). None or 0 = unlimited
    ticket_limit_per_number: Optional[int] = None

class LotteryUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    prize_multiplier: Optional[float] = None
    schedule: Optional[List[str]] = None
    closing_minutes_before: Optional[int] = None
    active: Optional[bool] = None
    prize_rules: Optional[List[Dict]] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    weekly_hours: Optional[Dict[str, Dict[str, str]]] = None
    holidays: Optional[List[Dict]] = None
    ticket_limit_per_number: Optional[int] = None

class TicketCreate(BaseModel):
    lottery_id: str
    numbers: List[int]
    amount: float
    currency: Currency = Currency.RD
    customer_name: Optional[str] = None
    position: Optional[str] = None  # For position-based bets: primera, segunda, tercera
    is_combined: bool = False  # For combined pale across draws

# Model for a single play within a multi-play ticket
class PlayItem(BaseModel):
    lottery_type: str  # quiniela, pale, tripleta, etc.
    numbers: List[int]
    amount: float
    position: Optional[str] = None  # primera, segunda, tercera

# Model for creating a multi-play ticket
class MultiPlayTicketCreate(BaseModel):
    plays: List[PlayItem]
    customer_name: Optional[str] = None
    currency: Currency = Currency.RD

class TicketResponse(BaseModel):
    id: str
    ticket_number: str
    lottery_id: str
    lottery_name: str
    seller_id: str
    seller_name: str
    numbers: List[int]
    amount: float
    currency: Currency
    potential_win: float
    status: TicketStatus
    customer_name: Optional[str] = None
    position: Optional[str] = None
    is_combined: bool = False
    created_at: datetime
    draw_id: Optional[str] = None
    paid_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

class FavoriteNumbers(BaseModel):
    name: str
    lottery_id: str
    numbers: List[int]

class DrawCreate(BaseModel):
    lottery_id: str
    position: Optional[str] = None  # For position-based draws
    winning_numbers: Optional[List[int]] = None  # Manual winning numbers input

class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    type: str  # "draw_result", "winner", "system"

# ==================== HELPERS ====================
def serialize_doc(doc, exclude_fields=None):
    """Serialize MongoDB documents, excluding sensitive fields"""
    if exclude_fields is None:
        exclude_fields = ['_id', 'password']  # Default sensitive fields to exclude
    
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d, exclude_fields) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            # Skip excluded fields
            if key in exclude_fields:
                continue
            if isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, dict):
                result[key] = serialize_doc(value, exclude_fields)
            elif isinstance(value, list):
                result[key] = serialize_doc(value, exclude_fields)
            else:
                result[key] = value
        return result
    return doc
    return doc

def generate_ticket_number():
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_part = str(random.randint(1000, 9999))
    return f"TKT-{timestamp}-{random_part}"

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

def require_role(allowed_roles: List[UserRole]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in [r.value for r in allowed_roles]:
            raise HTTPException(status_code=403, detail="No tienes permisos para esta acción")
        return user
    return role_checker

def parse_time_string(time_str: str) -> tuple:
    """
    Parse time string in various formats to (hour, minute).
    Supports: "08:00", "8:00", "08:00pm", "8:00 PM", etc.
    Returns (None, None) if parsing fails.
    """
    if not time_str:
        return None, None
    
    time_str = time_str.strip().lower()
    
    # Check for AM/PM format
    is_pm = 'pm' in time_str
    is_am = 'am' in time_str
    
    # Remove am/pm
    time_str = time_str.replace('pm', '').replace('am', '').strip()
    
    try:
        if ':' in time_str:
            parts = time_str.split(':')
            hour = int(parts[0].strip())
            minute = int(parts[1].strip()) if len(parts) > 1 else 0
        else:
            # Just a number
            hour = int(time_str)
            minute = 0
        
        # Apply AM/PM conversion
        if is_pm and hour < 12:
            hour += 12
        elif is_am and hour == 12:
            hour = 0
        
        return hour, minute
    except (ValueError, IndexError):
        return None, None

def check_lottery_open(lottery: dict) -> tuple:
    """
    Check if lottery is currently open for sales.
    Returns: (is_open, next_draw, message, today_hours, holiday_info)
    
    A lottery is CLOSED if:
    1. Today is a holiday marked as closed
    2. Current time is before opening_time for this day
    3. Current time is after closing_time for this day
    4. Current time is within closing_minutes_before a draw
    
    Supports:
    - weekly_hours for different hours per day of the week
    - holidays for special days (closed or special hours)
    """
    from datetime import timezone
    now = datetime.now(timezone.utc)
    # Convert to local time (assuming DR timezone UTC-4)
    local_now = now.replace(tzinfo=None) - timedelta(hours=4)
    
    # Get day of week (monday=0, sunday=6)
    day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    current_day = day_names[local_now.weekday()]
    today_date = local_now.strftime("%Y-%m-%d")
    
    closing_minutes = lottery.get("closing_minutes_before", 15)
    schedule = lottery.get("schedule", [])
    weekly_hours = lottery.get("weekly_hours")
    holidays = lottery.get("holidays", [])
    
    # Save original/default opening time for tomorrow's message (in case today is holiday)
    default_opening_time = lottery.get("opening_time", "08:00")
    
    is_open = True
    next_draw = None
    message = None
    holiday_info = None
    
    # Check if today is a holiday
    for holiday in holidays:
        if holiday.get("date") == today_date:
            holiday_info = holiday
            if holiday.get("closed", False):
                # Lottery is closed for the holiday
                is_open = False
                holiday_name = holiday.get("name", "Día festivo")
                message = f"🎉 Cerrada por {holiday_name}"
                today_hours = {"open": None, "close": None, "day": current_day, "holiday": holiday_name, "closed": True}
                return is_open, next_draw, message, today_hours, holiday_info
            else:
                # Special hours for holiday
                opening_time = holiday.get("open", "10:00")
                closing_time_daily = holiday.get("close", "18:00")
                break
    else:
        # Not a holiday - use weekly_hours or default
        if weekly_hours and current_day in weekly_hours:
            day_schedule = weekly_hours[current_day]
            opening_time = day_schedule.get("open", "08:00")
            closing_time_daily = day_schedule.get("close", "21:00")
        else:
            # Fallback to simple daily times
            opening_time = lottery.get("opening_time", "08:00")
            closing_time_daily = lottery.get("closing_time", "21:00")
    
    today_hours = {
        "open": opening_time, 
        "close": closing_time_daily, 
        "day": current_day,
        "holiday": holiday_info.get("name") if holiday_info else None
    }
    
    # Check daily opening/closing time
    if opening_time:
        open_hour, open_minute = parse_time_string(opening_time)
        if open_hour is not None:
            opening_datetime = local_now.replace(hour=open_hour, minute=open_minute, second=0, microsecond=0)
            if local_now < opening_datetime:
                is_open = False
                if holiday_info:
                    message = f"🎉 {holiday_info.get('name', 'Festivo')} - Abre a las {opening_time}"
                else:
                    message = f"Abre hoy a las {opening_time}"
    
    if closing_time_daily and is_open:
        close_hour, close_minute = parse_time_string(closing_time_daily)
        if close_hour is not None:
            closing_datetime = local_now.replace(hour=close_hour, minute=close_minute, second=0, microsecond=0)
            if local_now > closing_datetime:
                is_open = False
                # Check if tomorrow is a holiday
                tomorrow_date = (local_now + timedelta(days=1)).strftime("%Y-%m-%d")
                tomorrow_day = day_names[(local_now.weekday() + 1) % 7]
                tomorrow_holiday = None
                
                for holiday in holidays:
                    if holiday.get("date") == tomorrow_date:
                        tomorrow_holiday = holiday
                        break
                
                if tomorrow_holiday:
                    if tomorrow_holiday.get("closed", False):
                        message = f"Cerrada. Mañana cerrado por {tomorrow_holiday.get('name', 'festivo')}"
                    else:
                        tomorrow_open = tomorrow_holiday.get("open", "10:00")
                        message = f"Cerrada. Mañana ({tomorrow_holiday.get('name', 'festivo')}) abre a las {tomorrow_open}"
                else:
                    if weekly_hours and tomorrow_day in weekly_hours:
                        tomorrow_open = weekly_hours[tomorrow_day].get("open", "08:00")
                    else:
                        # Use default opening time, not today's (which might be holiday's special hours)
                        tomorrow_open = default_opening_time
                    message = f"Cerrada. Abre mañana ({tomorrow_day[:3]}) a las {tomorrow_open}"
    
    # Check draw-specific closing (if still open)
    if is_open and schedule:
        for draw_time in sorted(schedule):
            draw_hour, draw_minute = parse_time_string(draw_time)
            if draw_hour is None:
                continue
            draw_datetime = local_now.replace(hour=draw_hour, minute=draw_minute, second=0, microsecond=0)
            closing_before_draw = draw_datetime - timedelta(minutes=closing_minutes)
            
            if local_now < draw_datetime:
                next_draw = draw_time
                if local_now >= closing_before_draw:
                    is_open = False
                    message = f"Cerrada para sorteo {draw_time}. Reabre después del sorteo."
                break
    
    return is_open, next_draw, message, today_hours, holiday_info

def calculate_prize(ticket: dict, lottery: dict, winning_numbers: List[int], position: str = None) -> float:
    """Calculate prize based on lottery rules and position"""
    prize_rules = lottery.get("prize_rules", [])
    ticket_numbers = ticket["numbers"]
    ticket_position = ticket.get("position")
    
    # If lottery has position-based prizes
    if prize_rules and position:
        for rule in prize_rules:
            if rule.get("position") == position or rule.get("position") == "any":
                if ticket_numbers == winning_numbers:
                    return ticket["amount"] * rule.get("multiplier", lottery["prize_multiplier"])
    
    # Standard prize calculation
    if lottery["lottery_type"] in [LotteryType.QUINIELA.value, LotteryType.PEGA3.value, LotteryType.PEGA4.value]:
        if ticket_numbers == winning_numbers:
            # Check if ticket bet on specific position
            if ticket_position and position:
                if ticket_position == position:
                    return ticket["amount"] * lottery["prize_multiplier"]
            else:
                return ticket["amount"] * lottery["prize_multiplier"]
    else:
        # For loto-style games
        matches = len(set(ticket_numbers).intersection(set(winning_numbers)))
        if matches == lottery["numbers_to_pick"]:
            return ticket["amount"] * lottery["prize_multiplier"]
    
    return 0

# ==================== AUTH ROUTES ====================
@api_router.post("/auth/register")
async def register(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
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
    
    user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role.value,
        "credit_limit": user_data.credit_limit,
        "balance": 0.0,
        "commission_rate": user_data.commission_rate,
        "currency": user_data.currency.value,
        "created_by": current_user["id"],
        "created_at": datetime.utcnow(),
        "active": True,
        "total_sales": 0.0,
        "total_commission": 0.0,
        "last_activity": datetime.utcnow(),
        "notification_token": None,
        # New fields
        "phone": user_data.phone,
        "address": user_data.address,
        "cedula": user_data.cedula
    }
    await db.users.insert_one(user)
    return {"message": "Usuario creado exitosamente", "user_id": user["id"]}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not user.get("active", True):
        raise HTTPException(status_code=401, detail="Usuario desactivado")
    
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_activity": datetime.utcnow()}})
    
    token = create_token(user["id"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "credit_limit": user["credit_limit"],
            "balance": user["balance"],
            "commission_rate": user.get("commission_rate", 10.0),
            "currency": user["currency"]
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "role": current_user["role"],
        "credit_limit": current_user["credit_limit"],
        "balance": current_user["balance"],
        "commission_rate": current_user.get("commission_rate", 10.0),
        "currency": current_user["currency"],
        "total_sales": current_user.get("total_sales", 0.0),
        "total_commission": current_user.get("total_commission", 0.0)
    }

# ==================== USER MANAGEMENT ====================
@api_router.get("/users")
async def get_users(current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    query = {}
    if current_user["role"] == UserRole.ADMIN.value:
        query["created_by"] = current_user["id"]
    
    users = await db.users.find(query).to_list(1000)
    return serialize_doc(users)

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_doc(user)

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, update: UserUpdate, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if current_user["role"] == UserRole.ADMIN.value and user.get("created_by") != current_user["id"]:
        raise HTTPException(status_code=403, detail="No puedes modificar este usuario")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    return {"message": "Usuario actualizado"}

@api_router.post("/users/{user_id}/deposit")
async def deposit_balance(user_id: str, amount: float = Query(...), current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    new_balance = user["balance"] + amount
    await db.users.update_one({"id": user_id}, {"$set": {"balance": new_balance}})
    
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user["name"],
        "transaction_type": TransactionType.DEPOSIT.value,
        "amount": amount,
        "currency": user["currency"],
        "description": f"Depósito de saldo por {current_user['name']}",
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(transaction)
    
    return {"message": "Depósito realizado", "new_balance": new_balance}

@api_router.post("/users/{user_id}/notification-token")
async def update_notification_token(user_id: str, token: str, current_user: dict = Depends(get_current_user)):
    """Update user's push notification token"""
    await db.users.update_one({"id": user_id}, {"$set": {"notification_token": token}})
    return {"message": "Token actualizado"}

# ==================== FAVORITE NUMBERS ====================
@api_router.post("/favorites")
async def add_favorite(favorite: FavoriteNumbers, current_user: dict = Depends(get_current_user)):
    """Add favorite numbers combination"""
    fav_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "name": favorite.name,
        "lottery_id": favorite.lottery_id,
        "numbers": favorite.numbers,
        "created_at": datetime.utcnow(),
        "use_count": 0
    }
    await db.favorites.insert_one(fav_doc)
    return {"message": "Favorito guardado", "id": fav_doc["id"]}

@api_router.get("/favorites")
async def get_favorites(lottery_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get user's favorite numbers"""
    query = {"user_id": current_user["id"]}
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    favorites = await db.favorites.find(query).sort("use_count", -1).to_list(100)
    return serialize_doc(favorites)

@api_router.delete("/favorites/{favorite_id}")
async def delete_favorite(favorite_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a favorite"""
    result = await db.favorites.delete_one({"id": favorite_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorito no encontrado")
    return {"message": "Favorito eliminado"}

@api_router.post("/favorites/{favorite_id}/use")
async def use_favorite(favorite_id: str, current_user: dict = Depends(get_current_user)):
    """Increment use count for a favorite"""
    await db.favorites.update_one(
        {"id": favorite_id, "user_id": current_user["id"]},
        {"$inc": {"use_count": 1}}
    )
    return {"message": "Uso registrado"}

# ==================== LOTTERY MANAGEMENT ====================
@api_router.post("/lotteries")
async def create_lottery(lottery: LotteryCreate, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    lottery_doc = {
        "id": str(uuid.uuid4()),
        "name": lottery.name,
        "country": lottery.country,
        "lottery_type": lottery.lottery_type.value,
        "min_number": lottery.min_number,
        "max_number": lottery.max_number,
        "numbers_to_pick": lottery.numbers_to_pick,
        "price": lottery.price,
        "currency": lottery.currency.value,
        "prize_multiplier": lottery.prize_multiplier,
        "schedule": lottery.schedule,
        "closing_minutes_before": lottery.closing_minutes_before,
        "active": lottery.active,
        "prize_rules": lottery.prize_rules or [],
        "allows_combined": lottery.allows_combined,
        "opening_time": lottery.opening_time,
        "closing_time": lottery.closing_time,
        "weekly_hours": lottery.weekly_hours or DEFAULT_WEEKLY_SCHEDULE,
        "holidays": lottery.holidays or [],
        "ticket_limit_per_number": lottery.ticket_limit_per_number,
        "created_at": datetime.utcnow()
    }
    await db.lotteries.insert_one(lottery_doc)
    return {"message": "Lotería creada", "lottery_id": lottery_doc["id"]}

@api_router.get("/lotteries")
async def get_lotteries(active_only: bool = True, country: Optional[str] = None):
    query = {}
    if active_only:
        query["active"] = True
    if country:
        query["country"] = country
    
    lotteries = await db.lotteries.find(query).to_list(100)
    
    result = []
    for l in lotteries:
        is_open, next_draw, closed_message, today_hours, holiday_info = check_lottery_open(l)
        result.append({
            **serialize_doc(l),
            "is_open": is_open,
            "next_draw_time": next_draw,
            "closed_message": closed_message,
            "today_hours": today_hours,
            "is_holiday": holiday_info is not None,
            "holiday_name": holiday_info.get("name") if holiday_info else None
        })
    
    return result

@api_router.get("/lotteries/{lottery_id}")
async def get_lottery(lottery_id: str):
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    is_open, next_draw, closed_message, today_hours, holiday_info = check_lottery_open(lottery)
    return {
        **serialize_doc(lottery), 
        "is_open": is_open, 
        "next_draw_time": next_draw, 
        "closed_message": closed_message, 
        "today_hours": today_hours,
        "is_holiday": holiday_info is not None,
        "holiday_name": holiday_info.get("name") if holiday_info else None
    }

@api_router.put("/lotteries/{lottery_id}")
async def update_lottery(lottery_id: str, update: LotteryUpdate, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        await db.lotteries.update_one({"id": lottery_id}, {"$set": update_data})
    return {"message": "Lotería actualizada"}

# Holidays management endpoints
@api_router.post("/lotteries/{lottery_id}/holidays")
async def add_holiday(lottery_id: str, holiday: dict, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Add a holiday to a lottery. Holiday format: {"date": "2026-12-25", "name": "Navidad", "closed": true} or {"date": "2026-02-27", "name": "Independencia", "open": "10:00", "close": "18:00"}"""
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    # Validate holiday format
    if "date" not in holiday or "name" not in holiday:
        raise HTTPException(status_code=400, detail="El festivo debe tener 'date' (YYYY-MM-DD) y 'name'")
    
    holidays = lottery.get("holidays", [])
    # Check if holiday already exists for this date
    for h in holidays:
        if h["date"] == holiday["date"]:
            raise HTTPException(status_code=400, detail=f"Ya existe un festivo para la fecha {holiday['date']}")
    
    holidays.append(holiday)
    await db.lotteries.update_one({"id": lottery_id}, {"$set": {"holidays": holidays}})
    return {"message": f"Festivo '{holiday['name']}' agregado", "holidays": holidays}

@api_router.delete("/lotteries/{lottery_id}/holidays/{date}")
async def remove_holiday(lottery_id: str, date: str, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Remove a holiday from a lottery by date (format: YYYY-MM-DD)"""
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    holidays = lottery.get("holidays", [])
    new_holidays = [h for h in holidays if h["date"] != date]
    
    if len(new_holidays) == len(holidays):
        raise HTTPException(status_code=404, detail=f"No se encontró festivo para la fecha {date}")
    
    await db.lotteries.update_one({"id": lottery_id}, {"$set": {"holidays": new_holidays}})
    return {"message": f"Festivo eliminado para {date}", "holidays": new_holidays}

@api_router.get("/lotteries/{lottery_id}/holidays")
async def get_holidays(lottery_id: str):
    """Get all holidays for a lottery"""
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    return lottery.get("holidays", [])

@api_router.get("/lotteries/{lottery_id}/number-stats")
async def get_lottery_number_stats(lottery_id: str, current_user: dict = Depends(get_current_user)):
    """Get statistics of how many tickets have been sold per number for a lottery (for limit tracking)"""
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    ticket_limit = lottery.get("ticket_limit_per_number")
    
    # Aggregate to count tickets per number
    pipeline = [
        {"$match": {"lottery_id": lottery_id, "status": {"$ne": TicketStatus.CANCELLED.value}}},
        {"$unwind": "$numbers"},
        {"$group": {"_id": "$numbers", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    number_counts = await db.tickets.aggregate(pipeline).to_list(200)
    
    # Format response
    stats = []
    blocked_numbers = []
    for item in number_counts:
        num = item["_id"]
        count = item["count"]
        is_blocked = ticket_limit and ticket_limit > 0 and count >= ticket_limit
        stats.append({
            "number": num,
            "sold_count": count,
            "limit": ticket_limit,
            "remaining": (ticket_limit - count) if ticket_limit else None,
            "is_blocked": is_blocked
        })
        if is_blocked:
            blocked_numbers.append(num)
    
    return {
        "lottery_id": lottery_id,
        "lottery_name": lottery["name"],
        "ticket_limit_per_number": ticket_limit,
        "number_stats": stats,
        "blocked_numbers": blocked_numbers,
        "total_numbers_with_sales": len(stats)
    }

# ==================== TICKET SALES ====================
@api_router.post("/tickets")
async def create_ticket(ticket: TicketCreate, current_user: dict = Depends(get_current_user)):
    lottery = await db.lotteries.find_one({"id": ticket.lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    if not lottery.get("active", True):
        raise HTTPException(status_code=400, detail="Lotería no activa")
    
    is_open, next_draw, closed_message, today_hours, holiday_info = check_lottery_open(lottery)
    if not is_open:
        error_msg = closed_message or f"La lotería está cerrada. Próximo sorteo: {next_draw}"
        raise HTTPException(status_code=400, detail=error_msg)
    
    for num in ticket.numbers:
        if num < lottery["min_number"] or num > lottery["max_number"]:
            raise HTTPException(status_code=400, detail=f"Número {num} fuera de rango")
    
    if len(ticket.numbers) != lottery["numbers_to_pick"]:
        raise HTTPException(status_code=400, detail=f"Debe seleccionar {lottery['numbers_to_pick']} números")
    
    # Check ticket limit per number (global)
    ticket_limit = lottery.get("ticket_limit_per_number")
    limit_warnings = []  # Track numbers near limit
    if ticket_limit and ticket_limit > 0:
        for num in ticket.numbers:
            # Count how many non-cancelled tickets have been sold with this number for this lottery
            sold_count = await db.tickets.count_documents({
                "lottery_id": ticket.lottery_id,
                "numbers": num,
                "status": {"$ne": TicketStatus.CANCELLED.value}
            })
            if sold_count >= ticket_limit:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Límite alcanzado: El número {num} ya tiene {sold_count} boletos vendidos (máximo: {ticket_limit})"
                )
            # Check if number is near limit (80% or more) - will be at this level after this sale
            new_count = sold_count + 1
            if new_count >= ticket_limit * 0.8:
                remaining = ticket_limit - new_count
                limit_warnings.append({
                    "number": num,
                    "sold": new_count,
                    "limit": ticket_limit,
                    "remaining": remaining
                })
    
    # Check credit limit
    if current_user["role"] == UserRole.VENDEDOR.value:
        today_sales = await db.tickets.aggregate([
            {"$match": {
                "seller_id": current_user["id"],
                "created_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0)},
                "status": {"$ne": TicketStatus.CANCELLED.value}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        current_sales = today_sales[0]["total"] if today_sales else 0
        if current_sales + ticket.amount > current_user["credit_limit"]:
            raise HTTPException(status_code=400, detail="Límite de crédito excedido")
    
    # Calculate potential win based on position if applicable
    potential_win = ticket.amount * lottery["prize_multiplier"]
    if ticket.position and lottery.get("prize_rules"):
        for rule in lottery["prize_rules"]:
            if rule.get("position") == ticket.position:
                potential_win = ticket.amount * rule.get("multiplier", lottery["prize_multiplier"])
                break
    
    ticket_doc = {
        "id": str(uuid.uuid4()),
        "ticket_number": generate_ticket_number(),
        "lottery_id": ticket.lottery_id,
        "lottery_name": lottery["name"],
        "seller_id": current_user["id"],
        "seller_name": current_user["name"],
        "numbers": ticket.numbers,
        "amount": ticket.amount,
        "currency": ticket.currency.value,
        "potential_win": potential_win,
        "status": TicketStatus.PENDING.value,
        "customer_name": ticket.customer_name,
        "position": ticket.position,
        "is_combined": ticket.is_combined,
        "created_at": datetime.utcnow(),
        "draw_id": None,
        "paid_at": None,
        "cancelled_at": None
    }
    await db.tickets.insert_one(ticket_doc)
    
    # Update seller stats and commission
    commission_rate = current_user.get("commission_rate", 10.0)
    commission = ticket.amount * (commission_rate / 100)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {"total_sales": ticket.amount, "total_commission": commission, "balance": commission},
            "$set": {"last_activity": datetime.utcnow()}
        }
    )
    
    # Record transactions
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "transaction_type": TransactionType.SALE.value,
        "amount": ticket.amount,
        "currency": ticket.currency.value,
        "description": f"Venta de boleto {lottery['name']} - {ticket.numbers}",
        "reference_id": ticket_doc["id"],
        "created_at": datetime.utcnow()
    })
    
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "transaction_type": TransactionType.COMMISSION.value,
        "amount": commission,
        "currency": ticket.currency.value,
        "description": f"Comisión {commission_rate}% de venta {ticket_doc['ticket_number']}",
        "reference_id": ticket_doc["id"],
        "created_at": datetime.utcnow()
    })
    
    # Build response with limit warnings if any
    response = {**serialize_doc(ticket_doc), "commission_earned": commission}
    if limit_warnings:
        response["limit_warnings"] = limit_warnings
        # Generate warning message
        warnings_msg = []
        for w in limit_warnings:
            if w["remaining"] == 0:
                warnings_msg.append(f"Número {w['number']}: LÍMITE ALCANZADO ({w['sold']}/{w['limit']})")
            else:
                warnings_msg.append(f"Número {w['number']}: quedan {w['remaining']} de {w['limit']}")
        response["limit_warning_message"] = " | ".join(warnings_msg)
    
    return response

@api_router.post("/tickets/multi")
async def create_multi_play_ticket(ticket_data: MultiPlayTicketCreate, current_user: dict = Depends(get_current_user)):
    """Create a single ticket with multiple plays (quiniela, pale, tripleta, etc.)"""
    if not ticket_data.plays or len(ticket_data.plays) == 0:
        raise HTTPException(status_code=400, detail="Debe incluir al menos una jugada")
    
    # Get all active lotteries to match play types
    all_lotteries = await db.lotteries.find({"active": True}).to_list(100)
    lottery_map = {l["lottery_type"]: l for l in all_lotteries}
    
    # Validate and calculate each play
    plays_data = []
    total_amount = 0
    total_potential_win = 0
    multi_play_limit_warnings = []  # Track numbers near limit across all plays
    
    for play in ticket_data.plays:
        # Find matching lottery for this play type
        lottery = lottery_map.get(play.lottery_type)
        if not lottery:
            # Try to find any lottery with this type
            lottery = next((l for l in all_lotteries if l["lottery_type"] == play.lottery_type), None)
        
        if not lottery:
            raise HTTPException(status_code=400, detail=f"Tipo de lotería '{play.lottery_type}' no encontrado")
        
        # Validate numbers based on lottery type
        expected_numbers = lottery.get("numbers_to_pick", 1)
        if play.lottery_type in ["quiniela", "quinieloto"]:
            expected_numbers = 1
        elif play.lottery_type in ["pale", "super_pale"]:
            expected_numbers = 2
        elif play.lottery_type == "tripleta":
            expected_numbers = 3
        
        if len(play.numbers) != expected_numbers:
            raise HTTPException(status_code=400, detail=f"El tipo {play.lottery_type} requiere {expected_numbers} número(s)")
        
        # Validate number range
        min_num = lottery.get("min_number", 0)
        max_num = lottery.get("max_number", 99)
        for num in play.numbers:
            if num < min_num or num > max_num:
                raise HTTPException(status_code=400, detail=f"Número {num} fuera de rango ({min_num}-{max_num})")
        
        # Check ticket limit per number (global) for multi-play
        ticket_limit = lottery.get("ticket_limit_per_number")
        if ticket_limit and ticket_limit > 0:
            for num in play.numbers:
                sold_count = await db.tickets.count_documents({
                    "lottery_id": lottery["id"],
                    "numbers": num,
                    "status": {"$ne": TicketStatus.CANCELLED.value}
                })
                if sold_count >= ticket_limit:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Límite alcanzado: El número {num} ya tiene {sold_count} boletos vendidos (máximo: {ticket_limit})"
                    )
                # Check if number is near limit (80% or more) after this sale
                new_count = sold_count + 1
                if new_count >= ticket_limit * 0.8:
                    remaining = ticket_limit - new_count
                    # Avoid duplicates in warnings
                    if not any(w["number"] == num and w["lottery_id"] == lottery["id"] for w in multi_play_limit_warnings):
                        multi_play_limit_warnings.append({
                            "number": num,
                            "lottery_id": lottery["id"],
                            "lottery_name": lottery["name"],
                            "sold": new_count,
                            "limit": ticket_limit,
                            "remaining": remaining
                        })
        
        # Calculate potential win for this play
        multiplier = lottery.get("prize_multiplier", 70)
        if play.position and lottery.get("prize_rules"):
            for rule in lottery["prize_rules"]:
                if rule.get("position") == play.position:
                    multiplier = rule.get("multiplier", multiplier)
                    break
        
        potential_win = play.amount * multiplier
        
        plays_data.append({
            "lottery_type": play.lottery_type,
            "lottery_name": lottery["name"],
            "lottery_id": lottery["id"],
            "numbers": play.numbers,
            "amount": play.amount,
            "position": play.position,
            "potential_win": potential_win,
            "multiplier": multiplier
        })
        
        total_amount += play.amount
        total_potential_win += potential_win
    
    # Check credit limit for vendors
    if current_user["role"] == UserRole.VENDEDOR.value:
        today_sales = await db.tickets.aggregate([
            {"$match": {
                "seller_id": current_user["id"],
                "created_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0)},
                "status": {"$ne": TicketStatus.CANCELLED.value}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        current_sales = today_sales[0]["total"] if today_sales else 0
        if current_sales + total_amount > current_user["credit_limit"]:
            raise HTTPException(status_code=400, detail="Límite de crédito excedido")
    
    # Create the multi-play ticket
    ticket_doc = {
        "id": str(uuid.uuid4()),
        "ticket_number": generate_ticket_number(),
        "ticket_type": "multi_play",
        "seller_id": current_user["id"],
        "seller_name": current_user["name"],
        "plays": plays_data,
        "plays_count": len(plays_data),
        "total_amount": total_amount,
        "total_potential_win": total_potential_win,
        "currency": ticket_data.currency.value,
        "status": TicketStatus.PENDING.value,
        "customer_name": ticket_data.customer_name,
        "created_at": datetime.utcnow(),
        "paid_at": None,
        "cancelled_at": None
    }
    
    await db.tickets.insert_one(ticket_doc)
    
    # Update seller stats and commission
    commission_rate = current_user.get("commission_rate", 10.0)
    commission = total_amount * (commission_rate / 100)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {"total_sales": total_amount, "total_commission": commission, "balance": commission},
            "$set": {"last_activity": datetime.utcnow()}
        }
    )
    
    # Record sale transaction
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "transaction_type": TransactionType.SALE.value,
        "amount": total_amount,
        "currency": ticket_data.currency.value,
        "description": f"Venta multi-jugada ({len(plays_data)} jugadas)",
        "reference_id": ticket_doc["id"],
        "created_at": datetime.utcnow()
    })
    
    # Record commission transaction
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "transaction_type": TransactionType.COMMISSION.value,
        "amount": commission,
        "currency": ticket_data.currency.value,
        "description": f"Comisión {commission_rate}% de multi-jugada {ticket_doc['ticket_number']}",
        "reference_id": ticket_doc["id"],
        "created_at": datetime.utcnow()
    })
    
    # Build response with limit warnings if any
    response = {**serialize_doc(ticket_doc), "commission_earned": commission}
    if multi_play_limit_warnings:
        response["limit_warnings"] = multi_play_limit_warnings
        # Generate warning message
        warnings_msg = []
        for w in multi_play_limit_warnings:
            if w["remaining"] == 0:
                warnings_msg.append(f"Número {w['number']}: LÍMITE ALCANZADO ({w['sold']}/{w['limit']})")
            else:
                warnings_msg.append(f"Número {w['number']}: quedan {w['remaining']} de {w['limit']}")
        response["limit_warning_message"] = " | ".join(warnings_msg)
    
    return response

@api_router.get("/tickets")
async def get_tickets(
    status: Optional[TicketStatus] = None,
    lottery_id: Optional[str] = None,
    seller_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if current_user["role"] == UserRole.VENDEDOR.value:
        query["seller_id"] = current_user["id"]
    elif current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        query["seller_id"] = {"$in": vendor_ids}
    
    if seller_id and current_user["role"] in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]:
        query["seller_id"] = seller_id
    if status:
        query["status"] = status.value
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    tickets = await db.tickets.find(query).sort("created_at", -1).to_list(500)
    return serialize_doc(tickets)

@api_router.get("/tickets/today")
async def get_today_tickets(current_user: dict = Depends(get_current_user)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    query = {"created_at": {"$gte": today_start}}
    
    if current_user["role"] == UserRole.VENDEDOR.value:
        query["seller_id"] = current_user["id"]
    elif current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        query["seller_id"] = {"$in": vendor_ids}
    
    tickets = await db.tickets.find(query).sort("created_at", -1).to_list(500)
    return serialize_doc(tickets)

@api_router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Boleto no encontrado")
    return serialize_doc(ticket)

@api_router.post("/tickets/{ticket_id}/cancel")
async def cancel_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Boleto no encontrado")
    
    if ticket["status"] != TicketStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Solo se pueden cancelar boletos pendientes")
    
    time_diff = datetime.utcnow() - ticket["created_at"]
    if time_diff.total_seconds() > 300:
        raise HTTPException(status_code=400, detail="Tiempo de cancelación expirado (máximo 5 minutos)")
    
    if current_user["role"] == UserRole.VENDEDOR.value and ticket["seller_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="No puedes cancelar este boleto")
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": TicketStatus.CANCELLED.value, "cancelled_at": datetime.utcnow()}}
    )
    
    seller = await db.users.find_one({"id": ticket["seller_id"]})
    commission_rate = seller.get("commission_rate", 10.0)
    commission = ticket["amount"] * (commission_rate / 100)
    
    await db.users.update_one(
        {"id": ticket["seller_id"]},
        {"$inc": {"total_sales": -ticket["amount"], "total_commission": -commission, "balance": -commission}}
    )
    
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": ticket["seller_id"],
        "user_name": ticket["seller_name"],
        "transaction_type": TransactionType.CANCELLATION.value,
        "amount": -ticket["amount"],
        "currency": ticket["currency"],
        "description": f"Cancelación de boleto {ticket['ticket_number']}",
        "reference_id": ticket_id,
        "created_at": datetime.utcnow()
    })
    
    return {"message": "Boleto cancelado", "ticket_number": ticket["ticket_number"]}

@api_router.post("/tickets/{ticket_id}/pay")
async def pay_winning_ticket(ticket_id: str, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDEDOR]))):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Boleto no encontrado")
    
    if ticket["status"] != TicketStatus.WON.value:
        raise HTTPException(status_code=400, detail="Este boleto no es ganador o ya fue pagado")
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": TicketStatus.PAID.value, "paid_at": datetime.utcnow()}}
    )
    
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "transaction_type": TransactionType.PAYMENT.value,
        "amount": ticket["potential_win"],
        "currency": ticket["currency"],
        "description": f"Pago de premio {ticket['ticket_number']} - {ticket['lottery_name']}",
        "reference_id": ticket_id,
        "created_at": datetime.utcnow()
    })
    
    return {
        "message": "Premio pagado",
        "ticket_number": ticket["ticket_number"],
        "amount_paid": ticket["potential_win"],
        "currency": ticket["currency"]
    }

# Endpoint for ticket scanner - verify ticket status
@api_router.get("/tickets/verify/{ticket_number}")
async def verify_ticket(ticket_number: str):
    """Public endpoint to verify ticket status by ticket number"""
    ticket = await db.tickets.find_one({"ticket_number": ticket_number})
    if not ticket:
        raise HTTPException(status_code=404, detail="Boleto no encontrado")
    
    # Get lottery info
    lottery = await db.lotteries.find_one({"id": ticket.get("lottery_id")})
    lottery_name = lottery["name"] if lottery else ticket.get("lottery_name", "N/A")
    
    # Return ticket verification info
    return {
        "ticket_number": ticket["ticket_number"],
        "status": ticket["status"],
        "is_winner": ticket["status"] in ["won", "paid"],
        "is_paid": ticket["status"] == "paid",
        "lottery_name": lottery_name,
        "numbers": ticket.get("numbers", []),
        "plays": ticket.get("plays", []),  # For multi-play tickets
        "amount": ticket.get("amount") or ticket.get("total_amount", 0),
        "potential_win": ticket.get("potential_win") or ticket.get("total_potential_win", 0),
        "currency": ticket.get("currency", "RD$"),
        "created_at": ticket["created_at"].isoformat(),
        "customer_name": ticket.get("customer_name"),
        "message": get_ticket_message(ticket["status"])
    }

def get_ticket_message(status: str) -> str:
    messages = {
        "won": "🎉 ¡BOLETO GANADOR! Presente este boleto para cobrar su premio.",
        "paid": "✅ Este boleto ya fue pagado.",
        "lost": "😔 Este boleto no resultó ganador.",
        "pending": "⏳ Sorteo pendiente. Espere los resultados.",
        "cancelled": "❌ Este boleto fue cancelado."
    }
    return messages.get(status, "Estado desconocido")

# ==================== DRAWS ====================
@api_router.post("/draws")
async def create_draw(draw_data: DrawCreate, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    lottery = await db.lotteries.find_one({"id": draw_data.lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    # Use manual winning numbers if provided, otherwise generate randomly
    if draw_data.winning_numbers and len(draw_data.winning_numbers) > 0:
        winning_numbers = draw_data.winning_numbers
        # Validate manual numbers
        if len(winning_numbers) != lottery["numbers_to_pick"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Debe ingresar exactamente {lottery['numbers_to_pick']} número(s)"
            )
        for num in winning_numbers:
            if num < lottery["min_number"] or num > lottery["max_number"]:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Número {num} fuera de rango ({lottery['min_number']}-{lottery['max_number']})"
                )
    else:
        winning_numbers = random.sample(
            range(lottery["min_number"], lottery["max_number"] + 1),
            lottery["numbers_to_pick"]
        )
    winning_numbers.sort()
    
    draw = {
        "id": str(uuid.uuid4()),
        "lottery_id": lottery["id"],
        "lottery_name": lottery["name"],
        "winning_numbers": winning_numbers,
        "position": draw_data.position,
        "draw_time": datetime.utcnow(),
        "total_tickets": 0,
        "total_winners": 0,
        "total_paid": 0.0,
        "currency": lottery["currency"],
        "is_manual": draw_data.winning_numbers is not None  # Flag if manual entry
    }
    
    # Find pending tickets
    ticket_query = {
        "lottery_id": lottery["id"],
        "status": TicketStatus.PENDING.value
    }
    
    # If position-based draw, only check tickets for that position or no position
    if draw_data.position:
        ticket_query["$or"] = [
            {"position": draw_data.position},
            {"position": None},
            {"position": {"$exists": False}}
        ]
    
    pending_tickets = await db.tickets.find(ticket_query).to_list(10000)
    
    total_winners = 0
    total_paid = 0.0
    winner_notifications = []
    
    for ticket in pending_tickets:
        prize = calculate_prize(ticket, lottery, winning_numbers, draw_data.position)
        
        if prize > 0:
            await db.tickets.update_one(
                {"id": ticket["id"]},
                {"$set": {"status": TicketStatus.WON.value, "draw_id": draw["id"], "potential_win": prize}}
            )
            total_winners += 1
            total_paid += prize
            
            await db.transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": ticket["seller_id"],
                "user_name": ticket["seller_name"],
                "transaction_type": TransactionType.WIN.value,
                "amount": prize,
                "currency": ticket["currency"],
                "description": f"Premio ganado - {lottery['name']} - {ticket['numbers']}",
                "reference_id": ticket["id"],
                "created_at": datetime.utcnow()
            })
            
            # Add to notification list
            winner_notifications.append({
                "user_id": ticket["seller_id"],
                "ticket_number": ticket["ticket_number"],
                "prize": prize
            })
        else:
            await db.tickets.update_one(
                {"id": ticket["id"]},
                {"$set": {"status": TicketStatus.LOST.value, "draw_id": draw["id"]}}
            )
    
    draw["total_tickets"] = len(pending_tickets)
    draw["total_winners"] = total_winners
    draw["total_paid"] = total_paid
    
    await db.draws.insert_one(draw)
    
    # Record number frequency
    for num in winning_numbers:
        await db.number_stats.update_one(
            {"lottery_id": lottery["id"], "number": num},
            {"$inc": {"frequency": 1}, "$set": {"last_drawn": datetime.utcnow()}},
            upsert=True
        )
    
    # Create notifications for draw result
    notification = {
        "id": str(uuid.uuid4()),
        "type": "draw_result",
        "lottery_id": lottery["id"],
        "lottery_name": lottery["name"],
        "winning_numbers": winning_numbers,
        "position": draw_data.position,
        "total_winners": total_winners,
        "created_at": datetime.utcnow(),
        "read_by": []
    }
    await db.notifications.insert_one(notification)
    
    # Create individual notifications for each winning seller
    for winner in winner_notifications:
        seller_notification = {
            "id": str(uuid.uuid4()),
            "type": "winner_alert",
            "user_id": winner["user_id"],  # Specific to this seller
            "lottery_id": lottery["id"],
            "lottery_name": lottery["name"],
            "ticket_number": winner["ticket_number"],
            "prize_amount": winner["prize"],
            "currency": lottery.get("currency", "RD$"),
            "message": f"🎉 ¡GANADOR! Boleto {winner['ticket_number']} ganó {lottery.get('currency', 'RD$')} {winner['prize']:,.2f}",
            "created_at": datetime.utcnow(),
            "read": False
        }
        await db.notifications.insert_one(seller_notification)
    
    return serialize_doc(draw)

@api_router.get("/draws")
async def get_draws(lottery_id: Optional[str] = None, limit: int = 50):
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    draws = await db.draws.find(query).sort("draw_time", -1).to_list(limit)
    return serialize_doc(draws)

@api_router.get("/draws/{draw_id}")
async def get_draw(draw_id: str):
    draw = await db.draws.find_one({"id": draw_id})
    if not draw:
        raise HTTPException(status_code=404, detail="Sorteo no encontrado")
    return serialize_doc(draw)

# ==================== NOTIFICATIONS ====================
@api_router.get("/notifications")
async def get_notifications(limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get recent notifications - includes both global and user-specific"""
    user_id = current_user["id"]
    
    # Get notifications that are either:
    # 1. Global (no user_id) - draw results
    # 2. Specific to this user - winner alerts
    query = {
        "$or": [
            {"user_id": {"$exists": False}},  # Global notifications
            {"user_id": user_id}  # User-specific notifications
        ]
    }
    
    notifications = await db.notifications.find(query).sort("created_at", -1).to_list(limit)
    
    # Mark which ones user has read
    for n in notifications:
        # For user-specific notifications, use the 'read' field
        if "user_id" in n:
            n["is_read"] = n.get("read", False)
        else:
            # For global notifications, check read_by array
            n["is_read"] = user_id in n.get("read_by", [])
    
    return serialize_doc(notifications)

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark notification as read"""
    # Try to update user-specific notification first
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    
    # If not a user-specific notification, update the read_by array
    if result.modified_count == 0:
        await db.notifications.update_one(
            {"id": notification_id},
            {"$addToSet": {"read_by": current_user["id"]}}
        )
    
    return {"message": "Notificación marcada como leída"}

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread notifications for this user"""
    user_id = current_user["id"]
    
    # Count global notifications not read by user
    global_unread = await db.notifications.count_documents({
        "user_id": {"$exists": False},
        "read_by": {"$ne": user_id}
    })
    
    # Count user-specific notifications not read
    user_unread = await db.notifications.count_documents({
        "user_id": user_id,
        "read": {"$ne": True}
    })
    
    return {"unread_count": global_unread + user_unread}

# ==================== STATISTICS ====================
@api_router.get("/stats/numbers/{lottery_id}")
async def get_number_stats(lottery_id: str):
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    stats = await db.number_stats.find({"lottery_id": lottery_id}).to_list(100)
    stats = serialize_doc(stats)
    
    if not stats:
        return {"hot_numbers": [], "cold_numbers": [], "all_stats": []}
    
    frequencies = [s.get("frequency", 0) for s in stats]
    if frequencies:
        avg_freq = sum(frequencies) / len(frequencies)
        hot_threshold = avg_freq * 1.3
        cold_threshold = avg_freq * 0.7
        
        hot_numbers = [s["number"] for s in stats if s.get("frequency", 0) > hot_threshold]
        cold_numbers = [s["number"] for s in stats if s.get("frequency", 0) < cold_threshold]
    else:
        hot_numbers = []
        cold_numbers = []
    
    return {
        "hot_numbers": hot_numbers[:10],
        "cold_numbers": cold_numbers[:10],
        "all_stats": stats
    }

# ==================== MONITORING ====================
@api_router.get("/monitoring/live")
async def get_live_monitoring(current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    if current_user["role"] == UserRole.SUPER_ADMIN.value:
        users = await db.users.find({"role": {"$in": [UserRole.ADMIN.value, UserRole.VENDEDOR.value]}}).to_list(1000)
    else:
        users = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
    
    monitoring_data = []
    total_commission = 0
    
    for user in users:
        tickets = await db.tickets.find({
            "seller_id": user["id"],
            "created_at": {"$gte": today_start}
        }).to_list(10000)
        
        # Calculate detailed stats
        valid_tickets = [t for t in tickets if t["status"] != TicketStatus.CANCELLED.value]
        today_sales = sum(t.get("amount", 0) for t in valid_tickets)
        today_wins = sum(t.get("potential_win", 0) for t in tickets if t["status"] in [TicketStatus.WON.value, TicketStatus.PAID.value])
        
        total_tickets = len(valid_tickets)
        pending_tickets = len([t for t in tickets if t["status"] == TicketStatus.PENDING.value])
        winning_tickets = len([t for t in tickets if t["status"] == TicketStatus.WON.value])
        paid_tickets = len([t for t in tickets if t["status"] == TicketStatus.PAID.value])
        
        # Calculate commission earned today
        commission_rate = user.get("commission_rate", 10.0)
        commission_earned = today_sales * (commission_rate / 100)
        total_commission += commission_earned
        
        # Calculate credit usage
        credit_limit = user.get("credit_limit", 999999999)
        credit_used = today_sales  # Simplified: credit used = today's sales
        
        monitoring_data.append({
            "user_id": user["id"],
            "user_name": user["name"],
            "role": user["role"],
            "today_sales": today_sales,
            "today_wins": today_wins,
            "today_profit": today_sales - today_wins,
            "total_tickets": total_tickets,
            "pending_tickets": pending_tickets,
            "winning_tickets": winning_tickets,
            "paid_tickets": paid_tickets,
            "active": user.get("active", True),
            "last_activity": user.get("last_activity"),
            "commission_rate": commission_rate,
            "commission_earned": commission_earned,
            "credit_limit": credit_limit,
            "credit_used": credit_used
        })
    
    monitoring_data.sort(key=lambda x: x["today_sales"], reverse=True)
    
    # Global stats
    total_sales = sum(m["today_sales"] for m in monitoring_data)
    total_wins = sum(m["today_wins"] for m in monitoring_data)
    total_tickets = sum(m["total_tickets"] for m in monitoring_data)
    
    return {
        "users": monitoring_data,
        "global_stats": {
            "total_sales": total_sales,
            "total_wins": total_wins,
            "total_profit": total_sales - total_wins,
            "total_tickets": total_tickets,
            "active_users": len([m for m in monitoring_data if m["active"]]),
            "total_commission": total_commission
        }
    }

@api_router.get("/monitoring/tickets")
async def get_tickets_monitoring(
    status: Optional[TicketStatus] = None,
    lottery_id: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    query = {"created_at": {"$gte": today_start}}
    
    if current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        query["seller_id"] = {"$in": vendor_ids}
    
    if status:
        query["status"] = status.value
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    tickets = await db.tickets.find(query).sort("created_at", -1).to_list(500)
    return serialize_doc(tickets)

# ==================== ACCOUNTING ====================
@api_router.get("/accounting/report")
async def get_accounting_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if not start_date:
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start = datetime.fromisoformat(start_date)
    
    if not end_date:
        end = datetime.utcnow()
    else:
        end = datetime.fromisoformat(end_date)
    
    user_filter = {}
    if current_user["role"] == UserRole.VENDEDOR.value:
        user_filter["user_id"] = current_user["id"]
    elif current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        user_filter["user_id"] = {"$in": vendor_ids}
    
    if user_id and current_user["role"] in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]:
        user_filter["user_id"] = user_id
    
    query = {**user_filter, "created_at": {"$gte": start, "$lte": end}}
    
    transactions = await db.transactions.find(query).sort("created_at", -1).to_list(10000)
    
    total_sales = sum(t["amount"] for t in transactions if t["transaction_type"] == TransactionType.SALE.value)
    total_wins = sum(t["amount"] for t in transactions if t["transaction_type"] == TransactionType.WIN.value)
    total_commission = sum(t["amount"] for t in transactions if t["transaction_type"] == TransactionType.COMMISSION.value)
    total_payments = sum(t["amount"] for t in transactions if t["transaction_type"] == TransactionType.PAYMENT.value)
    
    ticket_query = {"created_at": {"$gte": start, "$lte": end}}
    if current_user["role"] == UserRole.VENDEDOR.value:
        ticket_query["seller_id"] = current_user["id"]
    elif current_user["role"] == UserRole.ADMIN.value:
        ticket_query["seller_id"] = {"$in": vendor_ids}
    if user_id:
        ticket_query["seller_id"] = user_id
    
    tickets = await db.tickets.find(ticket_query).to_list(10000)
    tickets_sold = len([t for t in tickets if t["status"] != TicketStatus.CANCELLED.value])
    tickets_won = len([t for t in tickets if t["status"] in [TicketStatus.WON.value, TicketStatus.PAID.value]])
    tickets_cancelled = len([t for t in tickets if t["status"] == TicketStatus.CANCELLED.value])
    
    return {
        "period": f"{start.date()} - {end.date()}",
        "total_sales": total_sales,
        "total_wins": total_wins,
        "total_commission": total_commission,
        "total_payments": total_payments,
        "net_profit": total_sales - total_wins,
        "currency": current_user["currency"],
        "tickets_sold": tickets_sold,
        "tickets_won": tickets_won,
        "tickets_cancelled": tickets_cancelled,
        "transactions": serialize_doc(transactions[-100:])
    }

@api_router.get("/accounting/summary")
async def get_accounting_summary(current_user: dict = Depends(get_current_user)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    user_filter = {}
    if current_user["role"] == UserRole.VENDEDOR.value:
        user_filter["seller_id"] = current_user["id"]
    elif current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        user_filter["seller_id"] = {"$in": vendor_ids}
    
    def get_amount(ticket):
        """Get amount from ticket, handling both regular and multi-play tickets"""
        return ticket.get("amount", ticket.get("total_amount", 0))
    
    def get_potential_win(ticket):
        """Get potential win from ticket, handling both regular and multi-play tickets"""
        return ticket.get("potential_win", ticket.get("total_potential_win", 0))
    
    today_tickets = await db.tickets.find({**user_filter, "created_at": {"$gte": today}}).to_list(10000)
    today_sales = sum(get_amount(t) for t in today_tickets if t.get("status") != TicketStatus.CANCELLED.value)
    today_wins = sum(get_potential_win(t) for t in today_tickets if t.get("status") in [TicketStatus.WON.value, TicketStatus.PAID.value])
    
    week_tickets = await db.tickets.find({**user_filter, "created_at": {"$gte": week_ago}}).to_list(10000)
    week_sales = sum(get_amount(t) for t in week_tickets if t.get("status") != TicketStatus.CANCELLED.value)
    week_wins = sum(get_potential_win(t) for t in week_tickets if t.get("status") in [TicketStatus.WON.value, TicketStatus.PAID.value])
    
    month_tickets = await db.tickets.find({**user_filter, "created_at": {"$gte": month_ago}}).to_list(10000)
    month_sales = sum(get_amount(t) for t in month_tickets if t.get("status") != TicketStatus.CANCELLED.value)
    month_wins = sum(get_potential_win(t) for t in month_tickets if t.get("status") in [TicketStatus.WON.value, TicketStatus.PAID.value])
    
    return {
        "today": {"sales": today_sales, "wins": today_wins, "profit": today_sales - today_wins, "tickets": len([t for t in today_tickets if t.get("status") != TicketStatus.CANCELLED.value])},
        "week": {"sales": week_sales, "wins": week_wins, "profit": week_sales - week_wins, "tickets": len([t for t in week_tickets if t.get("status") != TicketStatus.CANCELLED.value])},
        "month": {"sales": month_sales, "wins": month_wins, "profit": month_sales - month_wins, "tickets": len([t for t in month_tickets if t.get("status") != TicketStatus.CANCELLED.value])},
        "currency": current_user.get("currency", "RD$")
    }

@api_router.get("/accounting/sellers-report")
async def get_sellers_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    if not start_date:
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start = datetime.fromisoformat(start_date)
    
    if not end_date:
        end = datetime.utcnow()
    else:
        end = datetime.fromisoformat(end_date)
    
    if current_user["role"] == UserRole.SUPER_ADMIN.value:
        sellers = await db.users.find({"role": UserRole.VENDEDOR.value}).to_list(1000)
    else:
        sellers = await db.users.find({"created_by": current_user["id"], "role": UserRole.VENDEDOR.value}).to_list(1000)
    
    reports = []
    
    for seller in sellers:
        tickets = await db.tickets.find({
            "seller_id": seller["id"],
            "created_at": {"$gte": start, "$lte": end}
        }).to_list(10000)
        
        total_sales = sum(t["amount"] for t in tickets if t["status"] != TicketStatus.CANCELLED.value)
        total_wins = sum(t["potential_win"] for t in tickets if t["status"] in [TicketStatus.WON.value, TicketStatus.PAID.value])
        tickets_sold = len([t for t in tickets if t["status"] != TicketStatus.CANCELLED.value])
        tickets_won = len([t for t in tickets if t["status"] in [TicketStatus.WON.value, TicketStatus.PAID.value]])
        
        commission_rate = seller.get("commission_rate", 10.0)
        total_commission = total_sales * (commission_rate / 100)
        
        reports.append({
            "seller_id": seller["id"],
            "seller_name": seller["name"],
            "total_sales": total_sales,
            "total_wins": total_wins,
            "total_commission": total_commission,
            "net_profit": total_sales - total_wins,
            "tickets_sold": tickets_sold,
            "tickets_won": tickets_won,
            "commission_rate": commission_rate,
            "currency": seller["currency"]
        })
    
    reports.sort(key=lambda x: x["total_sales"], reverse=True)
    
    return {
        "period": f"{start.date()} - {end.date()}",
        "sellers": reports,
        "totals": {
            "total_sales": sum(r["total_sales"] for r in reports),
            "total_wins": sum(r["total_wins"] for r in reports),
            "total_commission": sum(r["total_commission"] for r in reports),
            "net_profit": sum(r["net_profit"] for r in reports)
        }
    }

@api_router.get("/accounting/daily-chart")
async def get_daily_chart_data(days: int = 7, current_user: dict = Depends(get_current_user)):
    data = []
    
    user_filter = {}
    if current_user["role"] == UserRole.VENDEDOR.value:
        user_filter["seller_id"] = current_user["id"]
    elif current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        user_filter["seller_id"] = {"$in": vendor_ids}
    
    for i in range(days - 1, -1, -1):
        day_start = (datetime.utcnow() - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        tickets = await db.tickets.find({
            **user_filter,
            "created_at": {"$gte": day_start, "$lt": day_end}
        }).to_list(10000)
        
        sales = sum(t["amount"] for t in tickets if t["status"] != TicketStatus.CANCELLED.value)
        wins = sum(t["potential_win"] for t in tickets if t["status"] in [TicketStatus.WON.value, TicketStatus.PAID.value])
        
        data.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "label": day_start.strftime("%d/%m"),
            "sales": sales,
            "wins": wins,
            "profit": sales - wins
        })
    
    return data

# ==================== INITIALIZATION ====================
@api_router.post("/init/super-admin")
async def init_super_admin():
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
        
        # Real
        {"id": str(uuid.uuid4()), "name": "Real", "country": "RD", "lottery_type": LotteryType.QUINIELA.value,
         "min_number": 0, "max_number": 99, "numbers_to_pick": 1, "price": 20.0, "currency": Currency.RD.value,
         "prize_multiplier": 70.0, "schedule": ["12:30", "14:30", "18:00", "21:00"], "closing_minutes_before": 15,
         "active": True, "created_at": datetime.utcnow()},
        
        # New York (RD style)
        {"id": str(uuid.uuid4()), "name": "New York", "country": "RD", "lottery_type": LotteryType.QUINIELA.value,
         "min_number": 0, "max_number": 99, "numbers_to_pick": 1, "price": 20.0, "currency": Currency.RD.value,
         "prize_multiplier": 70.0, "schedule": ["14:30", "22:30"], "closing_minutes_before": 15,
         "active": True, "created_at": datetime.utcnow()},
        
        # USA Lotteries
        {"id": str(uuid.uuid4()), "name": "Powerball USA", "country": "USA", "lottery_type": LotteryType.POWERBALL.value,
         "min_number": 1, "max_number": 69, "numbers_to_pick": 5, "price": 2.0, "currency": Currency.USD.value,
         "prize_multiplier": 1000000.0, "schedule": ["22:59"], "closing_minutes_before": 60,
         "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Mega Millions USA", "country": "USA", "lottery_type": LotteryType.MEGA_MILLIONS.value,
         "min_number": 1, "max_number": 70, "numbers_to_pick": 5, "price": 2.0, "currency": Currency.USD.value,
         "prize_multiplier": 1000000.0, "schedule": ["23:00"], "closing_minutes_before": 60,
         "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "New York Lottery", "country": "USA", "lottery_type": LotteryType.PICK3.value,
         "min_number": 0, "max_number": 9, "numbers_to_pick": 3, "price": 1.0, "currency": Currency.USD.value,
         "prize_multiplier": 500.0, "schedule": ["14:30", "22:30"], "closing_minutes_before": 30,
         "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Florida Lottery", "country": "USA", "lottery_type": LotteryType.PICK4.value,
         "min_number": 0, "max_number": 9, "numbers_to_pick": 4, "price": 1.0, "currency": Currency.USD.value,
         "prize_multiplier": 5000.0, "schedule": ["13:30", "21:45"], "closing_minutes_before": 30,
         "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Cash4Life", "country": "USA", "lottery_type": LotteryType.CASH4LIFE.value,
         "min_number": 1, "max_number": 60, "numbers_to_pick": 5, "price": 2.0, "currency": Currency.USD.value,
         "prize_multiplier": 1000.0, "schedule": ["21:00"], "closing_minutes_before": 60,
         "active": True, "created_at": datetime.utcnow()},
        
        # Animalitos Venezuela/RD Style
        {"id": str(uuid.uuid4()), "name": "Animalitos La Granjita", "country": "RD", "lottery_type": LotteryType.ANIMALITOS.value,
         "min_number": 0, "max_number": 36, "numbers_to_pick": 1, "price": 20.0, "currency": Currency.RD.value,
         "prize_multiplier": 30.0, "schedule": ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"], 
         "closing_minutes_before": 5, "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Animalitos Lotto Activo", "country": "RD", "lottery_type": LotteryType.ANIMALITOS.value,
         "min_number": 0, "max_number": 36, "numbers_to_pick": 1, "price": 20.0, "currency": Currency.RD.value,
         "prize_multiplier": 30.0, "schedule": ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"],
         "closing_minutes_before": 5, "active": True, "created_at": datetime.utcnow()},
        
        {"id": str(uuid.uuid4()), "name": "Animalitos Triple", "country": "RD", "lottery_type": LotteryType.ANIMALITOS_TRIPLE.value,
         "min_number": 0, "max_number": 36, "numbers_to_pick": 3, "price": 25.0, "currency": Currency.RD.value,
         "prize_multiplier": 5000.0, "schedule": ["12:00", "19:00"],
         "closing_minutes_before": 10, "active": True, "created_at": datetime.utcnow()},
    ]
    
    for lottery in default_lotteries:
        await db.lotteries.insert_one(lottery)
    
    return {
        "message": "Sistema inicializado",
        "super_admin_email": "admin@loteria.com",
        "super_admin_password": "admin123",
        "lotteries_created": len(default_lotteries)
    }

@api_router.get("/")
async def root():
    return {"message": "Sistema de Lotería RD/USA API - Banca Completa v3", "version": "3.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
