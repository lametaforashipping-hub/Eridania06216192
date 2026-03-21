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

## Estado de Verificación (21/03/2026)

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

## Backlog
### P1
- Verificar deploy con `eas update`
- Fase 2: Funcionalidad completa de vendedores
### P2
- Conectar dominio loteriamagica.com
- Finalizar Google Play Store
### P3
- Páginas web restantes (Terminales, Mi Perfil)
