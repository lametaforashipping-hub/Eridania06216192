# Sistema de Loteria Magica - PRD

## Declaracion del Problema Original
Aplicacion completa de loteria con roles de Admin, Vendedor y Cliente. Incluye venta de tickets, resultados automaticos, pagos digitales, notificaciones y panel administrativo. Originalmente construida como app movil (React Native/Expo), migrada a aplicacion web (React/Vite) para poder conectar el dominio personalizado loteriamagica.com.

## Estado Actual: Web App Funcionando (replica exacta de la app movil) - Mar 16, 2026

## Arquitectura
```
Backend: FastAPI + MongoDB (Motor async) - Puerto 8001
Frontend: React + Vite + CSS puro - Puerto 3000
Email: Hostinger SMTP
Scheduler: APScheduler (resultados automaticos cada 5 min)
```

## Migracion Completada (Mar 16, 2026)
- App web replica exacta de la app movil React Native
- Login con tema purpura, logo de empresa, campos con iconos
- Dashboard sin sidebar: header con saludo + filtro pais + stats cards + menu grid de iconos
- Todas las sub-paginas con PageHeader y boton de retorno al dashboard
- 27 items de menu visibles para super_admin (filtrados por rol)
- Testing: Backend 15/15 PASS, Frontend 100% PASS

## Paginas Web Implementadas
1. Login (/login) - Tema purpura, logo Loteria Magica, 3 botones
2. Dashboard (/) - Stats + Menu Grid con iconos coloridos
3. Usuarios (/users) - CRUD de usuarios, depositar balance
4. Loterias (/lotteries) - Cards con activar/desactivar
5. Boletos (/tickets) - Lista con busqueda y modal detalle
6. Resultados (/notifications) - Cards con 1er, 2do, 3er premio
7. Estadisticas (/stats) - Filtro periodo, top vendedores, ventas por loteria
8. Venta (/venta) - Seleccion multiple loterías, jugadas quiniela/pale/tripleta
9. ComingSoon (placeholder) - 19 paginas pendientes de implementar

## API Endpoints Principales
- POST /api/auth/login - Autenticacion
- GET /api/auth/me - Perfil del usuario
- GET /api/accounting/summary - Stats del dashboard (hoy/semana/mes)
- GET /api/notifications/unread-count - Contador notificaciones
- GET /api/company-profile - Nombre y logo de empresa
- GET /api/users - Lista de usuarios
- POST /api/auth/register - Crear usuario
- POST /api/users/{id}/deposit?amount=X - Depositar balance
- GET /api/lotteries?active_only=false - Lista loterias
- PUT /api/lotteries/{id} - Actualizar loteria (activar/desactivar)
- GET /api/tickets - Lista de tickets
- POST /api/tickets/multi - Crear ticket multi-jugada
- GET /api/lottery-results/latest - Resultados recientes
- GET /api/admin/stats/dashboard?period=today - Estadisticas admin

## Tareas Pendientes (Paginas ComingSoon)
- P1: Mi Perfil, Scanner/Verificar, Favoritos
- P1: Sorteos, Auto Resultados, En Vivo, Monitoreo
- P1: Limites de Numeros, Mi Reporte, Reporte Vendedores, Terminales
- P1: Dashboard Admin, Metas Ventas, Contabilidad, Comisiones
- P1: Pagar Premios, Pagos Clientes Pendientes
- P1: Cuentas de Banco, Tipos de Jugada, Mi Empresa, Configuracion
- P2: Portal de Clientes (login, registro, compra, comprobantes)
- P2: Conectar dominio loteriamagica.com
- P3: Google Play Store (prueba cerrada 12 verificadores)

## Credenciales de Test
- Admin: admin@loteria.com / admin123
- Vendedor: vendedor@test.com / 12345678

## Notas Tecnicas
- Resultados tardan 5-15s en cargar (scraping en tiempo real)
- company-profile requiere auth (muestra LM placeholder en login)
- Usar wait_for_timeout(3000) en Playwright, NO networkidle
- Supervisor ejecuta Vite via frontend_vite.conf
