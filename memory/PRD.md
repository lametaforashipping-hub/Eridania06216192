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

### Tickets y Verificación
- [x] Lista de boletos con filtros por estado
- [x] Cancelación de tickets (hasta 5 minutos después de creación)
- [x] Pago de premios
- [x] Impresión de recibos (HTML)
- [x] Compartir ticket (WhatsApp/Share)
- [x] **Escáner/Verificador de tickets:**
  - Entrada manual de número de ticket
  - Cámara para escaneo de códigos (móvil)
  - Endpoint público: GET /api/tickets/verify/{ticket_number}
  - Muestra estado: GANADOR, PERDIDO, PENDIENTE, PAGADO, CANCELADO

### Recibos Impresos
- [x] Diseño profesional con logo
- [x] Detalles del ticket (números, monto, fecha)
- [x] Código de barras para escaneo
- [x] **Comisión NO visible** en recibo impreso (solo en vista del vendedor)
- [x] Premio potencial

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

## Estructura de Archivos

```
/app
├── backend/
│   ├── server.py          # API principal FastAPI
│   ├── requirements.txt
│   └── tests/
│       └── test_lottery_system.py
└── frontend/
    ├── app/
    │   ├── _layout.tsx    # Layout principal
    │   ├── login.tsx      # Pantalla de login
    │   ├── dashboard.tsx  # Dashboard principal
    │   ├── users.tsx      # Gestión de usuarios
    │   ├── sales.tsx      # Venta individual
    │   ├── multi-play.tsx # Multi-Jugada
    │   ├── animalitos.tsx # Venta Animalitos
    │   ├── tickets.tsx    # Lista de boletos
    │   ├── scanner.tsx    # Verificador de tickets
    │   ├── monitoring.tsx # Monitoreo en tiempo real
    │   └── ...
    └── src/
        └── context/
            └── AuthContext.tsx
```

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

### Loterías y Sorteos
- GET /api/lotteries
- POST /api/draws
- GET /api/draws

## Credenciales de Prueba
- Email: admin@loteria.com
- Password: admin123

## Tareas Pendientes

### Prioridad Alta (P1)
- [ ] Monitoreo de jugadas individuales (no solo resúmenes de tickets)
- [ ] Selección múltiple de loterías en una sola jugada
- [ ] Reportes detallados por vendedor con fechas

### Prioridad Media (P2)
- [ ] Logo personalizado en recibos
- [ ] Migración de datos para usuarios existentes (agregar commission_rate default)

### Prioridad Baja (P3)
- [ ] Mejoras de UI adicionales
- [ ] Notificaciones push

## Actualizaciones Recientes (Feb 2026)
1. Sistema de usuarios mejorado con campos adicionales
2. Porcentaje de comisión individual por vendedor
3. Pantalla de verificación de tickets (/scanner)
4. Fix de seguridad: campos sensibles excluidos de API
5. Reset automático de formulario después de jugadas
6. Comisión oculta en recibos impresos
