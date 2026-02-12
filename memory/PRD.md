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

### Ventas - Sistema de Carrito con Favoritos
- **Selección Múltiple de Loterías:** Seleccionar varias loterías del mismo tipo
- **Sistema de Carrito:** Agregar múltiples jugadas antes de crear el ticket
- **Flujo de 4 Pasos:**
  1. Seleccionar Loterías (con filtro por tipo)
  2. Ingresar Números (manual o aleatorio)
  3. Monto y Agregar al Carrito
  4. Ver Carrito y Crear Ticket
- **⭐ Jugadas Favoritas:**
  - Guardar combinaciones frecuentes
  - Usar favoritos con un clic para agregar al carrito
  - Contador de uso (los más usados primero)
  - Eliminar favoritos no usados
- **Un solo recibo:** Todas las jugadas en un único ticket
- Validación de límites por número
- QR code en recibos

### Sorteos
- Creación de sorteos con números ganadores
- Sorteos manuales (ingreso manual de números ganadores)
- Procesamiento automático de tickets ganadores/perdedores

### Pagos de Tickets Ganadores
- **Vendedores pueden pagar tickets ganadores**
- Botón "Pagar Premio" en pantalla de tickets
- Validación de status (solo tickets "won" pueden pagarse)
- Registro de transacción de pago
- Estado actualizado a "paid" con timestamp

### Reportes con Filtro de País
- **Filtro de País:** Botones "Todos", "RD", "USA" para super_admin
- **Banderas de Moneda:** 🇩🇴 para RD$ y 🇺🇸 para USD
- Reportes por vendedor con país del vendedor
- Estadísticas de números
- Monitoreo en tiempo real
- Panel de límites

## Cambios Recientes (12 Feb 2026)

### Implementado Hoy
- ✅ **Jugadas Favoritas** - Guardar, usar y eliminar combinaciones frecuentes
- ✅ **Sistema de Carrito en Ventas** - Selección múltiple de loterías
- ✅ **Banderas de País en Reportes** - 🇩🇴 RD$ y 🇺🇸 $ en Dashboard
- ✅ **Filtrado de reportes por país** - Endpoints de accounting filtran por país
- ✅ **Pago de tickets ganadores** - Verificado funcionamiento para vendedores

## Credenciales de Prueba
- **Super Admin:** admin@loteria.com / admin123

## Endpoints Principales

### Autenticación
- POST /api/auth/login
- POST /api/auth/register
- GET /api/auth/me

### Loterías
- GET /api/lotteries?country={RD|US}
- POST /api/lotteries
- PUT /api/lotteries/{id}

### Tickets
- GET /api/tickets?country={RD|US}
- POST /api/tickets
- **POST /api/tickets/multi** (ticket múltiple con carrito)
- **POST /api/tickets/{id}/pay** (pagar ticket ganador)
- POST /api/tickets/{id}/cancel
- GET /api/tickets/verify/{ticket_number}

### Favoritos ⭐
- **GET /api/favorites** - Lista favoritos del usuario (ordenados por uso)
- **POST /api/favorites** - Crear favorito con múltiples plays
- **POST /api/favorites/{id}/use** - Incrementar contador de uso
- **DELETE /api/favorites/{id}** - Eliminar favorito

### Reportes (con filtro de país)
- GET /api/accounting/report?country={RD|US}
- GET /api/accounting/summary?country={RD|US}
- GET /api/accounting/sellers-report?country={RD|US}
- GET /api/accounting/daily-chart?country={RD|US}

## Tareas Pendientes

### P1 - Prioridad Alta
- Investigar error de "boleto" en móvil (usuario reportó problema, sin detalles)

### P2 - Prioridad Media
- Optimizar carga de página de Usuarios
- Chequeo general del sistema móvil y web

## Archivos Clave
- `/app/backend/server.py` - API completa con favoritos, pagos, filtrado
- `/app/frontend/app/sales.tsx` - Sistema de carrito con favoritos
- `/app/frontend/app/dashboard.tsx` - Dashboard con filtro de país
- `/app/frontend/app/tickets.tsx` - Lista y pago de tickets
- `/app/frontend/app/sellers-report.tsx` - Reporte con banderas

## Test Reports
- `/app/test_reports/iteration_9.json` - Pruebas de favoritos y pagos (100% passed)
- `/app/test_reports/iteration_8.json` - Pruebas de carrito y banderas (100% passed)
- `/app/test_reports/iteration_7.json` - Pruebas de filtrado por país (100% passed)
- `/app/backend/tests/test_favorites.py` - Tests de favoritos CRUD
