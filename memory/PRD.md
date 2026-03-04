# Sistema de Loteria Magica - PRD

## Declaracion del Problema Original
Aplicacion completa de loteria con roles de Admin, Vendedor y Cliente. Incluye venta de tickets, resultados automaticos, pagos digitales, notificaciones y panel administrativo.

## Estado Actual: Produccion Lista
La aplicacion web esta completa. Build Android v1.0.1 generado. Deployment fixes aplicados.

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

### Recibo de Ticket (Mar 2026)
- Formato tipo recibo de imprenta: logo, TKT#, fecha, jugadas, total
- Codigo QR generado via backend (endpoint /api/tickets/qr/{ticket_number})
- Texto "CONSERVE ESTE BOLETO ¡BUENA SUERTE!"
- Sin cuadros/bordes, sin badge de estado, sin linea de PREMIO
- Funciona en web y movil

### Bug Fixes (Mar 2026)
- CORREGIDO: "Ver Ticket" modal de acciones no se cerraba
- CORREGIDO: "Compartir/WhatsApp" no funcionaba en web (usa wa.me)
- CORREGIDO: Pago de Premios pantalla en blanco
- ACTUALIZADO: Cierre de loterias 10 min antes del sorteo
- CORREGIDO: Push notifications PUSH_TOO_MANY_EXPERIENCE_IDS

### Deployment Fixes (Mar 2026)
- Rutas hardcodeadas, CORS, bulk_write, scraper URLs corregidos
- expo-barcode-scanner, resultados.com.do eliminados
- eas.json creado, iconos corregidos a 512x512

## Arquitectura
```
Backend: FastAPI + MongoDB (Motor async)
Frontend: Expo/React Native Web (SDK 54)
Email: Hostinger SMTP
Scheduler: APScheduler
QR: backend qrcode library -> base64 PNG
```

## Tareas Pendientes
- P0: Deploy a produccion con QR code y fixes
- P1: Conectar dominio (loteriamagica.com)
- P2: Build iOS (esperando Apple Developer Program)

## Credenciales de Test
- Admin: admin@loteria.com / admin123
- Vendedor: vendedor@test.com / 12345678
- Cliente: 8091234567 / 123456
