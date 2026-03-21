# Lotería Mágica - PRD

## Problema Original
Aplicación de lotería completa con React/Vite frontend y FastAPI backend + MongoDB. Funcionalidades principales: gestión de loterías, ventas de tickets multi-jugada, generación de recibos como imagen PNG, configuración de premios por país, soporte multi-moneda (RD$ / US$), y sistema completo de reportes.

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
- Multiplicadores separados para RD y US
- Página admin: `/prize-config`
- **Estado: COMPLETO Y VERIFICADO** (21/03/2026)

### Multi-Play Tickets
- Endpoint: `POST /api/tickets/multi`
- Moneda automática basada en país del vendedor
- **Estado: COMPLETO Y VERIFICADO**

### Panel de Reportes de Ventas por País (NUEVO - 21/03/2026)
- **SalesReport** (`/sales-report`): Comparación RD vs USA con tarjetas de resumen, gráfico de ventas diarias dual, top loterías por país
- Backend: `GET /api/accounting/country-comparison?period=day|week|month`
- Filtros por período (Hoy, Semana, Mes)
- **Estado: COMPLETO Y VERIFICADO** - 23/23 tests passed

### Reporte de Vendedores (NUEVO - 21/03/2026)
- **SellersReport** (`/sellers-report`): Tabla de rendimiento con filtro por país, ordenamiento por ventas/boletos/ganancia/comisión
- Backend: `GET /api/accounting/sellers-report?country=RD|US`
- **Estado: COMPLETO Y VERIFICADO**

### Contabilidad (NUEVO - 21/03/2026)
- **AccountingPage** (`/accounting`): Resumen financiero con tarjetas de ventas, premios, comisiones y ganancia neta. Tabla de últimas transacciones.
- Backend: `GET /api/accounting/report?period=day|week|month&country=RD|US`
- **Estado: COMPLETO Y VERIFICADO**

### Comisiones (NUEVO - 21/03/2026)
- **CommissionReport** (`/commission-report`): Desglose de comisiones por vendedor y detalle individual
- Backend: `GET /api/accounting/commissions?period=day|week|month`
- **Estado: COMPLETO Y VERIFICADO**

### Mi Reporte - Vendedor (NUEVO - 21/03/2026)
- **UserReport** (`/user-report`): Reporte individual del vendedor con estadísticas, estado de boletos, gráfico diario, últimos boletos
- Backend: `GET /api/accounting/detailed-seller-report?period=daily|weekly|biweekly|monthly`
- **Estado: COMPLETO Y VERIFICADO**

### Navegación Actualizada (21/03/2026)
- Admin sidebar: Dashboard, Usuarios, Loterías, Venta, Tickets, Resultados, Reporte País, Vendedores, Contabilidad, Comisiones, Estadísticas
- Vendedor sidebar: Dashboard, Venta, Mis Tickets, Resultados, Mi Reporte

### Sistema de Usuarios y Auth
- Login, roles (super_admin, admin, vendedor)
- Impersonación de usuarios
- **Estado: COMPLETO**

### Loterías y Sorteos
- CRUD de loterías con horarios, días, países
- Resultados de sorteos automáticos
- **Estado: COMPLETO**

## Credenciales de Prueba
- Super Admin: admin@loteria.com / admin123 (country: US, currency: USD)
- Vendedor: vendedor@test.com / 12345678 (country: RD, currency: RD$)

## Backlog Priorizado

### P1
- Conectar dominio personalizado (loteriamagica.com)
- Fase 2: UI y funcionalidad de vendedores (flujo de ventas completo)

### P2
- Portal de clientes y funciones avanzadas
- Páginas restantes (Terminales, Mi Perfil, etc.)

### P3
- Finalizar envío a Google Play Store

## Problemas Conocidos
- `/api/company-profile` retorna 403 en cada carga de página (no bloquea funcionalidad)

## Archivos Clave
- `/app/backend/routes/tickets.py` - Tickets y recibos
- `/app/backend/routes/accounting.py` - Reportes y contabilidad (incluye country-comparison)
- `/app/backend/routes/prize_config.py` - Config premios
- `/app/frontend/src/pages/SalesReport.jsx` - Reporte por país
- `/app/frontend/src/pages/SellersReport.jsx` - Reporte vendedores
- `/app/frontend/src/pages/AccountingPage.jsx` - Contabilidad
- `/app/frontend/src/pages/CommissionReport.jsx` - Comisiones
- `/app/frontend/src/pages/UserReport.jsx` - Mi reporte
- `/app/frontend/src/components/Layout.jsx` - Sidebar navegación
- `/app/frontend/src/App.jsx` - Rutas
