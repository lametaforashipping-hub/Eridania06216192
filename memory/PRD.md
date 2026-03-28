# Lotería Mágica - PRD

## Problema Original
Aplicación de lotería con app móvil Expo (principal - la que usan vendedores) y panel web admin (secundario), backend FastAPI + MongoDB.

## ARQUITECTURA
### App Móvil Expo (PRINCIPAL - 47 pantallas)
- Ubicación: `/app/frontend/app/`
- Tecnología: Expo SDK 54 + React Native + expo-router
- Deploy: `eas update` (OTA) o `eas build`
- Package: `com.loteriamagica.app`

### App Web (Panel Admin)
- Ubicación: `/app/frontend/src/pages/`
- Tecnología: Vite + React
- Deploy: Emergent deploy

### Backend (Compartido)
- FastAPI puerto 8001, prefijo /api
- MongoDB (test_database)

## Cambios Recientes (28/03/2026)

### 11. FIX CRÍTICO: Tickets ganadores antes del sorteo (28/03/2026)
- **BUG**: Tickets creados HOY se marcaban como ganadores usando resultados de AYER
- **Causa**: El sistema no verificaba si el sorteo había ocurrido antes de procesar resultados
- **Solución implementada en `lottery_scheduler.py`**:
  1. **Cutoff por fecha**: Solo tickets creados ANTES de la hora de cierre del sorteo son elegibles
  2. **Corrección automática de draw_date**: Si la hora actual es ANTES del sorteo, los resultados son de AYER
  3. **Filtro en queries**: Todas las consultas de tickets ahora incluyen `created_at <= ticket_cutoff_time`
- **Queries afectadas**: Simple tickets, Multi-play tickets, Client simple tickets, Client multi-play tickets
- **Lógica**: 
  - Si son las 9:48 AM y el sorteo es a las 10:00 AM, los resultados que llegan son de AYER
  - Solo tickets creados antes de las 9:50 AM de AYER serían elegibles para esos resultados

### 10. RESTRICCIONES DE ADMIN UI (28/03/2026)
- **Rol `admin`** ya NO puede ver/acceder a:
  - Loterías (creación/edición de horarios)
  - Configuración del Sistema
  - Mi Empresa
- **Rol `super_admin`** mantiene acceso completo a todo
- **Archivos modificados**:
  - `Layout.jsx` - Sidebar con menús diferenciados (superAdminLinks vs adminLinks)
  - `App.jsx` - ProtectedRoute con `requiredRole="super_admin"` para rutas restringidas
  - `Dashboard.jsx` - menuItems ya tenían roles correctos
- **Test Report**: iteration_60 (100% - 6/6 tests passed)

### 9. MEJORAS DE UX - Cuadre y Loterías (28/03/2026)
- **Cuadre con Calendario**: Filtro de fechas con DatePicker visual para seleccionar rango
- **Lista de vendedores separada**: Cada vendedor tiene su propio balance y desglose
- **Configuración de Loterías mejorada**:
  - Formato 12 horas (AM/PM) en lugar de 24h
  - Time Picker visual para seleccionar hora de sorteo y cierre
  - Auto-cálculo de hora de cierre (10 min antes del sorteo)
  - Selección múltiple de tipos de juego (Quiniela, Palé, Tripleta, Super Palé)
  - Modal para crear nueva lotería con todos los campos
- **Corrección horarios Florida**: 
  - Florida Día: 14:30 → 13:30 (1:30 PM ET oficial)
  - Florida Noche: 22:45 → 21:45 (9:45 PM ET oficial)
- **Verificación completa**: 28/28 loterías con horarios oficiales correctos

### 8. RECIBO UNIFICADO - Single Source of Truth (28/03/2026)
- **PROBLEMA RESUELTO**: Antes había 3 recibos visuales diferentes (modal de venta, WhatsApp PDF, impresora PNG)
- **SOLUCIÓN**: Todos los flujos ahora usan el PNG del backend (`/api/tickets/receipt-image/{ticket_number}`)
- **Archivos modificados**:
  - `TicketModal.tsx` (src/components/sales y src_expo) - Muestra imagen del backend
  - `multi-play.tsx` - Modal de venta usa imagen del backend
  - `tickets.tsx` - Modal de ver recibo usa imagen del backend
- **Funciones actualizadas**:
  - **Imprimir**: Usa HTML con `<img src="backend_png_url">`
  - **WhatsApp**: Descarga PNG del backend y comparte via expo-sharing
  - **Ver recibo**: Muestra imagen del backend directamente
  - **Texto fallback**: Incluye URL del recibo para ver online
- **Endpoint**: `GET /api/tickets/receipt-image/{ticket_number}` retorna PNG 400x594px (~38KB)

### 1. Reorganización de Loterías
- 22 loterías con múltiples sorteos → **28 loterías individuales**
- Cada lotería tiene su propio sorteo y cierre
- Formato 12 horas (AM/PM) en vez de 24h
- Apertura: **7:00 AM** todas las loterías
- Cierre: **10 minutos antes** de cada sorteo
- Ordenamiento: Abiertas primero (por hora), cerradas abajo
- Mensaje cerrada: "Abre mañana [día] a las 7:00 AM"

### 2. Recibo de Ticket (WhatsApp)
- Logo bola dorada con "7" embebido en base64
- Tipografía toda en NEGRITA y +1 punto más grande
- Jugadas en formato tabla compacta (una línea por jugada) para boletos más cortos
- Muestra nombres de lotería correctamente agrupados
- Lookup de lottery_name si no está en el ticket
- WhatsApp ahora envía IMAGEN PNG directamente (expo-sharing)

### 3. Bugs Críticos Corregidos
- Multi-play winner detection: Tickets con múltiples loterías ahora detectan ganadores correctamente
- Ticket expiry: No expiran hasta después del último sorteo del día
- USA multipliers: Quiniela 60/12/4, Pale 1500, Tripleta 10000 o 150 por 2 números

### 4. Sistema de Prueba Gratis 15 Días (28/03/2026)
- Registro web en `/api/prueba-gratis`
- Seed data automática (admin + vendedor demo)
- Aislamiento multi-tenant por `tenant_id`
- Bloqueo automático al expirar (mensaje: contactar 718-916-1401)

### 5. Fix Contabilidad + Tickets Ganadores (28/03/2026)
- **BUG CRÍTICO CORREGIDO**: Contabilidad usaba campos `prize`/`total_prize` que NO EXISTÍAN. Corregido a `potential_win`/`total_potential_win` en:
  - `get_period_stats()` 
  - `get_accounting_report()` aggregation pipeline
  - `country-comparison` wins pipeline
- **Resultado**: Antes wins siempre era $0, ahora muestra valores reales (ej: 669,000)
- **Pérdida del vendedor**: profit = sales - wins (puede ser negativo). Confirmado: -655,637
- **Tickets ganadores ahora almacenan**: `won_number` (número que coincidió), `winning_numbers` (1ra, 2da, 3ra), `won_lottery_name`
- **Multi-play**: Cada jugada ganadora almacena `winning_numbers` individual
- **Transacciones**: Descripción ahora incluye número ganador y monto ganado
- **Endpoint verify**: Retorna `winning_details` con desglose completo

### 6. Notificaciones Detalladas de Ganadores (28/03/2026)
- Push notifications ahora incluyen número ganador y posición (ej: "#42 pegó en 1ra")
- Notificaciones in-app almacenan `won_number`, `won_position`, `winning_numbers`, `winning_plays`
- Multi-play: Mensaje detallado con cada jugada ganadora y su premio
- `notify_winner()` acepta parámetros opcionales de detalles del ganador

### 7. Sistema de Cuadre / Settlement (28/03/2026)
- **NUEVA RUTA**: `/api/settlements/` con 5 endpoints completos
- **Fórmula correcta**: `Ganancia Neta = Ventas - Comisión - Premios`
- **Comisión SIEMPRE se deduce**, gane o pierda el ticket
- **Cerrar Cuadre**: Admin/Super Admin registran pago del vendedor, balance se actualiza
- **Balance Acumulado**: Se arrastra de cuadre en cuadre. Si el vendedor paga parcial, el restante se suma a las nuevas ventas
- **Registrar Pago Rápido**: Sin cerrar cuadre completo, se reduce el balance
- **Filtro por Fecha**: Desde/hasta en todos los endpoints de cuadre
- **Historial**: Todas las liquidaciones guardadas con desglose
- **Restricción Admin**: Solo puede ver/cerrar cuadres de sus propios vendedores
- **Contabilidad corregida**: Todos los endpoints de accounting ahora usan la fórmula correcta (ventas - comisión - premios)

### Endpoints de Cuadre:
- `GET /api/settlements/cuadre/{seller_id}?start_date=X&end_date=Y`
- `POST /api/settlements/close` (cerrar cuadre con pago)
- `POST /api/settlements/payment` (pago rápido)
- `GET /api/settlements/history/{seller_id}`
- `GET /api/settlements/all-balances`

## Estado de Verificación

### Backend - 38+ endpoints verificados
- Auth, Portal Clientes, Tickets, Loterías, Sorteos, Usuarios, Contabilidad - OK

### Test Reports
- iteration_53: Multi-play winner detection (28/28 - 100%)
- iteration_54: Lottery reorganization + receipt image (22/22 - 100%)
- iteration_55: Free Trial system (16/16 - 100%)
- iteration_56: Accounting wins & seller loss (16/16 - 100%)
- iteration_57: Settlement/Cuadre backend (16/16 - 100%)
- iteration_58: Cuadre web frontend + backend (100% - all features pass)
- iteration_59: Unified Receipt (Backend 100%, Frontend 100%)
- iteration_60: Admin UI Restrictions (100% - 6/6 tests passed)

## Credenciales
- Super Admin: admin@loteria.com / admin123 (US, USD)
- Vendedor: vendedor@test.com / 12345678 (RD, RD$)
- Cliente: 8091234999 / 123456

## Backlog
### P0 - COMPLETADO
- ✅ Reorganizar loterías a individuales
- ✅ Arreglar recibo con logo y nombres de lotería
- ✅ WhatsApp envía imagen directamente
- ✅ Fix logo bola dorada con "7" en recibo PNG (base64 corrupta corregida)
- ✅ Refactoring: lógica de recibo extraída a `services/receipt_generator.py`
- ✅ Sistema de prueba gratis 15 días
- ✅ Fix contabilidad: campos incorrectos para premios (prize → potential_win)
- ✅ Tickets ganadores almacenan número ganador y desglose del premio
- ✅ Endpoint verify incluye winning_details
- ✅ Sistema de Cuadre: cerrar cuadre, registrar pago, balance acumulado, historial
- ✅ Fórmula contabilidad: Ganancia = Ventas - Comisión - Premios (en TODOS los endpoints)
- ✅ Widget "Prueba Gratis" embebible para globalmetafora.com
- ✅ Multiplicadores USA verificados (60/12/4, 1500, 10000)
- ✅ Pantalla de Cuadre en web (CuadrePage.jsx) y móvil (cuadre.tsx) con lista de vendedores, desglose, filtro fecha, cerrar cuadre, historial
- ✅ **RECIBO UNIFICADO**: Un solo recibo (backend PNG) para modal, WhatsApp y impresora

### P1
- ✅ Restricciones de UI para rol `admin` vs `super_admin` (Loterías, Configuración, Mi Empresa - ocultos para admin)
- Deploy a producción con `eas update`
- Verificar multiplicadores USA en producción
- Conectar BD producción (requiere whitelist IP en MongoDB Atlas)

### P2
- Conectar dominio loteriamagica.com
- Finalizar Google Play Store
- Push Notifications para hitos/ganadores

### P3
- Páginas web restantes (Terminales, Mi Perfil)
- Integrar botón "Prueba Gratis" en globalmetafora.com
