"""
Automatic Lottery Results Scheduler
Fetches lottery results automatically every 5-10 minutes and processes winning tickets.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from services.lottery_scraper import get_scraper, LotteryResult

logger = logging.getLogger(__name__)

# Global scheduler instance
_scheduler: Optional[AsyncIOScheduler] = None
_is_running = False

# Store last fetched results to detect new draws
_last_results: Dict[str, LotteryResult] = {}
_last_fetch_time: Optional[datetime] = None


async def process_new_results(db, validated_result: LotteryResult, lottery_doc: dict):
    """Process a validated lottery result and update winning tickets"""
    from models.enums import TicketStatus, TransactionType
    from services.notifications import notify_winner, notify_draw_complete
    import uuid
    
    lottery_id = lottery_doc["id"]
    lottery_name = lottery_doc["name"]
    
    # Create the draw record
    draw = {
        "id": str(uuid.uuid4()),
        "lottery_id": lottery_id,
        "lottery_name": lottery_name,
        "winning_numbers": [validated_result.first_prize],
        "first_prize": validated_result.first_prize,
        "second_prize": validated_result.second_prize,
        "third_prize": validated_result.third_prize,
        "position": "primera",
        "draw_time": datetime.now(timezone.utc),
        "draw_date": validated_result.draw_date,
        "total_tickets": 0,
        "total_winners": 0,
        "total_paid": 0.0,
        "currency": lottery_doc.get("currency", "RD$"),
        "is_manual": False,
        "is_automated": True,
        "source": validated_result.source,
        "validated": validated_result.validated,
        "validation_sources": validated_result.validation_sources
    }
    
    total_winners = 0
    total_paid = 0.0
    winner_notifications = []
    
    # Get prize tiers from lottery config
    prize_tiers = lottery_doc.get("prize_tiers", {"first": 70, "second": 15, "third": 5})
    play_types = lottery_doc.get("play_types", {})
    quiniela_config = play_types.get("quiniela", {})
    quiniela_multipliers = quiniela_config.get("multipliers", prize_tiers)
    
    # Process each prize position
    for position, prize_number, tier_key in [
        ("primera", validated_result.first_prize, "first"),
        ("segunda", validated_result.second_prize, "second"),
        ("tercera", validated_result.third_prize, "third")
    ]:
        if prize_number is None:
            continue
        
        # Find pending tickets with this number
        ticket_query = {
            "lottery_id": lottery_id,
            "status": TicketStatus.PENDING.value,
            "numbers": prize_number
        }
        
        matching_tickets = await db.tickets.find(ticket_query).to_list(10000)
        multiplier = quiniela_multipliers.get(tier_key, 70)
        
        for ticket in matching_tickets:
            prize = ticket.get("amount", 0) * multiplier
            
            await db.tickets.update_one(
                {"id": ticket["id"]},
                {"$set": {
                    "status": TicketStatus.WON.value,
                    "draw_id": draw["id"],
                    "potential_win": prize,
                    "won_position": position,
                    "automated_result": True
                }}
            )
            total_winners += 1
            total_paid += prize
            
            # Create transaction
            await db.transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": ticket["seller_id"],
                "user_name": ticket["seller_name"],
                "transaction_type": TransactionType.WIN.value,
                "amount": prize,
                "currency": ticket.get("currency", "RD$"),
                "description": f"Premio {position} (Auto) - {lottery_name} - {ticket['numbers']}",
                "reference_id": ticket["id"],
                "created_at": datetime.now(timezone.utc)
            })
            
            winner_notifications.append({
                "user_id": ticket["seller_id"],
                "ticket_number": ticket["ticket_number"],
                "prize": prize
            })
    
    # Mark remaining pending tickets as lost
    await db.tickets.update_many(
        {
            "lottery_id": lottery_id,
            "status": TicketStatus.PENDING.value
        },
        {"$set": {"status": TicketStatus.LOST.value, "draw_id": draw["id"]}}
    )
    
    # Update draw totals
    draw["total_winners"] = total_winners
    draw["total_paid"] = total_paid
    
    # Save draw
    await db.draws.insert_one(draw)
    
    # Create draw result notification for all users
    import uuid
    notification = {
        "id": str(uuid.uuid4()),
        "type": "draw_result",
        "lottery_id": lottery_id,
        "lottery_name": lottery_name,
        "winning_numbers": [validated_result.first_prize, validated_result.second_prize, validated_result.third_prize],
        "first_prize": validated_result.first_prize,
        "second_prize": validated_result.second_prize,
        "third_prize": validated_result.third_prize,
        "total_winners": total_winners,
        "is_automated": True,
        "created_at": datetime.now(timezone.utc),
        "read_by": []
    }
    await db.notifications.insert_one(notification)
    
    # Send winner notifications
    for winner in winner_notifications:
        seller_notification = {
            "id": str(uuid.uuid4()),
            "type": "winner_alert",
            "user_id": winner["user_id"],
            "lottery_id": lottery_id,
            "lottery_name": lottery_name,
            "ticket_number": winner["ticket_number"],
            "prize_amount": winner["prize"],
            "currency": lottery_doc.get("currency", "RD$"),
            "message": f"🎉 ¡GANADOR! Boleto {winner['ticket_number']} ganó {lottery_doc.get('currency', 'RD$')} {winner['prize']:,.2f}",
            "is_automated": True,
            "created_at": datetime.now(timezone.utc),
            "read": False
        }
        await db.notifications.insert_one(seller_notification)
        
        await notify_winner(
            winner["user_id"],
            winner["ticket_number"],
            winner["prize"],
            lottery_doc.get("currency", "RD$"),
            lottery_name
        )
    
    # Send draw complete notification to admins
    await notify_draw_complete(
        lottery_name,
        [validated_result.first_prize, validated_result.second_prize, validated_result.third_prize],
        total_winners,
        total_paid,
        lottery_doc.get("currency", "RD$")
    )
    
    logger.info(f"✅ Processed draw for {lottery_name}: {total_winners} winners, {total_paid} paid")
    return draw


async def check_and_process_results():
    """Main job: Fetch results and process any new draws"""
    global _last_results, _last_fetch_time
    
    from utils.database import get_db
    from services.notifications import notify_new_lottery_results
    
    logger.info("🔄 Starting automatic lottery results check...")
    
    try:
        db = get_db()
        scraper = get_scraper()
        
        # Fetch latest results from all sources
        current_results = await scraper.fetch_all_results()
        _last_fetch_time = datetime.now(timezone.utc)
        
        if not current_results:
            logger.warning("No results fetched from any source")
            return
        
        # Get all active lotteries from DB
        active_lotteries = await db.lotteries.find({"active": True}).to_list(100)
        
        # Create comprehensive mapping of lottery names to DB records
        # This maps various name variations to the actual lottery document
        lottery_map = {}
        for lot in active_lotteries:
            name_lower = lot["name"].lower()
            lottery_map[name_lower] = lot
            
            # Create variations
            # "Quiniela Leidsa" -> "leidsa", "quiniela leidsa"
            # "Lotería Nacional" -> "nacional", "loteria nacional"
            words = name_lower.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").split()
            for word in words:
                if word not in ["quiniela", "loteria", "lotería", "la", "de", "el"]:
                    lottery_map[word] = lot
            
            # Add specific mappings based on lottery name patterns
            if "leidsa" in name_lower:
                lottery_map["leidsa"] = lot
            if "nacional" in name_lower and "gana" not in name_lower:
                lottery_map["nacional"] = lot
            if "gana" in name_lower and "mas" in name_lower.replace("á", "a"):
                lottery_map["gana_mas"] = lot
            if "real" in name_lower:
                lottery_map["real"] = lot
            if "loteka" in name_lower:
                lottery_map["loteka"] = lot
            if "lotedom" in name_lower:
                lottery_map["lotedom"] = lot
            if "pega" in name_lower and "3" in name_lower:
                lottery_map["pega_3_mas"] = lot
            if "florida" in name_lower:
                if "día" in name_lower or "dia" in name_lower or "day" in name_lower:
                    lottery_map["florida_dia"] = lot
                elif "noche" in name_lower or "night" in name_lower:
                    lottery_map["florida_noche"] = lot
                else:
                    lottery_map["florida"] = lot
            if "new york" in name_lower or "ny" in name_lower:
                if "tarde" in name_lower or "midday" in name_lower:
                    lottery_map["new_york_tarde"] = lot
                elif "noche" in name_lower or "evening" in name_lower or "night" in name_lower:
                    lottery_map["new_york_noche"] = lot
            # La Primera - check before Leidsa to avoid conflicts
            if "primera" in name_lower:
                if "día" in name_lower or "dia" in name_lower:
                    lottery_map["la_primera_dia"] = lot
                    lottery_map["primera_dia"] = lot  # Alternative key
                elif "noche" in name_lower:
                    lottery_map["la_primera_noche"] = lot
                    lottery_map["primera_noche"] = lot  # Alternative key
                else:
                    lottery_map["la_primera"] = lot
            if "suerte" in name_lower:
                if "12:30" in name_lower or "1230" in name_lower:
                    lottery_map["la_suerte_1230"] = lot
                elif "18:00" in name_lower or "1800" in name_lower:
                    lottery_map["la_suerte_1800"] = lot
                else:
                    lottery_map["la_suerte"] = lot
            if "anguila" in name_lower or "anguilla" in name_lower:
                if "mañana" in name_lower or "manana" in name_lower:
                    lottery_map["anguila_manana"] = lot
                elif "medio" in name_lower or "mediodía" in name_lower or "mediodia" in name_lower:
                    lottery_map["anguila_mediodia"] = lot
                elif "tarde" in name_lower:
                    lottery_map["anguila_tarde"] = lot
                elif "noche" in name_lower:
                    lottery_map["anguila_noche"] = lot
                else:
                    lottery_map["anguila"] = lot
            if "king" in name_lower:
                if "12:30" in name_lower or "1230" in name_lower:
                    lottery_map["king_lottery_1230"] = lot
                elif "7:30" in name_lower or "19:30" in name_lower or "730" in name_lower:
                    lottery_map["king_lottery_1930"] = lot
                else:
                    lottery_map["king_lottery"] = lot
        
        logger.info(f"Lottery map created with {len(lottery_map)} entries for {len(active_lotteries)} active lotteries")
        
        # Lotteries that don't require cross-validation (unique sources)
        SINGLE_SOURCE_LOTTERIES = [
            # American lotteries
            "florida_dia", "florida_noche", "florida",
            "new_york_tarde", "new_york_noche", "new_york",
            # Anguila (unique source)
            "anguila", "anguila_manana", "anguila_mediodia", "anguila_tarde", "anguila_noche",
            # King Lottery
            "king_lottery", "king_lottery_1230", "king_lottery_1930",
            # La Primera
            "la_primera", "la_primera_dia", "la_primera_noche",
            # La Suerte
            "la_suerte", "la_suerte_1230", "la_suerte_1800",
            # Gana Más
            "gana_mas",
            # Pega 3 Más
            "pega_3_mas",
        ]
        
        # Track new results for push notification
        new_results_for_notification = []
        
        # Process each result
        for lottery_key, result in current_results.items():
            # Check if validation is required
            requires_validation = lottery_key not in SINGLE_SOURCE_LOTTERIES
            
            if requires_validation and not result.validated:
                logger.warning(f"⚠ Skipping unvalidated result for {lottery_key}")
                continue
            
            # For single-source lotteries, mark as validated with single source
            if not requires_validation and not result.validated:
                result.validated = True
                logger.info(f"✓ Accepting single-source result for {lottery_key}: {result.first_prize}-{result.second_prize}-{result.third_prize}")
            
            # Find matching lottery in DB with improved matching
            matching_lottery = None
            
            # Direct match first
            if lottery_key in lottery_map:
                matching_lottery = lottery_map[lottery_key]
            else:
                # Try partial matching
                for db_key, lot_doc in lottery_map.items():
                    if lottery_key in db_key or db_key in lottery_key:
                        matching_lottery = lot_doc
                        break
                    # Check if any word matches
                    lottery_words = lottery_key.replace("_", " ").split()
                    db_words = db_key.replace("_", " ").split()
                    for lw in lottery_words:
                        if lw in db_words or any(lw in dw for dw in db_words):
                            matching_lottery = lot_doc
                            break
                    if matching_lottery:
                        break
            
            if not matching_lottery:
                logger.debug(f"No matching lottery in DB for: {lottery_key}")
                continue
            
            lottery_id = matching_lottery["id"]
            
            # Check if this is a new result (different from last fetch)
            last_result = _last_results.get(lottery_key)
            is_new = (
                last_result is None or 
                not result.matches(last_result)
            )
            
            if is_new:
                # Check if we already have a draw with these exact numbers today
                today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
                existing_draw = await db.draws.find_one({
                    "lottery_id": lottery_id,
                    "first_prize": result.first_prize,
                    "second_prize": result.second_prize,
                    "third_prize": result.third_prize,
                    "draw_time": {"$gte": today_start}
                })
                
                if existing_draw:
                    logger.info(f"Draw already exists for {lottery_key} with these numbers")
                    _last_results[lottery_key] = result
                    continue
                
                logger.info(f"🆕 New validated result for {lottery_key}: {result.first_prize}-{result.second_prize}-{result.third_prize}")
                
                # Process the new result
                try:
                    await process_new_results(db, result, matching_lottery)
                    _last_results[lottery_key] = result
                    
                    # Add to list for push notification
                    new_results_for_notification.append({
                        "lottery_name": matching_lottery["name"],
                        "first": result.first_prize,
                        "second": result.second_prize,
                        "third": result.third_prize
                    })
                except Exception as e:
                    logger.error(f"Error processing result for {lottery_key}: {e}")
            else:
                logger.debug(f"No change in {lottery_key} results")
        
        # Send push notification to all users about new results
        if new_results_for_notification:
            logger.info(f"📢 Sending push notifications for {len(new_results_for_notification)} new results")
            await notify_new_lottery_results(new_results_for_notification)
        
        logger.info(f"✅ Results check completed. {len(current_results)} lotteries checked.")
        
    except Exception as e:
        logger.error(f"Error in automatic results check: {e}", exc_info=True)


def start_scheduler(interval_minutes: int = 5):
    """Start the automatic results scheduler"""
    global _scheduler, _is_running
    
    if _is_running:
        logger.info("Scheduler already running")
        return
    
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        check_and_process_results,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="lottery_results_checker",
        name="Check Lottery Results",
        replace_existing=True,
        max_instances=1
    )
    
    try:
        _scheduler.start()
        _is_running = True
        logger.info(f"🚀 Lottery results scheduler started (interval: {interval_minutes} minutes)")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")


def stop_scheduler():
    """Stop the automatic results scheduler"""
    global _scheduler, _is_running
    
    if _scheduler:
        _scheduler.shutdown()
        _scheduler = None
        _is_running = False
        logger.info("Scheduler stopped")


def get_scheduler_status() -> dict:
    """Get current scheduler status"""
    global _scheduler, _is_running, _last_fetch_time, _last_results
    
    return {
        "is_running": _is_running,
        "last_fetch_time": _last_fetch_time.isoformat() if _last_fetch_time else None,
        "last_results_count": len(_last_results),
        "last_results": {k: v.to_dict() for k, v in _last_results.items()}
    }
