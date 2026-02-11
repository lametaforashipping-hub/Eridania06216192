from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'lottery_db')]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'lottery-super-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="Sistema de Lotería RD/USA")
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

class TransactionType(str, Enum):
    SALE = "sale"
    WIN = "win"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    COMMISSION = "commission"

# ==================== MODELS ====================
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.VENDEDOR
    credit_limit: float = 10000.0
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
    currency: Currency
    created_by: Optional[str] = None
    created_at: datetime
    active: bool = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    credit_limit: Optional[float] = None
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
    active: bool
    created_at: datetime

class TicketCreate(BaseModel):
    lottery_id: str
    numbers: List[int]
    amount: float
    currency: Currency = Currency.RD
    customer_name: Optional[str] = None

class TicketResponse(BaseModel):
    id: str
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

class AccountingReport(BaseModel):
    period: str
    total_sales: float
    total_wins: float
    total_commission: float
    net_profit: float
    currency: Currency
    tickets_sold: int
    tickets_won: int

class NumberStats(BaseModel):
    number: int
    frequency: int
    last_drawn: Optional[datetime] = None
    is_hot: bool = False
    is_cold: bool = False

# ==================== AUTH HELPERS ====================
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
        "currency": user_data.currency.value,
        "created_by": current_user["id"],
        "created_at": datetime.utcnow(),
        "active": True
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
        "currency": current_user["currency"]
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
        currency=u["currency"],
        created_by=u.get("created_by"),
        created_at=u["created_at"],
        active=u.get("active", True)
    ) for u in users]

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
async def deposit_balance(user_id: str, amount: float, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
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
        **lottery.dict(),
        "lottery_type": lottery.lottery_type.value,
        "currency": lottery.currency.value,
        "created_at": datetime.utcnow()
    }
    await db.lotteries.insert_one(lottery_doc)
    return {"message": "Lotería creada", "lottery_id": lottery_doc["id"]}

@api_router.get("/lotteries", response_model=List[LotteryResponse])
async def get_lotteries(active_only: bool = True):
    query = {"active": True} if active_only else {}
    lotteries = await db.lotteries.find(query).to_list(100)
    return [LotteryResponse(**l) for l in lotteries]

@api_router.get("/lotteries/{lottery_id}")
async def get_lottery(lottery_id: str):
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    return LotteryResponse(**lottery)

@api_router.put("/lotteries/{lottery_id}")
async def update_lottery(lottery_id: str, update: dict, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    await db.lotteries.update_one({"id": lottery_id}, {"$set": update})
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
                "created_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0)}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        current_sales = today_sales[0]["total"] if today_sales else 0
        if current_sales + ticket.amount > current_user["credit_limit"]:
            raise HTTPException(status_code=400, detail="Límite de crédito excedido")
    
    potential_win = ticket.amount * lottery["prize_multiplier"]
    
    ticket_doc = {
        "id": str(uuid.uuid4()),
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
        "draw_id": None
    }
    await db.tickets.insert_one(ticket_doc)
    
    # Record sale transaction
    transaction = {
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
    await db.transactions.insert_one(transaction)
    
    return TicketResponse(**ticket_doc)

@api_router.get("/tickets", response_model=List[TicketResponse])
async def get_tickets(
    status: Optional[TicketStatus] = None,
    lottery_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    # Filter by role
    if current_user["role"] == UserRole.VENDEDOR.value:
        query["seller_id"] = current_user["id"]
    elif current_user["role"] == UserRole.ADMIN.value:
        # Get all vendedores created by this admin
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        query["seller_id"] = {"$in": vendor_ids}
    
    if status:
        query["status"] = status.value
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    tickets = await db.tickets.find(query).sort("created_at", -1).to_list(500)
    return [TicketResponse(**t) for t in tickets]

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
    return [TicketResponse(**t) for t in tickets]

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
        
        # Check if ticket wins (exact match for quiniela)
        if lottery["lottery_type"] in [LotteryType.QUINIELA.value, LotteryType.PEGA3.value]:
            is_winner = ticket["numbers"] == winning_numbers
        else:
            # For loto-style games, check matches
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
    
    return DrawResponse(**draw)

@api_router.get("/draws", response_model=List[DrawResponse])
async def get_draws(lottery_id: Optional[str] = None, limit: int = 50):
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    draws = await db.draws.find(query).sort("draw_time", -1).to_list(limit)
    return [DrawResponse(**d) for d in draws]

@api_router.get("/draws/{draw_id}")
async def get_draw(draw_id: str):
    draw = await db.draws.find_one({"id": draw_id})
    if not draw:
        raise HTTPException(status_code=404, detail="Sorteo no encontrado")
    return DrawResponse(**draw)

# ==================== STATISTICS ====================
@api_router.get("/stats/numbers/{lottery_id}")
async def get_number_stats(lottery_id: str):
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    stats = await db.number_stats.find({"lottery_id": lottery_id}).to_list(100)
    
    if not stats:
        return {"hot_numbers": [], "cold_numbers": [], "all_stats": []}
    
    # Calculate hot and cold
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
    
    # Clean stats for JSON serialization
    clean_stats = []
    for s in stats:
        clean_stat = {
            "number": s["number"],
            "frequency": s.get("frequency", 0),
            "last_drawn": s.get("last_drawn"),
            "lottery_id": s["lottery_id"]
        }
        clean_stats.append(clean_stat)
    
    return {
        "hot_numbers": hot_numbers[:10],
        "cold_numbers": cold_numbers[:10],
        "all_stats": clean_stats
    }

# ==================== ACCOUNTING ====================
@api_router.get("/accounting/report")
async def get_accounting_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Default to today
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
    
    # Get transactions
    query = {
        **user_filter,
        "created_at": {"$gte": start, "$lte": end}
    }
    
    transactions = await db.transactions.find(query).to_list(10000)
    
    total_sales = sum(t["amount"] for t in transactions if t["transaction_type"] == TransactionType.SALE.value)
    total_wins = sum(t["amount"] for t in transactions if t["transaction_type"] == TransactionType.WIN.value)
    
    # Count tickets
    ticket_query = {
        "created_at": {"$gte": start, "$lte": end}
    }
    if current_user["role"] == UserRole.VENDEDOR.value:
        ticket_query["seller_id"] = current_user["id"]
    elif current_user["role"] == UserRole.ADMIN.value:
        ticket_query["seller_id"] = {"$in": vendor_ids}
    
    tickets_sold = await db.tickets.count_documents(ticket_query)
    tickets_won = await db.tickets.count_documents({**ticket_query, "status": TicketStatus.WON.value})
    
    commission_rate = 0.10  # 10% commission
    total_commission = total_sales * commission_rate
    net_profit = total_sales - total_wins
    
    return {
        "period": f"{start.date()} - {end.date()}",
        "total_sales": total_sales,
        "total_wins": total_wins,
        "total_commission": total_commission,
        "net_profit": net_profit,
        "currency": current_user["currency"],
        "tickets_sold": tickets_sold,
        "tickets_won": tickets_won,
        "transactions": [TransactionResponse(
            id=t["id"],
            user_id=t["user_id"],
            user_name=t["user_name"],
            transaction_type=t["transaction_type"],
            amount=t["amount"],
            currency=t["currency"],
            description=t["description"],
            reference_id=t.get("reference_id"),
            created_at=t["created_at"]
        ) for t in transactions[-100:]]  # Last 100 transactions
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
    today_sales = sum(t["amount"] for t in today_tickets)
    today_wins = sum(t["potential_win"] for t in today_tickets if t["status"] == TicketStatus.WON.value)
    
    # Week stats
    week_tickets = await db.tickets.find({**user_filter, "created_at": {"$gte": week_ago}}).to_list(10000)
    week_sales = sum(t["amount"] for t in week_tickets)
    week_wins = sum(t["potential_win"] for t in week_tickets if t["status"] == TicketStatus.WON.value)
    
    # Month stats
    month_tickets = await db.tickets.find({**user_filter, "created_at": {"$gte": month_ago}}).to_list(10000)
    month_sales = sum(t["amount"] for t in month_tickets)
    month_wins = sum(t["potential_win"] for t in month_tickets if t["status"] == TicketStatus.WON.value)
    
    return {
        "today": {
            "sales": today_sales,
            "wins": today_wins,
            "profit": today_sales - today_wins,
            "tickets": len(today_tickets)
        },
        "week": {
            "sales": week_sales,
            "wins": week_wins,
            "profit": week_sales - week_wins,
            "tickets": len(week_tickets)
        },
        "month": {
            "sales": month_sales,
            "wins": month_wins,
            "profit": month_sales - month_wins,
            "tickets": len(month_tickets)
        },
        "currency": current_user["currency"]
    }

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
        "currency": Currency.RD.value,
        "created_at": datetime.utcnow(),
        "active": True
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
    return {"message": "Sistema de Lotería RD/USA API", "version": "1.0"}

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
