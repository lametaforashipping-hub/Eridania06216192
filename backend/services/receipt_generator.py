"""Receipt image generator service using Pillow - Clean thermal printer style with logo"""
import io
import os
import base64
from datetime import datetime, timedelta, timezone
from collections import OrderedDict
from PIL import Image, ImageDraw, ImageFont
import qrcode


BOLD_FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
REGULAR_FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

PLAY_TYPE_ABBR = {
    "quiniela": "Q", "pale": "P", "tripleta": "T",
    "super_pale": "SP", "first": "1ra", "second": "2da", "third": "3ra"
}

# Load logo from PNG file (golden ball with 7)
_LOGO_IMG = None
def _get_logo():
    global _LOGO_IMG
    if _LOGO_IMG is None:
        logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "logo_receipt.png")
        try:
            _LOGO_IMG = Image.open(logo_path).copy()
        except Exception as e:
            print(f"[RECEIPT] Cannot load logo: {e}")
            _LOGO_IMG = False
    return _LOGO_IMG if _LOGO_IMG is not False else None

BLACK = '#000000'
DARK_GRAY = '#333333'


def _load_fonts():
    """Load fonts - BOLD and LARGER for better readability on thermal printers"""
    try:
        return {
            "company": ImageFont.truetype(BOLD_FONT, 28),      # Bigger, bold
            "tagline": ImageFont.truetype(BOLD_FONT, 14),      # Bold now
            "address": ImageFont.truetype(BOLD_FONT, 15),      # Bold now
            "label": ImageFont.truetype(BOLD_FONT, 16),        # Bigger
            "ticket_num": ImageFont.truetype(BOLD_FONT, 24),   # Bigger
            "date": ImageFont.truetype(BOLD_FONT, 16),         # Bold now, bigger
            "lottery_name": ImageFont.truetype(BOLD_FONT, 18), # Bigger
            "play": ImageFont.truetype(BOLD_FONT, 17),         # Bigger
            "subtotal": ImageFont.truetype(BOLD_FONT, 16),     # Bigger
            "total_label": ImageFont.truetype(BOLD_FONT, 22),  # Bigger
            "total_amount": ImageFont.truetype(BOLD_FONT, 26), # Bigger
            "footer": ImageFont.truetype(BOLD_FONT, 15),       # Bold, bigger
        }
    except Exception:
        default = ImageFont.load_default()
        return {k: default for k in [
            "company", "tagline", "address", "label", "ticket_num", "date",
            "lottery_name", "play", "subtotal", "total_label", "total_amount", "footer"
        ]}


def _draw_text(draw, x, y, text, font, fill=BLACK):
    """Draw text normally - clean and legible"""
    draw.text((x, y), text, fill=fill, font=font)


def _draw_centered(draw, y, text, font, fill, width):
    """Draw centered text"""
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (width - (bbox[2] - bbox[0])) // 2
    draw.text((x, y), text, fill=fill, font=font)


def _draw_right_aligned(draw, y, text, font, fill, width, margin):
    """Draw right-aligned text"""
    bbox = draw.textbbox((0, 0), text, font=font)
    x = width - margin - (bbox[2] - bbox[0])
    draw.text((x, y), text, fill=fill, font=font)


def _paste_logo(img, draw, y, width):
    """Paste the golden ball logo centered"""
    try:
        logo_img = _get_logo()
        if logo_img is None:
            return y + 10
        logo_copy = logo_img.copy()
        logo_size = logo_copy.size[0]
        img.paste(logo_copy, ((width - logo_size) // 2, y))
        return y + logo_size + 8
    except Exception as e:
        print(f"[RECEIPT] Logo paste error: {e}")
        return y + 10


def _format_date(created):
    """Format date in DR timezone (UTC-4): 28/03/2026, 7:35 AM"""
    if not created:
        return None
    if isinstance(created, str):
        try:
            created = datetime.fromisoformat(created.replace('Z', '+00:00'))
        except Exception:
            return None
    
    # Define Dominican Republic timezone (UTC-4, no DST)
    dr_tz = timezone(timedelta(hours=-4))
    
    # If datetime is naive (no timezone), assume it's UTC and convert to DR
    if created.tzinfo is None:
        # Assume naive datetime is UTC, make it aware then convert
        created_utc = created.replace(tzinfo=timezone.utc)
        created_dr = created_utc.astimezone(dr_tz)
    else:
        # Already has timezone, just convert to DR
        created_dr = created.astimezone(dr_tz)
    
    hour = created_dr.hour
    am_pm = "AM" if hour < 12 else "PM"
    hour_12 = hour if hour <= 12 else hour - 12
    if hour_12 == 0:
        hour_12 = 12
    return f"{created_dr.day:02d}/{created_dr.month:02d}/{created_dr.year}, {hour_12}:{created_dr.minute:02d} {am_pm}"


def _format_play_line(play, currency_display):
    """Format a single play as: P 04-20  $5"""
    play_type = play.get("lottery_type", "quiniela")
    abbr = PLAY_TYPE_ABBR.get(play_type, play_type[:1].upper())
    numbers = play.get("numbers", [])
    if isinstance(numbers, list):
        nums = "-".join(str(n).zfill(2) for n in numbers)
    else:
        nums = str(numbers)
    amount = int(play.get("amount", 0))
    return abbr, nums, f"= {currency_display}{amount}"


def _draw_separator(draw, y, width, margin, style="solid"):
    """Draw a separator line"""
    if style == "solid":
        draw.line([(margin, y), (width - margin, y)], fill=BLACK, width=2)
    elif style == "light":
        draw.line([(margin, y), (width - margin, y)], fill='#AAAAAA', width=1)
    return y + 10


def generate_receipt_image(ticket: dict, company: dict, lottery_id_to_name: dict) -> bytes:
    """Generate a clean, professional receipt PNG image - Same size, LARGER & BOLDER fonts."""
    fonts = _load_fonts()
    width = 400  # Same width as before
    margin = 24
    play_row_h = 24  # Slightly taller rows for larger fonts
    col_width = (width - margin * 2 - 16) // 2

    company_name = (company.get("company_name") or "LOTERIA MAGICA") if company else "LOTERIA MAGICA"
    company_address = (company.get("address") or "SANTO DOMINGO") if company else "SANTO DOMINGO"
    company_rnc = (company.get("rnc") or "123-456-789") if company else "123-456-789"

    plays = ticket.get("plays", [])
    plays_by_lottery = OrderedDict()
    for play in plays:
        lottery_name = play.get("lottery_name")
        if not lottery_name or lottery_name == "LOTERIA":
            lottery_id = play.get("lottery_id", "")
            lottery_name = lottery_id_to_name.get(lottery_id, "LOTERIA")
        plays_by_lottery.setdefault(lottery_name, []).append(play)

    ticket_currency = ticket.get("currency", "RD$")
    currency_display = "US$" if ticket_currency in ["USD", "US$", "US"] else "RD$"
    ticket_number = ticket.get("ticket_number", "")

    # Estimate height
    num_groups = len(plays_by_lottery)
    total_play_rows = sum((len(lp) + 1) // 2 for lp in plays_by_lottery.values())
    estimated_height = 180 + 100 + 100 + (num_groups * 45) + (total_play_rows * play_row_h) + (num_groups * 35) + 100 + 180 + 80

    img = Image.new('RGB', (width, estimated_height), 'white')
    draw = ImageDraw.Draw(img)
    y = 15

    # === LOGO ===
    y = _paste_logo(img, draw, y, width)

    # === COMPANY NAME ===
    _draw_centered(draw, y, company_name.upper(), fonts["company"], BLACK, width)
    y += 32

    # === TAGLINE ===
    _draw_centered(draw, y, "Tu suerte esta aqui", fonts["tagline"], BLACK, width)
    y += 20

    # === ADDRESS + RNC ===
    _draw_centered(draw, y, company_address, fonts["address"], BLACK, width)
    y += 18
    _draw_centered(draw, y, f"RNC: {company_rnc}", fonts["address"], BLACK, width)
    y += 22

    # === SEPARATOR ===
    y = _draw_separator(draw, y, width, margin, "solid")
    y += 6

    # === TICKET NUMBER ===
    _draw_centered(draw, y, ticket_number, fonts["ticket_num"], BLACK, width)
    y += 28

    # === DATE ===
    date_str = _format_date(ticket.get("created_at"))
    if date_str:
        _draw_centered(draw, y, date_str, fonts["date"], BLACK, width)
        y += 20
    y += 8

    # === SEPARATOR ===
    y = _draw_separator(draw, y, width, margin, "solid")
    y += 6

    # === PLAYS GROUPED BY LOTTERY ===
    grand_total = 0

    for lottery_name, lottery_plays in plays_by_lottery.items():
        # Lottery name header
        _draw_text(draw, margin, y, lottery_name.upper(), fonts["lottery_name"], BLACK)
        y += 26

        # Plays in 2 columns
        subtotal = 0
        for i in range(0, len(lottery_plays), 2):
            # Left column
            play_left = lottery_plays[i]
            abbr_l, nums_l, amt_l = _format_play_line(play_left, currency_display)
            left_text = f"{abbr_l} {nums_l} {amt_l}"
            _draw_text(draw, margin + 4, y, left_text, fonts["play"], BLACK)
            subtotal += int(play_left.get("amount", 0))

            # Right column
            if i + 1 < len(lottery_plays):
                play_right = lottery_plays[i + 1]
                abbr_r, nums_r, amt_r = _format_play_line(play_right, currency_display)
                right_text = f"{abbr_r} {nums_r} {amt_r}"
                right_x = margin + col_width + 16
                _draw_text(draw, right_x, y, right_text, fonts["play"], BLACK)
                subtotal += int(play_right.get("amount", 0))

            y += play_row_h

        # Sub-total line
        grand_total += subtotal
        y += 4

        # Light separator between lottery groups
        y = _draw_separator(draw, y, width, margin, "light")
        y += 4

    # === GRAND TOTAL ===
    y = _draw_separator(draw, y, width, margin, "solid")
    y += 6
    total_amount = ticket.get("total_amount", grand_total)
    total_text = f"TOTAL: {currency_display} {total_amount:.2f}"
    _draw_centered(draw, y, total_text, fonts["total_amount"], BLACK, width)
    y += 34
    y = _draw_separator(draw, y, width, margin, "solid")
    y += 6

    # === QR CODE ===
    qr = qrcode.QRCode(version=1, box_size=4, border=2)
    qr.add_data(ticket_number)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
    qr_w, qr_h = qr_img.size
    img.paste(qr_img, ((width - qr_w) // 2, y))
    y += qr_h + 12

    # === FOOTER ===
    _draw_centered(draw, y, "CONSERVE ESTE BOLETO", fonts["footer"], BLACK, width)
    y += 18
    _draw_centered(draw, y, "BUENA SUERTE!", fonts["footer"], BLACK, width)
    y += 22

    # Crop to actual content and export
    img = img.crop((0, 0, width, y + 10))
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    buf.seek(0)
    return buf.getvalue()
