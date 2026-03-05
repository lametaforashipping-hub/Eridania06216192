# Sistema de Loteria Magica - PRD

## Declaracion del Problema Original
Aplicacion completa de loteria con roles de Admin, Vendedor y Cliente. Incluye venta de tickets, resultados automaticos, pagos digitales, notificaciones y panel administrativo.

## Estado Actual: Produccion Lista + iOS Submitted - Mar 2026
La aplicacion web esta completa y verificada. Build iOS subido a App Store Connect y enviado para revision de Apple.

## Funcionalidades Implementadas

### Core (Admin/Vendedor)
- Login/autenticacion JWT con roles
- Venta de tickets (individual y multi-play)
- Resultados automaticos via web scraping
- Dashboard de estadisticas avanzadas
- Gestion de loterias y horarios
- Sistema de comisiones
- Reporte mensual del vendedor
- Monitoreo en vivo de tickets
- Pago de premios
- Contabilidad y reportes

### Portal de Clientes
- Registro y perfil de cliente
- Compra digital de tickets
- Upload de comprobante de pago
- Notificaciones en tiempo real
- Vista de resultados

### Compartir Recibo PDF por WhatsApp (Mar 2026 - v3)
- En movil: `expo-print` genera PDF desde HTML -> `expo-sharing` comparte el archivo
- Logo embebido como base64 JPEG en el HTML (archivo: `src/assets/logoBase64.ts`)
- Branding completo: Logo + "LOTERIA MAGICA" + "Tu Suerte Comienza Aqui"
- Actualizado en 3 archivos: TicketModal.tsx, tickets.tsx, multi-play.tsx

### Recibo de Ticket (Mar 2026)
- Formato tipo recibo de imprenta: logo, TKT#, fecha, jugadas, total
- Codigo QR generado via backend (endpoint /api/tickets/qr/{ticket_number})
- Texto "CONSERVE ESTE BOLETO BUENA SUERTE!"

### iOS App Store Submission (Mar 5, 2026)
- Build iOS generado exitosamente via EAS Build (v1.0.0 build 1)
- Build subido a App Store Connect (ascAppId: 6760090637)
- Screenshots iPad 13" generados y subidos
- Privacy Policy endpoint creado (/api/privacy-policy)
- Pendiente: Revision por Apple (24h-3 dias)

### Database Reset (Mar 2026)
- Endpoint /api/admin/reset-database para super admins
- Boton "Resetear Base de Datos" en panel admin

### Deployment Health Fix (Mar 5, 2026)
- Removido fallback hardcodeado de DB_NAME en database.py
- Ahora usa os.environ['DB_NAME'] sin fallback (fail-fast)

## Arquitectura
```
Backend: FastAPI + MongoDB (Motor async)
Frontend: Expo/React Native Web (SDK 54)
Email: Hostinger SMTP
Scheduler: APScheduler
QR: backend qrcode library -> base64 PNG
```

## Tareas Pendientes
- P0: Esperar aprobacion de Apple para iOS app
- P1: Conectar dominio personalizado (loteriamagica.com) - requiere configuracion DNS por el usuario
- P2: Rebuild APK Android con los fixes de compartir imagen
- P3: Refactoring: Extraer logica HTML de PDF a funcion utilitaria (duplicada en 3 archivos)

## Testing Status (Mar 5, 2026)
- Deployment health check: PASSED (database connected, no hardcoded values)
- Backend API: healthy
- iOS build: uploaded to App Store Connect
- No integraciones mockeadas

## Credenciales de Test
- Admin: admin@loteria.com / admin123
- Vendedor: vendedor@test.com / 12345678
- Cliente: 8091234567 / 123456

## 3rd Party Integrations
- Hostinger SMTP: Para envio de emails
- MongoDB Atlas: Base de datos de produccion
- Expo Application Services (EAS): Build y submit de aplicaciones moviles
- Apple App Store Connect: Distribucion iOS (ascAppId: 6760090637)
