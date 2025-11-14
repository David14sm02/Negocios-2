# ✅ Checklist Pre-Producción - Sincronización Bidireccional Dolibarr

## 🔐 SEGURIDAD

### Variables de Entorno en Vercel

- [ ] **DOLIBARR_URL** - URL de producción de Dolibarr
- [ ] **DOLIBARR_API_USER** - Usuario con permisos API
- [ ] **DOLIBARR_API_PASSWORD** - Contraseña segura (NO compartir)
- [ ] **DOLIBARR_WEBHOOK_SECRET** - Secret único y seguro
- [ ] **DOLIBARR_DEFAULT_WAREHOUSE_ID** - ID del almacén correcto
- [ ] **DATABASE_URL** - URL de producción (con credenciales seguras)
- [ ] **JWT_SECRET** - Secret único y seguro
- [ ] **STRIPE_SECRET_KEY** - Clave de producción (no test)
- [ ] **STRIPE_WEBHOOK_SECRET** - Secret de webhook de producción

### Configuración de Seguridad

- [ ] Cambiar `DOLIBARR_API_PASSWORD` a una contraseña fuerte
- [ ] Cambiar `DOLIBARR_WEBHOOK_SECRET` a un valor único y seguro
- [ ] Cambiar `JWT_SECRET` a un valor único y seguro
- [ ] Verificar que `NODE_ENV=production` en Vercel
- [ ] Configurar `CORS_ORIGIN` con el dominio de producción

---

## ⚙️ CONFIGURACIÓN DOLIBARR

### Verificaciones en Dolibarr

- [ ] **Almacén existe:** Verificar que el almacén con ID `DOLIBARR_DEFAULT_WAREHOUSE_ID` existe
- [ ] **Usuario API:** Verificar que el usuario tiene permisos para:
  - Crear/actualizar productos
  - Crear movimientos de stock
  - Leer productos y stock
- [ ] **Gestión de stock:** Verificar que los productos tienen gestión de stock habilitada
- [ ] **API REST activada:** Verificar que el módulo API REST está activo

### Configuración Recomendada

- [ ] Activar "Modo producción" en Dolibarr (si está disponible)
- [ ] Configurar límites de rate limiting en Dolibarr (opcional)
- [ ] Verificar que los productos tienen códigos únicos (ref/SKU)

---

## 🗄️ BASE DE DATOS

### Migraciones Aplicadas

- [ ] Verificar que las migraciones se aplicaron en producción:
  ```sql
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'products' 
  AND column_name IN ('dolibarr_id', 'dolibarr_synced_at', 'sync_direction', 'last_sync_source');
  ```
- [ ] Verificar que los índices existen:
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE tablename = 'products' 
  AND indexname LIKE '%dolibarr%' OR indexname LIKE '%sync%';
  ```

### Backup

- [ ] Configurar backup automático de la base de datos
- [ ] Verificar que el backup incluye la tabla `integration_logs`

---

## 🔄 SINCRONIZACIÓN

### Polling Automático

- [ ] **Vercel Cron Jobs configurado:**
  - Verificar que `vercel.json` tiene el cron job configurado
  - Verificar que `api/cron/sync-dolibarr.js` existe
  - Verificar que el endpoint funciona: `GET /api/cron/sync-dolibarr`

- [ ] **Variables de polling:**
  ```env
  DOLIBARR_POLLING_ENABLED=true
  DOLIBARR_POLLING_INTERVAL=15
  DOLIBARR_POLLING_RUN_ON_START=true
  ```

### Sincronización Automática

- [ ] **E-commerce → Dolibarr:**
  - Verificar que `DOLIBARR_AUTO_SYNC=true`
  - Probar creando un producto y verificar que aparece en Dolibarr
  - Verificar que el stock se sincroniza correctamente

- [ ] **Dolibarr → E-commerce:**
  - Verificar que el polling funciona
  - Probar creando un producto en Dolibarr y esperar sincronización
  - Verificar que el stock se actualiza correctamente

---

## 📊 MONITOREO Y LOGS

### Logging

- [ ] Verificar que los logs se están guardando en `integration_logs`
- [ ] Configurar alertas para errores críticos (opcional)
- [ ] Verificar que los logs incluyen información suficiente para debugging

### Monitoreo Recomendado

- [ ] Configurar dashboard para ver estado de sincronización
- [ ] Alertas para:
  - Errores de conexión con Dolibarr
  - Productos que no se sincronizan
  - Errores en movimientos de stock

---

## 🧪 TESTING

### Pruebas Pre-Producción

- [ ] **Crear producto en e-commerce:**
  - Verificar que aparece en Dolibarr
  - Verificar que el stock es correcto
  - Verificar que `dolibarr_id` se guarda

- [ ] **Crear producto en Dolibarr:**
  - Verificar que aparece en e-commerce (esperar máximo 15 min)
  - Verificar que el stock es correcto

- [ ] **Actualizar stock en Dolibarr:**
  - Verificar que se actualiza en e-commerce (esperar máximo 15 min)

- [ ] **Actualizar stock en e-commerce:**
  - Verificar que se actualiza en Dolibarr (inmediato)

- [ ] **Productos sin SKU:**
  - Verificar manejo de errores si un producto no tiene SKU

---

## ⚠️ MANEJO DE ERRORES

### Validaciones

- [ ] Productos sin SKU no deben sincronizarse (o deben generar error claro)
- [ ] Errores de conexión con Dolibarr no deben romper la creación de productos
- [ ] Errores de stock no deben impedir la creación del producto

### Recuperación

- [ ] Script para sincronizar productos pendientes:
  ```bash
  node scripts/sync-all-products-to-dolibarr.js
  ```
- [ ] Script para sincronizar desde Dolibarr:
  ```bash
  node scripts/sync-from-dolibarr-polling.js
  ```

---

## 🚀 DEPLOYMENT

### Vercel

- [ ] **Variables de entorno agregadas** (ver lista arriba)
- [ ] **vercel.json configurado** con cron jobs
- [ ] **api/cron/sync-dolibarr.js** existe y funciona
- [ ] **Dominio configurado** y CORS actualizado
- [ ] **SSL/HTTPS activo**

### Post-Deployment

- [ ] Verificar que el servidor inicia correctamente
- [ ] Verificar que el cron job está activo en Vercel
- [ ] Probar sincronización en ambas direcciones
- [ ] Verificar logs en Vercel

---

## 📝 DOCUMENTACIÓN

### Para el Equipo

- [ ] Documentar cómo funciona la sincronización bidireccional
- [ ] Documentar cómo resolver problemas comunes
- [ ] Documentar cómo sincronizar manualmente si es necesario
- [ ] Documentar variables de entorno necesarias

---

## 🔍 VERIFICACIÓN FINAL

### Checklist Rápido

```bash
# 1. Verificar conexión con Dolibarr
GET /api/dolibarr/test

# 2. Verificar productos sincronizados
SELECT COUNT(*) FROM products WHERE dolibarr_id IS NOT NULL;

# 3. Verificar logs recientes
SELECT * FROM integration_logs 
WHERE created_at > NOW() - INTERVAL '1 hour' 
ORDER BY created_at DESC;

# 4. Probar sincronización manual
POST /api/dolibarr/sync/product/:id
```

---

## ⚡ OPTIMIZACIONES OPCIONALES

### Performance

- [ ] Considerar aumentar intervalo de polling si hay muchos productos (30 min en vez de 15)
- [ ] Considerar sincronizar solo productos modificados recientemente
- [ ] Indexar campos de búsqueda frecuente

### Funcionalidades Adicionales

- [ ] Dashboard de estado de sincronización
- [ ] Notificaciones de errores críticos
- [ ] Historial de cambios de stock
- [ ] Resolución automática de conflictos

---

## 🎯 PRIORIDADES PARA PRODUCCIÓN

### Crítico (Hacer antes de desplegar)

1. ✅ Variables de entorno en Vercel
2. ✅ Verificar almacén en Dolibarr
3. ✅ Probar sincronización en ambas direcciones
4. ✅ Verificar que el stock se sincroniza
5. ✅ Configurar cron jobs en Vercel

### Importante (Hacer pronto)

1. ⚠️ Backup de base de datos
2. ⚠️ Monitoreo de logs
3. ⚠️ Documentación del equipo

### Opcional (Mejoras futuras)

1. 💡 Dashboard de sincronización
2. 💡 Alertas automáticas
3. 💡 Optimizaciones de performance

---

## 📋 RESUMEN EJECUTIVO

**Estado Actual:**
- ✅ Sincronización bidireccional implementada
- ✅ Stock se sincroniza correctamente
- ✅ Polling automático configurado
- ✅ Logging mejorado

**Antes de Desplegar:**
1. Agregar variables de entorno en Vercel
2. Verificar almacén en Dolibarr
3. Probar sincronización completa
4. Configurar cron jobs en Vercel

**Listo para Producción:** ✅ (después de completar checklist)

