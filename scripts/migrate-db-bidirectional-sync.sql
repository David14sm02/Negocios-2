-- ============================================
-- MIGRACIÓN: Sincronización Bidireccional Dolibarr
-- Fecha: 2024
-- Descripción: Agrega campos necesarios para sincronización bidireccional
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

