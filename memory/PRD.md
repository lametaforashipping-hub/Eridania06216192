# Sistema de Loteria Magica - PRD

## Declaracion del Problema Original
Aplicacion completa de loteria con roles de Admin, Vendedor y Cliente. Incluye venta de tickets, resultados automaticos, pagos digitales, notificaciones y panel administrativo. Originalmente construida como app movil (React Native/Expo), ahora tambien disponible como aplicacion web (React/Vite).

## Estado Actual: Web App + Mobile App Funcionando - Mar 21, 2026

## Arquitectura
```
Backend: FastAPI + MongoDB (Motor async) - Puerto 8001
Frontend Web: React + Vite + CSS puro - Puerto 3000
Frontend Mobile: React Native / Expo (EAS builds)
Email: Hostinger SMTP
Scheduler: APScheduler (resultados automaticos cada 5 min)
```

## Cambios Recientes

### Mar 21, 2026
- Fix bug teclado en play-types-admin.tsx: Agregado KeyboardAvoidingView + ScrollView al modal de edicion para que el teclado no tape los botones Guardar/Cancelar
- Restaurados archivos Expo (app.json, eas.json, assets, app/ directory) para que el deployment EAS funcione junto con la web Vite
- Fix deployment: app.json y eas.json restaurados para resolver error "No app.json found" en paso EAS

### Mar 16, 2026
- Migracion completa de React Native a React + Vite para la web
- App web replica exacta de la app movil (login purpura, dashboard grid menu, stats cards)
- Todas las paginas admin implementadas y conectadas al backend
- Testing: Backend 15/15 PASS, Frontend 100% PASS

## Paginas Web Implementadas
1. Login (/login) - Tema purpura, logo Loteria Magica
2. Dashboard (/) - Stats + Menu Grid con iconos coloridos
3. Usuarios (/users) - CRUD de usuarios, depositar balance
4. Loterias (/lotteries) - Cards con activar/desactivar
5. Boletos (/tickets) - Lista con busqueda y modal detalle
6. Resultados (/notifications) - Cards con 1er, 2do, 3er premio
7. Estadisticas (/stats) - Filtro periodo, top vendedores
8. Venta (/venta) - Seleccion multiple loterias, jugadas
9. ComingSoon (placeholder) - 19 paginas pendientes

## API Endpoints Principales
- POST /api/auth/login
- GET /api/auth/me
- GET /api/accounting/summary
- GET /api/notifications/unread-count
- GET /api/company-profile
- GET /api/users
- POST /api/auth/register
- POST /api/users/{id}/deposit?amount=X
- GET /api/lotteries?active_only=false
- PUT /api/lotteries/{id}
- GET /api/tickets
- POST /api/tickets/multi
- GET /api/lottery-results/latest
- GET /api/admin/stats/dashboard?period=today
- PUT /api/lotteries/{id}/play-types/{play_type}

## Tareas Pendientes
- P1: Implementar paginas ComingSoon restantes (Mi Perfil, Scanner, etc.)
- P1: Portal de clientes (registro, compra digital)
- P2: Conectar dominio loteriamagica.com
- P2: Refinamiento UI/UX
- P3: Prueba cerrada en Google Play (12 verificadores)

## Credenciales de Test
- Admin: admin@loteria.com / admin123
- Vendedor: vendedor@test.com / 12345678
