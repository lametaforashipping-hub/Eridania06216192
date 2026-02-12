# Sistema de Lotería - PRD

## Descripción General
Sistema de gestión de lotería para República Dominicana y USA con soporte para múltiples tipos de juegos, vendedores, monitoreo en tiempo real y verificación de tickets.

## Stack Tecnológico
- **Frontend:** React Native (Expo) con TypeScript
- **Backend:** FastAPI (Python)
- **Base de Datos:** MongoDB
- **Routing:** File-based routing (Expo Router)

## Características Implementadas

### Autenticación y Usuarios
- [x] Login/Logout con JWT
- [x] Roles: Super Admin, Admin, Vendedor
- [x] Creación de usuarios con campos:
  - Nombre, Email, Contraseña
  - Teléfono, Dirección, Cédula/Identificación
  - Porcentaje de comisión individual
  - Límite de crédito
- [x] Control de permisos por rol
- [x] Vendedores solo pueden vender (sin acceso a configuración)

### Tipos de Juego
- [x] Quiniela (1 número)
- [x] Palé (2 números)
- [x] Tripleta (3 números)
- [x] Super Palé (2 números premium)
- [x] Animalitos (0-36)

### Venta de Boletos
- [x] Venta individual
- [x] Multi-Jugada (múltiples jugadas en un ticket)
- [x] Selección de lotería
- [x] Cliente opcional
- [x] Reset automático del formulario después de cada jugada
- [x] **Bloqueo de ventas cuando la lotería está cerrada**

### Tickets y Verificación
- [x] Lista de boletos con filtros por estado
- [x] Cancelación de tickets (hasta 5 minutos después de creación)
- [x] Pago de premios
- [x] Impresión de recibos (HTML)
- [x] Compartir ticket (WhatsApp/Share)
- [x] Escáner/Verificador de tickets

### Recibos Impresos (ACTUALIZADO Feb 2026)
- [x] Diseño profesional con logo de empresa
- [x] **Código de barras real** (usando fuente Libre Barcode 128)
- [x] **Información de la empresa** (RNC, teléfono, dirección)
- [x] Detalles del ticket (números, monto, fecha)
- [x] URL de verificación
- [x] Premio potencial
- [x] Comisión NO visible en recibo impreso

### Control de Horarios de Lotería (NUEVO Feb 2026)
- [x] **Hora de apertura diaria** (configurable por lotería)
- [x] **Hora de cierre diaria** (configurable por lotería)
- [x] **Horarios diferentes por día de la semana** (weekly_hours)
  - Sábados: horario extendido (08:00-22:00 por defecto)
  - Domingos: horario reducido (10:00-20:00 por defecto)
  - Configurable para cada día individualmente
- [x] **Bloqueo automático de ventas** fuera del horario
- [x] **Mensaje descriptivo** cuando la lotería está cerrada (incluye día siguiente)
- [x] Indicador visual de estado (abierta/cerrada) en la lista de loterías
- [x] Muestra horario del día actual en la tarjeta de lotería

### Sistema de Notificaciones
- [x] Campana de notificaciones en dashboard
- [x] Badge con contador de notificaciones no leídas
- [x] Notificaciones de resultados de sorteos (globales)
- [x] Alertas de ganadores personalizadas por vendedor
- [x] Polling automático cada 30 segundos
- [x] Tipos: draw_result, winner_alert, system

### UI/UX Mejoras (Feb 2026)
- [x] **KeyboardAvoidingView mejorado** en Multi-Jugada para evitar que el teclado tape el botón
- [x] Scroll con padding inferior para mejor acceso a botones

### Monitoreo y Reportes
- [x] Dashboard con estadísticas diarias
- [x] Monitoreo en tiempo real
- [x] Reportes por vendedor
- [x] Reportes por usuario
- [x] Contabilidad

### Seguridad
- [x] Campos sensibles (_id, password) excluidos de respuestas API
- [x] Autenticación JWT requerida para endpoints protegidos
- [x] Endpoint de verificación de tickets es público

## API Endpoints Principales

### Autenticación
- POST /api/auth/login
- POST /api/auth/register
- GET /api/auth/me

### Tickets
- POST /api/tickets (ticket individual)
- POST /api/tickets/multi (multi-jugada)
- GET /api/tickets
- GET /api/tickets/verify/{ticket_number} (público)
- POST /api/tickets/{id}/cancel
- POST /api/tickets/{id}/pay

### Usuarios
- GET /api/users
- PUT /api/users/{id}
- POST /api/users/{id}/deposit

### Notificaciones
- GET /api/notifications
- POST /api/notifications/{id}/read
- GET /api/notifications/unread-count

### Loterías y Sorteos
- GET /api/lotteries (incluye is_open, closed_message, opening_time, closing_time)
- POST /api/lotteries (con opening_time, closing_time)
- PUT /api/lotteries/{id} (actualizar horarios)
- POST /api/draws
- GET /api/draws

## Credenciales de Prueba
- Email: admin@loteria.com
- Password: admin123

## Tareas Pendientes

### Prioridad Alta (P1)
- [ ] Selección múltiple de loterías en una sola jugada
- [ ] Monitoreo de jugadas individuales (no solo tickets)
- [ ] Reportes detallados por vendedor con fechas

### Prioridad Media (P2)
- [ ] Logo personalizado/configurable en recibos
- [ ] Migración de datos para usuarios existentes (agregar commission_rate default)
- [ ] Migración de datos para loterías existentes (agregar opening_time, closing_time)

### Prioridad Baja (P3)
- [ ] Mejoras de UI adicionales
- [ ] Notificaciones push nativas

## Actualizaciones Recientes

### Feb 2026 - Sesión Actual
1. **Bug Fix:** KeyboardAvoidingView en Multi-Jugada para evitar que el teclado tape el botón
2. **Mejora de Recibos:** 
   - Código de barras real con fuente Libre Barcode 128
   - Logo de empresa con diseño circular
   - Información de empresa (RNC, teléfono, dirección)
   - URL de verificación en el footer
3. **Nueva Funcionalidad - Horarios de Lotería:**
   - Campos opening_time y closing_time en modelo de lotería
   - Función check_lottery_open actualizada para verificar horarios diarios
   - Bloqueo automático de ventas fuera del horario
   - Mensajes descriptivos de cierre
   - UI actualizada para mostrar estado y horarios

### Feb 2026 - Sesión Anterior
1. Sistema de usuarios mejorado con campos adicionales
2. Porcentaje de comisión individual por vendedor
3. Pantalla de verificación de tickets (/scanner)
4. Fix de seguridad: campos sensibles excluidos de API
5. Reset automático de formulario después de jugadas
6. Comisión oculta en recibos impresos
7. Sistema de notificaciones con alertas de ganadores
8. Campana de notificaciones en dashboard con badge

## Archivos Clave
- `/app/backend/server.py` - Backend principal
- `/app/frontend/app/multi-play.tsx` - Pantalla de multi-jugada
- `/app/frontend/app/sales.tsx` - Pantalla de venta individual
- `/app/frontend/app/lotteries.tsx` - Gestión de loterías
- `/app/frontend/app/tickets.tsx` - Lista de boletos

## Test Reports
- `/app/test_reports/iteration_1.json` - Tests de sesión anterior
- `/app/test_reports/iteration_2.json` - Tests de horarios de lotería (13 tests pasados)
- `/app/backend/tests/test_lottery_opening_hours.py` - Tests de horarios
