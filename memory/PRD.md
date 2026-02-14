# Sistema de Lotería RD/USA - PRD

## Descripción General
Sistema de gestión de loterías para República Dominicana y Estados Unidos. Permite la venta de boletos, gestión de sorteos, pago de premios y reportes de vendedores.

## Arquitectura
- **Backend:** FastAPI + MongoDB
- **Frontend:** React Native / Expo
- **Base de datos:** MongoDB
- **Dominio:** loteriamagica.com (Hostinger) - pendiente configuración

## Cambios Recientes (14 Feb 2026)

### ✅ Sistema de Cuentas Bancarias Virtuales (COMPLETADO 14 Feb 2026)
**Backend:**
- Nuevo archivo: `/app/backend/routes/bank_accounts.py`
- Endpoints para CRUD de cuentas bancarias virtuales
- Sistema de solicitudes de depósito (vendedor solicita, admin aprueba)
- Transacciones y historial por cuenta
- Resumen de totales por moneda

**Frontend:**
- Nueva página: `/app/frontend/app/bank-accounts.tsx`
- Crear cuentas tipo: Banco, Zelle, Efectivo
- Configurar por país (RD/USA) y moneda (RD$/USD)
- Pestaña de depósitos pendientes para aprobar/rechazar
- Accesible desde el menú principal (Super Admin/Admin)

### ✅ Bloqueo Automático por Balance $0 (COMPLETADO 14 Feb 2026)
- Vendedor con balance $0 se bloquea automáticamente al intentar vender
- Mensaje: "Tu balance es $0. No puedes realizar ventas hasta que deposites fondos."
- Se reactiva automáticamente cuando el admin aprueba un depósito

### ✅ Rediseño Página de Login (COMPLETADO 14 Feb 2026)
- Nuevo diseño moderno con tarjeta centrada
- Gradiente de fondo con círculos decorativos
- Logo con anillos decorativos (usa logo de empresa si existe)
- Campos de entrada compactos con íconos
- Botón con gradiente morado
- Carga el nombre de empresa desde `/api/company-profile`

### ✅ Sistema de Permisos Super Admin (COMPLETADO 14 Feb 2026)
**Restricciones implementadas:**
- **Gestión de Usuarios:**
  - Solo Super Admin puede crear/editar/activar/desactivar Administradores
  - Admin NO puede modificar a otros Admins ni al Super Admin
  - Admin solo puede gestionar Vendedores que él creó
  - UI muestra "Protegido" y mensaje para usuarios que Admin no puede gestionar
  
- **Gestión de Loterías:**
  - Solo Super Admin puede crear nuevas loterías
  - Solo Super Admin puede editar loterías (horarios, precios, configuración)
  - Solo Super Admin puede activar/desactivar loterías
  - Admin puede ver loterías pero sin opciones de edición

### ✅ Refactorización: sales.tsx Modularizado (COMPLETADO 14 Feb 2026)
- **Archivo original:** 4079 líneas → **Archivo nuevo:** 878 líneas (-78%)
- **Nueva estructura modular en** `/app/frontend/app/components/sales/`:
  ```
  /app/frontend/app/components/sales/
  ├── index.ts              # Barrel exports
  ├── types.ts              # Interfaces y tipos compartidos
  ├── constants.ts          # Constantes de configuración
  ├── styles.ts             # Estilos centralizados (~900 líneas)
  └── components/
      ├── index.ts          # Exports de componentes
      ├── TicketModal.tsx   # Modal de ticket con QR y compartir
      ├── FavoritesModal.tsx # Modal de favoritos
      ├── SaveFavoriteModal.tsx # Modal para guardar favoritos
      ├── RecentPlaysModal.tsx  # Modal de jugadas recientes
      ├── EditCartModal.tsx     # Modal de edición del carrito
      ├── ShortcutsHelpModal.tsx # Modal de atajos de teclado
      ├── LotterySelector.tsx   # Selector de loterías
      ├── PlayTypeSelector.tsx  # Selector de tipos de jugada
      ├── NumberInput.tsx       # Input de números
      └── CartSection.tsx       # Sección del carrito
  ```
- **Beneficios:**
  - Mejor mantenibilidad y legibilidad
  - Componentes reutilizables
  - Separación de responsabilidades
  - Más fácil de testear
  - Reducción del riesgo de regresiones

### ✅ Bug Fix: Error de Despliegue a Producción (REPORTADO 14 Feb 2026)
- **Estado:** BLOQUEADO - Requiere acción del usuario
- **Error:** `Your account (emergent003) has reached its limit of 2000 projects`
- **Solución requerida:** 
  1. Eliminar proyectos no usados en https://expo.dev
  2. O contactar soporte para aumentar límite

### ✅ Feature: Rediseño Profesional del Ticket de Venta (COMPLETADO 14 Feb 2026)
- **Nuevo diseño compacto y profesional** para el ticket de confirmación de venta
- **Estructura del ticket:**
  1. **Header centrado:** Logo de la empresa centrado, nombre de empresa, dirección y RNC
  2. **Número de ticket:** En negrita (fontWeight: 900), más grande y visible
  3. **Fecha y hora:** Sección separada con formato más legible
  4. **Jugadas:** Formato limpio con tipo abreviado (Q, P, T, SP), números y monto
  5. **Total:** Línea destacada con número de jugadas y monto total
  6. **Código QR:** Centrado en la parte inferior con el número de ticket
  7. **Footer:** Mensaje "CONSERVE ESTE BOLETO" y "¡BUENA SUERTE!"
- **Líneas divisorias simples:** Reemplazadas todas las cajas y bordes por líneas simples (1px negro)
- **QR Code:** Implementado usando `react-qr-code`
- **Pendiente verificación:** Crear ticket nuevo cuando loterías estén abiertas

## Funcionalidades Implementadas

### Sistema de Ventas Completo
- **Selección Múltiple de Loterías:** Checkboxes para seleccionar varias loterías
- **Sistema de Carrito:** Agregar múltiples jugadas antes de crear el ticket
- **Tipos de Jugada:** Quiniela, Pale, Tripleta, Super Pale con multiplicadores
- **Favoritos:** Guardar y usar combinaciones frecuentes
- **Jugadas Recientes:** Historial de últimas jugadas
- **Edición del Carrito:** Modificar jugadas antes de comprar
- **Atajos de Teclado:** F1-F4 para tipos, N/M para campos, Enter para agregar

### Autenticación y Usuarios
- Login con JWT
- Roles: super_admin, admin, vendedor
- Creación de usuarios con país (RD/US) y moneda automática
- Límite de crédito y comisiones

### Loterías (21 loterías reales de RD)
- Gana Más, Lotería Nacional, Pega 3 Más, Quiniela Leidsa, Quiniela Real, etc.
- Horarios de apertura/cierre configurables
- Múltiples tipos de jugada con multiplicadores configurables

### Reportes y Contabilidad
- Reporte detallado por vendedor (diario/semanal/quincenal/mensual)
- Exportar a Excel
- Dashboard con filtro de país (RD/USA)
- Alertas de alto riesgo

## Credenciales de Prueba
- **Vendedor:** vendedor@test.com / 12345678
- **Super Admin:** admin@loteria.com / admin123

## Próximos Pasos (Backlog)

### P0 - Bloqueadores
- [ ] Resolver error de despliegue (límite de proyectos Expo)

### P1 - Alta Prioridad
- [ ] Verificar diseño del ticket creando boleto nuevo
- [ ] Considerar refactorizar otros archivos grandes (tickets.tsx, multi-play.tsx)

### P2 - Media Prioridad
- [ ] Notificaciones push para resultados
- [ ] Dashboard de estadísticas avanzadas

### P3 - Baja Prioridad
- [ ] Reportes de comisión más detallados
- [ ] Interfaz de pago de premios mejorada
