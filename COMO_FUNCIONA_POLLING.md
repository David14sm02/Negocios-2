# Cómo Funciona el Polling Automático

## ⏱️ ¿Cuánto tiempo debo esperar?

### Respuesta corta:
**SÍ, debes esperar hasta la próxima ejecución del polling (máximo 15 minutos).**

### Explicación detallada:

1. **El polling se ejecuta cada 15 minutos automáticamente**
   - Si creas un producto a las 3:00 PM
   - Y el último polling fue a las 2:50 PM
   - Debes esperar hasta las 3:05 PM (próxima ejecución)

2. **Si acabas de iniciar el servidor:**
   - El polling se ejecuta inmediatamente al iniciar (si `DOLIBARR_POLLING_RUN_ON_START=true`)
   - Luego cada 15 minutos

3. **Intervalo configurable:**
   - Por defecto: 15 minutos
   - Puedes cambiarlo en `config.env`: `DOLIBARR_POLLING_INTERVAL=5` (cada 5 minutos)

---

## 🚀 Solución: Sincronización Manual Inmediata

**NO necesitas esperar si ejecutas el script manualmente:**

```bash
node scripts/sync-ahora.js
```

Esto sincroniza **inmediatamente** todos los productos desde Dolibarr.

---

## 📋 Flujo Recomendado

### Opción 1: Esperar (Automático)
1. Crear producto en Dolibarr
2. Esperar máximo 15 minutos
3. Refrescar el e-commerce
4. ✅ Producto aparece

### Opción 2: Inmediato (Manual)
1. Crear producto en Dolibarr
2. Ejecutar: `node scripts/sync-ahora.js`
3. Refrescar el e-commerce
4. ✅ Producto aparece inmediatamente

---

## 🔍 Verificar Cuándo Fue la Última Sincronización

Puedes verificar en la base de datos:

```sql
SELECT 
    name,
    sku,
    dolibarr_synced_at,
    last_sync_source
FROM products
WHERE last_sync_source = 'dolibarr'
ORDER BY dolibarr_synced_at DESC
LIMIT 5;
```

O en los logs:

```sql
SELECT 
    action,
    status,
    reference,
    created_at
FROM integration_logs
WHERE source = 'dolibarr' 
  AND direction = 'inbound'
ORDER BY created_at DESC
LIMIT 5;
```

---

## ⚙️ Configuración del Intervalo

En `config.env`:

```env
# Polling cada 15 minutos (default)
DOLIBARR_POLLING_INTERVAL=15

# Polling cada 5 minutos (más frecuente)
DOLIBARR_POLLING_INTERVAL=5

# Polling cada 30 minutos (menos frecuente)
DOLIBARR_POLLING_INTERVAL=30
```

**⚠️ Nota:** Intervalos muy cortos (menos de 5 minutos) pueden sobrecargar el servidor.

---

## 💡 Recomendación

**Para desarrollo/pruebas:**
- Usa `node scripts/sync-ahora.js` cuando necesites ver cambios inmediatos

**Para producción:**
- Deja el polling automático cada 15 minutos
- Es suficiente para la mayoría de casos de uso
- No sobrecarga el servidor

---

## 📊 Resumen

| Escenario | Tiempo de Espera |
|-----------|------------------|
| Polling automático | 0-15 minutos (depende de cuándo fue el último) |
| Sincronización manual | Inmediato (ejecutar script) |
| Al iniciar servidor | Inmediato (primera ejecución) |

