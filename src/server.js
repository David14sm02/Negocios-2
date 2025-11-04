const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

// Importar rutas
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de seguridad
app.use(helmet());
app.use(compression());

// Configuración de CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // límite de 100 requests por ventana
    message: {
        error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
    }
});
app.use('/api/', limiter);

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Middleware para parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos desde public/
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath, {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.html': 'text/html',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject'
        };
        
        if (mimeTypes[ext]) {
            res.setHeader('Content-Type', mimeTypes[ext]);
        }
    }
}));
app.use('/css', express.static(path.join(publicPath, 'css'), {
    setHeaders: (res) => {
        res.setHeader('Content-Type', 'text/css');
    }
}));
app.use('/js', express.static(path.join(publicPath, 'js'), {
    setHeaders: (res) => {
        res.setHeader('Content-Type', 'application/javascript');
    }
}));
app.use('/data', express.static(path.join(publicPath, 'data'), {
    setHeaders: (res, filePath) => {
        if (path.extname(filePath) === '.json') {
            res.setHeader('Content-Type', 'application/json');
        }
    }
}));

// Rutas de la API
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);

// Ruta de salud del servidor
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});

// Rutas para servir páginas HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/catalog.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'catalog.html'));
});

app.get('/blog.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'blog.html'));
});

app.get('/about.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'about.html'));
});

app.get('/product-detail.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'product-detail.html'));
});

app.get('/test-cart', (req, res) => {
    res.sendFile(path.join(publicPath, 'test-cart.html'));
});

// Middleware de manejo de errores
app.use(notFound);
app.use(errorHandler);

// Función para iniciar el servidor
async function startServer() {
    try {
        // Probar conexión a la base de datos
        await db.testConnection();
        console.log('✅ Conexión a PostgreSQL establecida correctamente');
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
            console.log(`📱 Frontend disponible en: http://localhost:${PORT}`);
            console.log(`🔗 API disponible en: http://localhost:${PORT}/api`);
            console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
            console.log(`🛒 Carrito funcional con base de datos`);
        });
    } catch (error) {
        console.error('❌ Error al conectar con la base de datos:', error.message);
        console.log('🔄 Iniciando servidor sin base de datos (solo archivos estáticos)');
        
        // Iniciar servidor sin base de datos
        app.listen(PORT, () => {
            console.log(`🚀 Servidor ejecutándose en puerto ${PORT} (modo estático)`);
            console.log(`📱 Frontend disponible en: http://localhost:${PORT}`);
            console.log(`⚠️  Carrito funcionará con localStorage (sin persistencia)`);
        });
    }
}

// Manejo de señales de terminación (solo en desarrollo local)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    process.on('SIGTERM', async () => {
        console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
        await db.close();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
        await db.close();
        process.exit(0);
    });

    // Iniciar servidor solo si no estamos en Vercel
    startServer();
}

module.exports = app;
