/**
 * Servicio para integrar con Dolibarr ERP
 * Maneja la comunicación con la API REST de Dolibarr
 */

const axios = require('axios');

class DolibarrService {
    constructor() {
        this.baseURL = process.env.DOLIBARR_URL || '';
        this.apiKey = process.env.DOLIBARR_API_KEY || '';
        this.apiSecret = process.env.DOLIBARR_API_SECRET || '';
        this.apiUser = process.env.DOLIBARR_API_USER || '';
        this.apiPassword = process.env.DOLIBARR_API_PASSWORD || '';
        
        if (!this.baseURL) {
            console.warn('⚠️ DOLIBARR_URL no está configurada en las variables de entorno');
        }
        
        // Soporta API Key o usuario/contraseña
        if (!this.apiKey && !this.apiUser) {
            console.warn('⚠️ DOLIBARR_API_KEY o DOLIBARR_API_USER no están configuradas');
        }
    }

    /**
     * Obtener headers para las peticiones a la API de Dolibarr
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Si hay API Key, usarla
        if (this.apiKey) {
            headers['DOLAPIKEY'] = this.apiKey;
            if (this.apiSecret) {
                headers['DOLAPISECRET'] = this.apiSecret;
            }
        }
        
        return headers;
    }
    
    /**
     * Obtener configuración de autenticación para axios
     */
    getAuthConfig() {
        // Si hay usuario y contraseña, usar HTTP Basic Auth
        if (this.apiUser && this.apiPassword) {
            return {
                auth: {
                    username: this.apiUser,
                    password: this.apiPassword
                }
            };
        }
        return {};
    }

    /**
     * Obtener token de API de Dolibarr
     */
    async getApiToken() {
        if (!this.baseURL || !this.apiUser || !this.apiPassword) {
            return null;
        }

        try {
            // Dolibarr requiere obtener el token primero desde el endpoint /login
            const loginUrl = `${this.baseURL}/api/index.php/login?login=${encodeURIComponent(this.apiUser)}&password=${encodeURIComponent(this.apiPassword)}`;
            const response = await axios.get(loginUrl);
            
            // El token viene en response.data.success.token según la respuesta del test
            if (response.data && response.data.success && response.data.success.token) {
                return response.data.success.token;
            }
            
            // También puede venir directamente en response.data.token
            if (response.data && response.data.token) {
                return response.data.token;
            }
            
            return null;
        } catch (error) {
            console.error('⚠️ Error obteniendo token de Dolibarr:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Hacer petición a la API de Dolibarr
     */
    async request(method, endpoint, data = null) {
        if (!this.baseURL) {
            throw new Error('DOLIBARR_URL no está configurada en config.env');
        }
        
        if (!this.apiKey && !this.apiUser) {
            throw new Error('Configura DOLIBARR_API_KEY o DOLIBARR_API_USER y DOLIBARR_API_PASSWORD en config.env');
        }

        const url = `${this.baseURL}/api/index.php${endpoint}`;
        
        try {
            let apiToken = this.apiKey;
            
            // Si no hay API Key, intentar obtener token con usuario/contraseña
            if (!apiToken && this.apiUser && this.apiPassword) {
                apiToken = await this.getApiToken();
                if (!apiToken) {
                    // Si no se puede obtener token, intentar autenticación básica HTTP
                    console.log('⚠️ No se pudo obtener token, intentando autenticación básica...');
                }
            }
            
            const config = {
                method,
                url,
                headers: {
                    'Content-Type': 'application/json'
                },
                ...(data && { data })
            };
            
            // Agregar autenticación
            if (apiToken) {
                // Usar token en header DOLAPIKEY
                config.headers['DOLAPIKEY'] = apiToken;
            } else if (this.apiUser && this.apiPassword) {
                // Usar autenticación básica HTTP como fallback
                config.auth = {
                    username: this.apiUser,
                    password: this.apiPassword
                };
            }

            const response = await axios(config);
            return response.data;
        } catch (error) {
            console.error('❌ Error en petición a Dolibarr:', error.response?.data || error.message);
            if (error.response?.status === 401) {
                throw new Error('Error de autenticación. Verifica tus credenciales. El usuario debe tener permisos para usar la API.');
            }
            throw error;
        }
    }

    /**
     * Verificar conexión con Dolibarr
     */
    async testConnection() {
        try {
            // Intentar con /status o /explorer para verificar conexión
            const response = await this.request('GET', '/explorer');
            return {
                success: true,
                message: 'Conexión exitosa con Dolibarr API',
                data: response
            };
        } catch (error) {
            // Si /explorer falla, intentar con /status
            try {
                const statusResponse = await this.request('GET', '/status');
                return {
                    success: true,
                    message: 'Conexión exitosa con Dolibarr API',
                    data: statusResponse
                };
            } catch (statusError) {
                return {
                    success: false,
                    error: error.message || statusError.message,
                    details: error.response?.data || statusError.response?.data
                };
            }
        }
    }

    /**
     * Sincronizar cliente desde e-commerce a Dolibarr
     * @param {Object} userData - Datos del usuario del e-commerce
     */
    async syncCustomer(userData) {
        try {
            // Buscar si el cliente ya existe en Dolibarr por email
            const existingCustomers = await this.request('GET', `/thirdparties?email=${userData.email}`);
            
            let customerId = null;
            
            if (existingCustomers && existingCustomers.length > 0) {
                // Cliente existe, actualizar
                customerId = existingCustomers[0].id;
                const updateData = {
                    name: userData.company || `${userData.first_name} ${userData.last_name}`,
                    firstname: userData.first_name,
                    lastname: userData.last_name,
                    email: userData.email,
                    phone: userData.phone,
                    address: userData.address,
                    zip: userData.postal_code,
                    town: userData.city,
                    state: userData.state,
                    country: userData.country,
                    client: 1, // Es cliente
                    prospect: 0
                };
                
                await this.request('PUT', `/thirdparties/${customerId}`, updateData);
                console.log(`✅ Cliente actualizado en Dolibarr: ${customerId}`);
            } else {
                // Cliente no existe, crear nuevo
                const createData = {
                    name: userData.company || `${userData.first_name} ${userData.last_name}`,
                    firstname: userData.first_name,
                    lastname: userData.last_name,
                    email: userData.email,
                    phone: userData.phone,
                    address: userData.address,
                    zip: userData.postal_code,
                    town: userData.city,
                    state: userData.state,
                    country: userData.country || 'MX',
                    client: 1, // Es cliente
                    prospect: 0,
                    status: 1 // Activo
                };
                
                const result = await this.request('POST', '/thirdparties', createData);
                customerId = result.id;
                console.log(`✅ Cliente creado en Dolibarr: ${customerId}`);
            }
            
            return {
                success: true,
                dolibarr_id: customerId
            };
        } catch (error) {
            console.error('❌ Error sincronizando cliente con Dolibarr:', error);
            throw error;
        }
    }

    /**
     * Sincronizar producto desde e-commerce a Dolibarr
     * @param {Object} productData - Datos del producto del e-commerce
     */
    async syncProduct(productData) {
        try {
            // Obtener todos los productos y buscar por referencia (ref/SKU)
            // La API de Dolibarr no siempre soporta búsqueda directa por ref en query params
            let existingProduct = null;
            try {
                // Intentar obtener todos los productos
                const allProducts = await this.request('GET', '/products');
                
                // Filtrar por referencia (ref) o barcode
                if (Array.isArray(allProducts) && allProducts.length > 0) {
                    existingProduct = allProducts.find(
                        p => p.ref === productData.sku || p.barcode === productData.sku
                    );
                }
            } catch (searchError) {
                // Si falla obtener todos, intentar búsqueda directa por ID o ref
                console.warn(`⚠️ No se pudo buscar productos existentes, intentando crear nuevo: ${searchError.message}`);
            }
            
            let productId = null;
            
            if (existingProduct) {
                // Producto existe, actualizar (sin stock_reel, se actualiza por separado)
                productId = existingProduct.id;
                const updateData = {
                    label: productData.name,
                    description: productData.description,
                    price: productData.price,
                    ref: productData.sku,
                    barcode: productData.sku,
                    // NO incluir stock_reel aquí - Dolibarr no lo permite
                    tosell: 1, // Disponible para venta
                    tobuy: 0,
                    status: productData.is_active ? 1 : 0
                };
                
                await this.request('PUT', `/products/${productId}`, updateData);
                console.log(`✅ Producto actualizado en Dolibarr: ${productId} (${productData.name})`);
            } else {
                // Producto no existe, crear nuevo (sin stock_reel inicial)
                const createData = {
                    label: productData.name,
                    description: productData.description,
                    price: productData.price,
                    ref: productData.sku,
                    barcode: productData.sku,
                    // NO incluir stock_reel aquí - se actualiza después
                    tosell: 1, // Disponible para venta
                    tobuy: 0,
                    status: productData.is_active ? 1 : 0,
                    type: 0 // Producto físico (0 = producto, 1 = servicio)
                };
                
                const result = await this.request('POST', '/products', createData);
                // El resultado puede ser el objeto completo o solo {id: X}
                productId = result.id || result;
                console.log(`✅ Producto creado en Dolibarr: ${productId} (${productData.name})`);
            }
            
            // Actualizar stock - Comentado temporalmente debido a problemas con la API de stockmovements
            // El stock se puede actualizar manualmente desde la interfaz de Dolibarr
            // O configurar después cuando se tenga acceso al endpoint correcto de stock
            if (productData.stock && productData.stock > 0) {
                console.log(`ℹ️ Stock del producto: ${productData.stock} unidades (actualizar manualmente en Dolibarr si es necesario)`);
            }
            
            return {
                success: true,
                dolibarr_id: productId
            };
        } catch (error) {
            console.error('❌ Error sincronizando producto con Dolibarr:', error);
            throw error;
        }
    }

    /**
     * Actualizar stock de un producto en Dolibarr
     * @param {String} sku - SKU del producto
     * @param {Number} newStock - Nuevo valor de stock (no diferencia, sino valor absoluto)
     */
    async updateProductStock(sku, newStock) {
        try {
            // Buscar el producto en Dolibarr
            const allProducts = await this.request('GET', '/products');
            let product = null;
            
            if (Array.isArray(allProducts) && allProducts.length > 0) {
                product = allProducts.find(p => p.ref === sku || p.barcode === sku);
            }
            
            if (!product) {
                console.warn(`⚠️ Producto con SKU ${sku} no encontrado en Dolibarr para actualizar stock`);
                return false;
            }
            
            // Obtener información completa del producto
            const productInfo = await this.request('GET', `/products/${product.id}`);
            const currentStock = productInfo.stock_reel || 0;
            const stockDifference = newStock - currentStock;
            
            if (stockDifference === 0) {
                // El stock ya está actualizado
                return true;
            }
            
            // Intentar actualizar usando el endpoint de productos (algunas versiones de Dolibarr lo permiten)
            // Si no funciona, el stock se mantendrá desincronizado y deberá actualizarse manualmente
            try {
                // Algunas APIs de Dolibarr permiten actualizar stock_reel directamente
                await this.request('PUT', `/products/${product.id}`, {
                    stock_reel: newStock
                });
                console.log(`✅ Stock actualizado en Dolibarr para ${sku}: ${currentStock} → ${newStock}`);
                return true;
            } catch (updateError) {
                // Si no se puede actualizar directamente, solo informar
                console.warn(`⚠️ No se pudo actualizar stock en Dolibarr para ${sku}. Stock local: ${newStock}, Stock Dolibarr: ${currentStock}`);
                console.warn(`   Actualiza manualmente el stock en Dolibarr o configura movimientos de stock`);
                return false;
            }
        } catch (error) {
            console.error(`❌ Error actualizando stock en Dolibarr para SKU ${sku}:`, error.message);
            return false;
        }
    }

    /**
     * Sincronizar orden desde e-commerce a Dolibarr
     * @param {Object} orderData - Datos de la orden del e-commerce
     * @param {Object} db - Instancia de la base de datos (opcional)
     */
    async syncOrder(orderData, db = null) {
        try {
            if (!db) {
                db = require('../config/database');
            }
            
            // Primero, asegurar que el cliente existe en Dolibarr
            const userResult = await db.query('SELECT * FROM users WHERE id = $1', [orderData.user_id]);
            if (userResult.rows.length === 0) {
                throw new Error('Usuario no encontrado');
            }
            
            const user = userResult.rows[0];
            const customerSync = await this.syncCustomer(user);
            const customerId = customerSync.dolibarr_id;
            
            // Crear pedido en Dolibarr
            const orderItems = [];
            for (const item of orderData.items) {
                // Sincronizar producto si es necesario
                const productResult = await db.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
                if (productResult.rows.length > 0) {
                    const product = productResult.rows[0];
                    await this.syncProduct(product);
                    
                    // Actualizar stock en Dolibarr después de la venta
                    // El stock ya fue actualizado en la BD local, ahora sincronizamos con Dolibarr
                    await this.updateProductStock(item.product_sku, product.stock);
                }
                
                orderItems.push({
                    desc: item.product_name,
                    qty: item.quantity,
                    subprice: item.price,
                    tva_tx: 16, // IVA 16%
                    ref: item.product_sku
                });
            }
            
            const orderDataDolibarr = {
                socid: customerId,
                date: new Date(orderData.created_at).toISOString().split('T')[0],
                lines: orderItems,
                note_public: orderData.notes || '',
                ref: orderData.order_number
            };
            
            const result = await this.request('POST', '/orders', orderDataDolibarr);
            console.log(`✅ Orden sincronizada con Dolibarr: ${result.id}`);
            
            return {
                success: true,
                dolibarr_id: result.id
            };
        } catch (error) {
            console.error('❌ Error sincronizando orden con Dolibarr:', error);
            throw error;
        }
    }

    /**
     * Sincronizar cancelación de orden y restaurar stock en Dolibarr
     * @param {Object} orderData - Datos de la orden cancelada
     * @param {Object} db - Instancia de la base de datos (opcional)
     */
    async syncOrderCancellation(orderData, db = null) {
        try {
            if (!db) {
                db = require('../config/database');
            }
            
            // Para cada producto en la orden, restaurar el stock en Dolibarr
            for (const item of orderData.items) {
                // Usar el stock actual si está disponible en los datos, sino obtenerlo de la BD
                let currentStock = item.current_stock;
                if (currentStock === null || currentStock === undefined) {
                    const productResult = await db.query('SELECT stock FROM products WHERE id = $1', [item.product_id]);
                    if (productResult.rows.length > 0) {
                        currentStock = productResult.rows[0].stock;
                    }
                }
                
                if (currentStock !== null && currentStock !== undefined) {
                    // El stock ya fue restaurado en la BD local, ahora sincronizamos con Dolibarr
                    await this.updateProductStock(item.product_sku, currentStock);
                }
            }
            
            console.log(`✅ Stock restaurado en Dolibarr para orden cancelada`);
            return {
                success: true
            };
        } catch (error) {
            console.error('❌ Error sincronizando cancelación de orden con Dolibarr:', error);
            throw error;
        }
    }

    /**
     * Obtener productos de Dolibarr
     */
    async getProducts() {
        try {
            const response = await this.request('GET', '/products');
            // La respuesta puede ser un array directamente o un objeto con una propiedad
            let products = response;
            if (response && !Array.isArray(response)) {
                // Si es un objeto, intentar obtener el array de productos
                products = response.products || response.data || [];
            }
            return {
                success: true,
                data: Array.isArray(products) ? products : []
            };
        } catch (error) {
            console.error('❌ Error obteniendo productos de Dolibarr:', error);
            throw error;
        }
    }

    /**
     * Obtener clientes de Dolibarr
     */
    async getCustomers() {
        try {
            const customers = await this.request('GET', '/thirdparties');
            return {
                success: true,
                data: customers
            };
        } catch (error) {
            console.error('❌ Error obteniendo clientes de Dolibarr:', error);
            throw error;
        }
    }

    /**
     * Obtener órdenes de Dolibarr
     */
    async getOrders() {
        try {
            const orders = await this.request('GET', '/orders');
            return {
                success: true,
                data: orders
            };
        } catch (error) {
            console.error('❌ Error obteniendo órdenes de Dolibarr:', error);
            throw error;
        }
    }
}

module.exports = new DolibarrService();

