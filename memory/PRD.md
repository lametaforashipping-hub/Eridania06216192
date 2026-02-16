# Sistema de Lotería RD/USA - PRD

## Descripción General
Sistema de gestión de loterías para República Dominicana y Estados Unidos. Permite la venta de boletos, gestión de sorteos, pago de premios y reportes de vendedores.

## Arquitectura
- **Backend:** FastAPI + MongoDB
- **Frontend:** React Native / Expo
- **Base de datos:** MongoDB
- **Dominio:** loteriamagica.com (Hostinger) - pendiente configuración

## Cambios Recientes

### ✅ Sistema de Resultados Automáticos (COMPLETADO 16 Feb 2026)
**Funcionalidades:**
- **Web Scraping Multi-Fuente:** Obtiene resultados de 4 sitios web dominicanos:
  - conectate.com.do
  - loteriasdominicanas.com
  - quinielasrd.com
  - loteriard.com
- **Validación Cruzada 100%:** Solo procesa resultados confirmados por 2+ fuentes
- **Scheduler Automático:** Verifica cada 5, 7 o 10 minutos (configurable)
- **Procesamiento Automático:** Detecta ganadores y envía notificaciones
- **Notificaciones Push a TODOS:** Cuando salen nuevos resultados, todos los usuarios reciben notificación push
- **Loterías Soportadas:** Nacional, Leidsa, Loteka, Real, LoteDom y más

**Backend Creado:**
- `/app/backend/services/lottery_scraper.py` - Servicio de scraping con validación
- `/app/backend/services/lottery_scheduler.py` - Scheduler automático APScheduler
- `/app/backend/routes/lottery_results.py` - API endpoints

**Frontend Creado:**
- `/app/frontend/app/auto-results.tsx` - Panel de control de resultados automáticos
- `/app/frontend/app/notifications.tsx` - Soporte para tipo `lottery_results`
- `/app/frontend/src/hooks/useNotificationPermission.ts` - Hook para verificar/solicitar permisos push
- `/app/frontend/src/components/NotificationBanner.tsx` - Banner para activar notificaciones

### ✅ Logo en Ticket Compartido (COMPLETADO 16 Feb 2026)
- El ticket ahora **siempre muestra** el logo de Lotería Mágica
- Si hay logo personalizado en el perfil de empresa, usa ese; sino usa el logo local
- Logo más grande (70x70) y circular
- Slogan siempre visible: muestra el slogan configurado o "Tu suerte comienza aquí" por defecto
- Campo slogan mejorado en perfil de empresa con indicación visual

### ✅ Pantalla de Venta Rápida para Móvil (COMPLETADO 16 Feb 2026)
**Nueva ruta:** `/quick-sales`

**Funcionalidades:**
- **Detección automática de tipo de jugada:**
  - 2 dígitos → Quiniela (ej: `02`)
  - 4 dígitos → Pale (ej: `0250` = 02-50)
  - 6 dígitos → Tripleta (ej: `025080` = 02-50-80)
- **Header con lotería seleccionada:** Nombre GRANDE + indicador ABIERTA/CERRADA
- **Selector de loterías:** Muestra TODAS con punto verde (abierta) o rojo (cerrada)
- **Monto manual:** Campo de entrada libre (sin botones predefinidos)
- **Entrada rápida:** Solo escribir números y presionar Enter
- **Vista previa en tiempo real** mientras se escribe
- **Carrito siempre visible** en la parte inferior
- **Haptic feedback** al agregar/eliminar jugadas
- **Validación:** No permite jugar en loterías cerradas

**Bug Fix:** Corregida validación de play_types que causaba error "no disponible"

**Testing:** 9/9 tests backend pasando, frontend verificado

**Archivos Creados:**
- `/app/frontend/app/quick-sales.tsx`

### ✅ Mejoras Visuales en Números de Sorteo (COMPLETADO 16 Feb 2026)
- **Sorteos (/draws):** Números más grandes (64x60x56px) con colores distintivos
  - 1er premio: Dorado (#fbbf24)
  - 2do premio: Gris (#9ca3af)
  - 3er premio: Bronce (#b45309)
- **Notificaciones:** Números en círculos de colores grandes (44px)
- **Texto negro** para mejor contraste

**APIs Nuevas:**
- `GET /api/lottery-results/sources-check` - Estado de fuentes de datos
- `GET /api/lottery-results/latest` - Últimos resultados validados
- `GET /api/lottery-results/preview` - Vista previa de ganadores potenciales
- `POST /api/lottery-results/fetch-now` - Buscar resultados manualmente
- `GET /api/lottery-results/status` - Estado del scheduler
- `POST /api/lottery-results/scheduler/start` - Iniciar scheduler (Super Admin)
- `POST /api/lottery-results/scheduler/stop` - Detener scheduler (Super Admin)

**Testing:** 13/13 tests backend pasando, frontend 100% verificado

### ✅ Alertas Sonoras y Vibración para Depósitos (COMPLETADO 14 Feb 2026)
**Funcionalidades:**
- **Sonido de alerta:** Beep de dos tonos (880Hz + 1100Hz) cuando hay nuevo depósito pendiente
- **Vibración:** Patrón de vibración en dispositivos móviles/navegadores compatibles
- **Sonido de éxito:** Tono de 523Hz cuando el admin aprueba un depósito
- **Anti-spam:** Mínimo 3 segundos entre alertas consecutivas
- **Compatibilidad:** Web Audio API para web, Haptics para iOS, Vibration para Android

**Archivos Creados:**
- `/app/frontend/src/hooks/useNotificationAlert.ts` - Hook reutilizable con toda la lógica de alertas

**Archivos Modificados:**
- `/app/frontend/app/dashboard.tsx` - Usa `checkAndAlertNewDeposits` cuando cambia el conteo
- `/app/frontend/app/bank-accounts.tsx` - Usa `alertDepositApproved` al aprobar depósitos

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

### ✅ Endpoint /health para Deployment (COMPLETADO 16 Feb 2026)
- Agregado `GET /health` que retorna `{"status": "healthy"}`
- Necesario para health checks de Kubernetes durante el deployment
- Archivo modificado: `/app/backend/server.py`

### ✅ Ticket Optimizado para WhatsApp (COMPLETADO 16 Feb 2026)
- **Formato compacto:** Una sola línea separadora, sin múltiples bordes
- **Por lotería:** Nombre en mayúsculas (NACIONAL, LEIDSA, etc.)
- **Jugadas compactas:** Formato "Q 02-15 = $100" en una sola línea
- **Total destacado:** Con borde superior simple
- **Footer compacto:** "CONSERVE ESTE BOLETO • ¡BUENA SUERTE!"
- **Botón "Enviar Imagen":** Descarga PNG en web, comparte directo en móvil
- Archivos modificados:
  - `/app/frontend/src/components/sales/components/TicketModal.tsx`
  - `/app/frontend/src/components/sales/styles.ts`

## Próximos Pasos (Backlog)

### P0 - Bloqueadores
- [x] ~~Resolver error de despliegue~~ - Endpoint /health implementado

### P1 - Alta Prioridad
- [x] ~~Agregar logo al ticket compartido~~ - COMPLETADO
- [ ] Conectar dominio personalizado (loteriamagica.com)
- [ ] Verificar deployment exitoso con nuevo /health endpoint

### P2 - Media Prioridad
- [x] ~~Notificaciones push para resultados~~ - COMPLETADO
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
