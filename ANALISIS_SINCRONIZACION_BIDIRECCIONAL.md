# Análisis: Sincronización Bidireccional con Dolibarr

## 📊 SITUACIÓN ACTUAL

### ✅ Lo que ya tienes (Sincronización Unidireccional: E-commerce → Dolibarr)

1. **Sincronización de Productos**
   - Método: `dolibarrService.syncProduct()`
   - Dirección: E-commerce → Dolibarr
   - Mapeo: Por SKU (`ref` en Dolibarr)
   - Funcionalidad: Crea o actualiza productos en Dolibarr desde el e-commerce

2. **Sincronización de Stock**
   - Método: `dolibarrService.createStockMovement()`
   - Dirección: E-commerce → Dolibarr
   - Funcionalidad: Registra movimientos de inventario cuando hay ventas/cancelaciones

3. **Sincronización de Clientes**
   - Método: `dolibarrService.syncCustomer()`
   - Dirección: E-commerce → Dolibarr
   - Mapeo: Por email

4. **Sincronización de Órdenes**
   - Método: `dolibarrService.syncOrder()`
   - Dirección: E-commerce → Dolibarr
   - Funcionalidad: Crea pedidos en Dolibarr cuando se completa una orden

5. **Métodos de Lectura desde Dolibarr**
   - `getProducts()` - Obtener lista de productos
   - `getCustomers()` - Obtener lista de clientes
   - `getOrders()` - Obtener lista de órdenes

6. **Sistema de Logging**
   - Tabla `integration_logs` para registrar todas las operaciones
   - Registra dirección (outbound/inbound), estado, payloads, errores

### ❌ Lo que NO tienes (Sincronización Bidireccional)

1. **Sincronización Inversa: Dolibarr → E-commerce**
   - ❌ No hay endpoint webhook para recibir notificaciones de Dolibarr
   - ❌ No hay proceso de polling para detectar cambios en Dolibarr
   - ❌ No hay método para sincronizar productos desde Dolibarr al e-commerce
   - ❌ No hay método para actualizar stock desde Dolibarr al e-commerce

2. **Mapeo de IDs**
   - ❌ No hay campo `dolibarr_id` en la tabla `products` para almacenar el ID de Dolibarr
   - ❌ El mapeo actual solo usa SKU, lo cual puede ser frágil si hay duplicados

3. **Detección de Cambios**
   - ❌ No hay forma de detectar cuando se crea un producto en Dolibarr
   - ❌ No hay forma de detectar cuando se modifica el stock en Dolibarr
   - ❌ No hay forma de detectar cuando se modifica un producto en Dolibarr

---

## 🎯 REQUERIMIENTOS PARA SINCRONIZACIÓN BIDIRECCIONAL

### Objetivo Principal
**Cuando se crea o modifica un producto/stock en Dolibarr → reflejarlo automáticamente en el e-commerce**

### Casos de Uso Específicos:
1. **Creación de Producto en Dolibarr**
   - Si se crea un producto nuevo en Dolibarr → crear producto en e-commerce
   - Mapear campos: nombre, descripción, precio, SKU, stock, etc.

2. **Modificación de Stock en Dolibarr**
   - Si se modifica el stock en Dolibarr → actualizar stock en e-commerce
   - Detectar movimientos de inventario y reflejarlos

3. **Modificación de Producto en Dolibarr**
   - Si se modifica precio, nombre, descripción → actualizar en e-commerce
   - Si se desactiva un producto → desactivar en e-commerce

---

## 🔧 SOLUCIONES POSIBLES

### Opción 1: Webhooks desde Dolibarr (RECOMENDADA si está disponible)

**Ventajas:**
- Tiempo real
- Eficiente (solo se ejecuta cuando hay cambios)
- No requiere polling constante

**Requisitos:**
- Dolibarr debe soportar webhooks (verificar versión y módulos)
- Configurar webhook en Dolibarr apuntando a tu e-commerce
- Endpoint seguro en el e-commerce para recibir notificaciones

**Implementación:**
```
Dolibarr → Webhook → POST /api/dolibarr/webhook → Procesar cambio → Actualizar BD
```

**Endpoints necesarios:**
- `POST /api/dolibarr/webhook` - Recibir notificaciones de Dolibarr
- Validación de firma/autenticación para seguridad

### Opción 2: Polling Periódico (FALLBACK si no hay webhooks)

**Ventajas:**
- Funciona con cualquier versión de Dolibarr
- No requiere configuración en Dolibarr

**Desventajas:**
- No es tiempo real (hay delay)
- Consume recursos (consultas periódicas)
- Puede perder cambios si hay muchos en poco tiempo

**Implementación:**
```
Cron Job / Scheduler → Obtener productos de Dolibarr → Comparar con BD → Sincronizar cambios
```

**Frecuencia sugerida:**
- Cada 5-15 minutos (balance entre actualidad y carga del servidor)

### Opción 3: Híbrida (MEJOR OPCIÓN)

**Combinar ambas:**
- Webhooks para cambios en tiempo real (si está disponible)
- Polling como respaldo para detectar cambios perdidos
- Polling periódico para verificación de consistencia

---

## 📋 COMPONENTES NECESARIOS

### 1. Modificaciones en Base de Datos ✅ ANALIZADO

**Estado actual de la BD:**
- ✅ Tabla `products` existe con 20 columnas
- ✅ Campo `sku` único para mapeo
- ✅ Tabla `integration_logs` lista para auditoría
- ❌ **FALTAN 4 campos críticos** para sincronización bidireccional

**Campos que necesitamos agregar:**
```sql
-- Ver script completo en: scripts/migrate-db-bidirectional-sync.sql
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS dolibarr_id INTEGER NULL,
ADD COLUMN IF NOT EXISTS dolibarr_synced_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS sync_direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
ADD COLUMN IF NOT EXISTS last_sync_source VARCHAR(50) NULL;
```

**Para ejecutar la migración:**
```bash
# Opción 1: Usar el script Node.js
node scripts/run-migration.js

# Opción 2: Ejecutar SQL directamente
psql [tu_connection_string] -f scripts/migrate-db-bidirectional-sync.sql
```

**Ver análisis completo en:** `ANALISIS_BD_SINCRONIZACION.md`

### 2. Nuevos Métodos en `dolibarrService.js`

```javascript
// Sincronizar producto desde Dolibarr al e-commerce
async syncProductFromDolibarr(dolibarrProduct)

// Actualizar stock desde Dolibarr
async syncStockFromDolibarr(productRef, newStock)

// Obtener producto completo de Dolibarr con stock
async getProductWithStock(dolibarrId)

// Comparar y detectar cambios
async detectProductChanges()
```

### 3. Nuevo Endpoint de Webhook

```javascript
// src/routes/dolibarr.js
POST /api/dolibarr/webhook
- Validar autenticación (token/firma)
- Procesar eventos: product.created, product.updated, stock.movement
- Sincronizar cambios al e-commerce
```

### 4. Job de Sincronización Periódica (Opcional)

```javascript
// scripts/sync-from-dolibarr.js
- Obtener todos los productos de Dolibarr
- Comparar con productos locales
- Sincronizar diferencias
- Ejecutar cada X minutos (usar node-cron o similar)
```

### 5. Sistema de Resolución de Conflictos

**Escenarios:**
- ¿Qué pasa si se modifica el mismo producto en ambos sistemas?
- ¿Cuál tiene prioridad?
- ¿Cómo evitar loops infinitos de sincronización?

**Estrategias:**
- Timestamp de última modificación
- Flags de sincronización
- Reglas de prioridad (ej: Dolibarr tiene prioridad para stock)

---

## 🔐 CONSIDERACIONES DE SEGURIDAD

1. **Autenticación de Webhooks**
   - Token secreto compartido
   - Firma HMAC de los payloads
   - Validación de origen IP (si es posible)

2. **Validación de Datos**
   - Sanitizar datos recibidos de Dolibarr
   - Validar tipos y formatos
   - Manejar errores gracefully

3. **Prevención de Loops**
   - Marcar productos en sincronización
   - Evitar re-sincronizar productos recién sincronizados
   - Timeout para evitar sincronizaciones simultáneas

---

## 📝 PLAN DE IMPLEMENTACIÓN SUGERIDO

### Fase 1: Preparación
1. ✅ Agregar campo `dolibarr_id` a tabla `products`
2. ✅ Investigar si Dolibarr soporta webhooks
3. ✅ Documentar estructura de datos de Dolibarr

### Fase 2: Métodos de Sincronización
1. ✅ Crear `syncProductFromDolibarr()`
2. ✅ Crear `syncStockFromDolibarr()`
3. ✅ Crear `getProductWithStock()`

### Fase 3: Mecanismo de Detección
1. ✅ Implementar webhook endpoint (si está disponible)
2. ✅ O implementar polling job
3. ✅ O implementar ambos (híbrido)

### Fase 4: Testing y Validación
1. ✅ Probar creación de producto en Dolibarr
2. ✅ Probar modificación de stock en Dolibarr
3. ✅ Verificar que no hay loops infinitos
4. ✅ Validar manejo de errores

### Fase 5: Monitoreo
1. ✅ Agregar logs detallados
2. ✅ Dashboard de estado de sincronización
3. ✅ Alertas para errores críticos

---

## ❓ PREGUNTAS A RESOLVER

1. **¿Dolibarr soporta webhooks?**
   - Verificar versión de Dolibarr
   - Revisar documentación de API
   - Consultar módulos disponibles

2. **¿Qué versión de Dolibarr estás usando?**
   - Determina qué endpoints están disponibles
   - Algunas versiones tienen mejor soporte de API

3. **¿Cuál es la prioridad de sincronización?**
   - ¿Dolibarr es la fuente de verdad para stock?
   - ¿E-commerce es la fuente de verdad para precios?
   - ¿Cómo resolver conflictos?

4. **¿Frecuencia de cambios esperada?**
   - Determina si polling es suficiente o necesitas webhooks
   - Impacta en la arquitectura

---

## 🚀 PRÓXIMOS PASOS

1. **Investigar capacidades de Dolibarr**
   - Verificar si soporta webhooks
   - Revisar documentación de API REST
   - Probar endpoints disponibles

2. **Decidir estrategia**
   - Webhooks (si está disponible)
   - Polling (si no hay webhooks)
   - Híbrida (recomendada)

3. **Implementar solución elegida**
   - Seguir plan de implementación
   - Testing exhaustivo
   - Monitoreo continuo

---

## 📚 REFERENCIAS ÚTILES

- Documentación API Dolibarr: https://wiki.dolibarr.org/index.php/Module_API_REST
- Tabla `integration_logs` existente para monitoreo
- Sistema de webhooks de Stripe como referencia de implementación

