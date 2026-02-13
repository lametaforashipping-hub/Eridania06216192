from enum import Enum

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
