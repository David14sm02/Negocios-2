# Configurar Polling Automático para Sincronización Dolibarr

## 🎯 Objetivo
Ejecutar automáticamente `sync-from-dolibarr-polling.js` cada 15 minutos para sincronizar cambios desde Dolibarr.

---

## 🪟 Windows (Task Scheduler)

### Paso 1: Abrir Programador de Tareas
1. Presiona `Win + R`
2. Escribe: `taskschd.msc`
3. Presiona Enter

### Paso 2: Crear Tarea Básica
1. Click en "Crear tarea básica..." (lado derecho)
2. Nombre: `Sincronizar Dolibarr con E-commerce`
3. Descripción: `Sincroniza productos y stock desde Dolibarr cada 15 minutos`
4. Click "Siguiente"

### Paso 3: Configurar Trigger (Cuándo ejecutar)
1. Selecciona "Diariamente"
2. Click "Siguiente"
3. Fecha de inicio: Hoy
4. Hora: La hora actual
5. Repetir cada: `15 minutos`
6. Duración: `Indefinidamente`
7. Click "Siguiente"

### Paso 4: Configurar Acción (Qué ejecutar)
1. Selecciona "Iniciar un programa"
2. Click "Siguiente"
3. Programa o script: `node`
4. Agregar argumentos: `scripts/sync-from-dolibarr-polling.js`
5. Iniciar en: `C:\Users\think\Documents\ITP\NE\Negocios-2`
6. Click "Siguiente"
7. Click "Finalizar"

### Paso 5: Verificar
- La tarea debería aparecer en la lista
- Click derecho → "Ejecutar" para probar manualmente
- Verifica que funcione correctamente

---

## 🐧 Linux/Mac (Cron)

### Editar crontab:
```bash
crontab -e
```

### Agregar esta línea:
```bash
# Sincronizar Dolibarr cada 15 minutos
*/15 * * * * cd /ruta/completa/al/proyecto && /usr/bin/node scripts/sync-from-dolibarr-polling.js >> /var/log/dolibarr-sync.log 2>&1
```

**Reemplazar:**
- `/ruta/completa/al/proyecto` → Tu ruta completa
- `/usr/bin/node` → Ruta donde está node (verificar con `which node`)

### Verificar que funciona:
```bash
# Ver logs
tail -f /var/log/dolibarr-sync.log

# Ver tareas programadas
crontab -l
```

---

## 🔄 Alternativa: Usar node-cron (Dentro de la aplicación)

Si prefieres que el polling se ejecute dentro de tu aplicación Node.js:

### 1. Instalar node-cron:
```bash
npm install node-cron
```

### 2. Crear archivo: `src/services/pollingService.js`
```javascript
const cron = require('node-cron');
const db = require('../config/database');
const dolibarrService = require('./dolibarrService');

// Ejecutar cada 15 minutos
cron.schedule('*/15 * * * *', async () => {
    console.log('🔄 Ejecutando sincronización automática desde Dolibarr...');
    try {
        await dolibarrService.syncAllProductsFromDolibarr(db, {
            onlyNew: false,
            updateStock: true
        });
        console.log('✅ Sincronización automática completada');
    } catch (error) {
        console.error('❌ Error en sincronización automática:', error);
    }
});

console.log('✅ Polling automático configurado (cada 15 minutos)');
```

### 3. Importar en `src/server.js`:
```javascript
// Al inicio del archivo, después de los requires
require('./services/pollingService');
```

---

## ✅ Verificar que funciona

### 1. Crear/modificar producto en Dolibarr
- Ve a Dolibarr
- Crea un producto nuevo o modifica el stock de uno existente

### 2. Esperar máximo 15 minutos
- El polling se ejecutará automáticamente

### 3. Verificar en e-commerce
- El producto debería aparecer o el stock debería actualizarse

### 4. Ver logs
- Windows: Ver historial en Task Scheduler
- Linux: `tail -f /var/log/dolibarr-sync.log`
- Node-cron: Ver logs de la aplicación

---

## 🎯 Resumen

**NO necesitas ejecutar el polling manualmente cada vez.**

**Solo necesitas:**
1. ✅ Configurarlo UNA VEZ para que se ejecute automáticamente
2. ✅ Dejarlo corriendo
3. ✅ Los cambios en Dolibarr se sincronizarán automáticamente cada 15 minutos

**Frecuencia recomendada:**
- 15 minutos: Balance entre actualidad y carga del servidor
- 5 minutos: Si necesitas actualizaciones más frecuentes
- 30 minutos: Si hay pocos cambios

