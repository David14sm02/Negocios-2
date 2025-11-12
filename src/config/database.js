const { Pool } = require('pg');

class Database {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            max: 20, // máximo de conexiones en el pool
            idleTimeoutMillis: 30000, // cerrar conexiones inactivas después de 30 segundos
            connectionTimeoutMillis: 10000, // timeout de conexión ampliado para entornos remotos
        });

        // Manejo de errores del pool
        this.pool.on('error', (err) => {
            console.error('❌ Error inesperado en el pool de conexiones:', err);
        });
    }

    // Probar conexión a la base de datos
    async testConnection() {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW()');
            console.log('📊 Conexión a PostgreSQL exitosa:', result.rows[0].now);
            client.release();
            return true;
        } catch (error) {
            console.error('❌ Error al conectar con PostgreSQL:', error.message);
            throw error;
        }
    }

    // Ejecutar query
    async query(text, params) {
        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            console.log('📝 Query ejecutada:', { text, duration, rows: result.rowCount });
            return result;
        } catch (error) {
            console.error('❌ Error en query:', { text, error: error.message });
            throw error;
        }
    }

    // Obtener cliente del pool
    async getClient() {
        return await this.pool.connect();
    }

    // Ejecutar transacción
    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Cerrar todas las conexiones
    async close() {
        await this.pool.end();
        console.log('🔒 Conexiones a la base de datos cerradas');
    }

    // Crear tablas si no existen
    async createTables() {
        try {
            console.log('🏗️ Creando tablas de la base de datos...');
            
            // Tabla de categorías
            await this.query(`
                CREATE TABLE IF NOT EXISTS categories (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    description TEXT,
                    parent_id INTEGER REFERENCES categories(id),
                    image_url VARCHAR(500),
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // Tabla de productos
            await this.query(`
                CREATE TABLE IF NOT EXISTS products (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
                    category_id INTEGER REFERENCES categories(id),
                    sku VARCHAR(100) UNIQUE NOT NULL,
                    stock INTEGER DEFAULT 0 CHECK (stock >= 0),
                    min_stock INTEGER DEFAULT 5,
                    image_url VARCHAR(500),
                    specifications JSONB,
                    features TEXT[],
                    tags TEXT[],
                    brand VARCHAR(100),
                    weight DECIMAL(8,2),
                    dimensions JSONB,
                    is_active BOOLEAN DEFAULT true,
                    is_featured BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // Tabla de usuarios/clientes
            await this.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255),
                    first_name VARCHAR(100),
                    last_name VARCHAR(100),
                    phone VARCHAR(20),
                    company VARCHAR(255),
                    address TEXT,
                    city VARCHAR(100),
                    state VARCHAR(100),
                    postal_code VARCHAR(20),
                    country VARCHAR(100),
                    is_active BOOLEAN DEFAULT true,
                    is_admin BOOLEAN DEFAULT false,
                    email_verified BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // Tabla de órdenes
            await this.query(`
                CREATE TABLE IF NOT EXISTS orders (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    order_number VARCHAR(50) UNIQUE NOT NULL,
                    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
                    total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
                    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
                    tax_amount DECIMAL(10,2) DEFAULT 0 CHECK (tax_amount >= 0),
                    shipping_amount DECIMAL(10,2) DEFAULT 0 CHECK (shipping_amount >= 0),
                    discount_amount DECIMAL(10,2) DEFAULT 0 CHECK (discount_amount >= 0),
                    shipping_address JSONB,
                    billing_address JSONB,
                    payment_method VARCHAR(50),
                    payment_status VARCHAR(50) DEFAULT 'pending',
                    stripe_payment_intent_id VARCHAR(255),
                    stripe_checkout_session_id VARCHAR(255),
                    stripe_customer_id VARCHAR(255),
                    currency VARCHAR(10) DEFAULT 'mxn',
                    amount_paid DECIMAL(10,2) CHECK (amount_paid >= 0),
                    amount_refunded DECIMAL(10,2) DEFAULT 0 CHECK (amount_refunded >= 0),
                    receipt_url VARCHAR(500),
                    payment_details JSONB DEFAULT '{}'::jsonb,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            await this.query(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255)
            `);

            await this.query(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255)
            `);

            await this.query(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)
            `);

            await this.query(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'mxn'
            `);

            await this.query(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) CHECK (amount_paid >= 0)
            `);

            await this.query(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_refunded DECIMAL(10,2) DEFAULT 0 CHECK (amount_refunded >= 0)
            `);

            await this.query(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_url VARCHAR(500)
            `);

            await this.query(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_details JSONB DEFAULT '{}'::jsonb
            `);

            // Tabla de detalles de órdenes
            await this.query(`
                CREATE TABLE IF NOT EXISTS order_items (
                    id SERIAL PRIMARY KEY,
                    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
                    product_id INTEGER REFERENCES products(id),
                    quantity INTEGER NOT NULL CHECK (quantity > 0),
                    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
                    total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS stripe_events (
                    id SERIAL PRIMARY KEY,
                    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
                    type VARCHAR(100) NOT NULL,
                    order_id INTEGER REFERENCES orders(id),
                    payload JSONB NOT NULL,
                    processed BOOLEAN DEFAULT false,
                    error TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    processed_at TIMESTAMP
                )
            `);

            // Tabla de carrito de compras (sesiones)
            await this.query(`
                CREATE TABLE IF NOT EXISTS cart_sessions (
                    id SERIAL PRIMARY KEY,
                    session_id VARCHAR(255) UNIQUE NOT NULL,
                    user_id INTEGER REFERENCES users(id),
                    items JSONB DEFAULT '[]',
                    total DECIMAL(10,2) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
                )
            `);

            // Tabla de blog/articles
            await this.query(`
                CREATE TABLE IF NOT EXISTS articles (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    slug VARCHAR(255) UNIQUE NOT NULL,
                    excerpt TEXT,
                    content TEXT NOT NULL,
                    author_id INTEGER REFERENCES users(id),
                    category VARCHAR(100),
                    tags TEXT[],
                    image_url VARCHAR(500),
                    is_published BOOLEAN DEFAULT false,
                    published_at TIMESTAMP,
                    views INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // Índices para mejorar rendimiento
            await this.query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON orders(stripe_payment_intent_id)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_orders_checkout_session ON orders(stripe_checkout_session_id)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_stripe_events_order ON stripe_events(order_id)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(type)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(is_published)`);

            // Tabla de logs de integración (Dolibarr, Stripe, etc.)
            await this.query(`
                CREATE TABLE IF NOT EXISTS integration_logs (
                    id SERIAL PRIMARY KEY,
                    source VARCHAR(50) NOT NULL DEFAULT 'dolibarr',
                    direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
                    reference VARCHAR(255),
                    action VARCHAR(100),
                    status VARCHAR(20) NOT NULL,
                    request_payload JSONB,
                    response_payload JSONB,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            await this.query(`CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON integration_logs(created_at DESC)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_integration_logs_source ON integration_logs(source)`);
            await this.query(`CREATE INDEX IF NOT EXISTS idx_integration_logs_status ON integration_logs(status)`);

            console.log('✅ Tablas creadas exitosamente');
        } catch (error) {
            console.error('❌ Error al crear tablas:', error);
            throw error;
        }
    }

    // Insertar datos iniciales
    async seedData() {
        try {
            console.log('🌱 Insertando datos iniciales...');

            // Insertar categorías
            const categories = [
                { name: 'Cables de Red', description: 'Cables de red para diferentes categorías y aplicaciones' },
                { name: 'Conectores', description: 'Conectores y terminales para instalaciones de red' },
                { name: 'Equipos de Red', description: 'Switches, routers y equipos de red' },
                { name: 'Herramientas', description: 'Herramientas profesionales para instalaciones' }
            ];

            for (const category of categories) {
                await this.query(
                    'INSERT INTO categories (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
                    [category.name, category.description]
                );
            }

            // Obtener IDs de categorías
            const categoryResults = await this.query('SELECT id, name FROM categories');
            const categoryMap = {};
            categoryResults.rows.forEach(row => {
                categoryMap[row.name] = row.id;
            });

            // Insertar productos de ejemplo
            const products = [
                {
                    name: 'Cable Cat6 UTP 305m',
                    description: 'Cable de red Cat6 UTP de 305 metros para instalaciones profesionales.',
                    price: 2500,
                    category_id: categoryMap['Cables de Red'],
                    sku: 'CAT6-305M',
                    stock: 50,
                    brand: 'NetTech',
                    specifications: JSON.stringify({
                        type: 'Cat6 UTP',
                        length: '305 metros',
                        conductor: 'Cobre sólido 23 AWG',
                        jacket: 'PVC',
                        frequency: '250 MHz',
                        speed: '1 Gbps',
                        color: 'Azul'
                    }),
                    features: ['Cumple estándares TIA/EIA-568-B.2-1', 'Conductor de cobre sólido 23 AWG', 'Cubierta PVC resistente'],
                    tags: ['cat6', 'cable', 'ethernet', '305m', 'utp'],
                    is_featured: true
                },
                {
                    name: 'Conectores RJ45 Cat6',
                    description: 'Conectores RJ45 para cable Cat6, paquete de 100 unidades.',
                    price: 150,
                    category_id: categoryMap['Conectores'],
                    sku: 'RJ45-CAT6',
                    stock: 200,
                    brand: 'NetTech',
                    specifications: JSON.stringify({
                        type: 'RJ45 Cat6',
                        quantity: '100 unidades',
                        compatibility: 'Cat6, Cat5e',
                        conductor: 'Hasta 23 AWG',
                        material: 'Plástico ABS',
                        termination: '8P8C'
                    }),
                    features: ['Compatible con cables Cat6 y Cat5e', 'Terminación 8P8C estándar', 'Material plástico ABS resistente'],
                    tags: ['rj45', 'conector', 'cat6', '100pcs'],
                    is_featured: true
                },
                {
                    name: 'Switch 24 Puertos Gigabit',
                    description: 'Switch de red 24 puertos Gigabit con gestión web.',
                    price: 3500,
                    category_id: categoryMap['Equipos de Red'],
                    sku: 'SW-24G',
                    stock: 15,
                    brand: 'NetTech',
                    specifications: JSON.stringify({
                        ports: '24 puertos Gigabit',
                        management: 'Web GUI',
                        switching: '48 Gbps',
                        mac: '8K MAC addresses',
                        power: '12V DC',
                        dimensions: '440 x 200 x 44 mm'
                    }),
                    features: ['24 puertos Gigabit Ethernet', 'Interfaz de gestión web', 'Auto MDI/MDIX', 'VLAN support'],
                    tags: ['switch', 'gigabit', '24puertos', 'managed'],
                    is_featured: true
                },
                {
                    name: 'Crimpeadora RJ45',
                    description: 'Herramienta crimpeadora profesional para conectores RJ45.',
                    price: 800,
                    category_id: categoryMap['Herramientas'],
                    sku: 'CRIMP-RJ45',
                    stock: 25,
                    brand: 'NetTech',
                    specifications: JSON.stringify({
                        type: 'Crimpeadora RJ45',
                        compatibility: 'RJ45, RJ11, RJ12',
                        material: 'Acero templado',
                        features: 'Cortador y pelacables integrado',
                        weight: '450g',
                        warranty: '2 años'
                    }),
                    features: ['Compatible con RJ45, RJ11, RJ12', 'Cortador de cable integrado', 'Pelacables automático'],
                    tags: ['crimpeadora', 'rj45', 'herramienta', 'profesional'],
                    is_featured: true
                },
                {
                    name: 'Cable Cat6a UTP 305m',
                    description: 'Cable de red Cat6a UTP de 305 metros para instalaciones de alta velocidad. Soporte para 10 Gigabit Ethernet.',
                    price: 3200,
                    category_id: categoryMap['Cables de Red'],
                    sku: 'CAT6A-305M',
                    stock: 30,
                    brand: 'NetTech',
                    specifications: JSON.stringify({
                        type: 'Cat6a UTP',
                        length: '305 metros',
                        conductor: 'Cobre sólido 23 AWG',
                        jacket: 'PVC LSZH',
                        frequency: '500 MHz',
                        speed: '10 Gbps',
                        color: 'Verde'
                    }),
                    features: ['Soporte para 10 Gigabit Ethernet', 'Frecuencia hasta 500 MHz', 'Cubierta LSZH retardante de llama', 'Ideal para centros de datos'],
                    tags: ['cat6a', 'cable', '10gb', 'ethernet', '305m'],
                    is_featured: true
                },
                {
                    name: 'Patch Panel 24 Puertos Cat6',
                    description: 'Patch panel de 24 puertos Cat6 con montaje en rack. Terminación IDC para fácil instalación.',
                    price: 1200,
                    category_id: categoryMap['Conectores'],
                    sku: 'PP-24-CAT6',
                    stock: 40,
                    brand: 'NetTech',
                    specifications: JSON.stringify({
                        ports: '24 puertos RJ45',
                        category: 'Cat6',
                        mounting: 'Rack 19"',
                        termination: 'IDC',
                        material: 'Metal',
                        height: '1U'
                    }),
                    features: ['24 puertos RJ45 Cat6', 'Montaje en rack 19 pulgadas', 'Terminación IDC', 'Construcción metálica robusta', 'Altura 1U'],
                    tags: ['patchpanel', '24puertos', 'cat6', 'rack'],
                    is_featured: true
                },
                {
                    name: 'Router WiFi 6 AX3000',
                    description: 'Router WiFi 6 con velocidad AX3000. Ideal para hogares y oficinas pequeñas con múltiples dispositivos.',
                    price: 2800,
                    category_id: categoryMap['Equipos de Red'],
                    sku: 'RT-WIFI6-AX3000',
                    stock: 20,
                    brand: 'NetTech',
                    specifications: JSON.stringify({
                        standard: 'WiFi 6 (802.11ax)',
                        speed: 'AX3000 (574 + 2402 Mbps)',
                        ports: '4 Gigabit LAN + 1 WAN',
                        antennas: '4 antenas externas',
                        security: 'WPA3',
                        usb: '1 puerto USB 3.0'
                    }),
                    features: ['WiFi 6 (802.11ax) AX3000', '4 puertos Gigabit Ethernet', '4 antenas externas de alta ganancia', 'Seguridad WPA3', 'Puerto USB 3.0'],
                    tags: ['router', 'wifi6', 'ax3000', 'gigabit'],
                    is_featured: true
                },
                {
                    name: 'Tester de Red RJ45',
                    description: 'Tester de red para cables RJ45 con indicadores LED. Detecta cortocircuitos, circuitos abiertos y cruces.',
                    price: 450,
                    category_id: categoryMap['Herramientas'],
                    sku: 'TEST-RJ45',
                    stock: 35,
                    brand: 'NetTech',
                    specifications: JSON.stringify({
                        type: 'Tester RJ45',
                        ports: '2 puertos RJ45',
                        indicators: '8 LEDs por puerto',
                        tests: 'Cortocircuito, abierto, cruzado',
                        power: 'Batería 9V',
                        range: 'Hasta 300m'
                    }),
                    features: ['Detección de cortocircuitos', 'Detección de circuitos abiertos', 'Detección de cables cruzados', 'Indicadores LED claros', 'Alcance hasta 300 metros'],
                    tags: ['tester', 'rj45', 'cable', 'diagnostico'],
                    is_featured: true
                }
            ];

            let insertedCount = 0;
            let skippedCount = 0;

            for (const product of products) {
                const result = await this.query(`
                    INSERT INTO products (name, description, price, category_id, sku, stock, brand, specifications, features, tags, is_featured)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (sku) DO NOTHING
                    RETURNING id
                `, [
                    product.name, product.description, product.price, product.category_id,
                    product.sku, product.stock, product.brand, product.specifications,
                    product.features, product.tags, product.is_featured
                ]);
                
                if (result.rows.length > 0) {
                    insertedCount++;
                } else {
                    skippedCount++;
                }
            }

            console.log(`✅ Datos iniciales procesados: ${insertedCount} insertados, ${skippedCount} ya existían`);
        } catch (error) {
            console.error('❌ Error al insertar datos iniciales:', error);
            throw error;
        }
    }
}

module.exports = new Database();
