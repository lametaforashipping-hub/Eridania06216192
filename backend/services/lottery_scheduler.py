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
        
        # Map lottery names to DB records
        lottery_map = {}
        for lot in active_lotteries:
            name_lower = lot["name"].lower()
            lottery_map[name_lower] = lot
            # Also map by common variations
            for word in name_lower.split():
                lottery_map[word] = lot
        
        # Process each result
        for lottery_key, result in current_results.items():
            # Only process validated results (2+ sources agree)
            if not result.validated:
                logger.warning(f"⚠ Skipping unvalidated result for {lottery_key}")
                continue
            
            # Find matching lottery in DB
            matching_lottery = None
            for db_name, lot_doc in lottery_map.items():
                if lottery_key in db_name or db_name in lottery_key:
                    matching_lottery = lot_doc
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
                except Exception as e:
                    logger.error(f"Error processing result for {lottery_key}: {e}")
            else:
                logger.debug(f"No change in {lottery_key} results")
        
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
