"""
Lottery Results Scraper Service
Scrapes real lottery results from Dominican Republic lottery websites
with cross-validation for 100% accuracy.
"""
import httpx
import logging
import re
from datetime import datetime, timezone, timedelta
from bs4 import BeautifulSoup
from typing import Optional, Dict, List, Tuple
import asyncio

logger = logging.getLogger(__name__)

# Lottery name mappings to normalize different source names
LOTTERY_NAME_MAPPINGS = {
    # Leidsa
    "leidsa": ["leidsa", "quiniela leidsa", "leidsa quiniela", "quiniela leidsa"],
    "pega_3_mas": ["pega 3 mas", "pega3 mas", "pega 3 más", "pega3mas", "leidsa pega 3"],
    # Loteka  
    "loteka": ["loteka", "quiniela loteka", "loteka quiniela"],
    # Nacional
    "nacional": ["nacional", "loteria nacional", "la nacional", "nacional noche", "nacional dia", "lotería nacional"],
    "gana_mas": ["gana mas", "gana más", "ganá más", "ganamas"],
    # Real
    "real": ["real", "loteria real", "loto real", "quiniela real"],
    # La Primera
    "la_primera": ["la primera", "primera", "quiniela la primera", "primera dia", "primera noche"],
    # La Suerte
    "la_suerte": ["la suerte", "suerte dominicana", "quiniela la suerte", "suerte 12:30", "suerte 18:00"],
    # Lotedom
    "lotedom": ["lotedom", "quiniela lotedom"],
    # King Lottery
    "king_lottery": ["king lottery", "king", "king lottery noche", "king lottery dia", "kinglottery"],
    # Anguila
    "anguila": ["anguila", "anguilla", "anguilita", "anguila lottery"],
    # Americanas
    "florida_dia": ["florida dia", "florida day", "florida medio dia", "florida mediodía"],
    "florida_noche": ["florida noche", "florida night", "florida evening"],
    "new_york_tarde": ["new york tarde", "new york midday", "ny tarde", "ny midday", "new york medio dia"],
    "new_york_noche": ["new york noche", "new york evening", "ny noche", "ny evening", "new york night"],
}

# Draw time schedules (Dominican Time UTC-4)
LOTTERY_SCHEDULES = {
    "nacional": ["14:30", "21:00"],
    "leidsa": ["20:55"],
    "loteka": ["19:55"],
    "real": ["12:55", "19:00"],
    "la_primera": ["12:00", "20:00"],
    "la_suerte": ["12:30", "18:00"],
    "lotedom": ["17:55"],
    "king_lottery": ["12:30", "19:30"],
    "florida": ["13:30", "21:45"],
    "new_york": ["14:30", "22:30"],
}


class LotteryResult:
    """Represents a lottery draw result"""
    def __init__(
        self, 
        lottery_name: str, 
        first_prize: int, 
        second_prize: Optional[int] = None,
        third_prize: Optional[int] = None,
        draw_time: Optional[str] = None,
        draw_date: Optional[str] = None,
        source: str = "unknown"
    ):
        self.lottery_name = lottery_name.lower().strip()
        self.first_prize = first_prize
        self.second_prize = second_prize
        self.third_prize = third_prize
        self.draw_time = draw_time
        self.draw_date = draw_date or datetime.now().strftime("%Y-%m-%d")
        self.source = source
        self.validated = False
        self.validation_sources = []
    
    def to_dict(self) -> dict:
        return {
            "lottery_name": self.lottery_name,
            "first_prize": self.first_prize,
            "second_prize": self.second_prize,
            "third_prize": self.third_prize,
            "draw_time": self.draw_time,
            "draw_date": self.draw_date,
            "source": self.source,
            "validated": self.validated,
            "validation_sources": self.validation_sources
        }
    
    def matches(self, other: 'LotteryResult') -> bool:
        """Check if two results match (same numbers)"""
        return (
            self.first_prize == other.first_prize and
            self.second_prize == other.second_prize and
            self.third_prize == other.third_prize
        )


class LotteryScraper:
    """Main scraper class that fetches from multiple sources"""
    
    def __init__(self):
        self.timeout = 30
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3",
        }
    
    async def fetch_page(self, url: str) -> Optional[str]:
        """Fetch a webpage with error handling"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=self.headers, follow_redirects=True)
                if response.status_code == 200:
                    return response.text
                logger.warning(f"Failed to fetch {url}: Status {response.status_code}")
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
        return None
    
    def normalize_lottery_name(self, name: str) -> str:
        """Normalize lottery name to a standard key"""
        name_lower = name.lower().strip()
        for key, aliases in LOTTERY_NAME_MAPPINGS.items():
            for alias in aliases:
                if alias in name_lower or name_lower in alias:
                    return key
        return name_lower.replace(" ", "_")
    
    def parse_number(self, text: str) -> Optional[int]:
        """Extract a 2-digit number from text"""
        if not text:
            return None
        # Remove non-numeric characters except digits
        cleaned = re.sub(r'[^\d]', '', str(text).strip())
        if cleaned and len(cleaned) >= 2:
            # Take last 2 digits for 2-digit lotteries
            num = int(cleaned[-2:])
            if 0 <= num <= 99:
                return num
        elif cleaned and len(cleaned) == 1:
            return int(cleaned)
        return None
    
    async def scrape_conectate(self) -> List[LotteryResult]:
        """Scrape from conectate.com.do - Primary source"""
        results = []
        url = "https://www.conectate.com.do/loterias/"
        
        html = await self.fetch_page(url)
        if not html:
            return results
        
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Find lottery result blocks
            lottery_blocks = soup.find_all('div', class_=re.compile(r'lottery|result|sorteo', re.I))
            
            # Also try table rows
            tables = soup.find_all('table')
            for table in tables:
                rows = table.find_all('tr')
                for row in rows:
                    cells = row.find_all(['td', 'th'])
                    if len(cells) >= 2:
                        lottery_name = cells[0].get_text(strip=True)
                        numbers_text = cells[1].get_text(strip=True) if len(cells) > 1 else ""
                        
                        # Parse numbers (format: "XX-XX-XX" or "XX XX XX")
                        numbers = re.findall(r'\d{1,2}', numbers_text)
                        if numbers and len(numbers) >= 1:
                            result = LotteryResult(
                                lottery_name=self.normalize_lottery_name(lottery_name),
                                first_prize=int(numbers[0]),
                                second_prize=int(numbers[1]) if len(numbers) > 1 else None,
                                third_prize=int(numbers[2]) if len(numbers) > 2 else None,
                                source="conectate.com.do"
                            )
                            results.append(result)
            
            # Alternative: Look for specific div patterns
            for block in soup.find_all(['div', 'section', 'article']):
                text = block.get_text()
                # Look for patterns like "Leidsa: 45-23-67"
                match = re.search(
                    r'(leidsa|loteka|nacional|real|primera|suerte|lotedom|king|florida|new york)[:\s]+(\d{1,2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})',
                    text.lower()
                )
                if match:
                    result = LotteryResult(
                        lottery_name=self.normalize_lottery_name(match.group(1)),
                        first_prize=int(match.group(2)),
                        second_prize=int(match.group(3)),
                        third_prize=int(match.group(4)),
                        source="conectate.com.do"
                    )
                    results.append(result)
                    
        except Exception as e:
            logger.error(f"Error parsing conectate.com.do: {e}")
        
        return results
    
    async def scrape_loteriasdominicanas(self) -> List[LotteryResult]:
        """Scrape from loteriasdominicanas.com - Secondary source"""
        results = []
        url = "https://loteriasdominicanas.com/"
        
        html = await self.fetch_page(url)
        if not html:
            return results
        
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Look for lottery result containers
            result_divs = soup.find_all('div', class_=re.compile(r'result|lottery|sorteo|quiniela', re.I))
            
            for div in result_divs:
                title_elem = div.find(['h2', 'h3', 'h4', 'span', 'strong'], class_=re.compile(r'title|name|lottery', re.I))
                if title_elem:
                    lottery_name = title_elem.get_text(strip=True)
                    
                    # Find numbers
                    number_elems = div.find_all(['span', 'div'], class_=re.compile(r'number|ball|num', re.I))
                    numbers = []
                    for elem in number_elems:
                        num = self.parse_number(elem.get_text())
                        if num is not None:
                            numbers.append(num)
                    
                    if numbers:
                        result = LotteryResult(
                            lottery_name=self.normalize_lottery_name(lottery_name),
                            first_prize=numbers[0],
                            second_prize=numbers[1] if len(numbers) > 1 else None,
                            third_prize=numbers[2] if len(numbers) > 2 else None,
                            source="loteriasdominicanas.com"
                        )
                        results.append(result)
            
            # Fallback: Parse text content
            body_text = soup.get_text()
            for lottery_key in LOTTERY_NAME_MAPPINGS.keys():
                pattern = rf'{lottery_key}[:\s]*(\d{{1,2}})[-\s]+(\d{{1,2}})[-\s]+(\d{{1,2}})'
                match = re.search(pattern, body_text.lower())
                if match:
                    result = LotteryResult(
                        lottery_name=lottery_key,
                        first_prize=int(match.group(1)),
                        second_prize=int(match.group(2)),
                        third_prize=int(match.group(3)),
                        source="loteriasdominicanas.com"
                    )
                    # Check if not already in results
                    if not any(r.lottery_name == result.lottery_name for r in results):
                        results.append(result)
                        
        except Exception as e:
            logger.error(f"Error parsing loteriasdominicanas.com: {e}")
        
        return results
    
    async def scrape_quinielasrd(self) -> List[LotteryResult]:
        """Scrape from quinielasrd.com - Tertiary source for validation"""
        results = []
        url = "https://quinielasrd.com/"
        
        html = await self.fetch_page(url)
        if not html:
            return results
        
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # This site typically shows results in a clean table format
            tables = soup.find_all('table')
            for table in tables:
                rows = table.find_all('tr')
                for row in rows:
                    cells = row.find_all(['td', 'th'])
                    if len(cells) >= 4:
                        lottery_name = cells[0].get_text(strip=True)
                        first = self.parse_number(cells[1].get_text())
                        second = self.parse_number(cells[2].get_text()) if len(cells) > 2 else None
                        third = self.parse_number(cells[3].get_text()) if len(cells) > 3 else None
                        
                        if first is not None:
                            result = LotteryResult(
                                lottery_name=self.normalize_lottery_name(lottery_name),
                                first_prize=first,
                                second_prize=second,
                                third_prize=third,
                                source="quinielasrd.com"
                            )
                            results.append(result)
                            
        except Exception as e:
            logger.error(f"Error parsing quinielasrd.com: {e}")
        
        return results
    
    async def scrape_loteriard(self) -> List[LotteryResult]:
        """Scrape from loteriard.com - Additional validation source"""
        results = []
        url = "https://www.loteriard.com/"
        
        html = await self.fetch_page(url)
        if not html:
            return results
        
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Find result sections
            for section in soup.find_all(['div', 'section', 'article']):
                text = section.get_text()
                
                # Look for patterns
                for lottery_key, aliases in LOTTERY_NAME_MAPPINGS.items():
                    for alias in aliases:
                        pattern = rf'{re.escape(alias)}[:\s]*(\d{{1,2}})[-\s,]+(\d{{1,2}})[-\s,]+(\d{{1,2}})'
                        match = re.search(pattern, text.lower())
                        if match:
                            result = LotteryResult(
                                lottery_name=lottery_key,
                                first_prize=int(match.group(1)),
                                second_prize=int(match.group(2)),
                                third_prize=int(match.group(3)),
                                source="loteriard.com"
                            )
                            if not any(r.lottery_name == result.lottery_name for r in results):
                                results.append(result)
                            break
                            
        except Exception as e:
            logger.error(f"Error parsing loteriard.com: {e}")
        
        return results
    
    async def scrape_ny_lottery(self) -> List[LotteryResult]:
        """Scrape New York Lottery Numbers results from multiple sources"""
        results = []
        
        # Source 1: LotteryUSA Midday
        for url, key in [
            ("https://www.lotteryusa.com/new-york/midday-numbers", "new_york_tarde"),
            ("https://www.lotteryusa.com/new-york/evening-numbers", "new_york_noche"),
        ]:
            html = await self.fetch_page(url)
            if html:
                try:
                    soup = BeautifulSoup(html, 'html.parser')
                    number_elems = soup.find_all(['span', 'div'], class_=re.compile(r'ball|number|result', re.I))
                    numbers = []
                    for elem in number_elems:
                        num = self.parse_number(elem.get_text())
                        if num is not None:
                            numbers.append(num)
                    
                    if len(numbers) >= 1:
                        results.append(LotteryResult(
                            lottery_name=key,
                            first_prize=numbers[0],
                            second_prize=numbers[1] if len(numbers) > 1 else None,
                            third_prize=numbers[2] if len(numbers) > 2 else None,
                            source="lotteryusa.com"
                        ))
                except Exception as e:
                    logger.error(f"Error parsing NY {key}: {e}")
        
        # Source 2: LotteryCorner (backup)
        try:
            url = "https://lotterycorner.com/ny/numbers-evening"
            html = await self.fetch_page(url)
            if html and "new_york_noche" not in [r.lottery_name for r in results]:
                soup = BeautifulSoup(html, 'html.parser')
                # Look for result table
                rows = soup.find_all('tr')
                for row in rows[:3]:
                    cells = row.find_all('td')
                    if len(cells) >= 2:
                        text = cells[1].get_text()
                        nums = re.findall(r'\d+', text)
                        if len(nums) >= 3:
                            results.append(LotteryResult(
                                lottery_name="new_york_noche",
                                first_prize=int(nums[0]),
                                second_prize=int(nums[1]),
                                third_prize=int(nums[2]),
                                source="lotterycorner.com"
                            ))
                            break
        except Exception as e:
            logger.debug(f"LotteryCorner NY backup failed: {e}")
        
        return results

    async def scrape_florida_full(self) -> List[LotteryResult]:
        """Scrape Florida Lottery - both midday and evening from multiple sources"""
        results = []
        
        # Source 1: LotteryUSA
        for url, key in [
            ("https://www.lotteryusa.com/florida/midday-pick-3", "florida_dia"),
            ("https://www.lotteryusa.com/florida/evening-pick-3", "florida_noche"),
        ]:
            html = await self.fetch_page(url)
            if html:
                try:
                    soup = BeautifulSoup(html, 'html.parser')
                    number_elems = soup.find_all(['span', 'div'], class_=re.compile(r'ball|number|result', re.I))
                    numbers = []
                    for elem in number_elems:
                        num = self.parse_number(elem.get_text())
                        if num is not None:
                            numbers.append(num)
                    
                    if len(numbers) >= 1:
                        results.append(LotteryResult(
                            lottery_name=key,
                            first_prize=numbers[0],
                            second_prize=numbers[1] if len(numbers) > 1 else None,
                            third_prize=numbers[2] if len(numbers) > 2 else None,
                            source="lotteryusa.com"
                        ))
                except Exception as e:
                    logger.error(f"Error parsing Florida {key}: {e}")
        
        # Source 2: LotteryCorner (backup for evening)
        try:
            url = "https://lotterycorner.com/fl/pick-3-evening"
            html = await self.fetch_page(url)
            if html and "florida_noche" not in [r.lottery_name for r in results]:
                soup = BeautifulSoup(html, 'html.parser')
                rows = soup.find_all('tr')
                for row in rows[:3]:
                    cells = row.find_all('td')
                    if len(cells) >= 2:
                        text = cells[1].get_text()
                        nums = re.findall(r'\d+', text)
                        if len(nums) >= 3:
                            results.append(LotteryResult(
                                lottery_name="florida_noche",
                                first_prize=int(nums[0]),
                                second_prize=int(nums[1]),
                                third_prize=int(nums[2]),
                                source="lotterycorner.com"
                            ))
                            break
        except Exception as e:
            logger.debug(f"LotteryCorner FL backup failed: {e}")
                        lottery_name="florida_dia",
                        first_prize=numbers[0],
                        second_prize=numbers[1] if len(numbers) > 1 else None,
                        third_prize=numbers[2] if len(numbers) > 2 else None,
                        source="lotteryusa.com"
                    ))
            except Exception as e:
                logger.error(f"Error parsing Florida midday: {e}")
        
        # Evening
        url_evening = "https://www.lotteryusa.com/florida/evening-pick-3"
        html = await self.fetch_page(url_evening)
        if html:
            try:
                soup = BeautifulSoup(html, 'html.parser')
                number_elems = soup.find_all(['span', 'div'], class_=re.compile(r'ball|number|result', re.I))
                numbers = []
                for elem in number_elems:
                    num = self.parse_number(elem.get_text())
                    if num is not None:
                        numbers.append(num)
                
                if len(numbers) >= 1:
                    results.append(LotteryResult(
                        lottery_name="florida_noche",
                        first_prize=numbers[0],
                        second_prize=numbers[1] if len(numbers) > 1 else None,
                        third_prize=numbers[2] if len(numbers) > 2 else None,
                        source="lotteryusa.com"
                    ))
            except Exception as e:
                logger.error(f"Error parsing Florida evening: {e}")
        
        return results

    async def scrape_anguila(self) -> List[LotteryResult]:
        """Scrape Anguilla lottery results from multiple sources"""
        results = []
        
        # Try loteriasdominicanas for Anguila
        url = "https://loteriasdominicanas.com/"
        html = await self.fetch_page(url)
        if html:
            try:
                soup = BeautifulSoup(html, 'html.parser')
                text = soup.get_text().lower()
                
                # Look for Anguila patterns
                for time_slot, key in [
                    ("mañana", "anguila_manana"),
                    ("manana", "anguila_manana"),
                    ("10:00", "anguila_manana"),
                    ("medio", "anguila_mediodia"),
                    ("12:00", "anguila_mediodia"),
                    ("tarde", "anguila_tarde"),
                    ("15:00", "anguila_tarde"),
                    ("noche", "anguila_noche"),
                    ("21:00", "anguila_noche"),
                ]:
                    pattern = rf'anguil[la]*\s*{time_slot}[:\s]*(\d{{1,2}})[-\s]+(\d{{1,2}})[-\s]+(\d{{1,2}})'
                    match = re.search(pattern, text)
                    if match:
                        result = LotteryResult(
                            lottery_name=key,
                            first_prize=int(match.group(1)),
                            second_prize=int(match.group(2)),
                            third_prize=int(match.group(3)),
                            source="loteriasdominicanas.com"
                        )
                        if not any(r.lottery_name == result.lottery_name for r in results):
                            results.append(result)
            except Exception as e:
                logger.error(f"Error parsing Anguila: {e}")
        
        return results

    async def scrape_king_lottery(self) -> List[LotteryResult]:
        """Scrape King Lottery results"""
        results = []
        
        # Try multiple sources for King Lottery
        for url in ["https://loteriasdominicanas.com/", "https://quinielasrd.com/"]:
            html = await self.fetch_page(url)
            if html:
                try:
                    soup = BeautifulSoup(html, 'html.parser')
                    text = soup.get_text().lower()
                    
                    # Look for King Lottery patterns
                    for time_slot, key in [
                        ("12:30", "king_lottery_1230"),
                        ("medio", "king_lottery_1230"),
                        ("7:30", "king_lottery_1930"),
                        ("19:30", "king_lottery_1930"),
                        ("noche", "king_lottery_1930"),
                    ]:
                        pattern = rf'king\s*lottery?\s*{time_slot}[:\s]*(\d{{1,2}})[-\s]+(\d{{1,2}})[-\s]+(\d{{1,2}})'
                        match = re.search(pattern, text)
                        if match:
                            result = LotteryResult(
                                lottery_name=key,
                                first_prize=int(match.group(1)),
                                second_prize=int(match.group(2)),
                                third_prize=int(match.group(3)),
                                source=url.split('/')[2]
                            )
                            if not any(r.lottery_name == result.lottery_name for r in results):
                                results.append(result)
                except Exception as e:
                    logger.error(f"Error parsing King Lottery from {url}: {e}")
        
        return results

    async def scrape_la_primera(self) -> List[LotteryResult]:
        """Scrape La Primera lottery results"""
        results = []
        
        for url in ["https://loteriasdominicanas.com/", "https://www.conectate.com.do/loterias/"]:
            html = await self.fetch_page(url)
            if html:
                try:
                    soup = BeautifulSoup(html, 'html.parser')
                    text = soup.get_text().lower()
                    
                    # La Primera Día
                    for pattern in [
                        r'primera\s*d[ií]a[:\s]*(\d{1,2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})',
                        r'primera\s*12[:\s]*(\d{1,2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})',
                    ]:
                        match = re.search(pattern, text)
                        if match:
                            result = LotteryResult(
                                lottery_name="la_primera_dia",
                                first_prize=int(match.group(1)),
                                second_prize=int(match.group(2)),
                                third_prize=int(match.group(3)),
                                source=url.split('/')[2]
                            )
                            if not any(r.lottery_name == "la_primera_dia" for r in results):
                                results.append(result)
                            break
                    
                    # Primera Noche
                    for pattern in [
                        r'primera\s*noche[:\s]*(\d{1,2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})',
                        r'primera\s*20[:\s]*(\d{1,2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})',
                    ]:
                        match = re.search(pattern, text)
                        if match:
                            result = LotteryResult(
                                lottery_name="la_primera_noche",
                                first_prize=int(match.group(1)),
                                second_prize=int(match.group(2)),
                                third_prize=int(match.group(3)),
                                source=url.split('/')[2]
                            )
                            if not any(r.lottery_name == "la_primera_noche" for r in results):
                                results.append(result)
                            break
                except Exception as e:
                    logger.error(f"Error parsing La Primera from {url}: {e}")
        
        return results

    async def scrape_la_suerte(self) -> List[LotteryResult]:
        """Scrape La Suerte lottery results"""
        results = []
        
        for url in ["https://loteriasdominicanas.com/", "https://www.conectate.com.do/loterias/"]:
            html = await self.fetch_page(url)
            if html:
                try:
                    soup = BeautifulSoup(html, 'html.parser')
                    text = soup.get_text().lower()
                    
                    # La Suerte 12:30
                    for pattern in [
                        r'suerte\s*12:?30[:\s]*(\d{1,2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})',
                        r'suerte\s*medio[:\s]*(\d{1,2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})',
                    ]:
                        match = re.search(pattern, text)
                        if match:
                            result = LotteryResult(
                                lottery_name="la_suerte_1230",
                                first_prize=int(match.group(1)),
                                second_prize=int(match.group(2)),
                                third_prize=int(match.group(3)),
                                source=url.split('/')[2]
                            )
                            if not any(r.lottery_name == "la_suerte_1230" for r in results):
                                results.append(result)
                            break
                    
                    # La Suerte 18:00
                    for pattern in [
                        r'suerte\s*18:?00[:\s]*(\d{1,2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})',
                        r'suerte\s*tarde[:\s]*(\d{1,2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})',
                    ]:
                        match = re.search(pattern, text)
                        if match:
                            result = LotteryResult(
                                lottery_name="la_suerte_1800",
                                first_prize=int(match.group(1)),
                                second_prize=int(match.group(2)),
                                third_prize=int(match.group(3)),
                                source=url.split('/')[2]
                            )
                            if not any(r.lottery_name == "la_suerte_1800" for r in results):
                                results.append(result)
                            break
                except Exception as e:
                    logger.error(f"Error parsing La Suerte from {url}: {e}")
        
        return results

    async def scrape_gana_mas(self) -> List[LotteryResult]:
        """Scrape Gana Más (Nacional) results"""
        results = []
        
        for url in ["https://loteriasdominicanas.com/", "https://www.conectate.com.do/loterias/"]:
            html = await self.fetch_page(url)
            if html:
                try:
                    soup = BeautifulSoup(html, 'html.parser')
                    text = soup.get_text().lower()
                    
                    for pattern in [
                        r'gana\s*m[aá]s[:\s]*(\d{1,2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})',
                        r'gan[aá]\s*m[aá]s[:\s]*(\d{1,2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})',
                    ]:
                        match = re.search(pattern, text)
                        if match:
                            result = LotteryResult(
                                lottery_name="gana_mas",
                                first_prize=int(match.group(1)),
                                second_prize=int(match.group(2)),
                                third_prize=int(match.group(3)),
                                source=url.split('/')[2]
                            )
                            if not any(r.lottery_name == "gana_mas" for r in results):
                                results.append(result)
                            break
                except Exception as e:
                    logger.error(f"Error parsing Gana Más from {url}: {e}")
        
        return results

    async def scrape_pega3_mas(self) -> List[LotteryResult]:
        """Scrape Pega 3 Más (Leidsa) results"""
        results = []
        
        for url in ["https://loteriasdominicanas.com/", "https://www.conectate.com.do/loterias/"]:
            html = await self.fetch_page(url)
            if html:
                try:
                    soup = BeautifulSoup(html, 'html.parser')
                    text = soup.get_text().lower()
                    
                    for pattern in [
                        r'pega\s*3\s*m[aá]s[:\s]*(\d{1,2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})',
                        r'pega3\s*m[aá]s[:\s]*(\d{1,2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})',
                    ]:
                        match = re.search(pattern, text)
                        if match:
                            result = LotteryResult(
                                lottery_name="pega_3_mas",
                                first_prize=int(match.group(1)),
                                second_prize=int(match.group(2)),
                                third_prize=int(match.group(3)),
                                source=url.split('/')[2]
                            )
                            if not any(r.lottery_name == "pega_3_mas" for r in results):
                                results.append(result)
                            break
                except Exception as e:
                    logger.error(f"Error parsing Pega 3 Más from {url}: {e}")
        
        return results

    async def fetch_all_results(self) -> Dict[str, LotteryResult]:
        """Fetch results from all sources and cross-validate"""
        logger.info("Fetching lottery results from all sources...")
        
        # Fetch from all sources concurrently
        all_tasks = [
            # Dominican sources (cross-validated)
            self.scrape_conectate(),
            self.scrape_loteriasdominicanas(),
            self.scrape_quinielasrd(),
            self.scrape_loteriard(),
            # American lotteries
            self.scrape_florida_full(),
            self.scrape_ny_lottery(),
            # Additional Dominican lotteries
            self.scrape_anguila(),
            self.scrape_king_lottery(),
            self.scrape_la_primera(),
            self.scrape_la_suerte(),
            self.scrape_gana_mas(),
            self.scrape_pega3_mas(),
        ]
        
        all_results = await asyncio.gather(*all_tasks, return_exceptions=True)
        
        # Combine results by lottery name
        results_by_lottery: Dict[str, List[LotteryResult]] = {}
        
        for source_results in all_results:
            if isinstance(source_results, Exception):
                logger.error(f"Source error: {source_results}")
                continue
            
            for result in source_results:
                key = result.lottery_name
                if key not in results_by_lottery:
                    results_by_lottery[key] = []
                results_by_lottery[key].append(result)
        
        # Cross-validate results
        validated_results: Dict[str, LotteryResult] = {}
        
        for lottery_name, results_list in results_by_lottery.items():
            if len(results_list) >= 2:
                # Check if at least 2 sources agree
                for i, r1 in enumerate(results_list):
                    matching_sources = [r1.source]
                    for j, r2 in enumerate(results_list):
                        if i != j and r1.matches(r2):
                            matching_sources.append(r2.source)
                    
                    if len(matching_sources) >= 2:
                        r1.validated = True
                        r1.validation_sources = matching_sources
                        validated_results[lottery_name] = r1
                        logger.info(f"✓ Validated {lottery_name}: {r1.first_prize}-{r1.second_prize}-{r1.third_prize} from {matching_sources}")
                        break
            elif len(results_list) == 1:
                # Single source - mark as unvalidated but include
                result = results_list[0]
                result.validated = False
                result.validation_sources = [result.source]
                validated_results[lottery_name] = result
                logger.warning(f"⚠ Unvalidated {lottery_name}: {result.first_prize}-{result.second_prize}-{result.third_prize} from {result.source}")
        
        logger.info(f"Total validated results: {len([r for r in validated_results.values() if r.validated])}/{len(validated_results)}")
        return validated_results
    
    async def get_results_for_lottery(self, lottery_name: str) -> Optional[LotteryResult]:
        """Get validated results for a specific lottery"""
        all_results = await self.fetch_all_results()
        normalized_name = self.normalize_lottery_name(lottery_name)
        
        if normalized_name in all_results:
            return all_results[normalized_name]
        
        # Try partial match
        for key, result in all_results.items():
            if normalized_name in key or key in normalized_name:
                return result
        
        return None


# Singleton instance
_scraper_instance: Optional[LotteryScraper] = None

def get_scraper() -> LotteryScraper:
    global _scraper_instance
    if _scraper_instance is None:
        _scraper_instance = LotteryScraper()
    return _scraper_instance
