# Guía: Webhooks con Dolibarr

## 🔍 ¿Dolibarr soporta webhooks?

**Respuesta corta:** Dolibarr **NO tiene webhooks nativos** en su API REST estándar. Sin embargo, hay alternativas:

### Opciones Disponibles:

1. **Polling (Recomendado)** - Verificar cambios periódicamente
2. **Módulos de terceros** - Algunos módulos pueden agregar webhooks
3. **Scripts personalizados en Dolibarr** - Crear triggers que llamen a tu API
4. **Webhook simulado** - Usar nuestro endpoint para pruebas manuales

---

## 🚀 Cómo Probar el Webhook (Simulación)

Aunque Dolibarr no envíe webhooks automáticamente, puedes probar que tu endpoint funciona correctamente:

### Opción 1: Script de Prueba Automático

```bash
# Asegúrate de que el servidor esté corriendo primero
npm start

# En otra terminal, ejecuta el script de prueba
node scripts/test-webhook.js
```

Este script simula los eventos que Dolibarr enviaría:
- `product.created` - Producto creado
- `product.updated` - Producto actualizado
- `stock.updated` - Stock actualizado
- `stock.movement` - Movimiento de stock

### Opción 2: Prueba Manual con cURL

```bash
# Probar creación de producto
curl -X POST http://localhost:3000/api/dolibarr/webhook \
  -H "Content-Type: application/json" \
  -H "X-Dolibarr-Secret: tu_secret_aqui" \
  -d '{
    "event": "product.created",
    "data": {
      "id": 1,
      "ref": "TEST-001",
      "label": "Producto de Prueba",
      "price": 100,
      "stock_reel": 50
    }
  }'

# Probar actualización de stock
curl -X POST http://localhost:3000/api/dolibarr/webhook \
  -H "Content-Type: application/json" \
  -H "X-Dolibarr-Secret: tu_secret_aqui" \
  -d '{
    "event": "stock.updated",
    "data": {
      "id": 1,
      "product_id": 1,
      "ref": "TEST-001",
      "stock": 45
    }
  }'
```

### Opción 3: Prueba con Postman

1. Crear nueva request POST
2. URL: `http://localhost:3000/api/dolibarr/webhook`
3. Headers:
   - `Content-Type: application/json`
   - `X-Dolibarr-Secret: tu_secret_aqui`
4. Body (raw JSON):
```json
{
  "event": "product.created",
  "data": {
    "id": 2,
    "ref": "CAT6-305M",
    "label": "Cable Cat6 UTP 305m",
    "price": 2500,
    "stock_reel": 30
  }
}
```

---

## 🔧 Configuración del Webhook

### 1. Configurar Secret en `config.env`:

```env
# Agregar esta línea
DOLIBARR_WEBHOOK_SECRET=tu_secret_super_seguro_aqui
```

### 2. El endpoint está disponible en:

```
POST /api/dolibarr/webhook
```

**Autenticación:**
- Header: `X-Dolibarr-Secret: tu_secret`
- O en body: `{ "secret": "tu_secret", ... }`

**Formato del payload:**
```json
{
  "event": "product.created|product.updated|stock.updated|stock.movement",
  "data": {
    "id": 1,
    "ref": "SKU-001",
    "label": "Nombre del producto",
    "price": 100,
    "stock_reel": 50,
    ...
  }
}
```

---

## 🔄 Alternativa: Polling (Recomendado para Producción)

Como Dolibarr no tiene webhooks nativos, la mejor opción es usar **polling periódico**:

### Configurar Polling Automático:

**Opción 1: Cron Job (Linux/Mac)**

```bash
# Editar crontab
crontab -e

# Agregar esta línea (cada 15 minutos)
*/15 * * * * cd /ruta/a/tu/proyecto && node scripts/sync-from-dolibarr-polling.js >> /var/log/dolibarr-sync.log 2>&1
```

**Opción 2: Task Scheduler (Windows)**

1. Abrir "Programador de tareas"
2. Crear tarea básica
3. Trigger: Cada 15 minutos
4. Acción: Iniciar programa
   - Programa: `node`
   - Argumentos: `scripts/sync-from-dolibarr-polling.js`
   - Iniciar en: `C:\ruta\a\tu\proyecto`

**Opción 3: Ejecutar Manualmente:**

```bash
node scripts/sync-from-dolibarr-polling.js
```

---

## 🛠️ Implementar Webhooks en Dolibarr (Avanzado)

Si realmente necesitas webhooks en tiempo real, puedes crear un módulo personalizado en Dolibarr:

### Crear Hook en Dolibarr:

1. **Crear archivo de hook** en Dolibarr:
   - Ruta: `htdocs/core/triggers/`
   - Archivo: `mod_webhook.class.php`

2. **Código de ejemplo:**
```php
<?php
class InterfaceWebhook extends DolibarrTriggers
{
    public function runTrigger($action, $object, $user, $langs, $conf)
    {
        if ($action == 'PRODUCT_CREATE' || $action == 'PRODUCT_MODIFY') {
            $webhook_url = 'https://tu-ecommerce.com/api/dolibarr/webhook';
            $secret = 'tu_secret_aqui';
            
            $data = [
                'event' => $action == 'PRODUCT_CREATE' ? 'product.created' : 'product.updated',
                'data' => [
                    'id' => $object->id,
                    'ref' => $object->ref,
                    'label' => $object->label,
                    'price' => $object->price,
                    'stock_reel' => $object->stock_reel
                ]
            ];
            
            $ch = curl_init($webhook_url);
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'X-Dolibarr-Secret: ' . $secret
            ]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_exec($ch);
            curl_close($ch);
        }
        
        return 0;
    }
}
```

3. **Activar el trigger** en Dolibarr:
   - Ir a: Configuración → Módulos → Triggers
   - Activar "InterfaceWebhook"

---

## ✅ Verificar que Funciona

### 1. Verificar Logs del Servidor:

Cuando recibas un webhook, verás en los logs:
```
✅ Producto actualizado desde Dolibarr: Nombre del Producto (SKU: XXX)
```

### 2. Verificar en Base de Datos:

```sql
-- Ver últimos eventos de sincronización
SELECT 
    direction,
    action,
    status,
    reference,
    created_at
FROM integration_logs
WHERE source = 'dolibarr' 
  AND direction = 'inbound'
ORDER BY created_at DESC
LIMIT 10;

-- Ver productos sincronizados desde Dolibarr
SELECT 
    id,
    name,
    sku,
    dolibarr_id,
    stock,
    last_sync_source,
    dolibarr_synced_at
FROM products
WHERE last_sync_source = 'dolibarr'
ORDER BY dolibarr_synced_at DESC
LIMIT 10;
```

### 3. Probar con Producto Real:

```bash
# 1. Obtener un producto real de Dolibarr
curl -X GET "https://tu-dolibarr.com/api/index.php/products/1" \
  -H "DOLAPIKEY: tu_api_key"

# 2. Enviar webhook simulado con esos datos
curl -X POST http://localhost:3000/api/dolibarr/webhook \
  -H "Content-Type: application/json" \
  -H "X-Dolibarr-Secret: tu_secret" \
  -d '{
    "event": "product.updated",
    "data": {
      "id": 1,
      "ref": "CAT6-305M",
      "label": "Cable Cat6 UTP 305m",
      "price": 2500,
      "stock_reel": 25
    }
  }'

# 3. Verificar que se actualizó en la BD
```

---

## 📊 Comparación: Webhook vs Polling

| Característica | Webhook | Polling |
|---------------|---------|---------|
| **Tiempo real** | ✅ Sí | ❌ Delay (5-15 min) |
| **Requiere configuración en Dolibarr** | ✅ Sí (módulo personalizado) | ❌ No |
| **Complejidad** | ⚠️ Alta | ✅ Baja |
| **Confiabilidad** | ⚠️ Depende de Dolibarr | ✅ Alta |
| **Recomendado para** | Tiempo real crítico | Producción estándar |

**Recomendación:** Usar **Polling** como solución principal y webhooks solo si realmente necesitas tiempo real y puedes implementar el módulo en Dolibarr.

---

## 🎯 Resumen

1. **Dolibarr NO tiene webhooks nativos** - Necesitas implementar un módulo personalizado
2. **Usa Polling** - Es más simple y confiable: `node scripts/sync-from-dolibarr-polling.js`
3. **Prueba el endpoint** - Usa `node scripts/test-webhook.js` para verificar que funciona
4. **Configura el secret** - Agrega `DOLIBARR_WEBHOOK_SECRET` en `config.env`

---

## 🔗 Recursos

- [Documentación API Dolibarr](https://wiki.dolibarr.org/index.php/Module_API_REST)
- [Triggers en Dolibarr](https://wiki.dolibarr.org/index.php/Triggers)
- Script de polling: `scripts/sync-from-dolibarr-polling.js`
- Script de prueba: `scripts/test-webhook.js`

