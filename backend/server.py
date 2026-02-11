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
app = FastAPI(title="Sistema de Lotería RD/USA - Banca Completa")
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
    LOTO = "loto"
    SUPER_KINO = "super_kino"
    PEGA3 = "pega3"
    POWERBALL = "powerball"
    MEGA_MILLIONS = "mega_millions"

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

# ==================== MODELS ====================
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.VENDEDOR
    credit_limit: float = 10000.0
    commission_rate: float = 10.0  # Percentage of sales
    currency: Currency = Currency.RD

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
    created_by: Optional[str] = None
    created_at: datetime
    active: bool = True
    total_sales: float = 0.0
    total_commission: float = 0.0

class UserUpdate(BaseModel):
    name: Optional[str] = None
    credit_limit: Optional[float] = None
    commission_rate: Optional[float] = None
    active: Optional[bool] = None

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
    closing_minutes_before: int = 15  # Minutes before draw to close betting
    active: bool = True

class LotteryResponse(BaseModel):
    id: str
    name: str
    country: str
    lottery_type: LotteryType
    min_number: int
    max_number: int
    numbers_to_pick: int
    price: float
    currency: Currency
    prize_multiplier: float
    schedule: List[str]
    closing_minutes_before: int
    active: bool
    is_open: bool = True
    next_draw_time: Optional[str] = None
    created_at: datetime

class LotteryUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    prize_multiplier: Optional[float] = None
    schedule: Optional[List[str]] = None
    closing_minutes_before: Optional[int] = None
    active: Optional[bool] = None

class TicketCreate(BaseModel):
    lottery_id: str
    numbers: List[int]
    amount: float
    currency: Currency = Currency.RD
    customer_name: Optional[str] = None

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
    created_at: datetime
    draw_id: Optional[str] = None
    paid_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

class DrawCreate(BaseModel):
    lottery_id: str

class DrawResponse(BaseModel):
    id: str
    lottery_id: str
    lottery_name: str
    winning_numbers: List[int]
    draw_time: datetime
    total_tickets: int
    total_winners: int
    total_paid: float
    currency: Currency

class TransactionResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    transaction_type: TransactionType
    amount: float
    currency: Currency
    description: str
    reference_id: Optional[str] = None
    created_at: datetime

class SellerReport(BaseModel):
    seller_id: str
    seller_name: str
    total_sales: float
    total_wins: float
    total_commission: float
    net_profit: float
    tickets_sold: int
    tickets_won: int
    currency: str

class MonitoringData(BaseModel):
    user_id: str
    user_name: str
    role: str
    today_sales: float
    today_wins: float
    today_profit: float
    pending_tickets: int
    active: bool
    last_activity: Optional[datetime] = None

class SystemSettings(BaseModel):
    default_commission_rate: float = 10.0
    default_closing_minutes: int = 15
    allow_ticket_cancellation: bool = True
    cancellation_time_limit_minutes: int = 5

# ==================== HELPERS ====================
def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = serialize_doc(value)
            else:
                result[key] = value
        return result
    return doc

def generate_ticket_number():
    """Generate unique ticket number"""
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

def check_lottery_open(lottery: dict) -> tuple:
    """Check if lottery is open for betting"""
    now = datetime.utcnow()
    current_time = now.strftime("%H:%M")
    closing_minutes = lottery.get("closing_minutes_before", 15)
    
    schedule = lottery.get("schedule", [])
    is_open = True
    next_draw = None
    
    for draw_time in sorted(schedule):
        # Parse draw time
        draw_hour, draw_minute = map(int, draw_time.split(":"))
        draw_datetime = now.replace(hour=draw_hour, minute=draw_minute, second=0, microsecond=0)
        
        # Calculate closing time
        closing_datetime = draw_datetime - timedelta(minutes=closing_minutes)
        
        if now < draw_datetime:
            next_draw = draw_time
            if now >= closing_datetime:
                is_open = False
            break
    
    return is_open, next_draw

# ==================== AUTH ROUTES ====================
@api_router.post("/auth/register")
async def register(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    # Check permissions
    if current_user["role"] == UserRole.SUPER_ADMIN.value:
        if user_data.role not in [UserRole.ADMIN, UserRole.VENDEDOR]:
            raise HTTPException(status_code=400, detail="Super Admin solo puede crear Admin o Vendedor")
    elif current_user["role"] == UserRole.ADMIN.value:
        if user_data.role != UserRole.VENDEDOR:
            raise HTTPException(status_code=400, detail="Admin solo puede crear Vendedores")
    else:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear usuarios")
    
    # Check if email exists
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
        "last_activity": datetime.utcnow()
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
    
    # Update last activity
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
@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    query = {}
    if current_user["role"] == UserRole.ADMIN.value:
        query["created_by"] = current_user["id"]
    
    users = await db.users.find(query).to_list(1000)
    return [UserResponse(
        id=u["id"],
        email=u["email"],
        name=u["name"],
        role=u["role"],
        credit_limit=u["credit_limit"],
        balance=u["balance"],
        commission_rate=u.get("commission_rate", 10.0),
        currency=u["currency"],
        created_by=u.get("created_by"),
        created_at=u["created_at"],
        active=u.get("active", True),
        total_sales=u.get("total_sales", 0.0),
        total_commission=u.get("total_commission", 0.0)
    ) for u in users]

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Check permissions
    if current_user["role"] == UserRole.VENDEDOR.value and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        credit_limit=user["credit_limit"],
        balance=user["balance"],
        commission_rate=user.get("commission_rate", 10.0),
        currency=user["currency"],
        created_by=user.get("created_by"),
        created_at=user["created_at"],
        active=user.get("active", True),
        total_sales=user.get("total_sales", 0.0),
        total_commission=user.get("total_commission", 0.0)
    )

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
    
    # Record transaction
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
        "created_at": datetime.utcnow()
    }
    await db.lotteries.insert_one(lottery_doc)
    return {"message": "Lotería creada", "lottery_id": lottery_doc["id"]}

@api_router.get("/lotteries")
async def get_lotteries(active_only: bool = True):
    query = {"active": True} if active_only else {}
    lotteries = await db.lotteries.find(query).to_list(100)
    
    result = []
    for l in lotteries:
        is_open, next_draw = check_lottery_open(l)
        result.append({
            "id": l["id"],
            "name": l["name"],
            "country": l["country"],
            "lottery_type": l["lottery_type"],
            "min_number": l["min_number"],
            "max_number": l["max_number"],
            "numbers_to_pick": l["numbers_to_pick"],
            "price": l["price"],
            "currency": l["currency"],
            "prize_multiplier": l["prize_multiplier"],
            "schedule": l["schedule"],
            "closing_minutes_before": l.get("closing_minutes_before", 15),
            "active": l["active"],
            "is_open": is_open,
            "next_draw_time": next_draw,
            "created_at": l["created_at"]
        })
    
    return result

@api_router.get("/lotteries/{lottery_id}")
async def get_lottery(lottery_id: str):
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    is_open, next_draw = check_lottery_open(lottery)
    lottery["is_open"] = is_open
    lottery["next_draw_time"] = next_draw
    return serialize_doc(lottery)

@api_router.put("/lotteries/{lottery_id}")
async def update_lottery(lottery_id: str, update: LotteryUpdate, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        await db.lotteries.update_one({"id": lottery_id}, {"$set": update_data})
    return {"message": "Lotería actualizada"}

# ==================== TICKET SALES ====================
@api_router.post("/tickets")
async def create_ticket(ticket: TicketCreate, current_user: dict = Depends(get_current_user)):
    # Get lottery
    lottery = await db.lotteries.find_one({"id": ticket.lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    if not lottery.get("active", True):
        raise HTTPException(status_code=400, detail="Lotería no activa")
    
    # Check if lottery is open
    is_open, next_draw = check_lottery_open(lottery)
    if not is_open:
        raise HTTPException(status_code=400, detail=f"La lotería está cerrada. Próximo sorteo: {next_draw}")
    
    # Validate numbers
    for num in ticket.numbers:
        if num < lottery["min_number"] or num > lottery["max_number"]:
            raise HTTPException(status_code=400, detail=f"Número {num} fuera de rango")
    
    if len(ticket.numbers) != lottery["numbers_to_pick"]:
        raise HTTPException(status_code=400, detail=f"Debe seleccionar {lottery['numbers_to_pick']} números")
    
    # Check credit limit for vendedores
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
    
    potential_win = ticket.amount * lottery["prize_multiplier"]
    
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
        "created_at": datetime.utcnow(),
        "draw_id": None,
        "paid_at": None,
        "cancelled_at": None
    }
    await db.tickets.insert_one(ticket_doc)
    
    # Update seller stats
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {"total_sales": ticket.amount},
            "$set": {"last_activity": datetime.utcnow()}
        }
    )
    
    # Calculate and record commission
    commission_rate = current_user.get("commission_rate", 10.0)
    commission = ticket.amount * (commission_rate / 100)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"total_commission": commission, "balance": commission}}
    )
    
    # Record sale transaction
    sale_transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "transaction_type": TransactionType.SALE.value,
        "amount": ticket.amount,
        "currency": ticket.currency.value,
        "description": f"Venta de boleto {lottery['name']} - {ticket.numbers}",
        "reference_id": ticket_doc["id"],
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(sale_transaction)
    
    # Record commission transaction
    commission_transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "transaction_type": TransactionType.COMMISSION.value,
        "amount": commission,
        "currency": ticket.currency.value,
        "description": f"Comisión {commission_rate}% de venta {ticket_doc['ticket_number']}",
        "reference_id": ticket_doc["id"],
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(commission_transaction)
    
    return {
        **ticket_doc,
        "commission_earned": commission
    }

@api_router.get("/tickets")
async def get_tickets(
    status: Optional[TicketStatus] = None,
    lottery_id: Optional[str] = None,
    seller_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    # Filter by role
    if current_user["role"] == UserRole.VENDEDOR.value:
        query["seller_id"] = current_user["id"]
    elif current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        query["seller_id"] = {"$in": vendor_ids}
    
    # Additional filters
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
    
    # Check cancellation time limit (5 minutes)
    time_diff = datetime.utcnow() - ticket["created_at"]
    if time_diff.total_seconds() > 300:  # 5 minutes
        raise HTTPException(status_code=400, detail="Tiempo de cancelación expirado (máximo 5 minutos)")
    
    # Check permissions
    if current_user["role"] == UserRole.VENDEDOR.value and ticket["seller_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="No puedes cancelar este boleto")
    
    # Update ticket status
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": TicketStatus.CANCELLED.value, "cancelled_at": datetime.utcnow()}}
    )
    
    # Reverse commission
    seller = await db.users.find_one({"id": ticket["seller_id"]})
    commission_rate = seller.get("commission_rate", 10.0)
    commission = ticket["amount"] * (commission_rate / 100)
    
    await db.users.update_one(
        {"id": ticket["seller_id"]},
        {
            "$inc": {
                "total_sales": -ticket["amount"],
                "total_commission": -commission,
                "balance": -commission
            }
        }
    )
    
    # Record cancellation transaction
    cancellation_transaction = {
        "id": str(uuid.uuid4()),
        "user_id": ticket["seller_id"],
        "user_name": ticket["seller_name"],
        "transaction_type": TransactionType.CANCELLATION.value,
        "amount": -ticket["amount"],
        "currency": ticket["currency"],
        "description": f"Cancelación de boleto {ticket['ticket_number']}",
        "reference_id": ticket_id,
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(cancellation_transaction)
    
    return {"message": "Boleto cancelado", "ticket_number": ticket["ticket_number"]}

@api_router.post("/tickets/{ticket_id}/pay")
async def pay_winning_ticket(ticket_id: str, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDEDOR]))):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Boleto no encontrado")
    
    if ticket["status"] != TicketStatus.WON.value:
        raise HTTPException(status_code=400, detail="Este boleto no es ganador o ya fue pagado")
    
    # Update ticket status
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": TicketStatus.PAID.value, "paid_at": datetime.utcnow()}}
    )
    
    # Record payment transaction
    payment_transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "transaction_type": TransactionType.PAYMENT.value,
        "amount": ticket["potential_win"],
        "currency": ticket["currency"],
        "description": f"Pago de premio {ticket['ticket_number']} - {ticket['lottery_name']}",
        "reference_id": ticket_id,
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(payment_transaction)
    
    return {
        "message": "Premio pagado",
        "ticket_number": ticket["ticket_number"],
        "amount_paid": ticket["potential_win"],
        "currency": ticket["currency"]
    }

# ==================== DRAWS ====================
@api_router.post("/draws")
async def create_draw(draw_data: DrawCreate, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    lottery = await db.lotteries.find_one({"id": draw_data.lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    # Generate winning numbers
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
        "draw_time": datetime.utcnow(),
        "total_tickets": 0,
        "total_winners": 0,
        "total_paid": 0.0,
        "currency": lottery["currency"]
    }
    
    # Find pending tickets for this lottery
    pending_tickets = await db.tickets.find({
        "lottery_id": lottery["id"],
        "status": TicketStatus.PENDING.value
    }).to_list(10000)
    
    total_winners = 0
    total_paid = 0.0
    
    for ticket in pending_tickets:
        ticket_numbers = set(ticket["numbers"])
        winning_set = set(winning_numbers)
        
        # Check if ticket wins
        if lottery["lottery_type"] in [LotteryType.QUINIELA.value, LotteryType.PEGA3.value]:
            is_winner = ticket["numbers"] == winning_numbers
        else:
            matches = len(ticket_numbers.intersection(winning_set))
            is_winner = matches == lottery["numbers_to_pick"]
        
        if is_winner:
            await db.tickets.update_one(
                {"id": ticket["id"]},
                {"$set": {"status": TicketStatus.WON.value, "draw_id": draw["id"]}}
            )
            total_winners += 1
            total_paid += ticket["potential_win"]
            
            # Record win transaction
            win_transaction = {
                "id": str(uuid.uuid4()),
                "user_id": ticket["seller_id"],
                "user_name": ticket["seller_name"],
                "transaction_type": TransactionType.WIN.value,
                "amount": ticket["potential_win"],
                "currency": ticket["currency"],
                "description": f"Premio ganado - {lottery['name']} - {ticket['numbers']}",
                "reference_id": ticket["id"],
                "created_at": datetime.utcnow()
            }
            await db.transactions.insert_one(win_transaction)
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
            {
                "$inc": {"frequency": 1},
                "$set": {"last_drawn": datetime.utcnow()}
            },
            upsert=True
        )
    
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
    """Get real-time monitoring data for all sellers"""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get users based on role
    if current_user["role"] == UserRole.SUPER_ADMIN.value:
        users = await db.users.find({"role": {"$in": [UserRole.ADMIN.value, UserRole.VENDEDOR.value]}}).to_list(1000)
    else:
        users = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
    
    monitoring_data = []
    
    for user in users:
        # Get today's tickets
        tickets = await db.tickets.find({
            "seller_id": user["id"],
            "created_at": {"$gte": today_start}
        }).to_list(10000)
        
        today_sales = sum(t["amount"] for t in tickets if t["status"] != TicketStatus.CANCELLED.value)
        today_wins = sum(t["potential_win"] for t in tickets if t["status"] in [TicketStatus.WON.value, TicketStatus.PAID.value])
        pending_tickets = len([t for t in tickets if t["status"] == TicketStatus.PENDING.value])
        
        monitoring_data.append({
            "user_id": user["id"],
            "user_name": user["name"],
            "role": user["role"],
            "today_sales": today_sales,
            "today_wins": today_wins,
            "today_profit": today_sales - today_wins,
            "pending_tickets": pending_tickets,
            "active": user.get("active", True),
            "last_activity": user.get("last_activity"),
            "commission_rate": user.get("commission_rate", 10.0),
            "credit_limit": user.get("credit_limit", 0),
            "balance": user.get("balance", 0)
        })
    
    # Sort by sales descending
    monitoring_data.sort(key=lambda x: x["today_sales"], reverse=True)
    
    # Get totals
    total_sales = sum(m["today_sales"] for m in monitoring_data)
    total_wins = sum(m["today_wins"] for m in monitoring_data)
    total_pending = sum(m["pending_tickets"] for m in monitoring_data)
    
    return {
        "users": monitoring_data,
        "summary": {
            "total_sales": total_sales,
            "total_wins": total_wins,
            "total_profit": total_sales - total_wins,
            "total_pending_tickets": total_pending,
            "active_sellers": len([m for m in monitoring_data if m["active"]])
        }
    }

@api_router.get("/monitoring/tickets")
async def get_tickets_monitoring(
    status: Optional[TicketStatus] = None,
    lottery_id: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get real-time ticket monitoring"""
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
    
    # Build query based on role
    user_filter = {}
    if current_user["role"] == UserRole.VENDEDOR.value:
        user_filter["user_id"] = current_user["id"]
    elif current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        user_filter["user_id"] = {"$in": vendor_ids}
    
    if user_id and current_user["role"] in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]:
        user_filter["user_id"] = user_id
    
    # Get transactions
    query = {
        **user_filter,
        "created_at": {"$gte": start, "$lte": end}
    }
    
    transactions = await db.transactions.find(query).sort("created_at", -1).to_list(10000)
    
    total_sales = sum(t["amount"] for t in transactions if t["transaction_type"] == TransactionType.SALE.value)
    total_wins = sum(t["amount"] for t in transactions if t["transaction_type"] == TransactionType.WIN.value)
    total_commission = sum(t["amount"] for t in transactions if t["transaction_type"] == TransactionType.COMMISSION.value)
    total_payments = sum(t["amount"] for t in transactions if t["transaction_type"] == TransactionType.PAYMENT.value)
    
    # Count tickets
    ticket_query = {
        "created_at": {"$gte": start, "$lte": end}
    }
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
    
    net_profit = total_sales - total_wins
    
    return {
        "period": f"{start.date()} - {end.date()}",
        "total_sales": total_sales,
        "total_wins": total_wins,
        "total_commission": total_commission,
        "total_payments": total_payments,
        "net_profit": net_profit,
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
    
    # Today stats
    today_tickets = await db.tickets.find({**user_filter, "created_at": {"$gte": today}}).to_list(10000)
    today_sales = sum(t["amount"] for t in today_tickets if t["status"] != TicketStatus.CANCELLED.value)
    today_wins = sum(t["potential_win"] for t in today_tickets if t["status"] in [TicketStatus.WON.value, TicketStatus.PAID.value])
    
    # Week stats
    week_tickets = await db.tickets.find({**user_filter, "created_at": {"$gte": week_ago}}).to_list(10000)
    week_sales = sum(t["amount"] for t in week_tickets if t["status"] != TicketStatus.CANCELLED.value)
    week_wins = sum(t["potential_win"] for t in week_tickets if t["status"] in [TicketStatus.WON.value, TicketStatus.PAID.value])
    
    # Month stats
    month_tickets = await db.tickets.find({**user_filter, "created_at": {"$gte": month_ago}}).to_list(10000)
    month_sales = sum(t["amount"] for t in month_tickets if t["status"] != TicketStatus.CANCELLED.value)
    month_wins = sum(t["potential_win"] for t in month_tickets if t["status"] in [TicketStatus.WON.value, TicketStatus.PAID.value])
    
    return {
        "today": {
            "sales": today_sales,
            "wins": today_wins,
            "profit": today_sales - today_wins,
            "tickets": len([t for t in today_tickets if t["status"] != TicketStatus.CANCELLED.value])
        },
        "week": {
            "sales": week_sales,
            "wins": week_wins,
            "profit": week_sales - week_wins,
            "tickets": len([t for t in week_tickets if t["status"] != TicketStatus.CANCELLED.value])
        },
        "month": {
            "sales": month_sales,
            "wins": month_wins,
            "profit": month_sales - month_wins,
            "tickets": len([t for t in month_tickets if t["status"] != TicketStatus.CANCELLED.value])
        },
        "currency": current_user["currency"]
    }

@api_router.get("/accounting/sellers-report")
async def get_sellers_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get detailed report by seller"""
    if not start_date:
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start = datetime.fromisoformat(start_date)
    
    if not end_date:
        end = datetime.utcnow()
    else:
        end = datetime.fromisoformat(end_date)
    
    # Get sellers
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
    
    # Sort by sales
    reports.sort(key=lambda x: x["total_sales"], reverse=True)
    
    # Totals
    total_all_sales = sum(r["total_sales"] for r in reports)
    total_all_wins = sum(r["total_wins"] for r in reports)
    total_all_commission = sum(r["total_commission"] for r in reports)
    
    return {
        "period": f"{start.date()} - {end.date()}",
        "sellers": reports,
        "totals": {
            "total_sales": total_all_sales,
            "total_wins": total_all_wins,
            "total_commission": total_all_commission,
            "net_profit": total_all_sales - total_all_wins
        }
    }

@api_router.get("/accounting/daily-chart")
async def get_daily_chart_data(
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """Get daily sales/wins data for charts"""
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
    """Create initial super admin if none exists"""
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
    
    # Create default lotteries
    default_lotteries = [
        {
            "id": str(uuid.uuid4()),
            "name": "Quiniela Nacional",
            "country": "RD",
            "lottery_type": LotteryType.QUINIELA.value,
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 1,
            "price": 20.0,
            "currency": Currency.RD.value,
            "prize_multiplier": 70.0,
            "schedule": ["12:30", "14:30", "18:00", "21:00"],
            "closing_minutes_before": 15,
            "active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Pale Nacional",
            "country": "RD",
            "lottery_type": LotteryType.PALE.value,
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 2,
            "price": 20.0,
            "currency": Currency.RD.value,
            "prize_multiplier": 1000.0,
            "schedule": ["12:30", "14:30", "18:00", "21:00"],
            "closing_minutes_before": 15,
            "active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Tripleta Nacional",
            "country": "RD",
            "lottery_type": LotteryType.TRIPLETA.value,
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 3,
            "price": 20.0,
            "currency": Currency.RD.value,
            "prize_multiplier": 50000.0,
            "schedule": ["12:30", "14:30", "18:00", "21:00"],
            "closing_minutes_before": 15,
            "active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Loto Leidsa",
            "country": "RD",
            "lottery_type": LotteryType.LOTO.value,
            "min_number": 1,
            "max_number": 38,
            "numbers_to_pick": 6,
            "price": 50.0,
            "currency": Currency.RD.value,
            "prize_multiplier": 100000.0,
            "schedule": ["20:55"],
            "closing_minutes_before": 15,
            "active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Pega 3",
            "country": "RD",
            "lottery_type": LotteryType.PEGA3.value,
            "min_number": 0,
            "max_number": 9,
            "numbers_to_pick": 3,
            "price": 25.0,
            "currency": Currency.RD.value,
            "prize_multiplier": 500.0,
            "schedule": ["12:55", "15:00", "21:00"],
            "closing_minutes_before": 15,
            "active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Powerball USA",
            "country": "USA",
            "lottery_type": LotteryType.POWERBALL.value,
            "min_number": 1,
            "max_number": 69,
            "numbers_to_pick": 5,
            "price": 2.0,
            "currency": Currency.USD.value,
            "prize_multiplier": 1000000.0,
            "schedule": ["22:59"],
            "closing_minutes_before": 15,
            "active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Mega Millions USA",
            "country": "USA",
            "lottery_type": LotteryType.MEGA_MILLIONS.value,
            "min_number": 1,
            "max_number": 70,
            "numbers_to_pick": 5,
            "price": 2.0,
            "currency": Currency.USD.value,
            "prize_multiplier": 1000000.0,
            "schedule": ["23:00"],
            "closing_minutes_before": 15,
            "active": True,
            "created_at": datetime.utcnow()
        }
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
    return {"message": "Sistema de Lotería RD/USA API - Banca Completa", "version": "2.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router
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
