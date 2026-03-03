# Sistema de Lotería Mágica - PRD

## Declaración del Problema Original
Aplicación completa de lotería con roles de Admin, Vendedor y Cliente. Incluye venta de tickets, resultados automáticos, pagos digitales, notificaciones y panel administrativo.

## Estado Actual: Producción Lista
La aplicación está completa con todas las funcionalidades solicitadas.

## Funcionalidades Implementadas

### Core (Admin/Vendedor)
- Login/autenticación JWT con roles
- Venta de tickets (individual y multi-play)
- Resultados automáticos vía web scraping
- Dashboard de estadísticas avanzadas (General, Clientes, Loterías)
- Gestión de loterías y horarios
- Sistema de comisiones
- Reporte mensual del vendedor
- Monitoreo en vivo de tickets
- Pago de premios
- Contabilidad y reportes

### Portal de Clientes
- Registro y perfil de cliente
- Compra digital de tickets
- Upload de comprobante de pago (Zelle/transferencia)
- Notificaciones en tiempo real
- Vista de resultados
- Dashboard personalizado

### Administración Avanzada
- Panel de estadísticas con aggregation pipelines (optimizado)
- Paginación en vista de tickets
- Gestión de metas de ventas
- Gestión de usuarios (Super Admin: editar, eliminar, resetear contraseña)
- Confirmación manual de pagos

### Notificaciones y Emails
- Servicio de email via Hostinger SMTP
- Reportes semanales automáticos
- Notificaciones push

### Timezone y Automatización (Última Sesión - Mar 2026)
- **CORREGIDO**: Timezone República Dominicana (America/Santo_Domingo) en TODOS los archivos frontend (13+ archivos)
- **NUEVO**: Auto-expiración de tickets pendientes → "perdido" (job cada 30 min)
- **OPTIMIZADO**: Consultas de BD con MongoDB aggregation pipelines (admin stats)
- **VERIFICADO**: Cierre automático de lotería 15 min antes del sorteo
- **ELIMINADO**: Todos los `.to_list(None)` del backend

## Arquitectura
```
Backend: FastAPI + MongoDB (Motor async)
Frontend: Expo/React Native Web
Email: Hostinger SMTP directo
Scheduler: APScheduler (payment summary, weekly report, lottery results, ticket expiry)
```

## Tareas Pendientes
- P0: Deploy a producción
- P1: Conectar dominio personalizado (loteriamagica.com)

## Credenciales de Test
- Admin: admin@loteria.com / admin123
- Vendedor: vendedor@test.com / 12345678
- Cliente: 8091234567 / 123456
