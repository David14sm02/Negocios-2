# 🚀 Guía de Deployment a Producción

## 📋 Checklist Rápido

### Antes de Desplegar

```bash
# 1. Ejecutar validación
node scripts/validar-produccion.js

# 2. Verificar que no hay errores
# Si hay errores, corregirlos antes de continuar
```

---

## 🔐 PASO 1: Variables de Entorno en Vercel

### Variables Críticas (OBLIGATORIAS)

1. Ve a tu proyecto en Vercel → **Settings** → **Environment Variables**

2. Agrega estas variables (una por una):

```env
# Base de Datos
DATABASE_URL=postgresql://usuario:password@host/db?sslmode=require

# Seguridad
JWT_SECRET=tu_secret_jwt_muy_seguro_y_largo
NODE_ENV=production

# Dolibarr
DOLIBARR_ENABLED=true
DOLIBARR_URL=https://nettechsolutions.with1.doliplace.fr
DOLIBARR_API_USER=admin
DOLIBARR_API_PASSWORD=tu_password_seguro
DOLIBARR_DEFAULT_WAREHOUSE_ID=1
DOLIBARR_WEBHOOK_SECRET=tu_secret_webhook_seguro
DOLIBARR_AUTO_SYNC=true

# Polling
DOLIBARR_POLLING_ENABLED=true
DOLIBARR_POLLING_INTERVAL=15
DOLIBARR_POLLING_RUN_ON_START=true

# CORS
CORS_ORIGIN=https://tu-dominio.vercel.app

# Stripe (si usas)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=https://tu-dominio.vercel.app/checkout/success
STRIPE_CANCEL_URL=https://tu-dominio.vercel.app/checkout/cancel
FRONTEND_URL=https://tu-dominio.vercel.app
```

3. **IMPORTANTE:** Configura las variables para:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

---

## ✅ PASO 2: Verificar Configuración

### En Dolibarr

1. **Verificar almacén:**
   - Ir a Dolibarr → Almacenes
   - Verificar que el almacén con ID `DOLIBARR_DEFAULT_WAREHOUSE_ID` existe
   - Si no existe, crear uno o cambiar el ID en las variables

2. **Verificar usuario API:**
   - El usuario debe tener permisos para:
     - Crear/actualizar productos
     - Crear movimientos de stock
     - Leer productos y stock

3. **Verificar API REST:**
   - Ir a Dolibarr → Configuración → Módulos
   - Verificar que "API REST" está activo

---

## 🗄️ PASO 3: Base de Datos

### Aplicar Migraciones

Si aún no has aplicado las migraciones en producción:

```bash
# Conectar a la base de datos de producción
# Y ejecutar el script de migración
node scripts/run-migration.js
```

O manualmente:

```sql
-- Agregar columnas
ALTER TABLE products ADD COLUMN IF NOT EXISTS dolibarr_id INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dolibarr_synced_at TIMESTAMP;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sync_direction VARCHAR(20) DEFAULT 'outbound';
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_sync_source VARCHAR(20);

-- Agregar índices
CREATE INDEX IF NOT EXISTS idx_products_dolibarr_id ON products(dolibarr_id);
CREATE INDEX IF NOT EXISTS idx_products_sync_direction ON products(sync_direction);
CREATE INDEX IF NOT EXISTS idx_products_last_sync_source ON products(last_sync_source);
```

---

## 📦 PASO 4: Verificar Archivos

### Archivos Necesarios

- [ ] `vercel.json` existe y tiene cron jobs configurados
- [ ] `api/cron/sync-dolibarr.js` existe
- [ ] `src/services/pollingService.js` existe
- [ ] `src/services/dolibarrService.js` tiene la lógica de stock

### Verificar vercel.json

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-dolibarr",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

---

## 🚀 PASO 5: Deploy

### En Vercel

1. **Push a producción:**
   ```bash
   git push origin main
   ```

2. **O deploy manual:**
   - Ve a Vercel → Deployments
   - Click en "Redeploy" del último deployment

3. **Verificar logs:**
   - Después del deploy, revisa los logs
   - Deberías ver: `✅ Conexión a PostgreSQL establecida correctamente`
   - Y: `🌐 Ejecutándose en Vercel - Polling vía Cron Jobs`

---

## ✅ PASO 6: Verificación Post-Deploy

### 1. Verificar que el servidor inicia

En los logs de Vercel deberías ver:
```
✅ Conexión a PostgreSQL establecida correctamente
🌐 Ejecutándose en Vercel - Polling vía Cron Jobs
```

### 2. Probar conexión con Dolibarr

```bash
GET https://tu-dominio.vercel.app/api/dolibarr/test
```

Debería responder:
```json
{
  "success": true,
  "message": "Conexión con Dolibarr exitosa"
}
```

### 3. Verificar Cron Job

En Vercel → Settings → Cron Jobs, deberías ver:
- `/api/cron/sync-dolibarr` programado cada 15 minutos

### 4. Probar Sincronización

**E-commerce → Dolibarr:**
1. Crear un producto en el e-commerce
2. Verificar en Dolibarr que aparece inmediatamente
3. Verificar que el stock es correcto

**Dolibarr → E-commerce:**
1. Crear un producto en Dolibarr
2. Esperar máximo 15 minutos
3. Verificar en el e-commerce que aparece

---

## 🔍 PASO 7: Monitoreo

### Logs a Revisar

1. **Logs de Vercel:**
   - Verificar que no hay errores
   - Verificar que el cron job se ejecuta

2. **Logs de integración:**
   ```sql
   SELECT * FROM integration_logs 
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```

3. **Productos sincronizados:**
   ```sql
   SELECT COUNT(*) FROM products WHERE dolibarr_id IS NOT NULL;
   ```

---

## ⚠️ Troubleshooting

### El cron job no se ejecuta

**Problema:** Vercel Cron Jobs no se ejecutan automáticamente

**Solución:**
1. Verificar que `vercel.json` tiene la sección `crons`
2. Verificar que el path es correcto: `/api/cron/sync-dolibarr`
3. Verificar que el archivo existe: `api/cron/sync-dolibarr.js`
4. Redesplegar después de cambios en `vercel.json`

### El stock no se sincroniza

**Problema:** Productos se crean pero el stock queda en 0

**Solución:**
1. Verificar que `DOLIBARR_DEFAULT_WAREHOUSE_ID` está configurado
2. Verificar que el almacén existe en Dolibarr
3. Revisar logs para ver errores de `createStockMovement`

### Productos no aparecen desde Dolibarr

**Problema:** Productos creados en Dolibarr no aparecen en e-commerce

**Solución:**
1. Verificar que el cron job se está ejecutando (revisar logs)
2. Ejecutar sincronización manual: `node scripts/sync-from-dolibarr-polling.js`
3. Verificar que los productos tienen SKU en Dolibarr

---

## 📊 Métricas a Monitorear

### Diariamente

- Productos sincronizados exitosamente
- Errores de sincronización
- Tiempo de respuesta del cron job

### Semanalmente

- Productos sin sincronizar
- Conflictos de stock
- Errores recurrentes

---

## 🎯 Resumen

**Antes de desplegar:**
1. ✅ Ejecutar `node scripts/validar-produccion.js`
2. ✅ Agregar todas las variables de entorno en Vercel
3. ✅ Verificar almacén en Dolibarr
4. ✅ Aplicar migraciones en BD de producción

**Después de desplegar:**
1. ✅ Verificar logs de Vercel
2. ✅ Probar sincronización en ambas direcciones
3. ✅ Verificar que el cron job funciona
4. ✅ Monitorear errores

**Listo para producción:** ✅

