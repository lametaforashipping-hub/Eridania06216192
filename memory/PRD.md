# Sistema de Loteria Magica - PRD

## Declaracion del Problema Original
Aplicacion completa de loteria con roles de Admin, Vendedor y Cliente. Incluye venta de tickets, resultados automaticos, pagos digitales, notificaciones y panel administrativo.

## Estado Actual: Produccion Lista
La aplicacion web esta completa. Build Android generado exitosamente. Deployment fixes aplicados.

## Funcionalidades Implementadas

### Core (Admin/Vendedor)
- Login/autenticacion JWT con roles
- Venta de tickets (individual y multi-play)
- Resultados automaticos via web scraping
- Dashboard de estadisticas avanzadas
- Gestion de loterias y horarios
- Sistema de comisiones
- Reporte mensual del vendedor
- Monitoreo en vivo de tickets
- Pago de premios
- Contabilidad y reportes

### Portal de Clientes
- Registro y perfil de cliente
- Compra digital de tickets
- Upload de comprobante de pago
- Notificaciones en tiempo real
- Vista de resultados

### Administracion Avanzada
- Panel de estadisticas con aggregation pipelines
- Paginacion en vista de tickets
- Gestion de metas de ventas
- Super Admin: editar, eliminar, resetear contrasena de usuarios
- Confirmacion manual de pagos

### Notificaciones y Emails
- Email via Hostinger SMTP
- Reportes semanales automaticos
- Notificaciones push

### Timezone y Automatizacion (Mar 2026)
- CORREGIDO (RAIZ): serialize_doc() agrega 'Z' a isoformat() para indicar UTC
- NUEVO: Auto-expiracion de tickets pendientes -> "perdido" (cada 30 min)
- OPTIMIZADO: MongoDB aggregation pipelines en admin stats

### Build Android (Mar 2026)
- ELIMINADO: expo-barcode-scanner (incompatible con SDK 54)
- CORREGIDO: Colores hex, iconos cuadrados, splash-image reference
- CREADO: eas.json para builds
- BUILD EXITOSO: v1.0.1 APK generado

### Deployment Fixes (Mar 2026)
- CORREGIDO: Rutas hardcodeadas en clients.py y company.py (ahora usan os.path.join)
- AGREGADO: CORS_ORIGINS=* en backend/.env
- OPTIMIZADO: bulk_write() en draws.py (eliminado patron N+1)

## Arquitectura
```
Backend: FastAPI + MongoDB (Motor async)
Frontend: Expo/React Native Web (SDK 54)
Email: Hostinger SMTP
Scheduler: APScheduler (payment summary, weekly report, lottery results, ticket expiry)
```

## Tareas Pendientes
- P0: Completar deploy a produccion (en proceso)
- P1: Conectar dominio (loteriamagica.com)
- P2: Build iOS (esperando activacion Apple Developer Program)

## Credenciales de Test
- Admin: admin@loteria.com / admin123
- Vendedor: vendedor@test.com / 12345678
- Cliente: 8091234567 / 123456
