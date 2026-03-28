"""Receipt image generator service using Pillow - Thermal printer style"""
import io
import base64
from datetime import datetime, timedelta, timezone
from collections import OrderedDict
from PIL import Image, ImageDraw, ImageFont
import qrcode


BOLD_FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

PLAY_TYPE_ABBR = {
    "quiniela": "Q", "pale": "P", "tripleta": "T",
    "super_pale": "SP", "first": "1ra", "second": "2da", "third": "3ra"
}

LOGO_BASE64 = "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"

BLACK = '#000000'


def _load_fonts():
    """Load all bold fonts - thermal printer style, all BLACK"""
    try:
        return {
            "company": ImageFont.truetype(BOLD_FONT, 26),
            "address": ImageFont.truetype(BOLD_FONT, 15),
            "label": ImageFont.truetype(BOLD_FONT, 16),
            "ticket_num": ImageFont.truetype(BOLD_FONT, 22),
            "date": ImageFont.truetype(BOLD_FONT, 15),
            "lottery_name": ImageFont.truetype(BOLD_FONT, 16),
            "play": ImageFont.truetype(BOLD_FONT, 15),
            "subtotal": ImageFont.truetype(BOLD_FONT, 15),
            "total": ImageFont.truetype(BOLD_FONT, 20),
            "footer": ImageFont.truetype(BOLD_FONT, 15),
        }
    except Exception:
        default = ImageFont.load_default()
        return {k: default for k in ["company", "address", "label", "ticket_num", "date", "lottery_name", "play", "subtotal", "total", "footer"]}


def _draw_centered(draw, y, text, font, fill, width):
    bbox = draw.textbbox((0, 0), text, font=font)
    draw.text(((width - (bbox[2] - bbox[0])) // 2, y), text, fill=fill, font=font)


def _draw_right_aligned(draw, y, text, font, fill, width, margin):
    bbox = draw.textbbox((0, 0), text, font=font)
    draw.text((width - margin - (bbox[2] - bbox[0]), y), text, fill=fill, font=font)


def _paste_logo(img, draw, y, width):
    try:
        logo_data = base64.b64decode(LOGO_BASE64)
        logo_img = Image.open(io.BytesIO(logo_data))
        if logo_img.mode == 'RGBA':
            bg = Image.new('RGB', logo_img.size, 'white')
            bg.paste(logo_img, mask=logo_img.split()[3])
            logo_img = bg
        elif logo_img.mode != 'RGB':
            logo_img = logo_img.convert('RGB')
        logo_img = logo_img.resize((70, 70), Image.Resampling.LANCZOS)
        img.paste(logo_img, ((width - 70) // 2, y))
        return y + 78
    except Exception as e:
        print(f"[RECEIPT] Logo load error: {e}")
        return y + 20


def _format_date(created):
    if not created:
        return None
    if isinstance(created, str):
        try:
            created = datetime.fromisoformat(created.replace('Z', '+00:00'))
        except Exception:
            return None
    dr_tz = timezone(timedelta(hours=-4))
    created_dr = created.astimezone(dr_tz) if created.tzinfo else created
    hour = created_dr.hour
    am_pm = "AM" if hour < 12 else "PM"
    hour_12 = hour if hour <= 12 else hour - 12
    if hour_12 == 0:
        hour_12 = 12
    return f"{created_dr.day:02d}/{created_dr.month:02d}/{created_dr.year} {hour_12}:{created_dr.minute:02d} {am_pm}"


def _format_play_line(play, currency_display):
    """Format a single play as: P 04-20  US 5"""
    play_type = play.get("lottery_type", "quiniela")
    abbr = PLAY_TYPE_ABBR.get(play_type, play_type[:1].upper())
    numbers = play.get("numbers", [])
    if isinstance(numbers, list):
        nums = "-".join(str(n).zfill(2) for n in numbers)
    else:
        nums = str(numbers)
    amount = int(play.get("amount", 0))
    return abbr, nums, f"{currency_display} {amount}"


def generate_receipt_image(ticket: dict, company: dict, lottery_id_to_name: dict) -> bytes:
    """Generate a thermal-printer-style PNG receipt."""
    fonts = _load_fonts()
    width = 420
    margin = 20
    play_row_h = 20
    col_width = (width - margin * 2 - 10) // 2

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
    total_play_rows = 0
    for lp in plays_by_lottery.values():
        total_play_rows += (len(lp) + 1) // 2  # 2 columns
    estimated_height = 120 + 80 + 80 + (num_groups * 35) + (total_play_rows * play_row_h) + (num_groups * 25) + 80 + 180 + 80

    img = Image.new('RGB', (width, estimated_height), 'white')
    draw = ImageDraw.Draw(img)
    y = 15

    # === LOGO ===
    y = _paste_logo(img, draw, y, width)

    # === COMPANY NAME ===
    _draw_centered(draw, y, company_name.upper(), fonts["company"], BLACK, width)
    y += 30

    # === ADDRESS + RNC ===
    _draw_centered(draw, y, company_address.upper(), fonts["address"], BLACK, width)
    y += 18
    _draw_centered(draw, y, f"RNC: {company_rnc}", fonts["address"], BLACK, width)
    y += 22

    # === SEPARATOR ===
    draw.line([(margin, y), (width - margin, y)], fill=BLACK, width=2)
    y += 12

    # === TICKET NUMBER ===
    _draw_centered(draw, y, "NO. BOLETO", fonts["label"], BLACK, width)
    y += 20
    _draw_centered(draw, y, ticket_number, fonts["ticket_num"], BLACK, width)
    y += 28

    # === DATE ===
    date_str = _format_date(ticket.get("created_at"))
    if date_str:
        _draw_centered(draw, y, date_str, fonts["date"], BLACK, width)
        y += 20
    y += 8

    # === SEPARATOR ===
    draw.line([(margin, y), (width - margin, y)], fill=BLACK, width=2)
    y += 12

    # === PLAYS GROUPED BY LOTTERY (2 columns) ===
    grand_total = 0

    for lottery_name, lottery_plays in plays_by_lottery.items():
        # Lottery name header
        draw.text((margin, y), lottery_name.upper(), fill=BLACK, font=fonts["lottery_name"])
        y += 22

        # Plays in 2 columns
        subtotal = 0
        for i in range(0, len(lottery_plays), 2):
            # Left column
            play_left = lottery_plays[i]
            abbr_l, nums_l, amt_l = _format_play_line(play_left, currency_display)
            left_text = f"{abbr_l} {nums_l}"
            draw.text((margin, y), left_text, fill=BLACK, font=fonts["play"])
            draw.text((margin + 120, y), amt_l, fill=BLACK, font=fonts["play"])
            subtotal += int(play_left.get("amount", 0))

            # Right column
            if i + 1 < len(lottery_plays):
                play_right = lottery_plays[i + 1]
                abbr_r, nums_r, amt_r = _format_play_line(play_right, currency_display)
                right_x = margin + col_width + 10
                right_text = f"{abbr_r} {nums_r}"
                draw.text((right_x, y), right_text, fill=BLACK, font=fonts["play"])
                draw.text((right_x + 120, y), amt_r, fill=BLACK, font=fonts["play"])
                subtotal += int(play_right.get("amount", 0))

            y += play_row_h

        # Sub-total line
        y += 2
        subtotal_text = f"SUB-TOTAL {currency_display} {subtotal}"
        _draw_right_aligned(draw, y, subtotal_text, fonts["subtotal"], BLACK, width, margin)
        y += 22
        grand_total += subtotal

        # Light separator between groups
        draw.line([(margin, y), (width - margin, y)], fill='#999999', width=1)
        y += 12

    # === GRAND TOTAL ===
    draw.line([(margin, y), (width - margin, y)], fill=BLACK, width=2)
    y += 10
    total_amount = ticket.get("total_amount", grand_total)
    total_text = f"TOTAL  {currency_display} {total_amount:.0f}"
    _draw_centered(draw, y, total_text, fonts["total"], BLACK, width)
    y += 32
    draw.line([(margin, y), (width - margin, y)], fill=BLACK, width=2)
    y += 15

    # === QR CODE ===
    qr = qrcode.QRCode(version=1, box_size=4, border=2)
    qr.add_data(ticket_number)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
    qr_w, qr_h = qr_img.size
    img.paste(qr_img, ((width - qr_w) // 2, y))
    y += qr_h + 20

    # === FOOTER ===
    _draw_centered(draw, y, "CONSERVE ESTE BOLETO", fonts["footer"], BLACK, width)
    y += 20
    _draw_centered(draw, y, "BUENA SUERTE!", fonts["footer"], BLACK, width)
    y += 20

    # Crop and export
    img = img.crop((0, 0, width, y + 10))
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    buf.seek(0)
    return buf.getvalue()
