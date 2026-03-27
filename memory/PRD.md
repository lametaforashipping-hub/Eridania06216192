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

## Cambios Recientes (27/03/2026)

### 1. Reorganización de Loterías
- 22 loterías con múltiples sorteos → **28 loterías individuales**
- Cada lotería tiene su propio sorteo y cierre
- Formato 12 horas (AM/PM) en vez de 24h
- Apertura: **7:00 AM** todas las loterías
- Cierre: **10 minutos antes** de cada sorteo
- Ordenamiento: Abiertas primero (por hora), cerradas abajo
- Mensaje cerrada: "Abre mañana [día] a las 7:00 AM"

### 2. Recibo de Ticket (WhatsApp)
- Logo fijo embebido en base64 (estrella con "LM")
- Muestra nombres de lotería correctamente agrupados
- Lookup de lottery_name si no está en el ticket
- WhatsApp ahora envía IMAGEN PNG directamente (expo-sharing)

### 3. Bugs Críticos Corregidos
- Multi-play winner detection: Tickets con múltiples loterías ahora detectan ganadores correctamente
- Ticket expiry: No expiran hasta después del último sorteo del día
- USA multipliers: Quiniela 60/12/4, Pale 1500, Tripleta 10000 o 150 por 2 números

## Estado de Verificación

### Backend - 38/38 endpoints verificados (100%)
- Auth, Portal Clientes, Tickets, Loterías, Sorteos, Usuarios, Contabilidad - OK

### Test Reports
- iteration_53: Multi-play winner detection (28/28 - 100%)
- iteration_54: Lottery reorganization + receipt image (22/22 - 100%)

## Credenciales
- Super Admin: admin@loteria.com / admin123 (US, USD)
- Vendedor: vendedor@test.com / 12345678 (RD, RD$)
- Cliente: 8091234999 / 123456

## Backlog
### P0 - COMPLETADO
- ✅ Reorganizar loterías a individuales
- ✅ Arreglar recibo con logo y nombres de lotería
- ✅ WhatsApp envía imagen directamente

### P1
- Deploy a producción con `eas update`
- Verificar multiplicadores USA en producción

### P2
- Conectar dominio loteriamagica.com
- Finalizar Google Play Store

### P3
- Páginas web restantes (Terminales, Mi Perfil)
