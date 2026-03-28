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


async def run_data_migrations():
    """
    Run data migrations on startup to fix known issues.
    These are idempotent - safe to run multiple times.
    """
    from utils.database import get_db
    db = get_db()
    
    try:
        logger.info("🔄 Running data migrations...")
        
        # Migration 1: Fix lottery schedules that are in wrong format (02:30 instead of 14:30)
        # Known issue: Some lotteries have PM times saved as AM (e.g., 02:30 instead of 14:30)
        lottery_time_fixes = {
            "Gana Más": {"schedule": ["14:30"], "closing_time": "14:20", "display_time": "2:30 PM", "display_closing": "2:20 PM"},
            "Quiniela Leidsa 3:55 PM": {"schedule": ["15:55"], "closing_time": "15:45", "display_time": "3:55 PM", "display_closing": "3:45 PM"},
            "Pega 3 Más 12:55 PM": {"schedule": ["12:55"], "closing_time": "12:45", "display_time": "12:55 PM", "display_closing": "12:45 PM"},
            "Pega 3 Más 3:00 PM": {"schedule": ["15:00"], "closing_time": "14:50", "display_time": "3:00 PM", "display_closing": "2:50 PM"},
            "Pega 3 Más 9:00 PM": {"schedule": ["21:00"], "closing_time": "20:50", "display_time": "9:00 PM", "display_closing": "8:50 PM"},
            "Lotería Nacional 6:00 PM": {"schedule": ["18:00"], "closing_time": "17:50", "display_time": "6:00 PM", "display_closing": "5:50 PM"},
            "Lotería Nacional 8:50 PM": {"schedule": ["20:50"], "closing_time": "20:40", "display_time": "8:50 PM", "display_closing": "8:40 PM"},
            "Quiniela Real": {"schedule": ["12:55"], "closing_time": "12:45", "display_time": "12:55 PM", "display_closing": "12:45 PM"},
            "Quiniela Loteka": {"schedule": ["19:55"], "closing_time": "19:45", "display_time": "7:55 PM", "display_closing": "7:45 PM"},
            "La Primera Día": {"schedule": ["12:00"], "closing_time": "11:50", "display_time": "12:00 PM", "display_closing": "11:50 AM"},
            "Primera Noche": {"schedule": ["19:00"], "closing_time": "18:50", "display_time": "7:00 PM", "display_closing": "6:50 PM"},
            "La Suerte 12:30 PM": {"schedule": ["12:30"], "closing_time": "12:20", "display_time": "12:30 PM", "display_closing": "12:20 PM"},
            "La Suerte 6:00 PM": {"schedule": ["18:00"], "closing_time": "17:50", "display_time": "6:00 PM", "display_closing": "5:50 PM"},
            "Quiniela LoteDom 12:00 PM": {"schedule": ["12:00"], "closing_time": "11:50", "display_time": "12:00 PM", "display_closing": "11:50 AM"},
            "Quiniela LoteDom 3:00 PM": {"schedule": ["15:00"], "closing_time": "14:50", "display_time": "3:00 PM", "display_closing": "2:50 PM"},
            "Quiniela LoteDom 6:00 PM": {"schedule": ["18:00"], "closing_time": "17:50", "display_time": "6:00 PM", "display_closing": "5:50 PM"},
            "Quiniela LoteDom 9:00 PM": {"schedule": ["21:00"], "closing_time": "20:50", "display_time": "9:00 PM", "display_closing": "8:50 PM"},
            "King Lottery 12:30 PM": {"schedule": ["12:30"], "closing_time": "12:20", "display_time": "12:30 PM", "display_closing": "12:20 PM"},
            "King Lottery 7:30 PM": {"schedule": ["19:30"], "closing_time": "19:20", "display_time": "7:30 PM", "display_closing": "7:20 PM"},
            "Anguila Mañana": {"schedule": ["10:00"], "closing_time": "09:50", "display_time": "10:00 AM", "display_closing": "9:50 AM"},
            "Anguila Medio Día": {"schedule": ["13:00"], "closing_time": "12:50", "display_time": "1:00 PM", "display_closing": "12:50 PM"},
            "Anguila Tarde": {"schedule": ["16:00"], "closing_time": "15:50", "display_time": "4:00 PM", "display_closing": "3:50 PM"},
            "Anguila Noche": {"schedule": ["21:00"], "closing_time": "20:50", "display_time": "9:00 PM", "display_closing": "8:50 PM"},
            "Florida Día": {"schedule": ["13:30"], "closing_time": "13:20", "display_time": "1:30 PM", "display_closing": "1:20 PM"},
            "Florida Noche": {"schedule": ["21:45"], "closing_time": "21:35", "display_time": "9:45 PM", "display_closing": "9:35 PM"},
            "New York Tarde": {"schedule": ["14:30"], "closing_time": "14:20", "display_time": "2:30 PM", "display_closing": "2:20 PM"},
            "New York Noche": {"schedule": ["22:30"], "closing_time": "22:20", "display_time": "10:30 PM", "display_closing": "10:20 PM"},
            "Quiniela Leidsa 8:55 AM": {"schedule": ["08:55"], "closing_time": "08:45", "display_time": "8:55 AM", "display_closing": "8:45 AM"},
        }
        
        fixed_count = 0
        for name, correct_values in lottery_time_fixes.items():
            # Check if lottery needs fixing (schedule is wrong)
            lottery = await db.lotteries.find_one({"name": name})
            if lottery:
                current_schedule = lottery.get("schedule", [])
                correct_schedule = correct_values["schedule"]
                
                # Only update if schedule is different
                if current_schedule != correct_schedule:
                    await db.lotteries.update_one(
                        {"name": name},
                        {"$set": correct_values}
                    )
                    logger.info(f"  ✅ Fixed {name}: {current_schedule} → {correct_schedule}")
                    fixed_count += 1
        
        if fixed_count > 0:
            logger.info(f"🔄 Migration complete: Fixed {fixed_count} lottery schedules")
        else:
            logger.info("🔄 Migration complete: All lottery schedules already correct")
            
    except Exception as e:
        logger.warning(f"⚠️ Migration error (non-fatal): {e}")

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
from routes.goals import router as goals_router
from routes.prize_config import router as prize_config_router
from routes.alert_settings import router as alert_settings_router
from routes.trial import router as trial_router
from routes.settlements import router as settlements_router

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
api_router.include_router(goals_router)
api_router.include_router(prize_config_router)
api_router.include_router(alert_settings_router)
api_router.include_router(trial_router)
api_router.include_router(settlements_router)

# Serve trial page at /api/prueba-gratis
from fastapi.responses import HTMLResponse

@api_router.get("/prueba-gratis", response_class=HTMLResponse)
async def prueba_gratis_page():
    """Serve the free trial registration page"""
    import os
    html_path = os.path.join(os.path.dirname(__file__), "static", "prueba-gratis.html")
    with open(html_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

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
    from services.notifications import notify_admin_pending_payments_summary, send_weekly_report_to_admins
    from utils.database import get_db
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    
    # Run data migrations first
    await run_data_migrations()
    
    async def _run_ticket_expiry():
        from services.ticket_expiry import expire_old_pending_tickets
        await expire_old_pending_tickets()
    
    try:
        # Create a single shared scheduler for all cron jobs
        shared_scheduler = AsyncIOScheduler()
        
        # Add daily payment summary job
        shared_scheduler.add_job(
            notify_admin_pending_payments_summary,
            'cron',
            hour=8,  # 8 AM UTC (4 AM DR)
            minute=0,
            id='daily_payment_summary',
            replace_existing=True
        )
        logger.info("Added daily payment summary job (8:00 AM UTC)")
        
        # Add weekly report job (every Monday at 8 AM UTC)
        shared_scheduler.add_job(
            send_weekly_report_to_admins,
            'cron',
            day_of_week='mon',  # Monday
            hour=8,
            minute=0,
            id='weekly_admin_report',
            replace_existing=True
        )
        logger.info("Added weekly report job (Mondays 8:00 AM UTC)")
        
        # Add ticket expiry job - runs every 30 minutes to mark old pending tickets as lost
        shared_scheduler.add_job(
            _run_ticket_expiry,
            'interval',
            minutes=30,
            id='ticket_expiry',
            replace_existing=True
        )
        logger.info("Added ticket expiry job (every 30 min)")
        
        # Start the shared scheduler
        shared_scheduler.start()
        logger.info("🚀 Cron scheduler started")
        
        # Start lottery results scheduler (separate scheduler for interval jobs)
        try:
            db = get_db()
            config = await db.system_config.find_one({"key": "lottery_scheduler"})
            
            if config and config.get("enabled", False):
                interval = config.get("interval_minutes", 5)
                start_scheduler(interval_minutes=interval)
                logger.info(f"🚀 Auto-started lottery scheduler (interval: {interval} min)")
            else:
                start_scheduler(interval_minutes=5)
                logger.info("🚀 Started lottery scheduler with default 5 min interval")
        except Exception as db_error:
            logger.warning(f"Could not start lottery scheduler (DB not ready): {db_error}")
            # Start with default anyway
            start_scheduler(interval_minutes=5)
            logger.info("🚀 Started lottery scheduler with default 5 min interval (fallback)")
        
    except Exception as e:
        logger.warning(f"Could not initialize schedulers: {e}")


@app.get("/health")
async def health_check():
    """Health check endpoint for deployment"""
    try:
        # Verify MongoDB connection is alive
        await client.admin.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception:
        # Return healthy even if DB check fails to prevent container restarts
        # The app can still serve static content and will retry DB connections
        return {"status": "healthy", "database": "reconnecting"}

from fastapi.responses import HTMLResponse, Response, FileResponse

@app.get("/api/privacy-policy", response_class=HTMLResponse)
async def privacy_policy():
    return """<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Politica de Privacidad - Loteria Magica</title><style>body{font-family:system-ui;max-width:700px;margin:0 auto;padding:20px;color:#333;line-height:1.6}h1{color:#1a1a2e}h2{color:#16213e;margin-top:24px}</style></head><body>
<h1>Politica de Privacidad</h1><p><strong>Loteria Magica</strong> — Ultima actualizacion: Marzo 2026</p>
<h2>1. Datos que Recopilamos</h2><p>Recopilamos la siguiente informacion cuando usas nuestra app:</p><ul><li><strong>Email:</strong> Para crear tu cuenta e iniciar sesion.</li><li><strong>Telefono:</strong> Para contactarte sobre tus boletos y premios.</li><li><strong>Datos de uso:</strong> Interacciones basicas con la app para mejorar el servicio.</li></ul>
<h2>2. Como Usamos tus Datos</h2><ul><li>Gestionar tu cuenta y autenticacion.</li><li>Procesar compras de boletos.</li><li>Notificarte sobre resultados y premios.</li><li>Mejorar la experiencia de la app.</li></ul>
<h2>3. Compartir Datos</h2><p>No vendemos ni compartimos tus datos personales con terceros, excepto cuando sea requerido por ley.</p>
<h2>4. Seguridad</h2><p>Protegemos tus datos con encriptacion y practicas de seguridad estandar de la industria.</p>
<h2>5. Tus Derechos</h2><p>Puedes solicitar la eliminacion de tu cuenta y datos contactandonos a: <strong>metafora@lametafora.net</strong></p>
<h2>6. Contacto</h2><p>Para preguntas sobre privacidad: <strong>metafora@lametafora.net</strong></p>
</body></html>"""



@app.get("/api/download-eas-json")
async def download_eas_json():
    """Temporary endpoint to download the correct eas.json file"""
    content = """{
  "cli": {
    "version": ">= 13.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "distribution": "store"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "eriberto.70@hotmail.com",
        "ascAppId": "6760090637"
      },
      "android": {
        "serviceAccountKeyPath": "./play-store-key.json",
        "track": "internal"
      }
    }
  }
}"""
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=eas.json"}
    )


@app.get("/api/ipad-screenshot/{num}")
async def ipad_screenshot(num: int):
    """Serve iPad screenshots for App Store submission"""
    names = {1: "ipad_1_login", 2: "ipad_2_dashboard", 3: "ipad_3_lottery", 4: "ipad_4_results"}
    if num not in names:
        return Response(content="Not found", status_code=404)
    path = f"/app/backend/static/ipad_screenshots/{names[num]}.png"
    return FileResponse(path, media_type="image/png", filename=f"{names[num]}.png")


@app.on_event("shutdown")
async def shutdown_db_client():
    """Close MongoDB connection on shutdown"""
    client.close()
