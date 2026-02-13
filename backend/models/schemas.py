from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
from .enums import UserRole, Currency, LotteryType, TicketStatus

# Default weekly schedule for lotteries
DEFAULT_WEEKLY_SCHEDULE = {
    "monday": {"open": "08:00", "close": "21:00"},
    "tuesday": {"open": "08:00", "close": "21:00"},
    "wednesday": {"open": "08:00", "close": "21:00"},
    "thursday": {"open": "08:00", "close": "21:00"},
    "friday": {"open": "08:00", "close": "21:00"},
    "saturday": {"open": "08:00", "close": "22:00"},
    "sunday": {"open": "10:00", "close": "20:00"},
}

# ==================== USER MODELS ====================
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.VENDEDOR
    credit_limit: float = 10000.0
    commission_rate: float = 10.0
    currency: Currency = Currency.RD
    country: str = "RD"
    phone: Optional[str] = None
    address: Optional[str] = None
    cedula: Optional[str] = None
    terminal_id: Optional[str] = None

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
    phone: Optional[str] = None
    address: Optional[str] = None
    cedula: Optional[str] = None
    terminal_id: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    credit_limit: Optional[float] = None
    commission_rate: Optional[float] = None
    active: Optional[bool] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    cedula: Optional[str] = None
    country: Optional[str] = None
    terminal_id: Optional[str] = None

# ==================== SYSTEM CONFIG ====================
class SystemConfig(BaseModel):
    high_risk_threshold_rd: float = 10000.0
    high_risk_threshold_usd: float = 200.0
    auto_refresh_interval: int = 5

class PrizeRule(BaseModel):
    position: str
    matches: int
    multiplier: float

# ==================== LOTTERY MODELS ====================
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
    prize_rules: Optional[List[Dict]] = None
    allows_combined: bool = False
    opening_time: Optional[str] = "08:00"
    closing_time: Optional[str] = "21:00"
    weekly_hours: Optional[Dict[str, Dict[str, str]]] = None
    holidays: Optional[List[Dict]] = None
    ticket_limit_per_number: Optional[int] = None
    prize_tiers: Optional[Dict[str, float]] = None

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
    prize_tiers: Optional[Dict[str, float]] = None

# ==================== TICKET MODELS ====================
class TicketCreate(BaseModel):
    lottery_id: str
    numbers: List[int]
    amount: float
    currency: Currency = Currency.RD
    customer_name: Optional[str] = None
    position: Optional[str] = None
    is_combined: bool = False

class PlayItem(BaseModel):
    lottery_type: str
    lottery_id: Optional[str] = None
    numbers: List[int]
    amount: float
    position: Optional[str] = None

class MultiPlayTicketCreate(BaseModel):
    plays: List[PlayItem]
    customer_name: Optional[str] = None
    currency: Currency = Currency.RD
    act_as_user_id: Optional[str] = None

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

# ==================== FAVORITES MODELS ====================
class FavoriteNumbers(BaseModel):
    name: Optional[str] = None
    lottery_id: Optional[str] = None
    lottery_type: Optional[str] = None
    numbers: List[int]
    amount: Optional[float] = 20.0

class CreateFavoriteWithPlays(BaseModel):
    name: str
    plays: List[FavoriteNumbers]
    currency: str = "RD"

# ==================== DRAW MODELS ====================
class DrawCreate(BaseModel):
    lottery_id: str
    position: Optional[str] = None
    winning_numbers: Optional[List[int]] = None

# ==================== NOTIFICATION MODELS ====================
class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    type: str
