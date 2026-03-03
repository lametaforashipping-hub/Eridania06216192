# Sistema de Loteria Magica - PRD

## Declaracion del Problema Original
Aplicacion completa de loteria con roles de Admin, Vendedor y Cliente. Incluye venta de tickets, resultados automaticos, pagos digitales, notificaciones y panel administrativo.

## Estado Actual: Produccion Lista
La aplicacion web esta completa con todas las funcionalidades solicitadas. Build de Android corregido.

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
- CORREGIDO: Todas las llamadas manuales a .isoformat() tambien tienen 'Z'
- NUEVO: Auto-expiracion de tickets pendientes -> "perdido" (cada 30 min)
- OPTIMIZADO: MongoDB aggregation pipelines en admin stats

### Correccion Build Android (Mar 2026)
- ELIMINADO: expo-barcode-scanner (incompatible con SDK 54, no se usaba en el codigo)
- CORREGIDO: Colores hex invalidos en app.json (#000 -> #000000)
- CORREGIDO: Iconos no cuadrados (512x513 -> 512x512) para icon.png, adaptive-icon.png, favicon.png
- CORREGIDO: Referencia splash-icon.png -> splash-image.png (archivo correcto)
- ELIMINADO: package-lock.json duplicado (conflicto con yarn.lock)
- CREADO: eas.json con configuracion de build (development, preview, production)
- VERIFICADO: expo-doctor 17/17 checks passed

## Arquitectura
```
Backend: FastAPI + MongoDB (Motor async)
Frontend: Expo/React Native Web (SDK 54)
Email: Hostinger SMTP
Scheduler: APScheduler (payment summary, weekly report, lottery results, ticket expiry)
```

## Tareas Pendientes
- P0: Ejecutar build EAS nuevamente (usuario debe ejecutar en su maquina)
- P1: Deploy a produccion
- P2: Conectar dominio (loteriamagica.com)

## Credenciales de Test
- Admin: admin@loteria.com / admin123
- Vendedor: vendedor@test.com / 12345678
- Cliente: 8091234567 / 123456
