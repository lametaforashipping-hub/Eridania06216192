from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection with Atlas-compatible settings
mongo_url = os.environ['MONGO_URL']

# Configure client with retry and timeout settings for Atlas
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=30000,  # 30 second timeout for server selection
    connectTimeoutMS=30000,  # 30 second connection timeout
    socketTimeoutMS=30000,  # 30 second socket timeout
    retryWrites=True,  # Enable retry writes for Atlas
    retryReads=True,  # Enable retry reads for Atlas
)
db = client[os.environ.get('DB_NAME', 'lottery_db')]

def get_db():
    return db
