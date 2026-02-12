# Sistema de Lotería - PRD

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
- **Reportes separados por país** (super_admin ve todos)

## Cambios Recientes (12 Feb 2026)

### Eliminado
- ❌ Animalitos - Eliminada funcionalidad completa (pantalla, endpoints, loterías)

### Nuevo
- ✅ Formato de venta manual - Campo de entrada para números en lugar de cuadrícula
- ✅ País y moneda en registro - Selección de RD (Peso) o US (Dólar) al crear usuarios
- ✅ Reportes por país - Filtrado automático basado en país del usuario
- ✅ Mejoras móvil - KeyboardAvoidingView mejorado en multi-jugada

### Corregido
- ✅ Error de parsing de tiempo en check_lottery_open
- ✅ Error de números undefined en tickets.tsx

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

### Reportes
- GET /api/accounting/report
- GET /api/accounting/sellers-report
- GET /api/monitoring/tickets

## Próximas Tareas (Backlog)
1. Mejorar testeo de sorteos manuales UI
2. Agregar filtro de país visible en reportes para super_admin

## Archivos Clave
- `/app/backend/server.py` - API completa
- `/app/frontend/app/sales.tsx` - Ventas con formato manual
- `/app/frontend/app/users.tsx` - Creación de usuarios con país
- `/app/frontend/app/multi-play.tsx` - Multi-jugada mejorada
- `/app/frontend/app/tickets.tsx` - Lista y pago de tickets
- `/app/frontend/app/dashboard.tsx` - Menú principal (sin animalitos)
