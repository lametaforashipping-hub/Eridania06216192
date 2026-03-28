import random
import bcrypt
import jwt
import os
from datetime import datetime, timedelta
from bson import ObjectId

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'lottery-super-secret-key-2024-extended')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

def serialize_doc(doc, exclude_fields=None):
    """Serialize MongoDB documents, excluding sensitive fields"""
    if exclude_fields is None:
        exclude_fields = ['_id', 'password']
    
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d, exclude_fields) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key in exclude_fields:
                continue
            if isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat() + 'Z'
            elif isinstance(value, dict):
                result[key] = serialize_doc(value, exclude_fields)
            elif isinstance(value, list):
                result[key] = serialize_doc(value, exclude_fields)
            else:
                result[key] = value
        return result
    return doc

def generate_ticket_number():
    year = datetime.utcnow().strftime("%Y")
    random_part = str(random.randint(10000, 99999))
    return f"LTMRD{year}{random_part}"

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

def parse_time_string(time_str: str) -> tuple:
    """
    Parse time string in various formats to (hour, minute).
    Supports: "08:00", "8:00", "08:00pm", "8:00 PM", "00:00", "24:00", etc.
    Returns (None, None) if parsing fails.
    """
    if not time_str:
        return (None, None)
    
    time_str = time_str.strip().lower()
    
    is_pm = 'pm' in time_str
    is_am = 'am' in time_str
    time_str = time_str.replace('pm', '').replace('am', '').strip()
    
    try:
        if ':' in time_str:
            parts = time_str.split(':')
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
        else:
            hour = int(time_str)
            minute = 0
        
        if is_pm and hour < 12:
            hour += 12
        elif is_am and hour == 12:
            hour = 0
        
        if hour >= 24:
            hour = 23
            minute = 59
        elif hour < 0:
            hour = 0
            minute = 0
        
        if minute < 0 or minute > 59:
            minute = 0
        
        return (hour, minute)
    except (ValueError, IndexError):
        return (None, None)


def check_lottery_open(lottery: dict) -> tuple:
    """
    Check if lottery is currently open for sales.
    
    Logic:
    - All lotteries open at 7:00 AM (opening_time)
    - Each lottery closes 10 minutes before its draw (closing_time)
    - After the draw, lottery stays CLOSED until 7:00 AM next day
    - If draw_days is specified, only operates on those days
    
    Returns: (is_open, next_draw, message, today_hours, holiday_info)
    """
    from datetime import timezone
    now = datetime.now(timezone.utc)
    local_now = now.replace(tzinfo=None) - timedelta(hours=4)
    
    day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    day_names_es = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
    current_day = day_names[local_now.weekday()]
    current_day_es = day_names_es[local_now.weekday()]
    today_date = local_now.strftime("%Y-%m-%d")
    
    schedule = lottery.get("schedule", [])
    holidays = lottery.get("holidays", [])
    draw_days = lottery.get("draw_days", [])  # e.g., ["monday", "tuesday", "wednesday", "thursday", "saturday"]
    
    # Default times - all lotteries open at 7:00 AM
    opening_time = lottery.get("opening_time", "07:00")
    closing_time = lottery.get("closing_time", "21:00")
    display_opening = lottery.get("display_opening", "7:00 AM")
    display_closing = lottery.get("display_closing", closing_time)
    display_draw = lottery.get("display_time", schedule[0] if schedule else "")
    
    is_open = True
    next_draw = schedule[0] if schedule else None
    message = None
    holiday_info = None
    
    # Check for holidays
    for holiday in holidays:
        if holiday.get("date") == today_date:
            holiday_info = holiday
            if holiday.get("closed", False):
                is_open = False
                holiday_name = holiday.get("name", "Día festivo")
                message = f"Cerrada por {holiday_name}"
                today_hours = {"open": None, "close": None, "day": current_day, "holiday": holiday_name, "closed": True}
                return is_open, next_draw, message, today_hours, holiday_info
            break
    
    today_hours = {
        "open": display_opening,
        "close": display_closing,
        "day": current_day,
        "holiday": holiday_info.get("name") if holiday_info else None
    }
    
    # Check if today is a draw day (if draw_days is specified)
    if draw_days and current_day not in draw_days:
        is_open = False
        # Find next draw day
        next_draw_day = None
        for i in range(1, 8):
            next_day_idx = (local_now.weekday() + i) % 7
            if day_names[next_day_idx] in draw_days:
                next_draw_day = day_names_es[next_day_idx]
                break
        
        if next_draw_day:
            message = f"Abre el {next_draw_day} a las {display_opening}"
        else:
            message = f"Cerrada hoy"
        
        today_hours["closed"] = True
        return is_open, next_draw, message, today_hours, holiday_info
    
    # Parse times
    open_hour, open_minute = parse_time_string(opening_time)
    close_hour, close_minute = parse_time_string(closing_time)
    
    if open_hour is None:
        open_hour, open_minute = 7, 0
    if close_hour is None:
        close_hour, close_minute = 21, 0
    
    opening_datetime = local_now.replace(hour=open_hour, minute=open_minute, second=0, microsecond=0)
    closing_datetime = local_now.replace(hour=close_hour, minute=close_minute, second=0, microsecond=0)
    
    # Get draw time
    draw_hour, draw_minute = None, None
    if schedule:
        draw_hour, draw_minute = parse_time_string(schedule[0])
    
    if draw_hour is not None:
        draw_datetime = local_now.replace(hour=draw_hour, minute=draw_minute, second=0, microsecond=0)
    else:
        draw_datetime = closing_datetime
    
    # Find tomorrow's draw day
    tomorrow_day_es = day_names_es[(local_now.weekday() + 1) % 7]
    if draw_days:
        # Find the actual next draw day
        for i in range(1, 8):
            next_day_idx = (local_now.weekday() + i) % 7
            if day_names[next_day_idx] in draw_days:
                tomorrow_day_es = day_names_es[next_day_idx]
                break
    
    # LOGIC:
    # 1. Before 7:00 AM = CLOSED (hasn't opened yet)
    # 2. Between 7:00 AM and closing_time (10 min before draw) = OPEN
    # 3. After closing_time = CLOSED until 7:00 AM next draw day
    
    if local_now < opening_datetime:
        # Before opening time
        is_open = False
        message = f"Abre hoy a las {display_opening}"
    elif local_now >= closing_datetime:
        # After closing time - closed until next draw day 7:00 AM
        is_open = False
        if local_now < draw_datetime:
            # Between closing and draw - waiting for draw
            message = f"Cerrada. Sorteo a las {display_draw}"
        else:
            # After draw - closed until next draw day
            message = f"Abre el {tomorrow_day_es} a las 7:00 AM"
    else:
        # Open for sales
        is_open = True
        message = None
    
    return is_open, next_draw, message, today_hours, holiday_info


def calculate_prize(ticket: dict, lottery: dict, winning_numbers: list, position: str = None) -> float:
    """Calculate prize based on lottery rules and position"""
    prize_rules = lottery.get("prize_rules", [])
    ticket_numbers = ticket["numbers"]
    ticket_position = ticket.get("position")
    lottery_type = lottery.get("lottery_type", "")
    
    if prize_rules and position:
        for rule in prize_rules:
            if rule.get("position") == position or rule.get("position") == "any":
                if ticket_numbers == winning_numbers:
                    return ticket["amount"] * rule.get("multiplier", lottery["prize_multiplier"])
    
    quiniela_types = ["quiniela", "pega3", "pega4"]
    if lottery_type in quiniela_types:
        if ticket_numbers == winning_numbers:
            if ticket_position and position:
                if ticket_position == position:
                    return ticket["amount"] * lottery["prize_multiplier"]
            else:
                return ticket["amount"] * lottery["prize_multiplier"]
    else:
        matches = len(set(ticket_numbers).intersection(set(winning_numbers)))
        if matches == lottery.get("numbers_to_pick", 1):
            return ticket["amount"] * lottery["prize_multiplier"]
    
    return 0
