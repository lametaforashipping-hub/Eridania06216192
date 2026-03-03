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
- Dashboard de estadísticas avanzadas
- Gestión de loterías y horarios
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

### Administración Avanzada
- Panel de estadísticas con aggregation pipelines
- Paginación en vista de tickets
- Gestión de metas de ventas
- Super Admin: editar, eliminar, resetear contraseña de usuarios
- Confirmación manual de pagos

### Notificaciones y Emails
- Email via Hostinger SMTP
- Reportes semanales automáticos
- Notificaciones push

### Timezone y Automatización (Mar 2026)
- **CORREGIDO (RAÍZ)**: serialize_doc() agrega 'Z' a isoformat() para indicar UTC
- **CORREGIDO**: Todas las llamadas manuales a .isoformat() también tienen 'Z'
- **CORREGIDO**: users.py/get_my_profile devuelve datos serializados (no raw MongoDB)
- **CORREGIDO**: timeZone: 'America/Santo_Domingo' en 13+ archivos frontend
- **NUEVO**: Auto-expiración de tickets pendientes → "perdido" (cada 30 min)
- **OPTIMIZADO**: MongoDB aggregation pipelines en admin stats
- **VERIFICADO**: Cierre automático 15 min antes del sorteo

## Arquitectura
```
Backend: FastAPI + MongoDB (Motor async)
Frontend: Expo/React Native Web
Email: Hostinger SMTP
Scheduler: APScheduler (payment summary, weekly report, lottery results, ticket expiry)
```

## Tareas Pendientes
- P0: Deploy a producción
- P1: Conectar dominio (loteriamagica.com)

## Credenciales de Test
- Admin: admin@loteria.com / admin123
- Vendedor: vendedor@test.com / 12345678
- Cliente: 8091234567 / 123456
