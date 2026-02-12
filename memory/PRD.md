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

### Multi-Jugada con Selector de Lotería (12 Feb 2026)
- **🎰 Multi-Lotto:** Seleccionar lotería específica para cada jugada
- **Selector de lotería:** Dropdown en modal de agregar jugada
- **Filtrado por tipo:** Lista muestra loterías compatibles con el tipo de jugada
- **Estado de lotería:** Muestra si está abierta o cerrada
- **Nombre en jugada:** Cada jugada muestra el nombre de la lotería seleccionada
- **Backend actualizado:** Acepta `lottery_id` por jugada

### Suplantación de Super Admin (NUEVO - 12 Feb 2026)
- **🎭 Modo Suplantación:** Super Admin puede actuar como vendedor
- **Botón en Perfil:** "Actuar como [Nombre]" aparece en perfil del vendedor
- **Pantalla de Suplantación:** Hub con acciones disponibles (Vender, Multi-Jugada)
- **Banner de Advertencia:** Banner naranja visible durante suplantación
- **Crear Tickets:** Tickets se crean a nombre del vendedor
- **Auditoría:** Campo `impersonated_by` registra qué admin creó el ticket
- **Seguridad:** Solo super_admin puede suplantar (403 para otros roles)

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

### 📊 Reporte Detallado por Vendedor
- **Períodos de tiempo:** Diario, Semanal, Quincenal, Mensual
- **Resumen completo:**
  - Total de ventas
  - Total de premios
  - Comisión calculada (%)
  - Ganancia neta
- **Conteo de boletos:** Total, Pendientes, Ganadores, Pagados, Perdidos, Cancelados
- **Desglose diario:** Gráfico de barras con ventas por día (para períodos semanal+)
- **Detalle de boletos:** Lista expandible con todos los tickets del período
- **📄 Exportar PDF:** Botón para generar e imprimir reporte en formato PDF
- **📤 Compartir Reporte:** Opciones para compartir por WhatsApp, Email o cualquier otra app
- **Acceso:** Click en vendedor desde "Reporte por Vendedores" o ir a "Mi Reporte Detallado"

### 🎫 Lista de Boletos Mejorada
- **Soporte Multi-jugada:** Muestra "Multi-jugada (X jugadas)" con detalle de plays
- **Soporte boletos simples:** Muestra nombre de lotería y números jugados
- **Filtros:** Todos, Pendientes, Ganadores, Pagados, Perdidos, Cancelados
- **Ver Recibo:** Botón para ver el recibo sin imprimir
- **Acciones:** Ver, Imprimir, Compartir, Cancelar

## Cambios Recientes (12 Feb 2026)

### ✅ Implementado Sesión 6 - Multi-Lotto y Ver Recibo
- ✅ **Multi-Lotto para Multi-Play**
  - Selector de lotería en modal de agregar jugada
  - Dropdown con lista de loterías compatibles por tipo
  - Estado de lotería visible (abierta/cerrada)
  - Nombre de lotería mostrado en cada jugada
  - Backend acepta `lottery_id` por jugada en `/api/tickets/multi`
- ✅ **Ver Recibo sin Imprimir**
  - Botón "Ver" funcional en modal de acciones
  - Modal con vista previa completa del recibo
  - Botones Imprimir y Compartir desde la vista
- ✅ **Testing Completado** - 100% backend tests passed (iteration_14.json)

### Implementado Sesión 5 - Ver Recibo y Validación Loterías
- ✅ **Validación de Horario en Multi-Play**
  - Backend valida si hay loterías abiertas antes de crear multi-play
  - Muestra error si todas las loterías están cerradas
  - Protege contra jugadas fuera de horario

### Implementado Sesión 4 - Alertas y Configuración de Premios
- ✅ **Alertas de Tickets de Alto Riesgo**
  - Endpoint `GET /api/admin/high-risk-tickets` identifica tickets con premio potencial alto
  - Umbral configurable: RD$ 10,000 / USD 200 por defecto
  - Endpoint `GET /api/admin/config` para obtener configuración
  - Endpoint `PUT /api/admin/config` para actualizar configuración
  - Badge "ALTO RIESGO" en pantalla En Vivo (color rojo pulsante)
- ✅ **Configuración de Premios por Lotería**
  - Campo `prize_tiers` agregado a modelo de lotería
  - Endpoint `PUT /api/lotteries/{lottery_id}/prize-tiers` para Super Admin
  - Permite configurar multiplicadores: {"first": 70, "second": 15, "third": 5}
- ✅ **Pantalla de Configuración del Sistema**
  - Nueva pantalla `/system-settings` solo para Super Admin
  - Editar umbrales de alto riesgo (RD$ y USD)
  - Editar intervalo de auto-refresh
  - Lista de loterías con multiplicadores actuales
  - Modal para editar multiplicadores por lotería (1ro, 2do, 3ro lugar)
  - Menú "Configuración" agregado al dashboard

### Implementado Sesión 3 - En Vivo y Gestión Vendedores
- ✅ **Tickets en Tiempo Real (En Vivo)**
  - Nueva pantalla `/live-tickets` con auto-refresh cada 5 segundos
  - Stats bar: Total, Ventas, Pendientes, Ganadores, Cancelados
  - Indicador "EN VIVO" con punto rojo pulsante
  - Badge "NUEVO" en tickets recientes
  - Botón pause/play para auto-refresh
  - Endpoint `GET /api/monitoring/live-tickets`
- ✅ **Super Admin Cancela Cualquier Ticket**
  - Sin límite de tiempo de 5 minutos
  - Puede cancelar tickets de cualquier vendedor
  - Registra quién canceló (`cancelled_by`)
- ✅ **Perfil del Vendedor para Admin**
  - Nueva pantalla `/seller-profile` con estadísticas completas
  - Botones: Depositar, Editar, Ver Reporte
  - Lista de boletos recientes con opción de cancelar
  - Historial de transacciones
  - Endpoint `GET /api/admin/seller-profile/{seller_id}`
- ✅ **Testing Completado** - 100% tests passed (iteration_13.json)

### Implementado Sesión 2
- ✅ **Gestión de Terminales Completada**
  - Nuevo campo `terminal_id` en modelo de usuario
  - Endpoint GET `/api/terminals` con búsqueda
  - Nueva pantalla `/terminals` con búsqueda y lista
  - Campo "ID de Terminal" en formulario de usuarios
- ✅ **Ticket HTML Rediseñado con Texto Bold**

### Implementado Sesión 1
- ✅ **Reporte Detallado por Vendedor** - Nuevo endpoint y pantalla con períodos (diario/semanal/quincenal/mensual)
- ✅ **Navegación a Reporte Detallado** - Click en vendedor abre su reporte detallado
- ✅ **Mejora tickets.tsx** - Soporte completo para boletos multi-play y simples
- ✅ **Ticket HTML Rediseñado** - Más compacto, letra más negrita, números más pequeños
- ✅ **Exportar PDF** - Implementado en reporte detallado
- ✅ **Compartir Reporte** - Modal con WhatsApp, Email y otras apps

### Implementado Anteriormente
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
- **POST /api/tickets/multi** (ticket múltiple con carrito, acepta lottery_id por jugada)
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
- **GET /api/accounting/detailed-seller-report?period={daily|weekly|biweekly|monthly}&seller_id={id}**

## Tareas Pendientes

### P0 - Completado ✅
- ~~Bug Fix: Modal de boletos crasheaba al ver detalles~~ - **CORREGIDO**
- ~~Gestión de Terminales~~ - **COMPLETADO**
- ~~Texto del boleto en negritas~~ - **COMPLETADO**
- ~~Tickets en tiempo real~~ - **COMPLETADO**
- ~~Super Admin cancela cualquier ticket~~ - **COMPLETADO**
- ~~Perfil del vendedor para Admin~~ - **COMPLETADO**
- ~~Alertas de alto riesgo~~ - **COMPLETADO**
- ~~Configuración de premios por lotería~~ - **COMPLETADO**
- ~~Pantalla de configuración del sistema~~ - **COMPLETADO**
- ~~Ver recibo sin imprimir~~ - **COMPLETADO**
- ~~Multi-Lotto para Multi-Play~~ - **COMPLETADO**
- ~~Suplantación de Super Admin~~ - **COMPLETADO** (12 Feb 2026)

### P1 - Prioridad Alta
- **Reportes de comisión detallados** - Desglose exacto de cómo se deducen las comisiones por vendedor

### P2 - Prioridad Media
- **Interfaz de Pago de Premios** - Marcar tickets ganadores como "Pagados"
- **Perfil de empresa con logo personalizable** - Logo en recibos

## Archivos Clave
- `/app/backend/server.py` - API completa con Multi-Lotto, favoritos, pagos, filtrado
- `/app/frontend/app/multi-play.tsx` - Multi-Play con selector de lotería (MODIFICADO)
- `/app/frontend/app/sales.tsx` - Sistema de carrito con favoritos
- `/app/frontend/app/dashboard.tsx` - Dashboard con filtro de país
- `/app/frontend/app/tickets.tsx` - Lista de tickets con Ver Recibo
- `/app/frontend/app/sellers-report.tsx` - Reporte con banderas y navegación a detallado
- `/app/frontend/app/detailed-seller-report.tsx` - Reporte detallado por vendedor

## Test Reports
- `/app/test_reports/iteration_15.json` - Suplantación de Super Admin verificado (100% frontend, 87.5% backend) - **NUEVO**
- `/app/test_reports/iteration_14.json` - Multi-Lotto feature verificado (100% passed)
- `/app/test_reports/iteration_13.json` - En Vivo, Super Admin, Perfil Vendedor (100% passed)
- `/app/test_reports/iteration_12.json` - Gestión de terminales verificada (100% passed)
- `/app/test_reports/iteration_11.json` - Bug fix modal de boletos verificado (100% passed)
- `/app/backend/tests/test_impersonate.py` - Tests de suplantación - **NUEVO**
- `/app/backend/tests/test_multi_lotto.py` - Tests de Multi-Lotto endpoint
