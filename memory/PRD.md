# Sistema de Lotería RD/USA - PRD

## Descripción General
Sistema de gestión de loterías para República Dominicana y Estados Unidos. Permite la venta de boletos, gestión de sorteos, pago de premios y reportes de vendedores.

## Arquitectura
- **Backend:** FastAPI + MongoDB
- **Frontend:** React Native / Expo
- **Base de datos:** MongoDB
- **Dominio:** loteriamagica.com (Hostinger) - pendiente configuración


## NUEVA FUNCIONALIDAD: Plataforma para Clientes ✅ COMPLETADO

### Fase 1: Base del Sistema de Clientes ✅ COMPLETADO 17 Feb 2026
**Backend:**
- Nuevo rol `CLIENTE` en `/app/backend/models/enums.py`
- Nuevos estados: `PENDING_PAYMENT`, `PaymentMethod`, `PaymentStatus`
- Nuevo archivo `/app/backend/routes/clients.py`:
  - `POST /api/clients/register` - Registro público de clientes
  - `POST /api/clients/login` - Login con teléfono
  - `GET /api/clients/me` - Perfil del cliente
  - `GET /api/clients/payment-accounts` - Cuentas de pago disponibles
  - `POST /api/clients/tickets` - Crear ticket (pendiente pago)
  - `POST /api/clients/tickets/{id}/upload-receipt` - Subir comprobante
  - `GET /api/clients/tickets` - Historial de tickets
  - `GET /api/clients/results` - Ver resultados
- Nuevo archivo `/app/backend/routes/payments.py`:
  - `GET /api/payments/config` - Configuración de cuentas
  - `PUT /api/payments/config` - Actualizar config
  - `GET /api/payments/pending` - Pagos pendientes
  - `POST /api/payments/{id}/action` - Aprobar/Rechazar pago
  - `GET /api/payments/history` - Historial

**Frontend:**
- `/app/frontend/app/client-register.tsx` - Registro de clientes
- `/app/frontend/app/client-login.tsx` - Login de clientes
- `/app/frontend/app/client-dashboard.tsx` - Dashboard principal
- Enlace en login principal: "Soy cliente - Quiero jugar"

### Fase 2: Sistema de Pagos ✅ COMPLETADO 17 Feb 2026
**Backend:**
- `PUT /api/clients/me` - Actualizar perfil de cliente
- Endpoint de payment-accounts ya devuelve las cuentas configuradas
- Flujo completo de creación de ticket con estado `pending_payment`

**Frontend:**
- `/app/frontend/app/client-play.tsx` - Pantalla de crear jugadas:
  - Selección de loterías abiertas
  - Detección automática de tipo de jugada (Quiniela/Pale/Tripleta)
  - Carrito de jugadas con total
  - Selección de método de pago (Zelle/Banco)
  - Modal de confirmación de pedido
  - Modal para subir comprobante post-creación
- `/app/frontend/app/client-tickets.tsx` - Historial de tickets:
  - Filtros por estado (Todas, Pago Pendiente, En Juego, Ganadores)
  - Subir comprobante desde historial
  - Detalle de ticket con jugadas
  - Paginación
- `/app/frontend/app/client-results.tsx` - Ver resultados:
  - Selector de fecha
  - Muestra resultados del día
  - Premios (1°, 2°, 3°)
- `/app/frontend/app/client-profile.tsx` - Perfil de cliente:
  - Estadísticas (Jugadas, Ganado)
  - Editar nombre/email
  - Acciones rápidas
  - Cerrar sesión

**Modificaciones:**
- `/app/frontend/src/context/AuthContext.tsx` - Soporte para login con token directo (clientes)

### Fase 3: Confirmación y Validación ✅ COMPLETADO 17 Feb 2026
**Backend:**
- `GET /api/payments/pending` - Lista de pagos pendientes
- `GET /api/payments/pending-count` - Contador de pagos pendientes
- `POST /api/payments/{id}/action` - Aprobar/rechazar pago
- Notificaciones push a clientes cuando se confirma/rechaza pago
- Scheduler de resumen diario de pagos pendientes (8:00 AM UTC)

**Frontend:**
- `/app/frontend/app/admin-pending-payments.tsx` - Panel de pagos pendientes:
  - Lista de pagos con info del cliente
  - Preview de comprobante de pago
  - Aprobar con confirmación
  - Rechazar con razón opcional
  - Paginación
- Nuevo menú "Pagos Clientes" en dashboard de admin

**Notificaciones:**
- `notify_client_payment_confirmed` - Notifica al cliente cuando el pago es aprobado
- `notify_client_payment_rejected` - Notifica al cliente cuando el pago es rechazado
- `notify_admin_pending_payments_summary` - Resumen diario a las 8:00 AM UTC

### Fase 4: Notificaciones y Resultados ✅ COMPLETADO 17 Feb 2026
**Backend:**
- `GET /api/clients/notifications` - Lista de notificaciones del cliente (paginada)
- `GET /api/clients/notifications/unread-count` - Contador de no leídas
- `PUT /api/clients/notifications/{id}/read` - Marcar como leída
- `PUT /api/clients/notifications/read-all` - Marcar todas como leídas
- Integración de `notify_client_winner` en `lottery_scheduler.py`
- Detección automática de tickets ganadores de clientes

**Frontend:**
- `/app/frontend/app/client-notifications.tsx` - Pantalla de notificaciones:
  - Lista de notificaciones con iconos por tipo
  - Diferencia visual entre leídas/no leídas
  - Marcar como leída al tocar
  - "Leer todo" en el header
  - Paginación
- `/app/frontend/app/client-dashboard.tsx` - Actualizado:
  - Icono de campana (notificaciones)
  - Badge con contador de no leídas
  - Enlace a pantalla de notificaciones

**Tipos de Notificaciones:**
- `payment_confirmed` - Pago aprobado
- `payment_rejected` - Pago rechazado
- `winner` - Premio ganado

## Mejoras Dashboard Estadísticas (PENDIENTE)
- Panel de pagos pendientes (Admin)
- Aprobar/Rechazar pagos
- Cancelación automática 15 min antes del cierre

### Fase 4: Notificaciones (PENDIENTE)
- Alertas al cliente sobre estado de pagos
- Notificación de ganadores


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

### ✅ Logo en Ticket Compartido (COMPLETADO 16 Feb 2026, BUG FIX 17 Feb 2026)
- El ticket ahora **siempre muestra** el logo de Lotería Mágica
- Si hay logo personalizado en el perfil de empresa, usa ese; sino usa el logo local
- Logo más grande (70x70) y circular
- Slogan siempre visible: muestra el slogan configurado o "Tu suerte comienza aquí" por defecto
- Campo slogan mejorado en perfil de empresa con indicación visual
- **Bug Fix (17 Feb 2026):** Corregida URL del logo que retornaba 404. Ahora usa URL local `/logo.png` servida desde la carpeta `public/`
- **QR Code:** Usa API externa `api.qrserver.com` para generar imagen QR en web (más compatible que SVG con html2canvas)

### ✅ Subida de Logo Personalizado (COMPLETADO 17 Feb 2026)
- **Backend:** Endpoint `POST /api/company-profile/logo` para subir logos
- **Funcionalidades:**
  - Soporta JPG, PNG, GIF, WebP
  - Genera nombre único para evitar conflictos de caché
  - Elimina logos anteriores al subir uno nuevo
  - Almacena en `/uploads/` (servido estáticamente)
  - Actualiza automáticamente el perfil de empresa en la DB
- **Frontend:** Pantalla de "Perfil de Empresa" permite:
  - Toca el área del logo para seleccionar imagen
  - Preview circular del logo actual
  - Vista previa del recibo con el logo
  - El logo aparece automáticamente en los tickets generados
- **Archivos modificados:**
  - `/app/backend/routes/company.py` (endpoint de upload)
  - `/app/frontend/app/company-profile.tsx` (helper getAbsoluteUrl)
  - `/app/frontend/src/components/sales/components/TicketModal.tsx` (getAbsoluteLogoUrl)

### ✅ Dashboard de Estadísticas Avanzadas (COMPLETADO 18 Feb 2026)
**Nueva ruta:** `/admin-stats`

**Backend - Endpoint `GET /api/admin/stats/dashboard`:**
- Parámetro `period`: day, week, month, year
- Retorna:
  - `summary`: ventas totales, ganancia neta, boletos, comisiones, premios pagados, promedio/boleto
  - `growth`: porcentaje de crecimiento vs período anterior
  - `status_breakdown`: conteo por estado (pendiente, ganador, perdido, etc.)
  - `sales_by_lottery`: ventas por lotería (top 10)
  - `daily_sales`: ventas diarias para gráficos
  - `top_sellers`: ranking de vendedores

**Backend - Endpoint `GET /api/admin/stats/extended`:** (NUEVO 18 Feb 2026)
- Analytics de clientes: total, nuevos, activos, tasa de conversión, top clientes
- Analytics de loterías: rendimiento por lotería con ingresos, tickets, margen de ganancia
- Analytics de tiempo: distribución por hora y día de la semana

**Frontend - Pantalla `/admin-stats`:**
- Selector de período (Hoy, Semana, Mes, Año)
- **3 pestañas:** General, Clientes, Loterías
- **Pestaña General:** 6 tarjetas KPI, gráficos de barras y circular, top vendedores
- **Pestaña Clientes:** KPIs de clientes, top clientes, gráficos de actividad horaria/semanal
- **Pestaña Loterías:** Tabla de rendimiento con tickets/ingresos/margen, pie chart de distribución
- Exportar a imagen PNG

**Archivos:**
- `/app/backend/routes/admin.py` (endpoints stats/dashboard y stats/extended)
- `/app/frontend/app/admin-stats.tsx` (pantalla con tabs)
- `/app/frontend/app/dashboard.tsx` (enlace al menú)

### ✅ Paginación en Vista de Tickets - FIX UI (COMPLETADO 18 Feb 2026)
**Endpoint `GET /api/tickets` actualizado:**
- Parámetros: `page` (default 1), `limit` (default 50, max 200)
- Retorna:
  - `tickets`: array paginado
  - `pagination`: page, limit, total, total_pages, has_next, has_prev
  - `status_counts`: conteo por estado para filtros

**Frontend `/tickets` actualizado:**
- **FIX:** Controles de paginación ahora en posición FIJA en la parte inferior (no dentro del scroll)
- Selector de cantidad por página (25, 50, 100)
- Botones Anterior/Siguiente siempre visibles
- Indicador "Pág. X/Y" y total de boletos

### ✅ Sistema de Email con SMTP Hostinger (COMPLETADO 18 Feb 2026)
**Servicio:** `/app/backend/services/email_service.py`

**Configuración SMTP (.env):**
```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=metafora@lametafora.net
SMTP_PASSWORD=****
SENDER_EMAIL=metafora@lametafora.net
```

**Funciones implementadas:**
- `send_winner_notification()` - Email cuando cliente gana premio
- `send_payment_confirmed_notification()` - Email cuando pago es aprobado
- `send_payment_rejected_notification()` - Email cuando pago es rechazado

**Integración:**
- Integrado en `/app/backend/services/notifications.py`
- Se envía email + notificación push + notificación in-app simultáneamente
- **ESTADO: ✅ FUNCIONANDO**

### ✅ Reportes Semanales Automáticos (COMPLETADO 18 Feb 2026)
**Scheduler:** Cada lunes a las 8:00 AM UTC

**Contenido del reporte:**
- Ventas totales de la semana
- Ganancia neta
- Boletos vendidos
- Premios pagados
- Top 5 vendedores
- Top 5 loterías
- Nuevos clientes registrados

**Archivos:**
- `/app/backend/services/notifications.py` → función `send_weekly_report_to_admins()`
- `/app/backend/server.py` → scheduler configurado

**ESTADO: ✅ FUNCIONANDO** - Se envía automáticamente a todos los admins con email


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

### ✅ Interfaz Unificada de Venta (COMPLETADO 16 Feb 2026)

### ✅ Pantalla de Reportes Mensuales (COMPLETADO 17 Feb 2026)
- **Nueva pantalla** accesible desde "Mi Perfil" con estadísticas mensuales detalladas
- **Funcionalidades:**
  - Selector de mes con navegación (flechas) entre meses
  - Tarjetas de resumen: Ventas totales, Comisiones, Depósitos, Promedio/Boleto
  - Indicador de crecimiento vs mes anterior (%)
  - **Gráfico de barras**: "Ventas por Día" (solo días con ventas)
  - **Gráfico de líneas**: "Tendencia de Ventas" (todos los días del mes)
  - Estado de boletos (Pendientes, Ganadores, No Ganaron, Cancelados)
  - **Exportar reporte como imagen PNG** (botón "Descargar Reporte")
  - Pull-to-refresh para actualizar datos
- **Archivos:**
  - Backend: `/app/backend/routes/users.py` (endpoint GET /api/users/me/monthly-report)
  - Frontend: `/app/frontend/app/monthly-report.tsx` (pantalla con gráficos y exportación)

### ✅ Pantalla "Mi Perfil" para Vendedores (COMPLETADO 17 Feb 2026)
- **Problema:** Los vendedores no podían acceder a su perfil, recibían error 403 al intentar acceder a endpoints de admin
- **Solución:** Se creó un endpoint dedicado `/api/users/me/profile` que cualquier usuario autenticado puede usar
- **Funcionalidades:**
  - Muestra nombre, email, rol y estado (activo/inactivo)
  - Balance disponible y límite de crédito
  - Porcentaje de comisión (con fallback a 10% por defecto)
  - Estadísticas de hoy: ventas, boletos, comisión, pendientes
  - Estadísticas de la semana: ventas, boletos, comisión
  - Lista de tickets recientes (últimos 20)
  - **Historial de transacciones completo:**
    - Filtros por tipo: Todos, Ventas, Comisiones, Depósitos
    - **Resumen de totales**: suma de ventas, comisiones y depósitos con iconos de color
    - Cada transacción muestra icono, descripción, fecha y monto
  - Edición de perfil (nombre, teléfono, dirección)
  - Botón de cerrar sesión
- **Archivos:**
  - Backend: `/app/backend/routes/users.py` (endpoint GET/PUT /api/users/me/profile)
  - Frontend: `/app/frontend/app/my-profile.tsx` (pantalla con filtros y resumen)

### ✅ Interfaz Unificada de Venta - Original (COMPLETADO 16 Feb 2026)
- **Antes:** Dos pantallas separadas ("Venta Rápida" y "Vender")
- **Ahora:** Una sola pantalla `/venta` optimizada para móvil
- **Características:**
  - Selección múltiple de loterías (todas seleccionadas por defecto)
  - Auto-detección del tipo de jugada (2 dígitos=Quiniela, 4=Pale, 6=Tripleta)
  - Preview en tiempo real: "Quiniela: 25 × 22 lotería(s)"
  - Agregar jugadas a todas las loterías seleccionadas con un clic
  - Acceso rápido a favoritos y jugadas recientes
  - Ticket modal con desglose por lotería
- Archivos:
  - `/app/frontend/app/venta.tsx` (NUEVA)
  - `/app/frontend/app/dashboard.tsx` (MODIFICADO - un solo botón "Venta")

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
- [x] ~~Página "Mi Perfil" para vendedores~~ - COMPLETADO 17 Feb 2026

### P1 - Alta Prioridad
- [x] ~~Agregar logo al ticket compartido~~ - COMPLETADO
- [x] ~~Personalizar logo desde Perfil de Empresa~~ - COMPLETADO 17 Feb 2026
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
