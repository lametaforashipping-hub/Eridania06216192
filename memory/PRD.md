# Sistema de Lotería RD/USA - PRD

## Descripción General
Sistema de gestión de loterías para República Dominicana y Estados Unidos. Permite la venta de boletos, gestión de sorteos, pago de premios y reportes de vendedores.

## Arquitectura
- **Backend:** FastAPI + MongoDB
- **Frontend:** React Native / Expo
- **Base de datos:** MongoDB

## Funcionalidades Implementadas

### Autenticación y Usuarios
- Login con JWT
- Roles: super_admin, admin, vendedor
- Creación de usuarios con país (RD/US) y moneda automática
- Límite de crédito y comisiones

### Loterías
- Múltiples tipos: Quiniela, Pale, Tripleta, Super Pale, etc.
- Horarios de apertura/cierre configurables
- Horarios especiales por día de la semana
- Feriados con horarios especiales
- Límite de boletos por número

### Ventas
- **Formato Manual:** Entrada de números manual (sin cuadrícula)
- Multi-jugada con múltiples jugadas en un solo boleto
- Validación de límites por número
- Alertas al 80% del límite
- QR code en recibos

### Sorteos
- Creación de sorteos con números ganadores
- Sorteos manuales (ingreso manual de números ganadores)
- Procesamiento automático de tickets ganadores/perdedores

### Pagos
- Pago de tickets ganadores
- Registro de transacciones
- Contabilidad de premios pagados

### Reportes
- Reportes por vendedor
- Estadísticas de números
- Monitoreo en tiempo real
- Panel de límites (números bloqueados/cerca del límite)
- **Reportes separados por país** (super_admin puede ver todos)

## Cambios Recientes (12 Feb 2026)

### Implementado
- ✅ **Filtrado de reportes por país** - Endpoints de accounting ahora filtran por país
  - `/api/accounting/summary?country=RD|US`
  - `/api/accounting/report?country=RD|US`
  - `/api/accounting/sellers-report?country=RD|US`
  - `/api/accounting/daily-chart?country=RD|US`
  - `/api/tickets?country=RD|US`
- ✅ **Selector de país en UI** - Dashboard y Sellers Report muestran filtro para super_admin
- ✅ Formato de venta manual - Campo de entrada para números en lugar de cuadrícula
- ✅ País y moneda en registro - Selección de RD (Peso) o US (Dólar) al crear usuarios
- ✅ Mejoras móvil - KeyboardAvoidingView mejorado en multi-jugada

### Eliminado
- ❌ Animalitos - Eliminada funcionalidad completa (pantalla, endpoints, loterías)

### Corregido
- ✅ Error de parsing de tiempo en check_lottery_open
- ✅ Error de números undefined en tickets.tsx
- ✅ Error en /reports/daily-chart endpoint

## Credenciales de Prueba
- **Super Admin:** admin@loteria.com / admin123

## Endpoints Principales

### Autenticación
- POST /api/auth/login
- POST /api/auth/register (requiere autenticación)
- GET /api/auth/me

### Loterías
- GET /api/lotteries
- POST /api/lotteries
- PUT /api/lotteries/{id}
- GET /api/lotteries/{id}/number-stats

### Tickets
- GET /api/tickets?country={RD|US}
- POST /api/tickets
- POST /api/multi-play-tickets
- POST /api/tickets/{id}/pay
- POST /api/tickets/{id}/cancel
- GET /api/tickets/verify/{ticket_number}

### Sorteos
- GET /api/draws
- POST /api/draws (con números ganadores manuales opcionales)

### Reportes (con filtro de país)
- GET /api/accounting/report?country={RD|US}
- GET /api/accounting/summary?country={RD|US}
- GET /api/accounting/sellers-report?country={RD|US}
- GET /api/accounting/daily-chart?country={RD|US}
- GET /api/monitoring/tickets

## Tareas Pendientes

### P1 - Prioridad Alta
- Investigar y corregir error de "boleto" en móvil (usuario reportó problema)
- Implementar lógica de moneda visible por país en reportes (mostrar RD$ o USD según país)

### P2 - Prioridad Media
- Optimizar carga de página de Usuarios (detectada lentitud)
- Chequeo general del sistema móvil y web

## Archivos Clave
- `/app/backend/server.py` - API completa con filtrado por país
- `/app/frontend/app/sales.tsx` - Ventas con formato manual
- `/app/frontend/app/users.tsx` - Creación de usuarios con país
- `/app/frontend/app/multi-play.tsx` - Multi-jugada mejorada
- `/app/frontend/app/tickets.tsx` - Lista y pago de tickets
- `/app/frontend/app/dashboard.tsx` - Dashboard con filtro de país
- `/app/frontend/app/sellers-report.tsx` - Reporte con filtro de país

## Test Reports
- `/app/test_reports/iteration_7.json` - Pruebas de filtrado por país (100% passed)
- `/app/backend/tests/test_country_filter.py` - Tests de backend para filtrado
