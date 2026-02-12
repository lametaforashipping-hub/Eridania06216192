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
- Múltiples tipos: Quiniela, Pale, Tripleta, Super Pale, Loto, Powerball, etc.
- Horarios de apertura/cierre configurables
- Horarios especiales por día de la semana
- Feriados con horarios especiales
- Límite de boletos por número

### Ventas - NUEVO Sistema de Carrito
- **Selección Múltiple de Loterías:** Poder seleccionar varias loterías del mismo tipo (ej: Quiniela Nacional + Quiniela Provincial) 
- **Sistema de Carrito:** Agregar múltiples jugadas antes de crear el ticket
- **Flujo de 4 Pasos:**
  1. Seleccionar Loterías (con filtro por tipo)
  2. Ingresar Números (manual o aleatorio)
  3. Monto y Agregar al Carrito
  4. Ver Carrito y Crear Ticket
- **Un solo recibo:** Todas las jugadas se combinan en un único ticket
- Validación de límites por número
- QR code en recibos

### Sorteos
- Creación de sorteos con números ganadores
- Sorteos manuales (ingreso manual de números ganadores)
- Procesamiento automático de tickets ganadores/perdedores

### Pagos
- Pago de tickets ganadores
- Registro de transacciones
- Contabilidad de premios pagados

### Reportes con Filtro de País
- **Filtro de País:** Botones "Todos", "RD", "USA" para super_admin
- **Banderas de Moneda:** 🇩🇴 para RD$ y 🇺🇸 para USD
- Reportes por vendedor con país del vendedor
- Estadísticas de números
- Monitoreo en tiempo real
- Panel de límites (números bloqueados/cerca del límite)

## Cambios Recientes (12 Feb 2026)

### Implementado Hoy
- ✅ **Sistema de Carrito en Ventas** - Nueva pantalla con selección múltiple de loterías
- ✅ **Banderas de País en Reportes** - 🇩🇴 RD$ y 🇺🇸 $ en Dashboard y Sellers Report
- ✅ **Filtrado de reportes por país** - Endpoints de accounting filtran por país
- ✅ **Selector de país en UI** - Dashboard y Sellers Report con filtro para super_admin

### Flujo del Nuevo Sistema de Ventas
1. Usuario selecciona una o varias loterías (ej: Quiniela 24H + Test Alerta 80%)
2. Ingresa el número (ej: 25) - se valida rango según lotería
3. Define monto (ej: RD$ 20) y hace clic en "Agregar al Carrito"
4. Se agregan 2 jugadas al carrito (mismos números, diferentes loterías)
5. Puede seguir agregando más jugadas con diferentes números/loterías
6. Al final hace clic en "Crear Ticket" para generar un solo recibo con todas las jugadas

### Eliminado
- ❌ Animalitos - Eliminada funcionalidad completa

## Credenciales de Prueba
- **Super Admin:** admin@loteria.com / admin123

## Endpoints Principales

### Autenticación
- POST /api/auth/login
- POST /api/auth/register (requiere autenticación)
- GET /api/auth/me

### Loterías
- GET /api/lotteries?country={RD|US}
- POST /api/lotteries
- PUT /api/lotteries/{id}
- GET /api/lotteries/{id}/number-stats

### Tickets
- GET /api/tickets?country={RD|US}
- POST /api/tickets (ticket simple)
- **POST /api/tickets/multi** (ticket múltiple con carrito)
- POST /api/tickets/{id}/pay
- POST /api/tickets/{id}/cancel
- GET /api/tickets/verify/{ticket_number}

### Reportes (con filtro de país)
- GET /api/accounting/report?country={RD|US}
- GET /api/accounting/summary?country={RD|US}
- GET /api/accounting/sellers-report?country={RD|US}
- GET /api/accounting/daily-chart?country={RD|US}
- GET /api/monitoring/tickets

## Tareas Pendientes

### P1 - Prioridad Alta
- Investigar error de "boleto" en móvil (usuario reportó problema, no hay detalles)

### P2 - Prioridad Media
- Optimizar carga de página de Usuarios (detectada lentitud)
- Chequeo general del sistema móvil y web

## Archivos Clave
- `/app/backend/server.py` - API completa con filtrado por país y /api/tickets/multi
- `/app/frontend/app/sales.tsx` - **NUEVO** Sistema de carrito de ventas
- `/app/frontend/app/dashboard.tsx` - Dashboard con filtro de país y banderas
- `/app/frontend/app/sellers-report.tsx` - Reporte con filtro de país y banderas
- `/app/frontend/app/users.tsx` - Creación de usuarios con país
- `/app/frontend/app/tickets.tsx` - Lista y pago de tickets

## Test Reports
- `/app/test_reports/iteration_8.json` - Pruebas de sistema de carrito y banderas (100% passed)
- `/app/test_reports/iteration_7.json` - Pruebas de filtrado por país (100% passed)
- `/app/backend/tests/test_multi_play_and_sales.py` - Tests de backend para multi-play
- `/app/backend/tests/test_country_filter.py` - Tests de backend para filtrado
