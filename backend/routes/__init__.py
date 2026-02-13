"""Routes package - Modular API routes organized by functionality"""
from .auth import router as auth_router
from .users import router as users_router
from .terminals import router as terminals_router
from .favorites import router as favorites_router
from .lotteries import router as lotteries_router
from .notifications import router as notifications_router
from .statistics import router as statistics_router
from .admin import router as admin_router
from .company import router as company_router
from .tickets import router as tickets_router
from .draws import router as draws_router
from .monitoring import router as monitoring_router
from .accounting import router as accounting_router

__all__ = [
    "auth_router",
    "users_router", 
    "terminals_router",
    "favorites_router",
    "lotteries_router",
    "notifications_router",
    "statistics_router",
    "admin_router",
    "company_router",
    "tickets_router",
    "draws_router",
    "monitoring_router",
    "accounting_router"
]
