/**
 * Servicio para integrar con Dolibarr ERP
 * Maneja la comunicación con la API REST de Dolibarr
 */

const axios = require('axios');
const { logIntegrationEvent } = require('../utils/integrationLogger');

class DolibarrService {
    constructor() {
        this.enabled = (process.env.DOLIBARR_ENABLED || 'true').toString().toLowerCase() !== 'false';
        this.baseURL = process.env.DOLIBARR_URL || '';
        this.apiKey = process.env.DOLIBARR_API_KEY || '';
        this.apiSecret = process.env.DOLIBARR_API_SECRET || '';
        this.apiUser = process.env.DOLIBARR_API_USER || '';
        this.apiPassword = process.env.DOLIBARR_API_PASSWORD || '';
        this.defaultWarehouseId = Number(process.env.DOLIBARR_DEFAULT_WAREHOUSE_ID) || null;

        if (!this.enabled) {
            console.info('ℹ️ Integración con Dolibarr deshabilitada (DOLIBARR_ENABLED=false)');
            return;
        }

        if (!this.baseURL) {
            throw new Error('DOLIBARR_URL no está configurada en config.env');
        }

        if (!this.apiKey && !(this.apiUser && this.apiPassword)) {
            throw new Error('Debes configurar DOLIBARR_API_KEY o DOLIBARR_API_USER y DOLIBARR_API_PASSWORD en config.env');
        }

        if (!this.defaultWarehouseId) {
            console.warn('⚠️ DOLIBARR_DEFAULT_WAREHOUSE_ID no está configurada. Los movimientos de inventario pueden fallar.');
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
    async request(method, endpoint, data = null, options = {}) {
        const {
            allow404 = false,
            mark404As = 'warning',
            reference = null
        } = options;

        if (!this.enabled) {
            throw new Error('Integración con Dolibarr deshabilitada (DOLIBARR_ENABLED=false)');
        }

        if (!this.baseURL) {
            throw new Error('DOLIBARR_URL no está configurada en config.env');
        }

        if (!this.apiKey && !(this.apiUser && this.apiPassword)) {
            throw new Error('Configura DOLIBARR_API_KEY o DOLIBARR_API_USER y DOLIBARR_API_PASSWORD en config.env');
        }

        const url = `${this.baseURL}/api/index.php${endpoint}`;
        const actionLabel = `${method.toUpperCase()} ${endpoint}`;
        const computedReference = reference || data?.ref || data?.id || data?.sku || data?.order_number || null;
        
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
            
            await logIntegrationEvent({
                source: 'dolibarr',
                direction: 'outbound',
                reference: computedReference,
                action: actionLabel,
                status: 'success',
                requestPayload: data,
                responsePayload: response.data
            });

            return response.data;
        } catch (error) {
            if (allow404 && error.response?.status === 404) {
                await logIntegrationEvent({
                    source: 'dolibarr',
                    direction: 'outbound',
                    reference: computedReference,
                    action: actionLabel,
                    status: mark404As,
                    requestPayload: data,
                    responsePayload: error.response?.data,
                    errorMessage: error.message
                });
                return null;
            }

            await logIntegrationEvent({
                source: 'dolibarr',
                direction: 'outbound',
                reference: computedReference,
                action: actionLabel,
                status: 'error',
                requestPayload: data,
                responsePayload: error.response?.data,
                errorMessage: error.message
            });

            console.error('❌ Error en petición a Dolibarr:', error.response?.data || error.message);
            if (error.response?.status === 401) {
                throw new Error('Error de autenticación. Verifica tus credenciales. El usuario debe tener permisos para usar la API.');
            }
            throw error;
        }
    }

    /**
     * Obtener producto por referencia (SKU) desde Dolibarr
     * @param {string} ref
     * @returns {Object|null}
     */
    async getProductByRef(ref) {
        if (!ref) {
            return null;
        }

        const encodedRef = encodeURIComponent(ref);

        // Intento directo con endpoint /products/ref/{ref}
        try {
            const product = await this.request('GET', `/products/ref/${encodedRef}`, null, {
                allow404: true,
                reference: ref
            });
            if (product && product.id) {
                return product;
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                console.warn(`⚠️ No se pudo obtener producto ${ref} mediante /products/ref: ${error.message}`);
            }
        }

        // Fallback con sqlfilters (solo Dolibarr >= 14)
        try {
            const filter = encodeURIComponent(`(t.ref:=:'${ref.replace(/'/g, "''")}')`);
            const products = await this.request('GET', `/products?limit=1&sqlfilters=${filter}`, null, {
                allow404: true,
                reference: ref
            });
            if (Array.isArray(products) && products.length > 0) {
                return products[0];
            }
        } catch (error) {
            console.warn(`⚠️ No se pudo obtener producto ${ref} mediante lista filtrada: ${error.message}`);
        }

        return null;
    }

    /**
     * Registrar un movimiento de inventario en Dolibarr
     * @param {Object} params
     * @param {number|null} params.productId
     * @param {string|null} params.productRef
     * @param {number} params.quantity - Cantidad (positiva suma stock, negativa resta)
     * @param {string} [params.label]
     * @param {string|null} [params.movementDate]
     * @param {Object} [params.extraFields]
     */
    async createStockMovement({
        productId = null,
        productRef = null,
        quantity,
        label,
        movementDate = null,
        extraFields = {}
    }) {
        if (!this.enabled) {
            console.info('ℹ️ Movimiento de stock omitido: integración Dolibarr deshabilitada');
            return { skipped: true };
        }

        if (!this.defaultWarehouseId) {
            throw new Error('DOLIBARR_DEFAULT_WAREHOUSE_ID no está configurada');
        }

        if (!quantity || Number(quantity) === 0) {
            return { skipped: true };
        }

        let resolvedProductId = productId;
        let resolvedRef = productRef;

        if (!resolvedProductId && resolvedRef) {
            const remoteProduct = await this.getProductByRef(resolvedRef);
            if (!remoteProduct) {
                throw new Error(`Producto con referencia ${resolvedRef} no encontrado en Dolibarr para registrar movimiento de stock`);
            }
            resolvedProductId = remoteProduct.id;
            resolvedRef = remoteProduct.ref || resolvedRef;
        }

        if (!resolvedProductId) {
            throw new Error('No se proporcionó productId ni productRef para registrar movimiento de stock en Dolibarr');
        }

        const isIncrease = Number(quantity) > 0;
        const payload = {
            product_id: resolvedProductId,
            product_ref: resolvedRef,
            warehouse_id: this.defaultWarehouseId,
            qty: Math.abs(Number(quantity)),
            label: label || (isIncrease ? 'Entrada inventario e-commerce' : 'Salida inventario e-commerce'),
            type: isIncrease ? 0 : 1,
            movement: isIncrease ? 'in' : 'out',
            ...extraFields
        };

        if (movementDate) {
            payload.movementdate = movementDate;
        }

        return this.request('POST', '/stockmovements', payload);
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
            const emailFilter = encodeURIComponent(`(t.email:=:'${userData.email.replace(/'/g, "''")}')`);
            const existingCustomers = await this.request(
                'GET',
                `/thirdparties?limit=1&sqlfilters=${emailFilter}`,
                null,
                { allow404: true, mark404As: 'info', reference: userData.email }
            ) || [];
            
            let customerId = null;
            const normalizeId = (value) => {
                if (value === null || value === undefined) {
                    return null;
                }
                const parsed = parseInt(value, 10);
                return Number.isNaN(parsed) ? value : parsed;
            };
            
            if (existingCustomers && existingCustomers.length > 0) {
                // Cliente existe, actualizar
                customerId = normalizeId(existingCustomers[0].id);
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
                const generateCustomerCode = () => {
                    const base = userData.code_client
                        || userData.company
                        || `${userData.first_name || ''}${userData.last_name || ''}`
                        || (userData.email ? userData.email.split('@')[0] : '')
                        || 'CLIENTE';

                    const normalized = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const sanitized = normalized.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

                    if (sanitized.length >= 3) {
                        return sanitized.slice(0, 12);
                    }

                    const timestamp = Date.now().toString().slice(-6);
                    return `CLI${timestamp}`;
                };

                const customerCode = generateCustomerCode();

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
                    status: 1, // Activo
                    code_client: 'auto'
                };
                
                const result = await this.request('POST', '/thirdparties', createData);
                customerId = normalizeId(result?.id ?? result);
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
     * @param {Object} db - Instancia de la base de datos (opcional)
     */
    async syncProduct(productData, db = null) {
        try {
            if (!db) {
                db = require('../config/database');
            }

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
                
                // Actualizar stock si es diferente
                if (productData.stock !== null && productData.stock !== undefined && productId) {
                    try {
                        // Obtener stock actual del producto en Dolibarr
                        let stockActualDolibarr = 0;
                        try {
                            const productInfo = await this.request('GET', `/products/${productId}`);
                            stockActualDolibarr = parseInt(productInfo.stock_reel || productInfo.stock || 0);
                        } catch (stockError) {
                            console.warn(`⚠️ No se pudo obtener stock actual de Dolibarr: ${stockError.message}`);
                            stockActualDolibarr = 0;
                        }

                        // Calcular diferencia
                        const stockDeseado = parseInt(productData.stock) || 0;
                        const diferenciaStock = stockDeseado - stockActualDolibarr;

                        // Si hay diferencia, crear movimiento de stock
                        if (diferenciaStock !== 0) {
                            console.log(`📦 Actualizando stock: ${stockActualDolibarr} → ${stockDeseado} (diferencia: ${diferenciaStock > 0 ? '+' : ''}${diferenciaStock})`);
                            
                            await this.createStockMovement({
                                productId: productId,
                                productRef: productData.sku,
                                quantity: diferenciaStock,
                                label: `Actualización stock desde e-commerce (${diferenciaStock > 0 ? '+' : ''}${diferenciaStock})`
                            });
                            
                            console.log(`✅ Stock actualizado en Dolibarr: ${stockDeseado} unidades`);
                        }
                    } catch (stockError) {
                        console.error(`⚠️ Error actualizando stock del producto ${productData.name}:`, stockError.message);
                    }
                }
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
            
            // Actualizar stock en Dolibarr usando movimientos de stock
            if (productData.stock && productData.stock > 0 && productId) {
                try {
                    // Obtener stock actual del producto en Dolibarr
                    let stockActualDolibarr = 0;
                    try {
                        const productInfo = await this.request('GET', `/products/${productId}`);
                        stockActualDolibarr = parseInt(productInfo.stock_reel || productInfo.stock || 0);
                    } catch (stockError) {
                        console.warn(`⚠️ No se pudo obtener stock actual de Dolibarr, asumiendo 0: ${stockError.message}`);
                        stockActualDolibarr = 0;
                    }

                    // Calcular diferencia entre stock deseado y stock actual
                    const stockDeseado = parseInt(productData.stock) || 0;
                    const diferenciaStock = stockDeseado - stockActualDolibarr;

                    // Si hay diferencia, crear movimiento de stock
                    if (diferenciaStock !== 0) {
                        console.log(`📦 Sincronizando stock: ${stockActualDolibarr} → ${stockDeseado} (diferencia: ${diferenciaStock > 0 ? '+' : ''}${diferenciaStock})`);
                        
                        await this.createStockMovement({
                            productId: productId,
                            productRef: productData.sku,
                            quantity: diferenciaStock,
                            label: diferenciaStock > 0 
                                ? `Inicialización stock desde e-commerce (+${diferenciaStock})`
                                : `Ajuste stock desde e-commerce (${diferenciaStock})`
                        });
                        
                        console.log(`✅ Stock sincronizado en Dolibarr: ${stockDeseado} unidades`);
                    } else {
                        console.log(`ℹ️ Stock ya está actualizado en Dolibarr: ${stockActualDolibarr} unidades`);
                    }
                } catch (stockError) {
                    // Error al sincronizar stock no debe impedir la creación del producto
                    console.error(`⚠️ Error sincronizando stock del producto ${productData.name} con Dolibarr:`, stockError.message);
                    console.error(`   El producto se creó pero el stock quedó en 0. Actualiza manualmente en Dolibarr o intenta sincronizar después.`);
                }
            } else if (productData.stock === 0 || !productData.stock) {
                console.log(`ℹ️ Producto creado sin stock inicial en Dolibarr (stock: ${productData.stock || 0})`);
            }
            
            // Actualizar dolibarr_id y campos de sincronización en la BD
            if (productData.id) {
                await db.query(`
                    UPDATE products 
                    SET 
                        dolibarr_id = $1,
                        dolibarr_synced_at = NOW(),
                        last_sync_source = 'ecommerce',
                        sync_direction = CASE 
                            WHEN sync_direction = 'inbound' THEN 'bidirectional'
                            ELSE COALESCE(sync_direction, 'outbound')
                        END
                    WHERE id = $2
                `, [productId, productData.id]);
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
            const difference = newStock - currentStock;

            if (difference === 0) {
                return true;
            }

            await this.createStockMovement({
                productId: product.id,
                productRef: product.ref || sku,
                quantity: difference,
                label: difference > 0
                    ? `Ajuste positivo desde e-commerce (+${difference})`
                    : `Ajuste negativo desde e-commerce (${difference})`
            });

            console.log(`✅ Movimiento de stock registrado en Dolibarr para ${sku}: ${currentStock} → ${newStock}`);
            return true;
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
                    
                    // Registrar movimiento de salida en Dolibarr
                    try {
                        await this.createStockMovement({
                            productRef: item.product_sku,
                            quantity: -item.quantity,
                            label: `Venta e-commerce ${orderData.order_number || ''}`.trim()
                        });
                    } catch (movementError) {
                        console.error(`⚠️ Error registrando movimiento de stock para ${item.product_sku}:`, movementError.message);
                    }
                }
                
                orderItems.push({
                    desc: item.product_name,
                    qty: item.quantity,
                    subprice: item.price,
                    tva_tx: 16, // IVA 16%
                    ref: item.product_sku
                });
            }
            
            const numericSocId = Number.parseInt(customerId, 10);
            const orderDataDolibarr = {
                socid: Number.isNaN(numericSocId) ? customerId : numericSocId,
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
                    // Registrar movimiento de entrada en Dolibarr para restaurar inventario
                    try {
                        await this.createStockMovement({
                            productRef: item.product_sku,
                            quantity: item.quantity,
                            label: `Cancelación e-commerce - devolución ${item.product_sku}`
                        });
                    } catch (movementError) {
                        console.error(`⚠️ Error registrando devolución de stock para ${item.product_sku}:`, movementError.message);
                    }
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

    /**
     * Obtener producto completo de Dolibarr con información de stock
     * @param {number} dolibarrId - ID del producto en Dolibarr
     * @returns {Object|null}
     */
    async getProductWithStock(dolibarrId) {
        try {
            const product = await this.request('GET', `/products/${dolibarrId}`);
            
            // Obtener stock del producto (puede estar en diferentes campos según versión de Dolibarr)
            const stock = product.stock_reel || product.stock || product.stock_warehouse || 0;
            
            return {
                ...product,
                stock_reel: stock
            };
        } catch (error) {
            console.error(`❌ Error obteniendo producto ${dolibarrId} de Dolibarr:`, error);
            return null;
        }
    }

    /**
     * Sincronizar producto desde Dolibarr al e-commerce
     * @param {Object} dolibarrProduct - Datos del producto desde Dolibarr
     * @param {Object} db - Instancia de la base de datos
     * @returns {Object} Resultado de la sincronización
     */
    async syncProductFromDolibarr(dolibarrProduct, db = null) {
        try {
            if (!db) {
                db = require('../config/database');
            }

            const dolibarrId = dolibarrProduct.id;
            const sku = dolibarrProduct.ref || dolibarrProduct.barcode;
            const stock = dolibarrProduct.stock_reel || dolibarrProduct.stock || 0;

            if (!sku) {
                throw new Error('Producto de Dolibarr no tiene referencia (ref) o código de barras');
            }

            // Buscar producto existente en e-commerce por dolibarr_id o SKU
            let existingProduct = null;
            
            if (dolibarrId) {
                const result = await db.query(
                    'SELECT * FROM products WHERE dolibarr_id = $1 OR sku = $2',
                    [dolibarrId, sku]
                );
                existingProduct = result.rows[0] || null;
            } else {
                const result = await db.query(
                    'SELECT * FROM products WHERE sku = $1',
                    [sku]
                );
                existingProduct = result.rows[0] || null;
            }

            // Mapear campos de Dolibarr al e-commerce
            const productData = {
                name: dolibarrProduct.label || dolibarrProduct.name || 'Producto sin nombre',
                description: dolibarrProduct.description || null,
                price: parseFloat(dolibarrProduct.price || dolibarrProduct.price_ttc || 0),
                sku: sku,
                stock: parseInt(stock) || 0,
                is_active: dolibarrProduct.status === 1 || dolibarrProduct.status === '1' || dolibarrProduct.tosell === 1,
                dolibarr_id: dolibarrId,
                dolibarr_synced_at: new Date(),
                last_sync_source: 'dolibarr',
                sync_direction: existingProduct?.sync_direction === 'outbound' ? 'bidirectional' : 'inbound'
            };

            let productId;
            let action;

            if (existingProduct) {
                // Actualizar producto existente
                productId = existingProduct.id;
                action = 'updated';

                // No sobrescribir campos que solo se modifican desde e-commerce si sync_direction es 'outbound'
                const updateFields = {
                    dolibarr_id: dolibarrId,
                    dolibarr_synced_at: new Date(),
                    last_sync_source: 'dolibarr',
                    stock: productData.stock
                };

                // Si es bidireccional o inbound, actualizar también nombre, descripción y precio
                if (productData.sync_direction === 'bidirectional' || productData.sync_direction === 'inbound') {
                    updateFields.name = productData.name;
                    updateFields.description = productData.description;
                    updateFields.price = productData.price;
                    updateFields.is_active = productData.is_active;
                }

                // Actualizar sync_direction si es necesario
                if (existingProduct.sync_direction === 'outbound') {
                    updateFields.sync_direction = 'bidirectional';
                } else if (!existingProduct.sync_direction || existingProduct.sync_direction === 'inbound') {
                    updateFields.sync_direction = productData.sync_direction;
                }

                await db.query(`
                    UPDATE products 
                    SET 
                        name = COALESCE($1, name),
                        description = COALESCE($2, description),
                        price = COALESCE($3, price),
                        stock = $4,
                        is_active = COALESCE($5, is_active),
                        dolibarr_id = $6,
                        dolibarr_synced_at = $7,
                        last_sync_source = $8,
                        sync_direction = $9,
                        updated_at = NOW()
                    WHERE id = $10
                `, [
                    updateFields.name,
                    updateFields.description,
                    updateFields.price,
                    updateFields.stock,
                    updateFields.is_active,
                    updateFields.dolibarr_id,
                    updateFields.dolibarr_synced_at,
                    updateFields.last_sync_source,
                    updateFields.sync_direction,
                    productId
                ]);

                console.log(`✅ Producto actualizado desde Dolibarr: ${productData.name} (SKU: ${sku})`);
            } else {
                // Crear nuevo producto
                action = 'created';

                // Buscar categoría por defecto o crear sin categoría
                const result = await db.query(`
                    INSERT INTO products (
                        name, description, price, sku, stock, is_active,
                        dolibarr_id, dolibarr_synced_at, last_sync_source, sync_direction
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'inbound'))
                    RETURNING id
                `, [
                    productData.name,
                    productData.description,
                    productData.price,
                    productData.sku,
                    productData.stock,
                    productData.is_active,
                    productData.dolibarr_id,
                    productData.dolibarr_synced_at,
                    productData.last_sync_source,
                    productData.sync_direction || 'inbound'
                ]);

                productId = result.rows[0].id;
                console.log(`✅ Producto creado desde Dolibarr: ${productData.name} (SKU: ${sku})`);
            }

            // Registrar en logs
            await logIntegrationEvent({
                source: 'dolibarr',
                direction: 'inbound',
                reference: sku,
                action: `product.${action}`,
                status: 'success',
                requestPayload: dolibarrProduct,
                responsePayload: { product_id: productId, action }
            });

            return {
                success: true,
                action,
                product_id: productId,
                dolibarr_id: dolibarrId
            };
        } catch (error) {
            console.error('❌ Error sincronizando producto desde Dolibarr:', error);
            
            // Registrar error en logs
            await logIntegrationEvent({
                source: 'dolibarr',
                direction: 'inbound',
                reference: dolibarrProduct.ref || dolibarrProduct.id,
                action: 'product.sync',
                status: 'error',
                requestPayload: dolibarrProduct,
                errorMessage: error.message
            });

            throw error;
        }
    }

    /**
     * Sincronizar stock desde Dolibarr al e-commerce
     * @param {string} sku - SKU del producto
     * @param {number} dolibarrId - ID del producto en Dolibarr (opcional)
     * @param {Object} db - Instancia de la base de datos
     * @returns {Object} Resultado de la sincronización
     */
    async syncStockFromDolibarr(sku, dolibarrId = null, db = null) {
        try {
            if (!db) {
                db = require('../config/database');
            }

            // Obtener producto de Dolibarr
            let dolibarrProduct = null;
            
            if (dolibarrId) {
                dolibarrProduct = await this.getProductWithStock(dolibarrId);
            } else {
                // Buscar por SKU
                const allProducts = await this.request('GET', '/products');
                if (Array.isArray(allProducts)) {
                    dolibarrProduct = allProducts.find(
                        p => (p.ref === sku || p.barcode === sku)
                    );
                    if (dolibarrProduct) {
                        dolibarrProduct = await this.getProductWithStock(dolibarrProduct.id);
                    }
                }
            }

            if (!dolibarrProduct) {
                throw new Error(`Producto con SKU ${sku} no encontrado en Dolibarr`);
            }

            const newStock = parseInt(dolibarrProduct.stock_reel || dolibarrProduct.stock || 0);

            // Actualizar stock en e-commerce
            const result = await db.query(`
                UPDATE products 
                SET 
                    stock = $1,
                    dolibarr_synced_at = NOW(),
                    last_sync_source = 'dolibarr',
                    updated_at = NOW()
                WHERE sku = $2 OR dolibarr_id = $3
                RETURNING id, name, stock
            `, [newStock, sku, dolibarrProduct.id]);

            if (result.rows.length === 0) {
                throw new Error(`Producto con SKU ${sku} no encontrado en e-commerce`);
            }

            const product = result.rows[0];

            console.log(`✅ Stock actualizado desde Dolibarr: ${product.name} - ${product.stock} unidades`);

            // Registrar en logs
            await logIntegrationEvent({
                source: 'dolibarr',
                direction: 'inbound',
                reference: sku,
                action: 'stock.update',
                status: 'success',
                requestPayload: { sku, dolibarr_id: dolibarrProduct.id, stock: newStock },
                responsePayload: { product_id: product.id, stock: product.stock }
            });

            return {
                success: true,
                product_id: product.id,
                stock: product.stock,
                dolibarr_id: dolibarrProduct.id
            };
        } catch (error) {
            console.error(`❌ Error sincronizando stock desde Dolibarr para SKU ${sku}:`, error);
            
            // Registrar error en logs
            await logIntegrationEvent({
                source: 'dolibarr',
                direction: 'inbound',
                reference: sku,
                action: 'stock.update',
                status: 'error',
                requestPayload: { sku, dolibarr_id },
                errorMessage: error.message
            });

            throw error;
        }
    }

    /**
     * Sincronizar todos los productos desde Dolibarr (para polling)
     * @param {Object} db - Instancia de la base de datos
     * @param {Object} options - Opciones de sincronización
     * @returns {Object} Resultado de la sincronización
     */
    async syncAllProductsFromDolibarr(db = null, options = {}) {
        try {
            if (!db) {
                db = require('../config/database');
            }

            const { 
                onlyNew = false,  // Solo sincronizar productos nuevos
                updateStock = true,  // Actualizar stock
                limit = null  // Límite de productos a sincronizar
            } = options;

            console.log('🔄 Iniciando sincronización masiva desde Dolibarr...');

            // Obtener todos los productos de Dolibarr
            const dolibarrProducts = await this.getProducts();
            
            if (!dolibarrProducts.success || !Array.isArray(dolibarrProducts.data)) {
                throw new Error('No se pudieron obtener productos de Dolibarr');
            }

            let productsToSync = dolibarrProducts.data;
            
            if (limit) {
                productsToSync = productsToSync.slice(0, limit);
            }

            console.log(`📦 Total de productos a sincronizar: ${productsToSync.length}`);

            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            for (const dolibarrProduct of productsToSync) {
                try {
                    // Si onlyNew, verificar si el producto ya existe
                    if (onlyNew) {
                        const existing = await db.query(
                            'SELECT id FROM products WHERE dolibarr_id = $1 OR sku = $2',
                            [dolibarrProduct.id, dolibarrProduct.ref || dolibarrProduct.barcode]
                        );
                        
                        if (existing.rows.length > 0) {
                            continue; // Saltar productos existentes
                        }
                    }

                    // Sincronizar producto
                    await this.syncProductFromDolibarr(dolibarrProduct, db);
                    successCount++;
                } catch (error) {
                    errorCount++;
                    errors.push({
                        product: dolibarrProduct.ref || dolibarrProduct.id,
                        error: error.message
                    });
                    console.error(`❌ Error sincronizando producto ${dolibarrProduct.ref || dolibarrProduct.id}:`, error.message);
                }
            }

            console.log(`✅ Sincronización completada: ${successCount} exitosos, ${errorCount} errores`);

            return {
                success: true,
                total: productsToSync.length,
                successCount,
                errorCount,
                errors
            };
        } catch (error) {
            console.error('❌ Error en sincronización masiva desde Dolibarr:', error);
            throw error;
        }
    }
}

module.exports = new DolibarrService();

