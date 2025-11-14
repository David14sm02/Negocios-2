# Solución: Sincronización Inmediata E-commerce → Dolibarr

## ⚠️ PROBLEMA

La sincronización desde e-commerce a Dolibarr **DEBE ser INMEDIATA**, no espera 15 minutos.

Si no funciona, puede ser:
1. Error silencioso (se captura pero no se muestra)
2. Configuración incorrecta
3. Error de conexión con Dolibarr

---

## ✅ CÓMO DEBERÍA FUNCIONAR

Cuando creas un producto en el e-commerce:
1. ✅ Se crea en la BD local
2. ✅ **INMEDIATAMENTE** se sincroniza a Dolibarr (sin esperar)
3. ✅ Se guarda el `dolibarr_id` en la BD

**NO espera 15 minutos** - es instantáneo.

---

## 🔍 CÓMO VERIFICAR

### 1. Verificar Logs del Servidor

Cuando creas un producto, deberías ver en los logs:

```
✅ Producto creado en Dolibarr: [ID] ([Nombre])
```

O si hay error:

```
⚠️ Error sincronizando producto con Dolibarr (no crítico): [mensaje]
```

### 2. Verificar en Base de Datos

```sql
SELECT id, name, sku, dolibarr_id, last_sync_source, created_at
FROM products
WHERE dolibarr_id IS NULL
ORDER BY created_at DESC
LIMIT 5;
```

Si hay productos con `dolibarr_id = NULL`, NO se sincronizaron.

### 3. Verificar Configuración

En `config.env` debe estar:

```env
DOLIBARR_ENABLED=true
DOLIBARR_URL=https://nettechsolutions.with1.doliplace.fr
DOLIBARR_AUTO_SYNC=true  ← ESTO ES CRÍTICO
```

---

## 🔧 SOLUCIONES

### Solución 1: Sincronizar Manualmente

Si un producto no se sincronizó, puedes sincronizarlo manualmente:

**Opción A: Por API**
```bash
POST /api/dolibarr/sync/product/:productId
```

**Opción B: Script**
```bash
node scripts/sync-all-products-to-dolibarr.js
```

### Solución 2: Mejorar Logging

El código actual captura errores silenciosamente. Podemos mejorarlo para ver qué pasa.

### Solución 3: Verificar Conexión

Asegúrate de que la conexión con Dolibarr funciona:

```bash
GET /api/dolibarr/test
```

---

## 🧪 PRUEBA RÁPIDA

1. **Crear un producto nuevo en el e-commerce**
2. **Inmediatamente verificar en Dolibarr** (no esperar)
3. **Si no aparece:**
   - Revisar logs del servidor
   - Verificar errores en `integration_logs`
   - Sincronizar manualmente

---

## 📝 NOTA IMPORTANTE

**La diferencia clave:**

- **Dolibarr → E-commerce:** Usa polling (cada 15 min) o webhook
- **E-commerce → Dolibarr:** Es INMEDIATO (al crear/actualizar producto)

Si no es inmediato, hay un problema que debemos diagnosticar.

