# Sistema de Lotería RD/USA - PRD

## Descripción General
Sistema de gestión de loterías para República Dominicana y Estados Unidos. Permite la venta de boletos, gestión de sorteos, pago de premios y reportes de vendedores.

## Arquitectura
- **Backend:** FastAPI + MongoDB
- **Frontend:** React Native / Expo
- **Base de datos:** MongoDB
- **Dominio:** loteriamagica.com (Hostinger) - pendiente configuración

## Cambios Recientes

### ✅ Sistema de Cuentas Bancarias Virtuales (COMPLETADO 14 Feb 2026)
**Backend:**
- Archivo: `/app/backend/routes/bank_accounts.py`
- Endpoints completos para CRUD de cuentas bancarias virtuales
- Sistema de solicitudes de depósito (vendedor solicita, admin aprueba)
- Transacciones y historial por cuenta
- Resumen de totales por moneda
- Tests: `/app/backend/tests/test_bank_accounts.py` - 14/14 tests pasando

**Frontend:**
- Página: `/app/frontend/app/bank-accounts.tsx`
- Crear cuentas tipo: Banco, Zelle, Efectivo
- Configurar por país (RD/USA) y moneda (RD$/USD)
- Pestaña de depósitos pendientes para aprobar/rechazar
- Modal completo para crear cuentas bancarias
- Accesible desde el menú principal (Super Admin/Admin)

**Verificado:**
- GET /api/bank-accounts - Lista cuentas (4 cuentas existen)
- POST /api/bank-accounts - Crea cuentas (bank, zelle, cash)
- GET /api/bank-accounts/summary - Totales por moneda
- POST /api/bank-accounts/deposit-request - Vendedores crean solicitudes
- GET /api/bank-accounts/deposit-requests?status=pending - Lista pendientes
- PUT /api/bank-accounts/deposit-requests/{id} - Aprueba/rechaza depósitos
- Control de autorización - Vendedores bloqueados de acciones admin

### ✅ Bloqueo Automático por Balance $0 (COMPLETADO)
- Vendedor con balance $0 se bloquea automáticamente al intentar vender
- Se reactiva automáticamente cuando el admin aprueba un depósito

### ✅ Rediseño Página de Login (COMPLETADO)
- Nuevo diseño moderno con tarjeta centrada
- Gradiente de fondo con círculos decorativos
- Logo de empresa integrado
- Campos de entrada compactos con íconos
- Botón con gradiente morado

### ✅ Sistema de Permisos Super Admin (COMPLETADO)
**Restricciones implementadas:**
- Solo Super Admin puede crear/editar/activar/desactivar Administradores
- Admin NO puede modificar a otros Admins ni al Super Admin
- Admin solo puede gestionar Vendedores que él creó
- Solo Super Admin puede crear/editar loterías

### ✅ Refactorización: sales.tsx Modularizado (COMPLETADO)
- Archivo original: 4079 líneas → Archivo nuevo: 878 líneas (-78%)
- Nueva estructura modular en `/app/frontend/app/components/sales/`

## Funcionalidades Implementadas

### Sistema de Ventas Completo
- Selección Múltiple de Loterías
- Sistema de Carrito
- Tipos de Jugada: Quiniela, Pale, Tripleta, Super Pale
- Favoritos y Jugadas Recientes
- Edición del Carrito
- Atajos de Teclado
- Ticket con QR Code y compartir

### Autenticación y Usuarios
- Login con JWT
- Roles: super_admin, admin, vendedor
- Creación de usuarios con país (RD/US)

### Loterías (21 loterías reales de RD)
- Gana Más, Lotería Nacional, Pega 3 Más, etc.
- Horarios configurables
- Multiplicadores por tipo de jugada

### Reportes y Contabilidad
- Reporte detallado por vendedor
- Exportar a Excel
- Dashboard con filtro de país

## Credenciales de Prueba
- **Super Admin:** admin@loteria.com / admin123
- **Vendedor:** vendedor@test.com / 12345678

## Próximos Pasos (Backlog)

### P0 - Bloqueadores
- [ ] Resolver error de despliegue (límite de proyectos Expo - emergent003)

### P1 - Alta Prioridad
- [ ] Agregar logo al ticket compartido
- [ ] Conectar dominio personalizado (loteriamagica.com)

### P2 - Media Prioridad
- [ ] Notificaciones push para resultados
- [ ] Dashboard de estadísticas avanzadas

### P3 - Baja Prioridad
- [ ] Reportes de comisión más detallados
- [ ] Interfaz de pago de premios mejorada

## Estructura de Archivos Clave
```
/app
├── backend/
│   ├── routes/
│   │   ├── bank_accounts.py    # Sistema bancario completo
│   │   ├── tickets.py          # Ventas (incluye check de balance)
│   │   ├── users.py            # RBAC implementado
│   │   └── lotteries.py        # RBAC implementado
│   ├── tests/
│   │   └── test_bank_accounts.py  # 14 tests
│   └── server.py
└── frontend/
    └── app/
        ├── bank-accounts.tsx   # Página de cuentas bancarias
        ├── login.tsx           # Login rediseñado
        ├── dashboard.tsx       # Menu principal
        ├── sales.tsx           # Ventas (modularizado)
        └── components/sales/   # Componentes modulares
```

## APIs del Sistema Bancario
- `GET /api/bank-accounts` - Lista cuentas
- `POST /api/bank-accounts` - Crear cuenta (Super Admin)
- `GET /api/bank-accounts/summary` - Resumen con totales
- `GET /api/bank-accounts/public` - Info pública para vendedores
- `POST /api/bank-accounts/deposit-request` - Solicitar depósito
- `GET /api/bank-accounts/deposit-requests` - Lista solicitudes
- `PUT /api/bank-accounts/deposit-requests/{id}` - Procesar depósito
- `POST /api/bank-accounts/{id}/adjust-balance` - Ajuste manual
- `GET /api/bank-accounts/{id}/transactions` - Historial
