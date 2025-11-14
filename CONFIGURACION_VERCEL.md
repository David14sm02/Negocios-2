# Configuración de Variables de Entorno en Vercel

## 📋 Variables Necesarias para Sincronización Bidireccional

Si desplegas tu aplicación en Vercel, necesitas agregar estas variables de entorno en el dashboard de Vercel.

---

## 🔧 Cómo Agregar Variables en Vercel

### Paso 1: Ir a la Configuración del Proyecto
1. Ve a tu proyecto en Vercel
2. Click en **Settings** (Configuración)
3. Click en **Environment Variables** (Variables de Entorno)

### Paso 2: Agregar Variables

Agrega las siguientes variables (una por una):

---

## 📝 Variables de Dolibarr (Ya Existentes)

Estas probablemente ya las tienes, pero verifica:

```env
DOLIBARR_ENABLED=true
DOLIBARR_URL=https://tu-instancia-dolibarr.com
DOLIBARR_API_USER=admin
DOLIBARR_API_PASSWORD=TU_CONTRASEÑA_DOLIBARR_AQUI
DOLIBARR_DEFAULT_WAREHOUSE_ID=1
DOLIBARR_AUTO_SYNC=true
```

---

## 🆕 Variables NUEVAS para Sincronización Bidireccional

### 1. Webhook Secret (Opcional pero Recomendado)
```env
DOLIBARR_WEBHOOK_SECRET=TU_WEBHOOK_SECRET_AQUI
```
**Descripción:** Secret para validar webhooks de Dolibarr (si los implementas)

### 2. Polling Automático
```env
DOLIBARR_POLLING_ENABLED=true
```
**Descripción:** Habilita el polling automático cada X minutos

### 3. Intervalo de Polling
```env
DOLIBARR_POLLING_INTERVAL=15
```
**Descripción:** Intervalo en minutos entre cada sincronización (default: 15)

### 4. Ejecutar al Iniciar
```env
DOLIBARR_POLLING_RUN_ON_START=true
```
**Descripción:** Ejecutar sincronización inmediatamente al iniciar el servidor

---

## ⚙️ Configuración por Ambiente

En Vercel puedes configurar variables para diferentes ambientes:

- **Production** (Producción)
- **Preview** (Previsualización)
- **Development** (Desarrollo)

**Recomendación:** Agrega todas las variables en los 3 ambientes.

---

## 📋 Lista Completa de Variables para Copiar/Pegar

### Variables de Base de Datos
```env
DATABASE_URL=postgresql://usuario:contraseña@host:puerto/nombre_bd?sslmode=require&channel_binding=require
DB_SSL=false
```

### Variables de Seguridad
```env
JWT_SECRET=TU_JWT_SECRET_AQUI_GENERA_UNO_SEGURO_DE_256_BITS
```

### Variables de Dolibarr (Completas)
```env
DOLIBARR_ENABLED=true
DOLIBARR_URL=https://tu-instancia-dolibarr.com
DOLIBARR_API_USER=admin
DOLIBARR_API_PASSWORD=TU_CONTRASEÑA_DOLIBARR_AQUI
DOLIBARR_DEFAULT_WAREHOUSE_ID=1
DOLIBARR_AUTO_SYNC=true
DOLIBARR_WEBHOOK_SECRET=TU_WEBHOOK_SECRET_AQUI
DOLIBARR_POLLING_ENABLED=true
DOLIBARR_POLLING_INTERVAL=15
DOLIBARR_POLLING_RUN_ON_START=true
```

### Variables de Stripe (Si las usas)
```env
STRIPE_SECRET_KEY=sk_test_TU_CLAVE_SECRETA_DE_STRIPE_AQUI
STRIPE_WEBHOOK_SECRET=whsec_TU_WEBHOOK_SECRET_DE_STRIPE_AQUI
STRIPE_SUCCESS_URL=https://tu-dominio.vercel.app/checkout/success
STRIPE_CANCEL_URL=https://tu-dominio.vercel.app/checkout/cancel
FRONTEND_URL=https://tu-dominio.vercel.app
```

### Variables del Servidor
```env
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://tu-dominio.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
VERCEL=true
```

---

## ⚠️ Importante: Valores Sensibles

**NUNCA** subas estos valores a GitHub o repositorios públicos:

- `DOLIBARR_API_PASSWORD`
- `DOLIBARR_WEBHOOK_SECRET`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `DATABASE_URL` (contiene credenciales)

**Solución:** Usa variables de entorno en Vercel, NO las pongas en el código.

---

## 🔄 Después de Agregar Variables

1. **Redesplegar la aplicación:**
   - Ve a **Deployments**
   - Click en los 3 puntos del último deployment
   - Click en **Redeploy**

2. **Verificar logs:**
   - Después del redeploy, verifica los logs
   - Deberías ver: `✅ [POLLING] Polling automático configurado`

---

## 🧪 Verificar que Funciona

Después del redeploy, verifica:

1. **Logs del servidor:**
   ```
   ✅ [POLLING] Polling automático configurado (cada 15 minutos)
   📅 [POLLING] Próxima ejecución: [fecha]
   ```

2. **Crear producto en Dolibarr:**
   - Espera máximo 15 minutos
   - O ejecuta sincronización manual (si tienes acceso)

3. **Verificar en e-commerce:**
   - El producto debería aparecer automáticamente

---

## 📝 Notas Importantes

### Sobre el Polling en Vercel

- **Vercel Serverless:** El polling funciona, pero ten en cuenta que:
  - Si no hay tráfico, las funciones serverless pueden "dormir"
  - El polling se ejecutará cuando haya una request activa
  - Considera usar Vercel Cron Jobs para mayor confiabilidad

### Alternativa: Vercel Cron Jobs

Si quieres mayor control, puedes usar Vercel Cron Jobs:

1. Crear archivo `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/sync-dolibarr",
    "schedule": "*/15 * * * *"
  }]
}
```

2. Crear endpoint `/api/cron/sync-dolibarr` que ejecute la sincronización

---

## ✅ Checklist

- [ ] Agregar `DOLIBARR_POLLING_ENABLED=true`
- [ ] Agregar `DOLIBARR_POLLING_INTERVAL=15`
- [ ] Agregar `DOLIBARR_POLLING_RUN_ON_START=true`
- [ ] Agregar `DOLIBARR_WEBHOOK_SECRET` (opcional)
- [ ] Configurar en Production, Preview y Development
- [ ] Redesplegar la aplicación
- [ ] Verificar logs después del deploy

---

## 🆘 Troubleshooting

### El polling no funciona en Vercel

**Problema:** Las funciones serverless se "duermen sin tráfico"

**Solución:** 
1. Usar Vercel Cron Jobs (recomendado)
2. O mantener el sitio "despierto" con un servicio de ping
3. O usar un servicio externo para ejecutar el polling

### Variables no se aplican

**Solución:**
1. Verifica que agregaste las variables en el ambiente correcto
2. Redesplega después de agregar variables
3. Verifica que los nombres de las variables coinciden exactamente

---

## 📚 Referencias

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

