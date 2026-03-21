# Lotería Mágica - PRD

## Problema Original
Aplicación de lotería completa con React/Vite frontend y FastAPI backend + MongoDB. Funcionalidades principales: gestión de loterías, ventas de tickets multi-jugada, generación de recibos como imagen PNG, configuración de premios por país, y soporte multi-moneda (RD$ / US$).

## Arquitectura
- **Frontend:** React + Vite (puerto 3000)
- **Backend:** FastAPI (puerto 8001, prefijo /api)
- **DB:** MongoDB (test_database)
- **Mobile:** Expo (código en /app/frontend/app/)

## Funcionalidades Implementadas

### Generación de Recibo (Ticket Image)
- Endpoint: `GET /api/tickets/receipt-image/{ticket_number}`
- Genera PNG con: logo, nombre empresa, slogan, número ticket, fecha, jugadas agrupadas por lotería, moneda dinámica, total, QR, footer
- Moneda determinada por país del vendedor (US → US$, RD → RD$)
- **Estado: COMPLETO Y VERIFICADO** (21/03/2026)

### Configuración de Premios por País
- Endpoints: `GET/PUT /api/prize-config`, `GET /api/prize-config/{country}`
- Multiplicadores separados para RD y US (quiniela, pale, tripleta, super_pale)
- Página admin: `/prize-config`
- **Estado: COMPLETO Y VERIFICADO** (21/03/2026)

### Multi-Play Tickets
- Endpoint: `POST /api/tickets/multi`
- Soporta múltiples jugadas por ticket
- Moneda automática basada en país del vendedor
- **Estado: COMPLETO Y VERIFICADO**

### Sistema de Usuarios y Auth
- Login, roles (super_admin, admin, vendedor)
- Impersonación de usuarios por super_admin
- **Estado: COMPLETO**

### Loterías y Sorteos
- CRUD de loterías con horarios, días, países
- Resultados de sorteos
- **Estado: COMPLETO**

## Credenciales de Prueba
- Super Admin: admin@loteria.com / admin123 (country: US, currency: USD)
- Vendedor: vendedor@test.com / 12345678 (country: RD, currency: RD$)

## Backlog Priorizado

### P1
- Conectar dominio personalizado (loteriamagica.com)
- Implementar páginas "Coming Soon" (Reportes, Terminales, Contabilidad)

### P2
- Fase 2: UI y funcionalidad de vendedores
- Flujo de ventas del vendedor desde la app móvil

### P3
- Fase 3: Portal de clientes y funciones avanzadas
- Finalizar envío a Google Play Store

## Archivos Clave
- `/app/backend/routes/tickets.py` - Tickets y recibos
- `/app/backend/routes/prize_config.py` - Config premios
- `/app/frontend/src/pages/PrizeConfig.jsx` - Admin premios
- `/app/frontend/src/pages/Venta.jsx` - Página de ventas
- `/app/frontend/src/pages/Tickets.jsx` - Lista de tickets
