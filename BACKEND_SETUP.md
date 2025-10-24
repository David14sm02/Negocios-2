# NetTech Solutions - E-commerce Backend

## 🚀 Instrucciones de Instalación y Ejecución

### Prerrequisitos
- Node.js 16+ instalado
- PostgreSQL (usando Neon como servicio)
- Navegador web moderno

### 1. Instalación de Dependencias

```bash
# Instalar dependencias de Node.js
npm install
```

### 2. Configuración de Variables de Entorno

Copia el archivo `config.env` y renómbralo a `.env`:

```bash
cp config.env .env
```

Edita el archivo `.env` con tus configuraciones específicas:

```env
# Puerto del servidor
PORT=3000

# Base de datos PostgreSQL (Neon)
DATABASE_URL=postgresql://neondb_owner:npg_DNUSnM51lqBR@ep-soft-butterfly-ah5h4527-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# JWT Secret (cambiar en producción)
JWT_SECRET=tu_jwt_secret_super_seguro_aqui_cambiar_en_produccion
```

### 3. Inicialización de la Base de Datos

```bash
# Crear tablas y datos iniciales
node scripts/init-db.js
```

Este comando:
- ✅ Prueba la conexión con PostgreSQL
- ✅ Crea todas las tablas necesarias
- ✅ Inserta datos iniciales (categorías y productos)
- ✅ Crea índices para optimizar consultas

### 4. Ejecutar el Servidor

#### Modo Desarrollo (con recarga automática)
```bash
npm run dev
```

#### Modo Producción
```bash
npm start
```

### 5. Verificar la Instalación

Una vez ejecutado el servidor, verifica que todo funcione:

1. **Servidor**: http://localhost:3000
2. **API Health Check**: http://localhost:3000/api/health
3. **Productos**: http://localhost:3000/api/products
4. **Categorías**: http://localhost:3000/api/products/categories/list

## 📊 Estructura de la Base de Datos

### Tablas Principales

- **`categories`** - Categorías de productos
- **`products`** - Catálogo de productos
- **`users`** - Usuarios/clientes
- **`orders`** - Órdenes de compra
- **`order_items`** - Detalles de órdenes
- **`cart_sessions`** - Sesiones de carrito
- **`articles`** - Artículos del blog

### Datos Iniciales

El script de inicialización crea:

- **4 categorías**: Cables de Red, Conectores, Equipos de Red, Herramientas
- **4 productos de ejemplo** con especificaciones completas
- **Índices optimizados** para consultas rápidas

## 🔗 Endpoints de la API

### Productos
- `GET /api/products` - Listar productos con filtros
- `GET /api/products/:id` - Obtener producto específico
- `GET /api/products/category/:id` - Productos por categoría
- `GET /api/products/featured/list` - Productos destacados
- `GET /api/products/categories/list` - Listar categorías

### Carrito
- `GET /api/cart` - Obtener carrito
- `POST /api/cart/add` - Agregar producto
- `PUT /api/cart/update` - Actualizar cantidad
- `DELETE /api/cart/remove/:id` - Remover producto
- `DELETE /api/cart/clear` - Limpiar carrito

### Usuarios
- `POST /api/users/register` - Registrar usuario
- `POST /api/users/login` - Iniciar sesión
- `GET /api/users/profile` - Obtener perfil
- `PUT /api/users/profile` - Actualizar perfil
- `GET /api/users/orders` - Órdenes del usuario

### Órdenes
- `POST /api/orders` - Crear orden
- `GET /api/orders` - Listar órdenes del usuario
- `GET /api/orders/:id` - Obtener orden específica
- `PUT /api/orders/:id/cancel` - Cancelar orden

## 🛠️ Comandos Útiles

```bash
# Ver logs en tiempo real
npm run dev

# Ejecutar tests (cuando estén implementados)
npm test

# Reinicializar base de datos
node scripts/init-db.js

# Verificar conexión a la base de datos
node -e "require('./config/database').testConnection()"
```

## 🔧 Solución de Problemas

### Error de Conexión a PostgreSQL
```bash
# Verificar que la URL de conexión sea correcta
echo $DATABASE_URL

# Probar conexión manual
psql "postgresql://neondb_owner:npg_DNUSnM51lqBR@ep-soft-butterfly-ah5h4527-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

### Puerto en Uso
```bash
# Cambiar puerto en .env
PORT=3001

# O matar proceso que usa el puerto
lsof -ti:3000 | xargs kill -9
```

### Problemas con Dependencias
```bash
# Limpiar cache y reinstalar
rm -rf node_modules package-lock.json
npm install
```

## 📱 Frontend

El frontend está integrado y se sirve desde el mismo servidor:

- **Página principal**: http://localhost:3000
- **Catálogo**: http://localhost:3000/catalog.html
- **Blog**: http://localhost:3000/blog.html
- **Acerca de**: http://localhost:3000/about.html

## 🔐 Autenticación

El sistema incluye autenticación JWT:

1. **Registro**: `POST /api/users/register`
2. **Login**: `POST /api/users/login`
3. **Token**: Se almacena en localStorage
4. **Headers**: `Authorization: Bearer <token>`

## 📈 Próximos Pasos

1. **Integración con Dolibarr ERP**
2. **Sistema de pagos**
3. **Notificaciones por email**
4. **Panel de administración**
5. **Analytics y reportes**

## 🆘 Soporte

Si encuentras problemas:

1. Verifica los logs del servidor
2. Revisa la conexión a la base de datos
3. Confirma que todas las dependencias estén instaladas
4. Consulta la documentación de la API

---

¡El e-commerce está listo para usar! 🎉
