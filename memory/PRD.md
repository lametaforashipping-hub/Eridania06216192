# Lotería Mágica - PRD

## Problema Original
Aplicación de lotería completa con React/Vite frontend y FastAPI backend + MongoDB. Funcionalidades principales: gestión de loterías, ventas de tickets multi-jugada, generación de recibos como imagen PNG, configuración de premios por país, soporte multi-moneda (RD$ / US$), sistema de reportes, y alertas en tiempo real.

## Arquitectura
- **Frontend:** React + Vite (puerto 3000)
- **Backend:** FastAPI (puerto 8001, prefijo /api)
- **DB:** MongoDB (test_database)
- **Mobile:** Expo (código en /app/frontend/app/)

## Funcionalidades Implementadas

### Generación de Recibo (Ticket Image) - VERIFICADO 21/03/2026
- Endpoint: `GET /api/tickets/receipt-image/{ticket_number}`
- PNG con logo, jugadas agrupadas por lotería, moneda dinámica (US$/RD$), QR

### Configuración de Premios por País - VERIFICADO 21/03/2026
- Endpoints: `GET/PUT /api/prize-config`
- Página admin: `/prize-config`

### Panel de Reportes de Ventas por País - VERIFICADO 21/03/2026
- `/sales-report` - Comparación RD vs USA con gráficos duales
- Backend: `GET /api/accounting/country-comparison`

### Reportes y Contabilidad - VERIFICADO 21/03/2026
- `/sellers-report` - Rendimiento de vendedores con filtro país
- `/accounting` - Resumen financiero y transacciones
- `/commission-report` - Desglose de comisiones
- `/user-report` - Reporte individual del vendedor

### Sistema de Alertas en Tiempo Real (NUEVO - 21/03/2026)
- **Milestone de Ventas**: Notificación automática cuando vendedor alcanza monto configurado
- **Meta Diaria**: Notificación cuando vendedor alcanza meta diaria
- **Ticket Ganador**: Notificación cuando un ticket gana
- **Configuración admin**: `/alert-settings` con toggles y umbrales por país (RD$/US$)
- **Centro de Notificaciones**: Campana en header con dropdown de alertas recientes, badge con conteo
- Backend: `GET/PUT /api/alert-settings`, `GET /api/alert-settings/recent-alerts`
- **Estado: COMPLETO Y VERIFICADO** - Backend 13/13 tests, frontend funcional

### Navegación con Sidebar (NUEVO - 21/03/2026)
- Layout persistente con sidebar en todas las páginas internas
- Links: Dashboard, Usuarios, Loterías, Venta, Tickets, Resultados, Reporte País, Vendedores, Contabilidad, Comisiones, Estadísticas, Alertas
- Header con campana de notificaciones y email
- Dashboard mantiene su propio layout (sin sidebar wrapper)

### Sistema de Usuarios y Auth - COMPLETO
### Loterías y Sorteos - COMPLETO
### Multi-Play Tickets - COMPLETO

## Credenciales de Prueba
- Super Admin: admin@loteria.com / admin123 (country: US, currency: USD)
- Vendedor: vendedor@test.com / 12345678 (country: RD, currency: RD$)

## Backlog Priorizado

### P1
- Conectar dominio personalizado (loteriamagica.com)
- Fase 2: UI y funcionalidad completa de vendedores

### P2
- Portal de clientes y funciones avanzadas
- Páginas restantes (Terminales, Mi Perfil, Verificar Ticket)

### P3
- Finalizar envío a Google Play Store

## Problemas Conocidos
- `/api/company-profile` retorna 403 (no bloquea funcionalidad)

## Archivos Clave
- `/app/backend/routes/tickets.py` - Tickets, recibos, milestone check
- `/app/backend/routes/accounting.py` - Reportes, country-comparison
- `/app/backend/routes/alert_settings.py` - Config alertas
- `/app/frontend/src/components/Layout.jsx` - Layout con sidebar
- `/app/frontend/src/components/NotificationCenter.jsx` - Campana notificaciones
- `/app/frontend/src/pages/AlertSettings.jsx` - Config alertas
- `/app/frontend/src/pages/SalesReport.jsx` - Reporte por país
- `/app/frontend/src/pages/SellersReport.jsx` - Reporte vendedores
- `/app/frontend/src/pages/AccountingPage.jsx` - Contabilidad
- `/app/frontend/src/pages/CommissionReport.jsx` - Comisiones
- `/app/frontend/src/pages/UserReport.jsx` - Mi reporte
- `/app/frontend/src/App.jsx` - Rutas con Layout wrapper
