# Manual Técnico - NetTech Solutions E-commerce

## 1. Introducción General

### Descripción del Proyecto
Sistema de e-commerce para NetTech Solutions especializado en productos de red y conectividad. El proyecto incluye un backend REST API desarrollado con Node.js y Express, un frontend estático, integración con Dolibarr ERP para gestión de inventario y clientes, y procesamiento de pagos mediante Stripe.

### Tecnologías Principales
- **Backend**: Node.js 16+, Express.js
- **Base de Datos**: PostgreSQL (Neon)
- **ERP**: Dolibarr (sincronización bidireccional)
- **Pagos**: Stripe
- **Despliegue**: Vercel
- **Autenticación**: JWT (JSON Web Tokens)

---

## 2. Arquitectura del Sistema

### Estructura de Carpetas
```
Negocios-2/
├── src/                    # Código fuente del backend
│   ├── config/            # Configuración (base de datos)
│   ├── middleware/        # Middlewares (auth, validación, errores)
│   ├── routes/            # Rutas de la API
│   ├── services/          # Servicios (Dolibarr, Stripe, Polling)
│   ├── utils/             # Utilidades
│   └── server.js          # Punto de entrada del servidor
├── public/                # Frontend estático (HTML, CSS, JS)
├── scripts/               # Scripts de utilidad y migraciones
├── api/                   # Funciones serverless para Vercel
│   └── cron/              # Cron jobs (sincronización automática)
├── config.env             # Variables de entorno (NO incluir en Git)
└── vercel.json            # Configuración de Vercel
```

### Flujo General de la Aplicación
1. **Cliente** → Frontend (HTML/JS) realiza solicitud
2. **Frontend** → API REST (Express) procesa la solicitud
3. **API** → Base de datos PostgreSQL (almacena/recupera datos)
4. **API** → Dolibarr (sincroniza productos, órdenes, clientes)
5. **API** → Stripe (procesa pagos)
6. **API** → Respuesta JSON al frontend

---

## 3. Configuración e Instalación

### Requisitos Previos
- Node.js >= 16.0.0
- PostgreSQL (Neon o equivalente)
- Cuenta en Dolibarr ERP
- Cuenta en Stripe
- Cuenta en Vercel (para despliegue)

### Variables de Entorno (`config.env`)
```env
# Servidor
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Base de Datos
DATABASE_URL=postgresql://usuario:password@host/neondb?sslmode=require
DB_SSL=true

# Seguridad
JWT_SECRET=clave_secreta_muy_segura

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=http://localhost:3000/checkout/success
STRIPE_CANCEL_URL=http://localhost:3000/checkout/cancel

# Dolibarr
DOLIBARR_ENABLED=true
DOLIBARR_URL=https://tuinstancia.dolibarr
DOLIBARR_API_KEY=tu_api_key (o DOLIBARR_API_USER + DOLIBARR_API_PASSWORD)
DOLIBARR_AUTO_SYNC=true
DOLIBARR_DEFAULT_WAREHOUSE_ID=1
DOLIBARR_POLLING_ENABLED=true
DOLIBARR_POLLING_INTERVAL=15
```

### Instalación
```bash
# Instalar dependencias
npm install

# Copiar archivo de configuración
cp config.env.example config.env
# Editar config.env con tus valores

# Inicializar base de datos (crea tablas y datos de ejemplo)
node scripts/init-db.js

# Ejecutar en desarrollo
npm run dev
# o
npm start
```

---

## 4. Integraciones Principales

### 4.1 Dolibarr ERP

#### Sincronización Bidireccional
- **E-commerce → Dolibarr**: Productos, órdenes y clientes se sincronizan automáticamente
- **Dolibarr → E-commerce**: Sincronización mediante polling automático cada 15 minutos
- **Campos de sincronización en BD**: `dolibarr_id`, `dolibarr_synced_at`, `sync_direction`, `last_sync_source`

#### Polling Automático
- Se ejecuta cada 15 minutos mediante cron job en Vercel
- Endpoint: `/api/cron/sync-dolibarr`
- Configuración en `vercel.json`:
  ```json
  "crons": [{
    "path": "/api/cron/sync-dolibarr",
    "schedule": "*/15 * * * *"
  }]
  ```

#### Webhooks (Opcional)
- Endpoint: `POST /api/dolibarr/webhook`
- Permite sincronización en tiempo real cuando hay cambios en Dolibarr
- Configurar en Dolibarr con URL del webhook

#### Métodos Principales del Servicio
- `syncProduct()`: Sincroniza producto desde e-commerce a Dolibarr
- `syncProductFromDolibarr()`: Sincroniza producto desde Dolibarr al e-commerce
- `syncOrder()`: Sincroniza orden con Dolibarr
- `syncCustomer()`: Sincroniza cliente con Dolibarr
- `syncStockFromDolibarr()`: Actualiza stock desde Dolibarr

### 4.2 Stripe

#### Funcionalidades
- Procesamiento de pagos mediante Stripe Checkout
- Webhooks para actualizar estado de órdenes
- Manejo de reembolsos y cancelaciones

#### Endpoints Importantes
- `POST /api/payments/create-checkout-session`: Crea sesión de pago
- `POST /webhooks/stripe`: Webhook de Stripe (requiere verificación de firma)

---

## 5. Base de Datos

### Tablas Principales

#### `products`
- Información de productos del catálogo
- Campos importantes: `id`, `name`, `sku`, `price`, `stock`, `dolibarr_id`, `sync_direction`
- Relación con `categories`

#### `orders`
- Órdenes de compra
- Campos importantes: `id`, `order_number`, `user_id`, `status`, `total`, `stripe_payment_intent_id`
- Relación con `order_items` y `users`

#### `users`
- Usuarios/clientes del sistema
- Campos: `id`, `email`, `password_hash`, información de contacto

#### `order_items`
- Detalles de productos en cada orden
- Relación con `orders` y `products`

#### `integration_logs`
- Logs de todas las operaciones con Dolibarr
- Campos: `source`, `direction` (inbound/outbound), `action`, `status`, `reference`

### Sincronización con Dolibarr
- Los productos tienen campos `dolibarr_id`, `dolibarr_synced_at`, `sync_direction` y `last_sync_source`
- `sync_direction` puede ser: `'inbound'`, `'outbound'`, `'bidirectional'`
- `last_sync_source` indica si el último cambio fue `'ecommerce'` o `'dolibarr'`

---

## 6. Despliegue

### Configuración en Vercel

#### Variables de Entorno en Vercel
Configurar todas las variables de `config.env` en el dashboard de Vercel:
- `DATABASE_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `DOLIBARR_URL`, `DOLIBARR_API_KEY`
- `JWT_SECRET`
- Y todas las demás variables necesarias

#### Configuración de Cron Jobs
El archivo `vercel.json` define:
- Cron job para sincronización automática cada 15 minutos
- Rutas de la API
- Build configuration

#### Build y Deploy
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Verificación Post-Deploy
1. Verificar health check: `GET /api/health`
2. Probar conexión con Dolibarr: `GET /api/dolibarr/test`
3. Verificar que el cron job se ejecute correctamente

---

## 7. Endpoints Principales de la API

### Productos
- `GET /api/products` - Listar productos
- `GET /api/products/:id` - Obtener producto
- `POST /api/products` - Crear producto (admin)
- `PUT /api/products/:id` - Actualizar producto (admin)

### Carrito
- `GET /api/cart/:sessionId` - Obtener carrito
- `POST /api/cart/:sessionId/items` - Agregar item
- `DELETE /api/cart/:sessionId/items/:itemId` - Eliminar item

### Órdenes
- `POST /api/orders` - Crear orden (requiere autenticación)
- `GET /api/orders` - Listar órdenes del usuario
- `GET /api/orders/:id` - Obtener orden específica

### Usuarios
- `POST /api/users/register` - Registrar usuario
- `POST /api/users/login` - Iniciar sesión
- `GET /api/users/profile` - Obtener perfil (requiere autenticación)

### Dolibarr
- `GET /api/dolibarr/test` - Probar conexión con Dolibarr
- `POST /api/dolibarr/sync/product/:productId` - Sincronizar producto
- `POST /api/dolibarr/sync/order/:orderId` - Sincronizar orden
- `POST /api/dolibarr/sync/from-dolibarr/all` - Sincronización masiva (admin)
- `POST /api/dolibarr/webhook` - Webhook de Dolibarr

### Pagos
- `POST /api/payments/create-checkout-session` - Crear sesión de pago
- `POST /webhooks/stripe` - Webhook de Stripe

---

## 8. Seguridad

### Autenticación
- **JWT Tokens**: Los usuarios autenticados reciben un token JWT
- **Middleware**: `authenticateToken` verifica tokens en rutas protegidas
- **Admin**: Middleware `requireAdmin` para rutas de administración

### Rate Limiting
- Límite de 100 requests por 15 minutos por IP
- Configurado mediante `express-rate-limit`
- Aplicado a todas las rutas `/api/*`

### Variables de Entorno
- **NUNCA** commitear `config.env` al repositorio
- Usar `config.env.example` como plantilla
- En producción, usar variables de entorno de Vercel

### Validación
- Middleware `express-validator` para validar datos de entrada
- Validación en rutas de creación/actualización de productos y órdenes

---

## 9. Mantenimiento y Troubleshooting

### Comandos Útiles

```bash
# Inicializar base de datos
node scripts/init-db.js

# Ejecutar migraciones
node scripts/run-migration.js

# Sincronizar todos los productos con Dolibarr
node scripts/sync-all-products-to-dolibarr.js

# Sincronizar desde Dolibarr
node scripts/sync-from-dolibarr-polling.js

# Verificar estado de sincronización
node scripts/verificar-estado-sincronizacion.js

# Probar conexión con Dolibarr
node test-dolibarr.js
```

### Verificación de Estado

#### Health Check
```bash
curl http://localhost:3000/api/health
```

#### Verificar Conexión con Dolibarr
```bash
curl http://localhost:3000/api/dolibarr/test
```

#### Ver Logs de Integración
```sql
SELECT * FROM integration_logs 
WHERE status = 'error' 
ORDER BY created_at DESC 
LIMIT 20;
```

### Problemas Comunes

#### Productos no se sincronizan con Dolibarr
1. Verificar que `DOLIBARR_ENABLED=true`
2. Verificar credenciales (`DOLIBARR_API_KEY` o `DOLIBARR_API_USER`/`DOLIBARR_API_PASSWORD`)
3. Verificar que `DOLIBARR_URL` sea correcta
4. Revisar logs: `SELECT * FROM integration_logs WHERE status = 'error'`

#### Cron job no se ejecuta en Vercel
1. Verificar que la ruta `/api/cron/sync-dolibarr` existe y está configurada en `vercel.json`
2. Verificar logs en Vercel Dashboard → Functions
3. Verificar variables de entorno en Vercel

#### Base de datos no conecta
1. Verificar `DATABASE_URL` en variables de entorno
2. Verificar `DB_SSL=true` si el proveedor requiere SSL
3. Verificar que la base de datos esté activa (Neon puede pausarse)

#### Pagos con Stripe fallan
1. Verificar `STRIPE_SECRET_KEY` (usar `sk_test_` para desarrollo, `sk_live_` para producción)
2. Verificar `STRIPE_WEBHOOK_SECRET` si se usan webhooks
3. Verificar URLs de éxito y cancelación en Stripe Dashboard

### Scripts de Diagnóstico

- `scripts/diagnostico-producto-test11.js` - Diagnóstico de producto específico
- `scripts/diagnostico-sync-ecommerce-dolibarr.js` - Diagnóstico de sincronización
- `scripts/check-status.js` - Verificar estado general del sistema
