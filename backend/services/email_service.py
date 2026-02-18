"""Email service using SMTP for lottery notifications"""
import os
import ssl
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

# SMTP Configuration
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.hostinger.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', SMTP_USER)


def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """
    Send an email using SMTP
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML content of the email
    
    Returns:
        True if email was sent successfully, False otherwise
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured - email not sent")
        return False
    
    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"Lotería Mágica <{SENDER_EMAIL}>"
        message["To"] = to_email
        
        # Add HTML content
        html_part = MIMEText(html_content, "html")
        message.attach(html_part)
        
        # Connect and send
        context = ssl.create_default_context()
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, message.as_string())
        
        logger.info(f"Email sent successfully to {to_email}")
        return True
            
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


def send_winner_notification(
    client_name: str,
    client_email: str,
    ticket_number: str,
    lottery_name: str,
    winning_numbers: str,
    prize_amount: float,
    currency: str = "RD$"
) -> bool:
    """Send notification email when a client wins"""
    
    subject = f"🎉 ¡Felicidades! Has ganado en {lottery_name}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
            .header {{ background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 30px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 28px; }}
            .content {{ padding: 30px; }}
            .prize-box {{ background: #fef3c7; border: 2px solid #f59e0b; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }}
            .prize-amount {{ font-size: 36px; font-weight: bold; color: #d97706; }}
            .details {{ background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; }}
            .details p {{ margin: 8px 0; color: #475569; }}
            .footer {{ background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎊 ¡GANASTE! 🎊</h1>
                <p>¡Enhorabuena, {client_name}!</p>
            </div>
            <div class="content">
                <p>Nos complace informarte que tu boleto ha resultado <strong>GANADOR</strong> en el sorteo de hoy.</p>
                
                <div class="prize-box">
                    <p style="margin:0; color:#92400e;">Tu premio es de</p>
                    <p class="prize-amount">{currency} {prize_amount:,.2f}</p>
                </div>
                
                <div class="details">
                    <p><strong>📋 Detalles del boleto:</strong></p>
                    <p>🎫 Número de ticket: <strong>{ticket_number}</strong></p>
                    <p>🎰 Lotería: <strong>{lottery_name}</strong></p>
                    <p>🔢 Números ganadores: <strong>{winning_numbers}</strong></p>
                </div>
                
                <p style="color:#64748b; font-size:14px;">
                    Para reclamar tu premio, por favor comunícate con nosotros o visita nuestra oficina.
                </p>
            </div>
            <div class="footer">
                <p>Lotería Mágica - Tu suerte está aquí</p>
                <p>Este es un correo automático, por favor no responder.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(client_email, subject, html_content)


def send_payment_confirmed_notification(
    client_name: str,
    client_email: str,
    ticket_number: str,
    amount: float,
    currency: str = "RD$"
) -> bool:
    """Send notification when payment is confirmed"""
    
    subject = f"✅ Pago confirmado - Boleto #{ticket_number[-4:]}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
            .header {{ background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 30px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 24px; }}
            .content {{ padding: 30px; }}
            .success-icon {{ font-size: 60px; text-align: center; }}
            .details {{ background: #f0fdf4; border: 1px solid #86efac; padding: 15px; border-radius: 8px; margin: 15px 0; }}
            .details p {{ margin: 8px 0; color: #166534; }}
            .footer {{ background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ Pago Confirmado</h1>
            </div>
            <div class="content">
                <div class="success-icon">✓</div>
                <p style="text-align:center;">Hola <strong>{client_name}</strong>,</p>
                <p style="text-align:center;">Tu pago ha sido <strong style="color:#22c55e;">CONFIRMADO</strong> exitosamente.</p>
                
                <div class="details">
                    <p>🎫 <strong>Ticket:</strong> #{ticket_number[-8:]}</p>
                    <p>💰 <strong>Monto:</strong> {currency} {amount:,.2f}</p>
                    <p>📅 <strong>Estado:</strong> Activo - Participando en sorteos</p>
                </div>
                
                <p style="color:#64748b; font-size:14px; text-align:center;">
                    ¡Buena suerte! Te notificaremos si resultas ganador.
                </p>
            </div>
            <div class="footer">
                <p>Lotería Mágica - Tu suerte está aquí</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(client_email, subject, html_content)


def send_payment_rejected_notification(
    client_name: str,
    client_email: str,
    ticket_number: str,
    reason: str = None
) -> bool:
    """Send notification when payment is rejected"""
    
    subject = f"❌ Pago rechazado - Boleto #{ticket_number[-4:]}"
    
    reason_text = f"<p><strong>Motivo:</strong> {reason}</p>" if reason else ""
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
            .header {{ background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 30px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 24px; }}
            .content {{ padding: 30px; }}
            .warning-icon {{ font-size: 60px; text-align: center; }}
            .details {{ background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 15px 0; }}
            .details p {{ margin: 8px 0; color: #991b1b; }}
            .footer {{ background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>❌ Pago Rechazado</h1>
            </div>
            <div class="content">
                <div class="warning-icon">⚠️</div>
                <p style="text-align:center;">Hola <strong>{client_name}</strong>,</p>
                <p style="text-align:center;">Lamentamos informarte que tu pago ha sido <strong style="color:#ef4444;">RECHAZADO</strong>.</p>
                
                <div class="details">
                    <p>🎫 <strong>Ticket:</strong> #{ticket_number[-8:]}</p>
                    {reason_text}
                </div>
                
                <p style="color:#64748b; font-size:14px; text-align:center;">
                    Por favor, verifica tu comprobante de pago y vuelve a intentarlo, o contáctanos para más información.
                </p>
            </div>
            <div class="footer">
                <p>Lotería Mágica - Tu suerte está aquí</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(client_email, subject, html_content)
