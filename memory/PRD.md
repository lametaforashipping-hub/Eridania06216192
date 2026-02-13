# Sistema de Lotería RD/USA - PRD

## Descripción General
Sistema de gestión de loterías para República Dominicana y Estados Unidos. Permite la venta de boletos, gestión de sorteos, pago de premios y reportes de vendedores.

## Arquitectura
- **Backend:** FastAPI + MongoDB
- **Frontend:** React Native / Expo
- **Base de datos:** MongoDB

### Estructura Backend Modular (COMPLETADO 14 Dic 2025)
```
/app/backend/
├── server.py              # Archivo principal refactorizado (79 líneas, -97.6%)
├── routes/                # 14 Routers modulares
│   ├── __init__.py        # Exporta todos los routers
│   ├── auth.py           # Autenticación (login, register, me, refresh)
│   ├── users.py          # Gestión de usuarios
│   ├── terminals.py      # Gestión de terminales
│   ├── favorites.py      # Números favoritos
│   ├── lotteries.py      # Gestión de loterías + holidays + prize-tiers
│   ├── tickets.py        # Ventas de boletos (simple + multi-play)
│   ├── draws.py          # Sorteos y multi-prize
│   ├── notifications.py  # Notificaciones
│   ├── monitoring.py     # Monitoreo en tiempo real
│   ├── accounting.py     # Contabilidad y reportes
│   ├── statistics.py     # Estadísticas de números
│   ├── admin.py          # Configuración sistema + seller-profile + act-as-seller
│   ├── company.py        # Perfil de empresa
│   └── system.py         # Inicialización y health checks (NEW)
├── services/             # Lógica de negocio
│   └── notifications.py  # Push notifications (Expo)
├── models/               # Modelos Pydantic y Enums
│   ├── schemas.py        # Modelos de request/response
│   └── enums.py          # Enumeraciones (roles, estados, etc.)
└── utils/                # Utilidades
    ├── auth.py           # Dependencias de autenticación JWT
    ├── database.py       # Conexión MongoDB
    └── helpers.py        # Funciones auxiliares (check_lottery_open, calculate_prize, etc.)
```

**Logro de Refactorización (14 Dic 2025):**
- server.py reducido de 3347 líneas a 79 líneas (-97.6%)
- 14 routers modulares organizados por funcionalidad
- 18 pruebas unitarias pasando
- Toda la funcionalidad preservada


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
- **🎫 Nuevo Diseño de Ticket/Recibo (13 Feb 2026):**
  - Logo de "Loteria Magic" en la cabecera
  - Código QR que contiene solo el ID del ticket para búsqueda en sistema
  - Diseño profesional con gradientes y mejor estructura visual
  - Sección de jugadas con detalles de lotería, números y montos
  - Totales destacados con premio potencial
  - Pie con instrucciones de conservación del boleto
  - Compatible con impresión (expo-print) y WhatsApp (Share)

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

### Mejoras en Gestión de Loterías (13 Feb 2026)
- ✅ **Vista Detallada de Horarios por Lotería**
  - Sección "Horario de Operación" con ícono y título
  - Badge "Hoy (día): HH:MM - HH:MM" con estado abierto/cerrado
  - Tabla de "Horarios por Día" mostrando todos los días de la semana
  - Día actual resaltado en verde
  - Horarios diferentes para sábado y domingo
  - Horario fijo para loterías sin configuración semanal
- ✅ **Modal de Edición Mejorado**
  - Información explicativa sobre el bloqueo automático de ventas
  - Campos claros: Apertura (🟢) y Cierre (🔴)
  - Switch para usar horarios diferentes por día
- ✅ **Información Visible**
  - "Abre hoy a las XX:XX" (barra naranja cuando está cerrada)
  - "ABIERTA" (barra verde cuando está operando)
  - Horarios de sorteos del día

### Sesión 12 - Rediseño de Ticket/Recibo con Logo y QR (13 Feb 2026)
- ✅ **Nuevo Diseño de Ticket/Recibo**
  - Logo de "Loteria Magic" en la cabecera del ticket
  - Diseño profesional con gradientes azul oscuro (#1a365d)
  - Sección de número de ticket con fuente monoespaciada
  - QR code contiene solo el ID del ticket (TKT-xxxxxx) para búsqueda en sistema
  - Sección de jugadas con tipo, números y monto
  - Totales destacados con premio potencial en amarillo
  - Instrucciones de conservación del boleto
  - Compatible con impresión (expo-print) y compartir por WhatsApp
- ✅ **Archivos Actualizados:**
  - `frontend/app/multi-play.tsx` - función generateTicketHTML
  - `frontend/app/sales.tsx` - función generateTicketHTML  
  - `frontend/app/tickets.tsx` - función generateTicketHTML
- ✅ **Testing Completado** - iteration_23.json: 100% backend, 100% frontend

### Sesión 13 - Alertas de Alto Riesgo + Refactorización Backend (13 Feb 2026)
- ✅ **(P2) Alertas de Alto Riesgo en Tiempo Real**
  - Cuando se crea un ticket que excede el umbral (RD$10,000 o USD$200)
  - Se crea automáticamente una notificación para todos los Super Admins
  - Notificación incluye: vendedor, monto, número de ticket, tipo "high_risk_alert"
  - Funciona tanto para tickets simples como multi-jugada
- ✅ **(P3) Refactorización del Backend**
  - Nueva estructura modular creada:
    - `/backend/models/` - Enums (enums.py) y Schemas Pydantic (schemas.py)
    - `/backend/utils/` - Helpers (helpers.py) y Database connection (database.py)
    - `/backend/routes/` - Preparado para migración incremental de rutas
    - `/backend/services/` - Preparado para lógica de negocio
  - El server.py original sigue funcionando mientras se migra gradualmente

### Verificación de Tickets con QR (Ya Implementado)
- **🔍 Pantalla de Verificar** (`/scanner`)
  - Entrada manual del número de ticket
  - Escaneo de QR con cámara (solo en dispositivos móviles con expo-camera)
  - El QR del ticket contiene solo el ticket_number (TKT-xxxxxx)
  - Modal con resultado completo: estado, jugadas, montos, premio potencial
  - Compatible con todos los tipos de tickets (simples y multi-jugada)

### Sesión 11 - Fix Token Expirado y Multi-Jugada en Web (13 Feb 2026)
- ✅ **Fix Crítico: Error "Token Expirado"**
  - Nuevo endpoint POST `/api/auth/refresh` para renovar tokens JWT
  - Auto-renovación de token al iniciar la app (si está guardado)
  - Auto-renovación periódica cada 20 horas (token expira en 24h)
  - Manejo de error 401 con logout automático y alerta al usuario
  - AuthContext actualizado con funciones `refreshToken()` y `handleAuthError()`
  - Mensaje claro "Tu sesión ha expirado. Por favor, inicia sesión nuevamente."
- ✅ **Fix Crítico: Botón "Agregar Jugada" en Multi-Jugada (Web)**
  - El botón no respondía a clicks dentro del Modal con ScrollView
  - Solución: Usar elemento HTML nativo `<div onClick>` para plataforma web
  - `TouchableOpacity` se mantiene para plataformas nativas (iOS/Android)
  - Estructura del Modal reorganizada: botón fuera del ScrollView
  - Nuevos estilos: `modalBodyScroll`, `modalBodyContent`, `modalFooter`
- ✅ **Testing Completado**
  - Backend: 11/11 tests de auth/refresh passed
  - Vender page: 100% funcional
  - Multi-Jugada: 100% funcional (agregar jugada + crear boleto)
  - iteration_22.json: Backend 100%, Frontend 100%

### Sesión 10 - Fix de Multi-Jugada, Validación de Horarios y Haptic Feedback (13 Feb 2026)
- ✅ **Fix Crítico: Botón "Agregar Jugada" en Multi-Jugada**
  - El botón no respondía a clicks en la versión web
  - Solución: Componente `ModalButton` usando `Pressable` con `accessibilityRole="button"`
  - Testing confirmado: 100% funcional (iteration_21.json)
- ✅ **Fix Backend: Validación de Horas Inválidas**
  - Función `parse_time_string` ahora maneja horas fuera de rango (ej: "24:00")
  - Previene `ValueError: hour must be in 0..23` al cargar loterías
  - Horas >= 24 se convierten a 23:59, horas < 0 a 00:00
- ✅ **Alert Cross-Platform**
  - Nueva función `showAlert` que usa `window.alert()` en web y `Alert.alert()` en móvil
  - Mejora la experiencia de usuario mostrando errores de validación en todas las plataformas
- ✅ **Haptic Feedback al Agregar Jugadas** (NEW)
  - Vibración de confirmación cuando se agrega una jugada en Multi-Jugada
  - Vibración cuando se agrega item al carrito en Vender
  - Vibración cuando se agregan favoritos al carrito
  - Solo funciona en dispositivos móviles (iOS/Android)
  - Usa `expo-haptics` con `NotificationFeedbackType.Success`

### Sesión 9 - Impersonación Completa, Recibos con Logo, Push Notifications y Reportes de Comisiones (13 Feb 2026)
- ✅ **Logo de Empresa en Recibos**
  - El recibo del boleto ahora muestra información completa de la empresa
  - Incluye: Nombre, slogan, dirección, teléfono, RNC
  - Se obtiene automáticamente del perfil de empresa (company-profile)
  - Funciona tanto en vista previa como en impresión
- ✅ **Impersonación Completa del Super Admin**
  - Pantalla de suplantación ahora tiene 6 acciones:
    1. Vender (Boleto simple)
    2. Multi-Jugada (Múltiples jugadas)  
    3. Ver Boletos (Historial de ventas)
    4. Pagar Premios (Boletos ganadores)
    5. Ver Reporte (Estadísticas)
    6. Depositar (Agregar balance)
  - Modal de depósito funcional con input numérico
  - Navegación a las diferentes pantallas con contexto del vendedor
- ✅ **Botón "+" de Sorteos Mejorado**
  - Usa elemento `<button>` HTML nativo en web para mejor compatibilidad
  - Soluciona problemas de TouchableOpacity en React Native Web
- ✅ **Push Notifications para Ganadores**
  - Servicio de notificaciones push con expo-notifications
  - Registro automático de tokens al iniciar sesión (solo dispositivos nativos)
  - Notificaciones enviadas al vendedor y super admin cuando hay ganadores
  - Notificaciones de sorteo completado para super admins
  - Integración con Expo Push API
  - Canal dedicado "lottery-winners" con sonido y vibración
- ✅ **Reporte Detallado de Comisiones** (NEW)
  - Nueva pantalla `/commission-report` con desglose completo
  - Filtros por período: Hoy, Semana, Mes
  - Fórmula visual: Ventas × Tasa = Comisión
  - Desglose por vendedor (solo Super Admin)
  - Detalle por venta con ticket, lotería, monto, tasa y comisión ganada
  - Estadísticas: total boletos, promedio de venta, comisión total
  - Backend endpoint: `/api/accounting/commissions`
- ✅ **Testing Completado** - iteration_19.json: 100% backend, 100% frontend

### Sesión 8 - Correcciones y Sorteos Mejorados (13 Feb 2026)
- ✅ **Bug Fix: Verificar Boleto**
  - Botón "Verificar Boleto" ahora funciona en web
  - Solución: Uso de elemento `<button>` HTML nativo para React Native Web
  - El modal de resultados muestra correctamente el estado del ticket
- ✅ **Iconos del Dashboard Más Grandes**
  - Iconos aumentados de 28px a 32px
  - Texto de labels aumentado de 11px a 13px con peso 500
  - Mejor legibilidad en dispositivos móviles
- ✅ **Sistema de Sorteos con 3 Premios**
  - Nueva pantalla de sorteos con soporte para 1er, 2do, 3er premio
  - Formulario con campos de Fecha y Hora del sorteo
  - Iconos diferenciados: 🥇 Trofeo dorado (1ro), 🥈 Trofeo gris (2do), 🥉 Medalla bronce (3ro)
  - Nuevo endpoint: POST `/api/draws/multi-prize`
  - Endpoint para actualizar sorteos: PUT `/api/draws/{draw_id}`
  - Validación de números dentro del rango permitido
  - * Primer premio obligatorio, 2do y 3ro opcionales
- ✅ **Testing Completado** - iteration_18.json: 100% backend, 95% frontend

### Chequeo General Completo (12-13 Feb 2026) - TODAS LAS FUNCIONALIDADES ✅
**Testing Agent:** iteration_17.json - Backend: 100% (25/25), Frontend: 100% (25/25 páginas)

**Nuevas Funcionalidades Implementadas:**
1. ✅ **Pago de Premios** (`pay-prizes.tsx`)
   - Resumen de premios por pagar vs pagados
   - Búsqueda por ticket, vendedor o cliente
   - Filtros: Por Pagar | Pagados
   - Modal de confirmación de pago
   - Endpoint: POST /api/tickets/{id}/pay

2. ✅ **Perfil de Empresa** (`company-profile.tsx`)
   - Subir logo de la empresa
   - Campos: Nombre, RNC, Dirección, Teléfono, Email, Slogan
   - Pie de recibo personalizable
   - Vista previa del recibo
   - Endpoints: GET/PUT /api/company-profile

**Bugs Corregidos:**
1. ✅ **favorites.tsx** - La página de favoritos crasheaba por mismatch de datos
2. ✅ **server.py** - Endpoint sellers-report fallaba con tickets multi-play

**Pantallas Verificadas (23/23):**
- ✅ Login, Dashboard, Usuarios (Nuevo + Editar + Depositar)
- ✅ Boletos (búsqueda + filtros + ver recibo + cancelar)
- ✅ Vender Números, Multi-Jugada (multi-lotería)
- ✅ Verificar Boleto, Favoritos, Resultados/Draws
- ✅ En Vivo (tiempo real), Monitoreo, Límites
- ✅ Vendedores, Terminales (10 terminales), Estadísticas
- ✅ Contabilidad (ROI, comisiones), Loterías (CRUD + horarios)
- ✅ Configuración del Sistema (alertas + multiplicadores)
- ✅ Notificaciones, Perfil Vendedor, Suplantación

### Implementado Sesión 4 - Gestión Usuarios y Búsqueda Tickets (12 Feb 2026)
- ✅ **Creación de Usuarios desde Frontend**
  - Botón "+ Nuevo" visible y prominente en la pantalla de Usuarios
  - Modal de creación con todos los campos requeridos
  - Validación de campos obligatorios (Nombre, Email, Contraseña)
  - Creación exitosa verificada tanto por curl como por UI
- ✅ **Edición de Usuarios**
  - Nuevo botón "Editar" (azul) en cada tarjeta de usuario
  - Modal de edición con campos: Nombre, Cédula, Terminal ID, Teléfono, Dirección, País, Comisión, Límite de Crédito
  - Endpoint PUT `/api/users/{user_id}` funcionando correctamente
  - Pre-llenado de datos existentes del usuario
- ✅ **Mejoras en Creación de Usuarios**
  - Mejor manejo de errores con logs de consola
  - Trim de campos de texto
  - Normalización de email a minúsculas
  - Terminal ID convertido a mayúsculas automáticamente
- ✅ **Buscador de Tickets**
  - Nueva barra de búsqueda en pantalla de Boletos
  - Placeholder: "Buscar por # ticket (ej: 1234 o últimos 4 dígitos)"
  - Búsqueda por número completo de ticket
  - Búsqueda por últimos 4 dígitos
  - Contador de resultados encontrados
  - Botón para limpiar búsqueda (X)
- ✅ **Testing Completado** - iteration_16.json: 87.5% backend, 100% frontend

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
- `/app/backend/server.py` - API completa con Multi-Lotto, favoritos, pagos, filtrado, suplantación
- `/app/frontend/app/multi-play.tsx` - Multi-Play con selector de lotería y soporte suplantación (MODIFICADO)
- `/app/frontend/app/impersonate.tsx` - Hub de suplantación para Super Admin (NUEVO)
- `/app/frontend/app/seller-profile.tsx` - Perfil vendedor con botón suplantación (MODIFICADO)
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
