"""Statistics routes"""
from fastapi import APIRouter, HTTPException
from utils.database import get_db
from utils.helpers import serialize_doc

router = APIRouter(prefix="/stats", tags=["Statistics"])


@router.get("/numbers/{lottery_id}")
async def get_number_stats(lottery_id: str):
    """Get hot and cold numbers statistics for a lottery"""
    db = get_db()
    
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    stats = await db.number_stats.find({"lottery_id": lottery_id}).to_list(100)
    stats = serialize_doc(stats)
    
    if not stats:
        return {"hot_numbers": [], "cold_numbers": [], "all_stats": []}
    
    frequencies = [s.get("frequency", 0) for s in stats]
    if frequencies:
        avg_freq = sum(frequencies) / len(frequencies)
        hot_threshold = avg_freq * 1.3
        cold_threshold = avg_freq * 0.7
        
        hot_numbers = [s["number"] for s in stats if s.get("frequency", 0) > hot_threshold]
        cold_numbers = [s["number"] for s in stats if s.get("frequency", 0) < cold_threshold]
    else:
        hot_numbers = []
        cold_numbers = []
    
    return {
        "hot_numbers": hot_numbers[:10],
        "cold_numbers": cold_numbers[:10],
        "all_stats": stats
    }
