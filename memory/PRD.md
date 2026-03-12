# Sistema de Loteria Magica - PRD

## Declaracion del Problema Original
Aplicacion completa de loteria con roles de Admin, Vendedor y Cliente. Incluye venta de tickets, resultados automaticos, pagos digitales, notificaciones y panel administrativo.

## Estado Actual: Produccion Lista + iOS Submitted + Android en Play Console - Mar 2026

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

### iOS App Store (Mar 5, 2026)
- Build iOS generado y subido a App Store Connect (v1.0.0 build 1)
- Enviado para revision de Apple
- ascAppId: 6760090637

### Google Play Store (Mar 5, 2026)
- Build Android (.aab) subido a Google Play Console (v1.0.1 build 101)
- Prueba interna publicada
- Configuracion completada: politica de privacidad, seguridad de datos, clasificacion, anuncios, categoria
- Pendiente: Prueba cerrada con 12+ verificadores por 14 dias

### Bug Fix: Modal de Deposito (Mar 5, 2026)
- Agregado KeyboardAvoidingView a modales de deposito en users.tsx y seller-profile.tsx
- El teclado ya no tapa el boton de confirmar deposito

### Database Reset (Mar 2026)
- Endpoint /api/admin/reset-database para super admins

### Deployment Health Fix (Mar 5, 2026)
- Removido fallback hardcodeado de DB_NAME en database.py

## Arquitectura
```
Backend: FastAPI + MongoDB (Motor async)
Frontend: Expo/React Native Web (SDK 54)
Email: Hostinger SMTP
Scheduler: APScheduler
```

## Tareas Pendientes
- P0: Deploy permanente de la app web
- P0: Esperar aprobacion de Apple para iOS
- P1: Prueba cerrada en Google Play (12 verificadores, 14 dias)
- P1: Conectar dominio loteriamagica.com
- P2: Refactoring: Extraer logica HTML de PDF a funcion utilitaria

## Credenciales de Test
- Admin: admin@loteria.com / admin123
- Vendedor: vendedor@test.com / 12345678

## 3rd Party Integrations
- Hostinger SMTP
- MongoDB Atlas
- Expo Application Services (EAS)
- Apple App Store Connect
- Google Play Console
