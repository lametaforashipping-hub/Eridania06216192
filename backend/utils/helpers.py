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
        
        if hour == 24:
            hour = 0
        
        return (hour, minute)
    except (ValueError, IndexError):
        return (None, None)
