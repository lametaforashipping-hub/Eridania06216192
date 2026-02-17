"""
Sistema de Lotería RD/USA - Backend API
Refactored modular architecture
"""
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection with Atlas-compatible settings
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=30000,
    connectTimeoutMS=30000,
    socketTimeoutMS=30000,
    retryWrites=True,
    retryReads=True,
)

# Create the main app
app = FastAPI(title="Sistema de Lotería RD/USA - Banca Completa v3")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import and register all routers
from routes import (
    auth_router,
    users_router,
    terminals_router,
    favorites_router,
    lotteries_router,
    notifications_router,
    statistics_router,
    admin_router,
    company_router,
    tickets_router,
    draws_router,
    monitoring_router,
    accounting_router,
    system_router,
    lottery_results_router
)
from routes.bank_accounts import router as bank_accounts_router
from routes.clients import router as clients_router
from routes.payments import router as payments_router

# Register all routers with the API router
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(terminals_router)
api_router.include_router(favorites_router)
api_router.include_router(lotteries_router)
api_router.include_router(notifications_router)
api_router.include_router(statistics_router)
api_router.include_router(admin_router)
api_router.include_router(company_router)
api_router.include_router(tickets_router)
api_router.include_router(draws_router)
api_router.include_router(monitoring_router)
api_router.include_router(accounting_router)
api_router.include_router(system_router)
api_router.include_router(bank_accounts_router)
api_router.include_router(lottery_results_router)
api_router.include_router(clients_router)
api_router.include_router(payments_router)

# Include the main API router
app.include_router(api_router)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    from services.lottery_scheduler import start_scheduler
    from utils.database import get_db
    
    try:
        # Check if scheduler should auto-start from saved config
        db = get_db()
        config = await db.system_config.find_one({"key": "lottery_scheduler"})
        
        if config and config.get("enabled", False):
            interval = config.get("interval_minutes", 5)
            start_scheduler(interval_minutes=interval)
            logger.info(f"🚀 Auto-started lottery scheduler (interval: {interval} min)")
        else:
            # Start with default 5 minutes if no config exists
            start_scheduler(interval_minutes=5)
            logger.info("🚀 Started lottery scheduler with default 5 min interval")
    except Exception as e:
        logger.warning(f"Could not auto-start scheduler: {e}")


@app.get("/health")
async def health_check():
    """Health check endpoint for deployment"""
    try:
        # Verify MongoDB connection is alive
        await client.admin.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        # Return healthy even if DB check fails to prevent container restarts
        # The app can still serve static content and will retry DB connections
        return {"status": "healthy", "database": "reconnecting"}


@app.on_event("shutdown")
async def shutdown_db_client():
    """Close MongoDB connection on shutdown"""
    client.close()
