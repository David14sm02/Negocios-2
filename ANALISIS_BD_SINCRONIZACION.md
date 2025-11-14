# Análisis de Base de Datos - Sincronización Bidireccional

## 📊 ESTRUCTURA ACTUAL

### Tabla: `products`

**Columnas existentes (20 campos):**
- `id` - INTEGER (PK)
- `name` - VARCHAR(255) NOT NULL
- `description` - TEXT
- `price` - NUMERIC NOT NULL
- `category_id` - INTEGER (FK → categories.id)
- `sku` - VARCHAR(100) NOT NULL UNIQUE
- `stock` - INTEGER DEFAULT 0
- `min_stock` - INTEGER DEFAULT 5
- `image_url` - TEXT
- `specifications` - JSONB
- `features` - ARRAY
- `tags` - ARRAY
- `brand` - VARCHAR(100)
- `weight` - NUMERIC
- `dimensions` - JSONB
- `is_active` - BOOLEAN DEFAULT true
- `is_featured` - BOOLEAN DEFAULT false
- `created_at` - TIMESTAMP DEFAULT now()
- `updated_at` - TIMESTAMP DEFAULT now()
- `views` - INTEGER DEFAULT 0

**Índices existentes:**
- `products_pkey` (PRIMARY KEY en `id`)
- `products_sku_key` (UNIQUE en `sku`)
- `idx_products_category` (en `category_id`)
- `idx_products_sku` (en `sku`)
- `idx_products_active` (en `is_active`)
- `idx_products_featured` (en `is_featured`)

**Restricciones:**
- FOREIGN KEY: `category_id` → `categories.id`
- UNIQUE: `sku`
- CHECK: `price >= 0`, `stock >= 0`

### Tabla: `integration_logs`

**Columnas existentes (10 campos):**
- `id` - INTEGER (PK)
- `source` - VARCHAR DEFAULT 'dolibarr'
- `direction` - VARCHAR DEFAULT 'outbound'
- `reference` - VARCHAR
- `action` - VARCHAR
- `status` - VARCHAR NOT NULL
- `request_payload` - JSONB
- `response_payload` - JSONB
- `error_message` - TEXT
- `created_at` - TIMESTAMP DEFAULT now()

✅ **Esta tabla ya está bien estructurada para registrar sincronizaciones bidireccionales**

---

## ❌ CAMPOS FALTANTES

Para implementar sincronización bidireccional, necesitamos agregar los siguientes campos a la tabla `products`:

### 1. `dolibarr_id` (INTEGER NULL)
- **Propósito**: Almacenar el ID del producto en Dolibarr
- **Tipo**: INTEGER NULL (puede ser NULL si el producto no existe en Dolibarr)
- **Uso**: Mapeo directo entre productos del e-commerce y Dolibarr
- **Índice**: Sí (parcial, solo donde no es NULL)

### 2. `dolibarr_synced_at` (TIMESTAMP NULL)
- **Propósito**: Registrar cuándo fue la última sincronización con Dolibarr
- **Tipo**: TIMESTAMP NULL
- **Uso**: Detectar productos desactualizados y evitar sincronizaciones innecesarias
- **Índice**: Sí

### 3. `sync_direction` (VARCHAR(20) NOT NULL DEFAULT 'outbound')
- **Propósito**: Indicar la dirección de sincronización del producto
- **Tipo**: VARCHAR(20) NOT NULL
- **Valores permitidos**: 'outbound', 'inbound', 'bidirectional'
- **Default**: 'outbound' (comportamiento actual)
- **Uso**: Controlar qué productos se sincronizan en qué dirección
- **Índice**: Sí

### 4. `last_sync_source` (VARCHAR(50) NULL)
- **Propósito**: Registrar qué sistema modificó el producto por última vez
- **Tipo**: VARCHAR(50) NULL
- **Valores posibles**: 'ecommerce', 'dolibarr', null
- **Uso**: Resolver conflictos y evitar loops de sincronización
- **Índice**: No necesario

---

## 📝 SCRIPT DE MIGRACIÓN

```sql
-- ============================================
-- MIGRACIÓN: Sincronización Bidireccional Dolibarr
-- ============================================

-- 1. Agregar campos para sincronización bidireccional
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS dolibarr_id INTEGER NULL,
ADD COLUMN IF NOT EXISTS dolibarr_synced_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS sync_direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
ADD COLUMN IF NOT EXISTS last_sync_source VARCHAR(50) NULL;

-- 2. Crear índices para mejorar rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_products_dolibarr_id 
ON products(dolibarr_id) 
WHERE dolibarr_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_dolibarr_synced_at 
ON products(dolibarr_synced_at);

CREATE INDEX IF NOT EXISTS idx_products_sync_direction 
ON products(sync_direction);

CREATE INDEX IF NOT EXISTS idx_products_last_sync_source 
ON products(last_sync_source);

-- 3. Agregar constraint para validar valores de sync_direction
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_sync_direction_check;

ALTER TABLE products 
ADD CONSTRAINT products_sync_direction_check 
CHECK (sync_direction IN ('outbound', 'inbound', 'bidirectional'));

-- 4. Agregar constraint para validar valores de last_sync_source
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_last_sync_source_check;

ALTER TABLE products 
ADD CONSTRAINT products_last_sync_source_check 
CHECK (last_sync_source IS NULL OR last_sync_source IN ('ecommerce', 'dolibarr'));

-- 5. Comentarios para documentación
COMMENT ON COLUMN products.dolibarr_id IS 'ID del producto en Dolibarr ERP. NULL si no está sincronizado.';
COMMENT ON COLUMN products.dolibarr_synced_at IS 'Timestamp de la última sincronización con Dolibarr';
COMMENT ON COLUMN products.sync_direction IS 'Dirección de sincronización: outbound (ecommerce→dolibarr), inbound (dolibarr→ecommerce), bidirectional (ambas direcciones)';
COMMENT ON COLUMN products.last_sync_source IS 'Último sistema que modificó el producto: ecommerce o dolibarr';

-- 6. Verificar que la migración se aplicó correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'products' 
AND column_name IN ('dolibarr_id', 'dolibarr_synced_at', 'sync_direction', 'last_sync_source')
ORDER BY column_name;
```

---

## 🔍 VERIFICACIÓN POST-MIGRACIÓN

Después de ejecutar la migración, verifica que todo esté correcto:

```sql
-- Verificar columnas agregadas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products' 
AND column_name IN ('dolibarr_id', 'dolibarr_synced_at', 'sync_direction', 'last_sync_source');

-- Verificar índices creados
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'products'
AND indexname LIKE '%dolibarr%' OR indexname LIKE '%sync%';

-- Verificar constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'products'
AND constraint_name LIKE '%sync%';
```

---

## 📋 ESTRATEGIA DE USO DE LOS CAMPOS

### `dolibarr_id`
- **Cuándo se establece**: Cuando se crea o sincroniza un producto con Dolibarr
- **Cuándo se actualiza**: Nunca (es inmutable, representa el ID en Dolibarr)
- **Cuándo se elimina**: Cuando se elimina el producto de Dolibarr (se pone NULL)

### `dolibarr_synced_at`
- **Cuándo se actualiza**: Cada vez que se sincroniza con Dolibarr (inbound o outbound)
- **Uso en queries**: Para encontrar productos que necesitan sincronización
  ```sql
  -- Productos que no se han sincronizado en más de 1 hora
  SELECT * FROM products 
  WHERE dolibarr_synced_at < NOW() - INTERVAL '1 hour'
  AND sync_direction IN ('inbound', 'bidirectional');
  ```

### `sync_direction`
- **'outbound'**: Solo sincroniza e-commerce → Dolibarr (comportamiento actual)
- **'inbound'**: Solo sincroniza Dolibarr → e-commerce (nuevos productos de Dolibarr)
- **'bidirectional'**: Sincroniza en ambas direcciones (productos que se modifican en ambos sistemas)

### `last_sync_source`
- **'ecommerce'**: El producto fue modificado en el e-commerce
- **'dolibarr'**: El producto fue modificado en Dolibarr
- **NULL**: No se ha sincronizado aún o es un producto nuevo

**Lógica de resolución de conflictos:**
```javascript
// Si last_sync_source = 'dolibarr' y hay cambios en e-commerce
// → Priorizar Dolibarr (es la fuente de verdad para stock)
// Si last_sync_source = 'ecommerce' y hay cambios en Dolibarr
// → Priorizar Dolibarr para stock, pero mantener cambios de e-commerce para otros campos
```

---

## 🎯 QUERIES ÚTILES DESPUÉS DE LA MIGRACIÓN

### Productos que necesitan sincronización desde Dolibarr
```sql
SELECT id, name, sku, dolibarr_id, dolibarr_synced_at
FROM products
WHERE sync_direction IN ('inbound', 'bidirectional')
AND (dolibarr_synced_at IS NULL 
     OR dolibarr_synced_at < NOW() - INTERVAL '15 minutes');
```

### Productos sincronizados con Dolibarr
```sql
SELECT COUNT(*) as total,
       COUNT(dolibarr_id) as con_dolibarr_id,
       COUNT(*) - COUNT(dolibarr_id) as sin_dolibarr_id
FROM products
WHERE is_active = true;
```

### Productos con conflictos potenciales
```sql
SELECT id, name, sku, last_sync_source, dolibarr_synced_at, updated_at
FROM products
WHERE last_sync_source = 'ecommerce'
AND dolibarr_synced_at IS NOT NULL
AND updated_at > dolibarr_synced_at
AND sync_direction = 'bidirectional';
```

---

## ✅ RESUMEN

### Lo que ya tienes:
- ✅ Tabla `products` bien estructurada
- ✅ Campo `sku` único para mapeo
- ✅ Tabla `integration_logs` para auditoría
- ✅ Índices básicos en campos importantes

### Lo que necesitas agregar:
- ❌ `dolibarr_id` - Para mapeo directo
- ❌ `dolibarr_synced_at` - Para tracking de sincronización
- ❌ `sync_direction` - Para control de dirección
- ❌ `last_sync_source` - Para resolución de conflictos
- ❌ Índices adicionales para rendimiento

### Próximos pasos:
1. ✅ Ejecutar script de migración
2. ✅ Actualizar código para usar nuevos campos
3. ✅ Implementar métodos de sincronización bidireccional
4. ✅ Configurar webhooks o polling

