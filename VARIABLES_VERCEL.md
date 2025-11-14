# Variables de Entorno para Vercel - Lista Rápida

## 🚀 Variables NUEVAS que DEBES Agregar en Vercel

Agrega estas 3 variables en el dashboard de Vercel:

```env
DOLIBARR_POLLING_ENABLED=true
DOLIBARR_POLLING_INTERVAL=15
DOLIBARR_POLLING_RUN_ON_START=true
DOLIBARR_WEBHOOK_SECRET=NetTechSolutions_Webhook_Secret_2024_SecureKey123
```

---

## 📋 Cómo Agregarlas en Vercel

1. Ve a tu proyecto en Vercel
2. **Settings** → **Environment Variables**
3. Agrega cada variable:
   - **Key:** `DOLIBARR_POLLING_ENABLED`
   - **Value:** `true`
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development
4. Repite para las otras 3 variables

---

## ⚠️ IMPORTANTE: Vercel usa Cron Jobs

En Vercel, el polling automático funciona diferente:

- ✅ **Local:** Polling automático cada 15 minutos
- ✅ **Vercel:** Cron Job cada 15 minutos (configurado en `vercel.json`)

**No necesitas hacer nada extra**, el `vercel.json` ya está configurado.

---

## ✅ Después de Agregar Variables

1. **Redesplegar:**
   - Ve a **Deployments**
   - Click en **Redeploy** del último deployment

2. **Verificar:**
   - Los logs deberían mostrar que el cron job está activo
   - Cada 15 minutos se ejecutará automáticamente

---

## 🔍 Verificar que Funciona

Después del deploy, crea un producto en Dolibarr y espera máximo 15 minutos. Debería aparecer automáticamente en el e-commerce.

