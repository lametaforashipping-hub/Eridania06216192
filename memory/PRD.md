# Lotería Mágica - PRD

## Problema Original
Aplicación de lotería completa con app móvil Expo (React Native) y panel web admin (React/Vite), backend FastAPI + MongoDB.

## IMPORTANTE: Dos Apps en el Proyecto
### App Móvil Expo (LA PRINCIPAL - la que usan los vendedores)
- **Ubicación:** `/app/frontend/app/` (47 pantallas .tsx)
- **Tecnología:** Expo SDK 54 + React Native + expo-router
- **Se despliega con:** `eas update` (OTA) o `eas build` (nuevo build)
- **Package:** `com.loteriamagica.app`

### App Web Admin (secundaria)
- **Ubicación:** `/app/frontend/src/pages/` (16 páginas .jsx)
- **Tecnología:** Vite + React + react-router-dom
- **Se despliega con:** Emergent deploy
- **URL:** preview en navegador

### Backend (compartido por ambas)
- FastAPI en puerto 8001, prefijo /api
- MongoDB (test_database)

## Pantallas App Móvil (47 total)
### Core: _layout, index, login, dashboard
### Ventas: venta, multi-play, tickets, quick-sales, scanner, favorites, live-tickets
### Admin: users, lotteries, draws, auto-results, admin-stats, monitoring, number-limits, pay-prizes, admin-pending-payments, bank-accounts, play-types-admin, company-profile, system-settings, terminals, sales-goals
### Reportes: user-report, sellers-report, commission-report, accounting, detailed-seller-report, monthly-report, stats, notifications
### Clientes: client-login, client-register, client-dashboard, client-play, client-tickets, client-results, client-profile, client-notifications
### Perfil: my-profile, seller-profile, sales, impersonate
### Nuevo: alert-settings

## Funcionalidades Backend Verificadas
- Generación recibo PNG con moneda dinámica (US$/RD$) - VERIFICADO
- Configuración premios por país - VERIFICADO
- Alertas en tiempo real (milestones/metas) - VERIFICADO
- Reportes de ventas por país - VERIFICADO
- Contabilidad, comisiones, reportes vendedores - VERIFICADO

## Credenciales
- Super Admin: admin@loteria.com / admin123 (country: US, currency: USD)
- Vendedor: vendedor@test.com / 12345678 (country: RD, currency: RD$)

## Backlog
### P1
- Fase 2: Funcionalidad de vendedores (verificar flujos móviles)
- Portal de clientes
### P2
- Conectar dominio loteriamagica.com
- Finalizar Google Play Store
### P3
- Páginas restantes web (Terminales, Mi Perfil)
