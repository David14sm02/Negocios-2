# ✅ Integración Bidireccional con Dolibarr - COMPLETADA

## 📋 Resumen de Implementación

La sincronización bidireccional entre el e-commerce y Dolibarr ha sido implementada exitosamente. Ahora el sistema puede:

1. ✅ **Sincronizar productos desde e-commerce → Dolibarr** (ya existía, mejorado)
2. ✅ **Sincronizar productos desde Dolibarr → e-commerce** (NUEVO)
3. ✅ **Sincronizar stock desde Dolibarr → e-commerce** (NUEVO)
4. ✅ **Recibir notificaciones vía webhook** (NUEVO)
5. ✅ **Polling periódico para detectar cambios** (NUEVO)

---

## 🗄️ Cambios en Base de Datos

### Campos Agregados a `products`:
- ✅ `dolibarr_id` (INTEGER) - ID del producto en Dolibarr
- ✅ `dolibarr_synced_at` (TIMESTAMP) - Última sincronización
- ✅ `sync_direction` (VARCHAR) - Dirección de sincronización
- ✅ `last_sync_source` (VARCHAR) - Última fuente de modificación

### Índices Creados:
- ✅ `idx_products_dolibarr_id`
- ✅ `idx_products_dolibarr_synced_at`
- ✅ `idx_products_sync_direction`
- ✅ `idx_products_last_sync_source`

### Constraints:
- ✅ `products_sync_direction_check` - Valida valores permitidos
- ✅ `products_last_sync_source_check` - Valida valores permitidos

---

## 🔧 Métodos Implementados en `dolibarrService.js`

### Métodos Nuevos:

1. **`getProductWithStock(dolibarrId)`**
   - Obtiene producto completo de Dolibarr con información de stock

2. **`syncProductFromDolibarr(dolibarrProduct, db)`**
   - Sincroniza producto desde Dolibarr al e-commerce
   - Crea o actualiza según corresponda
   - Maneja mapeo de campos automáticamente

3. **`syncStockFromDolibarr(sku, dolibarrId, db)`**
   - Actualiza stock desde Dolibarr al e-commerce
   - Busca producto por SKU o dolibarr_id

4. **`syncAllProductsFromDolibarr(db, options)`**
   - Sincronización masiva de todos los productos
   - Opciones: `onlyNew`, `updateStock`, `limit`

### Métodos Actualizados:

1. **`syncProduct(productData, db)`**
   - Ahora guarda `dolibarr_id` en la BD
   - Actualiza campos de sincronización
   - Maneja `sync_direction` automáticamente

---

## 🌐 Endpoints API Nuevos

### Sincronización desde Dolibarr:

1. **POST `/api/dolibarr/sync/from-dolibarr/product/:dolibarrId`**
   - Sincroniza un producto específico desde Dolibarr
   - Requiere autenticación admin

2. **POST `/api/dolibarr/sync/from-dolibarr/stock/:sku`**
   - Actualiza stock de un producto
   - Body opcional: `{ dolibarr_id: number }`
   - Requiere autenticación admin

3. **POST `/api/dolibarr/sync/from-dolibarr/all`**
   - Sincronización masiva de todos los productos
   - Body opcional: `{ onlyNew: boolean, limit: number }`
   - Requiere autenticación admin

4. **POST `/api/dolibarr/webhook`**
   - Webhook para recibir notificaciones de Dolibarr
   - No requiere autenticación (usa secret en header)
   - Eventos soportados:
     - `product.created`
     - `product.updated`
     - `stock.movement`
     - `stock.updated`

---

## 📜 Scripts Creados

### 1. `scripts/migrate-db-bidirectional-sync.sql`
- Script SQL para migración de base de datos
- Agrega campos, índices y constraints

### 2. `scripts/run-migration.js`
- Ejecuta la migración de forma segura
- Verifica que todo se aplicó correctamente

### 3. `scripts/sync-from-dolibarr-polling.js`
- Script de polling para sincronización periódica
- Se puede ejecutar manualmente o como cron job
- Sincroniza todos los productos desde Dolibarr

### 4. `scripts/test-bidirectional-sync.js`
- Script de pruebas para verificar la integración
- Verifica conexión, campos, métodos y endpoints
- ✅ **Todas las pruebas pasaron exitosamente**

---

## 🔐 Configuración Necesaria

### Variables de Entorno (`config.env`):

```env
# Configuración existente
DOLIBARR_ENABLED=true
DOLIBARR_URL=https://tuinstancia.dolibarr
DOLIBARR_API_KEY=tu_api_key
DOLIBARR_DEFAULT_WAREHOUSE_ID=1

# NUEVA - Para webhooks (opcional pero recomendado)
DOLIBARR_WEBHOOK_SECRET=tu_secret_seguro_aqui
```

---

## 🚀 Cómo Usar

### 1. Sincronización Manual desde API:

```bash
# Sincronizar un producto específico desde Dolibarr
curl -X POST http://localhost:3000/api/dolibarr/sync/from-dolibarr/product/2 \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json"

# Actualizar stock de un producto
curl -X POST http://localhost:3000/api/dolibarr/sync/from-dolibarr/stock/CAT6-305M \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dolibarr_id": 2}'

# Sincronización masiva
curl -X POST http://localhost:3000/api/dolibarr/sync/from-dolibarr/all \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"onlyNew": false, "limit": 50}'
```

### 2. Polling Periódico (Cron Job):

```bash
# Ejecutar cada 15 minutos
*/15 * * * * cd /ruta/proyecto && node scripts/sync-from-dolibarr-polling.js
```

### 3. Configurar Webhook en Dolibarr:

1. Ir a configuración de webhooks en Dolibarr
2. Agregar nuevo webhook:
   - URL: `https://tu-ecommerce.com/api/dolibarr/webhook`
   - Secret: (el mismo que `DOLIBARR_WEBHOOK_SECRET`)
   - Eventos: `product.created`, `product.updated`, `stock.movement`, `stock.updated`

---

## 📊 Flujo de Sincronización

### E-commerce → Dolibarr (Outbound):
```
1. Se crea/modifica producto en e-commerce
2. syncProduct() se ejecuta automáticamente
3. Producto se crea/actualiza en Dolibarr
4. dolibarr_id se guarda en BD
5. sync_direction = 'outbound' o 'bidirectional'
6. last_sync_source = 'ecommerce'
```

### Dolibarr → E-commerce (Inbound):
```
1. Se crea/modifica producto en Dolibarr
2. Webhook o polling detecta el cambio
3. syncProductFromDolibarr() se ejecuta
4. Producto se crea/actualiza en e-commerce
5. dolibarr_id se guarda/actualiza
6. sync_direction = 'inbound' o 'bidirectional'
7. last_sync_source = 'dolibarr'
```

### Bidireccional:
```
- Si sync_direction = 'bidirectional'
- Cualquier cambio en cualquier sistema se sincroniza
- last_sync_source indica quién hizo el último cambio
```

---

## ✅ Verificación de Integración

Ejecutar el script de pruebas:

```bash
node scripts/test-bidirectional-sync.js
```

**Resultado esperado:**
- ✅ Conexión con Dolibarr: OK
- ✅ Campos en BD: OK
- ✅ Métodos de sincronización: OK
- ✅ Logs de integración: OK
- ✅ Endpoints: OK

---

## 📝 Logs y Auditoría

Todos los eventos de sincronización se registran en la tabla `integration_logs`:

```sql
SELECT 
    source,
    direction,
    action,
    status,
    reference,
    created_at
FROM integration_logs
WHERE source = 'dolibarr'
ORDER BY created_at DESC
LIMIT 20;
```

**Direcciones:**
- `outbound`: E-commerce → Dolibarr
- `inbound`: Dolibarr → E-commerce

**Acciones comunes:**
- `product.created`
- `product.updated`
- `stock.update`
- `GET /products`
- `PUT /products/:id`

---

## 🎯 Casos de Uso Implementados

### ✅ Caso 1: Crear producto en Dolibarr → Aparece en e-commerce
- Webhook o polling detecta el nuevo producto
- `syncProductFromDolibarr()` crea el producto en e-commerce
- `sync_direction = 'inbound'`

### ✅ Caso 2: Modificar stock en Dolibarr → Se actualiza en e-commerce
- Webhook o polling detecta el cambio de stock
- `syncStockFromDolibarr()` actualiza el stock
- `last_sync_source = 'dolibarr'`

### ✅ Caso 3: Crear producto en e-commerce → Se sincroniza a Dolibarr
- `syncProduct()` se ejecuta automáticamente
- Producto se crea en Dolibarr
- `dolibarr_id` se guarda en BD
- `sync_direction = 'outbound'` o `'bidirectional'`

### ✅ Caso 4: Modificar producto en ambos sistemas
- `sync_direction = 'bidirectional'`
- `last_sync_source` indica quién hizo el último cambio
- Resolución de conflictos: Dolibarr tiene prioridad para stock

---

## 🔍 Troubleshooting

### Problema: Productos no se sincronizan desde Dolibarr

**Solución:**
1. Verificar conexión: `GET /api/dolibarr/test`
2. Verificar que los productos tengan `ref` o `barcode` en Dolibarr
3. Revisar logs: `SELECT * FROM integration_logs WHERE status = 'error'`
4. Ejecutar sincronización manual: `POST /api/dolibarr/sync/from-dolibarr/all`

### Problema: Webhook no funciona

**Solución:**
1. Verificar que `DOLIBARR_WEBHOOK_SECRET` esté configurado
2. Verificar que el secret en Dolibarr coincida
3. Revisar logs del servidor para ver requests recibidos
4. Usar polling como alternativa

### Problema: Loops infinitos de sincronización

**Solución:**
- El sistema previene loops usando `last_sync_source`
- Si un producto fue modificado por 'dolibarr', no se re-sincroniza inmediatamente
- Verificar `sync_direction` y `last_sync_source` en la BD

---

## 📚 Archivos Modificados/Creados

### Modificados:
- ✅ `src/services/dolibarrService.js` - Métodos nuevos y actualizados
- ✅ `src/routes/dolibarr.js` - Endpoints nuevos
- ✅ `src/routes/products.js` - Actualizado para pasar `db` a `syncProduct`

### Creados:
- ✅ `scripts/migrate-db-bidirectional-sync.sql`
- ✅ `scripts/run-migration.js`
- ✅ `scripts/sync-from-dolibarr-polling.js`
- ✅ `scripts/test-bidirectional-sync.js`
- ✅ `ANALISIS_SINCRONIZACION_BIDIRECCIONAL.md`
- ✅ `ANALISIS_BD_SINCRONIZACION.md`
- ✅ `INTEGRACION_BIDIRECCIONAL_COMPLETA.md` (este archivo)

---

## ✨ Características Implementadas

- ✅ Sincronización bidireccional completa
- ✅ Mapeo automático de campos
- ✅ Resolución de conflictos inteligente
- ✅ Prevención de loops infinitos
- ✅ Logging completo de todas las operaciones
- ✅ Webhooks para tiempo real
- ✅ Polling como respaldo
- ✅ Sincronización masiva
- ✅ Manejo robusto de errores
- ✅ Validación de datos

---

## 🎉 Estado: COMPLETADO Y VERIFICADO

Todas las pruebas pasaron exitosamente. La integración bidireccional está lista para usar en producción.

**Última verificación:** ✅ Todas las pruebas pasaron (14/11/2025)

