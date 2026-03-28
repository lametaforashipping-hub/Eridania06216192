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
    import uuid
    from utils.database import get_db
    db = get_db()
    
    try:
        logger.info("🔄 Running data migrations...")
        
        # Base lottery template
        def make_lottery(name, schedule_24h, display_time, country="RD", currency="RD$"):
            # Calculate closing time (10 min before)
            h, m = map(int, schedule_24h.split(':'))
            close_m = m - 10
            close_h = h
            if close_m < 0:
                close_m += 60
                close_h -= 1
            closing_24h = f"{close_h:02d}:{close_m:02d}"
            
            # Calculate display closing
            close_hour_12 = close_h if close_h <= 12 else close_h - 12
            if close_hour_12 == 0:
                close_hour_12 = 12
            close_ampm = "AM" if close_h < 12 else "PM"
            display_closing = f"{close_hour_12}:{close_m:02d} {close_ampm}"
            
            return {
                "id": str(uuid.uuid4()),
                "name": name,
                "schedule": [schedule_24h],
                "closing_time": closing_24h,
                "opening_time": "07:00",
                "display_time": display_time,
                "display_closing": display_closing,
                "display_opening": "7:00 AM",
                "country": country,
                "currency": currency,
                "play_types": {
                    "quiniela": {"multiplier": 70, "numbers_required": 1, "enabled": True},
                    "pale": {"multiplier": 1500, "numbers_required": 2, "enabled": True},
                    "tripleta": {"multiplier": 10000, "numbers_required": 3, "enabled": True}
                },
                "min_number": 0,
                "max_number": 99,
                "price": 20,
                "active": True
            }
        
        # ============================================================
        # LOTERÍAS QUE DEBEN EXISTIR CON CONFIGURACIÓN EXACTA
        # ============================================================
        all_lotteries = {
            # LEIDSA
            "Quiniela Leidsa 8:55 AM": make_lottery("Quiniela Leidsa 8:55 AM", "08:55", "8:55 AM"),
            "Quiniela Leidsa 3:55 PM": make_lottery("Quiniela Leidsa 3:55 PM", "15:55", "3:55 PM"),
            
            # PEGA 3 MÁS (3 horarios)
            "Pega 3 Más 12:55 PM": make_lottery("Pega 3 Más 12:55 PM", "12:55", "12:55 PM"),
            "Pega 3 Más 3:00 PM": make_lottery("Pega 3 Más 3:00 PM", "15:00", "3:00 PM"),
            "Pega 3 Más 9:00 PM": make_lottery("Pega 3 Más 9:00 PM", "21:00", "9:00 PM"),
            
            # LOTERÍA NACIONAL
            "Gana Más 2:30 PM": make_lottery("Gana Más 2:30 PM", "14:30", "2:30 PM"),
            "Lotería Nacional 6:00 PM": make_lottery("Lotería Nacional 6:00 PM", "18:00", "6:00 PM"),
            "Lotería Nacional 8:50 PM": make_lottery("Lotería Nacional 8:50 PM", "20:50", "8:50 PM"),
            
            # REAL
            "Quiniela Real 12:55 PM": make_lottery("Quiniela Real 12:55 PM", "12:55", "12:55 PM"),
            
            # LOTEKA
            "Quiniela Loteka 7:55 PM": make_lottery("Quiniela Loteka 7:55 PM", "19:55", "7:55 PM"),
            
            # LA PRIMERA
            "La Primera 12:00 PM": make_lottery("La Primera 12:00 PM", "12:00", "12:00 PM"),
            "La Primera 7:00 PM": make_lottery("La Primera 7:00 PM", "19:00", "7:00 PM"),
            
            # LA SUERTE
            "La Suerte 12:30 PM": make_lottery("La Suerte 12:30 PM", "12:30", "12:30 PM"),
            "La Suerte 6:00 PM": make_lottery("La Suerte 6:00 PM", "18:00", "6:00 PM"),
            
            # LOTEDOM (4 horarios)
            "Quiniela LoteDom 12:00 PM": make_lottery("Quiniela LoteDom 12:00 PM", "12:00", "12:00 PM"),
            "Quiniela LoteDom 3:00 PM": make_lottery("Quiniela LoteDom 3:00 PM", "15:00", "3:00 PM"),
            "Quiniela LoteDom 6:00 PM": make_lottery("Quiniela LoteDom 6:00 PM", "18:00", "6:00 PM"),
            "Quiniela LoteDom 9:00 PM": make_lottery("Quiniela LoteDom 9:00 PM", "21:00", "9:00 PM"),
            
            # KING LOTTERY
            "King Lottery 12:30 PM": make_lottery("King Lottery 12:30 PM", "12:30", "12:30 PM"),
            "King Lottery 7:30 PM": make_lottery("King Lottery 7:30 PM", "19:30", "7:30 PM"),
            
            # ANGUILA
            "Anguila 10:00 AM": make_lottery("Anguila 10:00 AM", "10:00", "10:00 AM"),
            "Anguila 1:00 PM": make_lottery("Anguila 1:00 PM", "13:00", "1:00 PM"),
            "Anguila 4:00 PM": make_lottery("Anguila 4:00 PM", "16:00", "4:00 PM"),
            "Anguila 9:00 PM": make_lottery("Anguila 9:00 PM", "21:00", "9:00 PM"),
            
            # USA - FLORIDA
            "Florida 1:30 PM": make_lottery("Florida 1:30 PM", "13:30", "1:30 PM", "US", "USD"),
            "Florida 9:45 PM": make_lottery("Florida 9:45 PM", "21:45", "9:45 PM", "US", "USD"),
            
            # USA - NEW YORK
            "New York 2:30 PM": make_lottery("New York 2:30 PM", "14:30", "2:30 PM", "US", "USD"),
            "New York 10:30 PM": make_lottery("New York 10:30 PM", "22:30", "10:30 PM", "US", "USD"),
        }
        
        # Mapeo de nombres antiguos a nuevos (para renombrar)
        name_renames = {
            "Gana Más": "Gana Más 2:30 PM",
            "Quiniela Real": "Quiniela Real 12:55 PM",
            "Quiniela Loteka": "Quiniela Loteka 7:55 PM",
            "La Primera Día": "La Primera 12:00 PM",
            "Primera Noche": "La Primera 7:00 PM",
            "Anguila Mañana": "Anguila 10:00 AM",
            "Anguila Medio Día": "Anguila 1:00 PM",
            "Anguila Tarde": "Anguila 4:00 PM",
            "Anguila Noche": "Anguila 9:00 PM",
            "Florida Día": "Florida 1:30 PM",
            "Florida Noche": "Florida 9:45 PM",
            "New York Tarde": "New York 2:30 PM",
            "New York Noche": "New York 10:30 PM",
        }
        
        fixed_count = 0
        created_count = 0
        renamed_count = 0
        
        # Step 1: Rename old lotteries to include time in name
        for old_name, new_name in name_renames.items():
            existing = await db.lotteries.find_one({"name": old_name})
            if existing:
                # Check if new name already exists
                new_exists = await db.lotteries.find_one({"name": new_name})
                if not new_exists:
                    new_config = all_lotteries.get(new_name, {})
                    update_data = {"name": new_name}
                    if new_config:
                        update_data.update({
                            "schedule": new_config["schedule"],
                            "closing_time": new_config["closing_time"],
                            "display_time": new_config["display_time"],
                            "display_closing": new_config["display_closing"],
                        })
                    await db.lotteries.update_one({"name": old_name}, {"$set": update_data})
                    logger.info(f"  📝 Renamed: {old_name} → {new_name}")
                    renamed_count += 1
        
        # Step 2: Create missing lotteries
        for name, config in all_lotteries.items():
            existing = await db.lotteries.find_one({"name": name})
            if not existing:
                await db.lotteries.insert_one(config)
                logger.info(f"  ➕ Created: {name} ({config['display_time']})")
                created_count += 1
        
        # Step 3: Fix schedules for existing lotteries
        for name, config in all_lotteries.items():
            existing = await db.lotteries.find_one({"name": name})
            if existing:
                current_schedule = existing.get("schedule", [])
                correct_schedule = config["schedule"]
                
                if current_schedule != correct_schedule:
                    await db.lotteries.update_one(
                        {"name": name},
                        {"$set": {
                            "schedule": config["schedule"],
                            "closing_time": config["closing_time"],
                            "display_time": config["display_time"],
                            "display_closing": config["display_closing"],
                        }}
                    )
                    logger.info(f"  ✅ Fixed: {name} schedule {current_schedule} → {correct_schedule}")
                    fixed_count += 1
        
        logger.info(f"🔄 Migration complete: {renamed_count} renamed, {created_count} created, {fixed_count} fixed")
            
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
