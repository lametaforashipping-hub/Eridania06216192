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
                result[key] = value.isoformat()
            elif isinstance(value, dict):
                result[key] = serialize_doc(value, exclude_fields)
            elif isinstance(value, list):
                result[key] = serialize_doc(value, exclude_fields)
            else:
                result[key] = value
        return result
    return doc

def generate_ticket_number():
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_part = str(random.randint(1000, 9999))
    return f"TKT-{timestamp}-{random_part}"

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
    Returns: (is_open, next_draw, message, today_hours, holiday_info)
    """
    from datetime import timezone
    now = datetime.now(timezone.utc)
    local_now = now.replace(tzinfo=None) - timedelta(hours=4)
    
    day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    current_day = day_names[local_now.weekday()]
    today_date = local_now.strftime("%Y-%m-%d")
    
    closing_minutes = lottery.get("closing_minutes_before", 15)
    schedule = lottery.get("schedule", [])
    weekly_hours = lottery.get("weekly_hours")
    holidays = lottery.get("holidays", [])
    
    default_opening_time = lottery.get("opening_time", "08:00")
    
    is_open = True
    next_draw = None
    message = None
    holiday_info = None
    
    for holiday in holidays:
        if holiday.get("date") == today_date:
            holiday_info = holiday
            if holiday.get("closed", False):
                is_open = False
                holiday_name = holiday.get("name", "Día festivo")
                message = f"🎉 Cerrada por {holiday_name}"
                today_hours = {"open": None, "close": None, "day": current_day, "holiday": holiday_name, "closed": True}
                return is_open, next_draw, message, today_hours, holiday_info
            else:
                opening_time = holiday.get("open", "10:00")
                closing_time_daily = holiday.get("close", "18:00")
                break
    else:
        if weekly_hours and current_day in weekly_hours:
            day_schedule = weekly_hours[current_day]
            opening_time = day_schedule.get("open", "08:00")
            closing_time_daily = day_schedule.get("close", "21:00")
        else:
            opening_time = lottery.get("opening_time", "08:00")
            closing_time_daily = lottery.get("closing_time", "21:00")
    
    today_hours = {
        "open": opening_time, 
        "close": closing_time_daily, 
        "day": current_day,
        "holiday": holiday_info.get("name") if holiday_info else None
    }
    
    if opening_time:
        open_hour, open_minute = parse_time_string(opening_time)
        if open_hour is not None:
            opening_datetime = local_now.replace(hour=open_hour, minute=open_minute, second=0, microsecond=0)
            if local_now < opening_datetime:
                is_open = False
                if holiday_info:
                    message = f"🎉 {holiday_info.get('name', 'Festivo')} - Abre a las {opening_time}"
                else:
                    message = f"Abre hoy a las {opening_time}"
    
    if closing_time_daily and is_open:
        close_hour, close_minute = parse_time_string(closing_time_daily)
        if close_hour is not None:
            closing_datetime = local_now.replace(hour=close_hour, minute=close_minute, second=0, microsecond=0)
            if local_now > closing_datetime:
                is_open = False
                tomorrow_date = (local_now + timedelta(days=1)).strftime("%Y-%m-%d")
                tomorrow_day = day_names[(local_now.weekday() + 1) % 7]
                tomorrow_holiday = None
                
                for holiday in holidays:
                    if holiday.get("date") == tomorrow_date:
                        tomorrow_holiday = holiday
                        break
                
                if tomorrow_holiday:
                    if tomorrow_holiday.get("closed", False):
                        message = f"Cerrada. Mañana cerrado por {tomorrow_holiday.get('name', 'festivo')}"
                    else:
                        tomorrow_open = tomorrow_holiday.get("open", "10:00")
                        message = f"Cerrada. Mañana ({tomorrow_holiday.get('name', 'festivo')}) abre a las {tomorrow_open}"
                else:
                    if weekly_hours and tomorrow_day in weekly_hours:
                        tomorrow_open = weekly_hours[tomorrow_day].get("open", "08:00")
                    else:
                        tomorrow_open = default_opening_time
                    message = f"Cerrada. Abre mañana ({tomorrow_day[:3]}) a las {tomorrow_open}"
    
    if is_open and schedule:
        for draw_time in sorted(schedule):
            draw_hour, draw_minute = parse_time_string(draw_time)
            if draw_hour is None:
                continue
            draw_datetime = local_now.replace(hour=draw_hour, minute=draw_minute, second=0, microsecond=0)
            closing_before_draw = draw_datetime - timedelta(minutes=closing_minutes)
            
            if local_now < draw_datetime:
                next_draw = draw_time
                if local_now >= closing_before_draw:
                    is_open = False
                    message = f"Cerrada para sorteo {draw_time}. Reabre después del sorteo."
                break
    
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
