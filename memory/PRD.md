# Sistema de Lotería RD/USA - PRD

## Descripción General
Sistema de gestión de loterías para República Dominicana y Estados Unidos. Permite la venta de boletos, gestión de sorteos, pago de premios y reportes de vendedores.

## Arquitectura
- **Backend:** FastAPI + MongoDB
- **Frontend:** React Native / Expo
- **Base de datos:** MongoDB
- **Dominio:** loteriamagica.com (Hostinger) - pendiente configuración

## Cambios Recientes

### ✅ Notificaciones en Tiempo Real para Depósitos (COMPLETADO 14 Feb 2026)
**Funcionalidades:**
- Cuando un vendedor solicita un depósito, el Super Admin recibe una notificación automática
- Badge naranja en el menú "Cuentas Banco" mostrando cantidad de depósitos pendientes
- Al tocar la notificación de depósito, navega directamente a `/bank-accounts`
- Polling cada 30 segundos para actualizar conteo de depósitos pendientes
- Notificaciones muestran título "💰 Nueva Solicitud de Depósito" con mensaje del monto

**Archivos Modificados:**
- `/app/frontend/app/notifications.tsx` - Soporte para tipos `deposit_request` y `deposit_processed`
- `/app/frontend/app/dashboard.tsx` - Badge en menú + polling de depósitos pendientes

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

### ✅ Bloqueo Automático por Balance $0 (COMPLETADO)
- Vendedor con balance $0 se bloquea automáticamente al intentar vender
- Se reactiva automáticamente cuando el admin aprueba un depósito

### ✅ Rediseño Página de Login (COMPLETADO)
- Nuevo diseño moderno con tarjeta centrada
- Gradiente de fondo con círculos decorativos
- Logo de empresa integrado

### ✅ Sistema de Permisos Super Admin (COMPLETADO)
- Solo Super Admin puede crear/editar/activar/desactivar Administradores
- Admin NO puede modificar a otros Admins ni al Super Admin
- Solo Super Admin puede crear/editar loterías

### ✅ Refactorización: sales.tsx Modularizado (COMPLETADO)
- Archivo original: 4079 líneas → Archivo nuevo: 878 líneas (-78%)

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

## APIs del Sistema Bancario
- `GET /api/bank-accounts` - Lista cuentas
- `POST /api/bank-accounts` - Crear cuenta (Super Admin)
- `GET /api/bank-accounts/summary` - Resumen con totales
- `GET /api/bank-accounts/deposit-requests/pending-count` - Conteo de pendientes
- `POST /api/bank-accounts/deposit-request` - Solicitar depósito
- `GET /api/bank-accounts/deposit-requests` - Lista solicitudes
- `PUT /api/bank-accounts/deposit-requests/{id}` - Procesar depósito
