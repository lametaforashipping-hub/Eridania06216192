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

## Estado de Verificación (25/03/2026)

### Backend - 38/38 endpoints verificados (100%)
- Auth (login admin/vendor, auth/me con country/active) - OK
- Portal Clientes (register, login, me, tickets, results, notifications) - OK
- Tickets (crear multi-play, listar, recibo PNG, QR, cancelar) - OK
- Loterías (listar activas/todas) - OK
- Sorteos y Resultados - OK
- Usuarios (admin CRUD) - OK
- Contabilidad (summary, report, commissions, sellers, daily-chart) - OK
- Comparación por País (country-comparison RD vs US) - OK
- Alertas (settings GET/PUT, recent-alerts) - OK
- Configuración Premios - OK
- Cuentas Bancarias - OK
- Favoritos y Notificaciones - OK

### BUG FIX (25/03/2026): Información incompleta en boleto/WhatsApp
**Problemas**:
1. Modal de confirmación no mostraba nombres de lotería (solo tipo: "quiniela")
2. Logo no cargaba en modal del recibo (usaba URL relativa en vez de base64)
3. Moneda hardcodeada como "RD$" en modal de confirmación
4. Abreviatura de tipo de jugada incorrecta en recibo
**Fix aplicado en**: multi-play.tsx (modal de confirmación), tickets.tsx (historial + recibo)
**Tests**: Backend receipt image verificado visualmente - muestra logo + nombres de lotería correctamente

### NUEVA FUNCIONALIDAD (25/03/2026): Pantalla de Resultados para Vendedores
- Nueva pantalla `/results` que muestra los últimos resultados de sorteos
- Filtros: Hoy, Ayer, Todos
- Muestra bolas de primera (dorado), segunda (morado), tercera (rojo) por lotería
- Badges de verificación y resultado automático
- Accesible para todos los roles desde el dashboard
- Archivo: /app/frontend/app/results.tsx
**Problema**: Tickets multi-play con jugadas en MÚLTIPLES loterías NO eran detectados como ganadores.
**Causa Raíz**: 3 bugs en lottery_scheduler.py y draws.py:
  1. Query usaba lottery_id/numbers a nivel superior, pero multi-play los tiene en plays[]
  2. Mark-as-lost marcaba TODO ticket como perdido incluyendo multi-play con loterías sin sortear
  3. Pale/tripleta no verificaba que TODOS los números coincidieran
**Fix aplicado en**: lottery_scheduler.py (process_new_results + determine_play_win) y draws.py (create_draw_multi_prize)
**Tests**: 28/28 pasaron (15 unit + 13 API) - iteration_53

### App Móvil - 47 pantallas verificadas
- Core: _layout, index, login, dashboard
- Ventas: venta, multi-play, tickets, quick-sales, scanner, favorites, live-tickets
- Admin: users, lotteries, draws, auto-results, admin-stats, monitoring, number-limits, pay-prizes, admin-pending-payments, bank-accounts, play-types-admin, company-profile, system-settings, terminals, sales-goals
- Reportes: user-report, sellers-report, commission-report, accounting, detailed-seller-report, monthly-report, stats, notifications
- Clientes: client-login, client-register, client-dashboard, client-play, client-tickets, client-results, client-profile, client-notifications
- Perfil: my-profile, seller-profile, sales, impersonate
- Nuevo: alert-settings

## Funcionalidades Backend Verificadas
- Generación recibo PNG con moneda dinámica (US$/RD$) + logo
- Configuración premios por país (RD/US)
- Alertas en tiempo real (milestones de ventas, metas diarias)
- Reportes por país (comparación RD vs US)
- Portal de clientes completo
- Contabilidad y comisiones

## Credenciales
- Super Admin: admin@loteria.com / admin123 (US, USD)
- Vendedor: vendedor@test.com / 12345678 (RD, RD$)
- Cliente: 8091234999 / 123456

## Test Reports
- iteration_49: Currency verification (16/16)
- iteration_50: Report pages (23/23)
- iteration_51: Alert system (13/13)
- iteration_52: Comprehensive mobile API (38/38)
- iteration_53: Multi-play winner detection bug fix (28/28) - 100%
- iteration_54: US multipliers + ticket expiry fix + tripleta parcial - all PASS (manual E2E)

## Backlog
### P1
- Verificar deploy con `eas update`
- Fase 2: Funcionalidad completa de vendedores
### P2
- Conectar dominio loteriamagica.com
- Finalizar Google Play Store
### P3
- Páginas web restantes (Terminales, Mi Perfil)
