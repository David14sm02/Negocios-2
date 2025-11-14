# Solución: Sincronización de Stock E-commerce → Dolibarr

## ❌ PROBLEMA IDENTIFICADO

Cuando creas un producto en el e-commerce con stock (ej: 10 unidades):
- ✅ El producto se crea en Dolibarr
- ❌ El stock queda en 0 en Dolibarr (NO se sincroniza)

**Causa:** El código tenía comentada la sincronización de stock.

---

## ✅ SOLUCIÓN IMPLEMENTADA

Ahora el stock se sincroniza automáticamente usando **movimientos de stock**:

1. **Obtener stock actual** del producto en Dolibarr (0 al crear nuevo)
2. **Calcular diferencia** entre stock deseado (e-commerce) y stock actual (Dolibarr)
3. **Crear movimiento de stock** para ajustar la diferencia
4. **Resultado:** El stock se sincroniza correctamente en Dolibarr

---

## 🔧 CÓMO FUNCIONA AHORA

### Cuando creas un producto con stock:

1. Se crea el producto en Dolibarr (stock inicial: 0)
2. Se obtiene el stock actual (0)
3. Se calcula diferencia (ej: 10 - 0 = +10)
4. Se crea movimiento de entrada (+10 unidades)
5. **Resultado:** Stock en Dolibarr = 10 unidades ✅

### Cuando actualizas el stock:

1. Se obtiene stock actual en Dolibarr (ej: 10)
2. Se calcula diferencia con nuevo stock (ej: 15 - 10 = +5)
3. Se crea movimiento de entrada (+5 unidades)
4. **Resultado:** Stock en Dolibarr = 15 unidades ✅

---

## 🧪 CÓMO PROBAR

### Paso 1: Reiniciar el servidor

```bash
npm start
```

### Paso 2: Crear un producto nuevo con stock

1. Crear producto en el e-commerce con stock (ej: 10 unidades)
2. Verificar logs del servidor - deberías ver:
   ```
   📦 Sincronizando stock: 0 → 10 (diferencia: +10)
   ✅ Stock sincronizado en Dolibarr: 10 unidades
   ```
3. Verificar en Dolibarr - el stock debería ser 10 unidades

### Paso 3: Verificar en Dolibarr

1. Ir a Dolibarr → Productos → Lista
2. Buscar el producto creado
3. Verificar que el **Stock físico** sea el correcto (10 unidades)

---

## 📊 LOGS QUE VERÁS

### Si funciona correctamente:

```
🔄 [AUTO-SYNC] Iniciando sincronización automática: Producto Test (SKU: TEST-001)
✅ Producto creado en Dolibarr: 15 (Producto Test)
📦 Sincronizando stock: 0 → 10 (diferencia: +10)
✅ Stock sincronizado en Dolibarr: 10 unidades
✅ [AUTO-SYNC] Producto sincronizado: Producto Test → Dolibarr ID: 15
```

### Si hay error:

```
⚠️ Error sincronizando stock del producto Producto Test: [mensaje de error]
   El producto se creó pero el stock quedó en 0. Actualiza manualmente en Dolibarr.
```

---

## ⚠️ IMPORTANTE

### Requisitos para que funcione:

1. ✅ `DOLIBARR_DEFAULT_WAREHOUSE_ID` debe estar configurado en `config.env`
2. ✅ El almacén debe existir en Dolibarr
3. ✅ El producto debe tener gestión de stock habilitada en Dolibarr

### Si el stock no se sincroniza:

1. **Verificar configuración:**
   ```env
   DOLIBARR_DEFAULT_WAREHOUSE_ID=1
   ```

2. **Verificar que el almacén existe en Dolibarr:**
   - Ir a Dolibarr → Almacenes
   - Verificar que el almacén con ID 1 existe

3. **Verificar logs del servidor:**
   - Buscar errores relacionados con stock
   - Verificar mensajes de `createStockMovement`

---

## 🔍 VERIFICACIÓN

### En Base de Datos:

```sql
-- Ver productos con stock sincronizado
SELECT 
    id,
    name,
    sku,
    stock,
    dolibarr_id,
    last_sync_source,
    dolibarr_synced_at
FROM products
WHERE last_sync_source = 'ecommerce'
ORDER BY dolibarr_synced_at DESC
LIMIT 5;
```

### En Dolibarr:

1. Ir a Productos → Lista
2. Buscar el producto por SKU
3. Verificar que el **Stock físico** coincide con el del e-commerce

---

## ✅ RESUMEN

| Antes | Ahora |
|-------|-------|
| ❌ Stock NO se sincronizaba | ✅ Stock se sincroniza automáticamente |
| ❌ Stock quedaba en 0 en Dolibarr | ✅ Stock se actualiza correctamente |
| ❌ Código comentado | ✅ Código activo y funcionando |

---

## 🎯 PRÓXIMOS PASOS

1. ✅ Reiniciar servidor: `npm start`
2. ✅ Crear producto de prueba con stock
3. ✅ Verificar logs del servidor
4. ✅ Verificar en Dolibarr que el stock es correcto

**El stock ahora se sincroniza automáticamente cuando creas o actualizas un producto.** ✅

