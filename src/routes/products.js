const express = require('express');
const db = require('../config/database');
const { validateProduct, validateId, validateSearch } = require('../middleware/validation');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const dolibarrService = require('../services/dolibarrService');

const router = express.Router();

const parseNullableJson = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length === 0) return null;
        try {
            return JSON.parse(trimmed);
        } catch (error) {
            throw new Error('Formato JSON inválido');
        }
    }
    return null;
};

const parseStringArray = (value) => {
    if (value === undefined || value === null) return null;
    if (Array.isArray(value)) {
        return value
            .map(item => (typeof item === 'string' ? item.trim() : ''))
            .filter(item => item.length > 0);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length === 0) return null;

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed
                    .map(item => (typeof item === 'string' ? item.trim() : ''))
                    .filter(item => item.length > 0);
            }
        } catch {
            // no-op, intentamos con separadores
        }

        const normalized = trimmed
            .replace(/^\{|\}$/g, '')
            .replace(/^\[|\]$/g, '')
            .split(/[,\n]/)
            .map(item => item.replace(/^"+|"+$/g, '').trim())
            .filter(item => item.length > 0);

        return normalized.length > 0 ? normalized : null;
    }
    return null;
};

const parseNumeric = (value) => {
    if (value === undefined || value === null) return null;
    const num = typeof value === 'string' ? Number(value.replace(/[^0-9.,-]/g, '').replace(',', '.')) : Number(value);
    return Number.isFinite(num) ? num : null;
};

const parseInteger = (value, defaultValue = 0) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    const num = Number(value);
    return Number.isInteger(num) && num >= 0 ? num : defaultValue;
};

// GET /api/products - Obtener todos los productos con filtros
router.get('/', optionalAuth, validateSearch, async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 12,
            category,
            search,
            min_price,
            max_price,
            sort = 'name',
            order = 'asc',
            featured
        } = req.query;

        const offset = (page - 1) * limit;
        let whereConditions = ['p.is_active = true'];
        let queryParams = [];
        let paramCount = 0;

        // Filtro por categoría
        if (category) {
            paramCount++;
            whereConditions.push(`p.category_id = $${paramCount}`);
            queryParams.push(category);
        }

        // Filtro por búsqueda
        if (search) {
            paramCount++;
            whereConditions.push(`(
                p.name ILIKE $${paramCount} OR 
                p.description ILIKE $${paramCount} OR 
                p.sku ILIKE $${paramCount} OR 
                p.brand ILIKE $${paramCount}
            )`);
            queryParams.push(`%${search}%`);
        }

        // Filtro por precio mínimo
        if (min_price) {
            paramCount++;
            whereConditions.push(`p.price >= $${paramCount}`);
            queryParams.push(parseFloat(min_price));
        }

        // Filtro por precio máximo
        if (max_price) {
            paramCount++;
            whereConditions.push(`p.price <= $${paramCount}`);
            queryParams.push(parseFloat(max_price));
        }

        // Filtro por productos destacados
        if (featured === 'true') {
            whereConditions.push('p.is_featured = true');
        }

        // Construir la consulta
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        const orderBy = `ORDER BY p.${sort} ${order.toUpperCase()}`;
        
        // Consulta principal
        const query = `
            SELECT 
                p.id,
                p.name,
                p.description,
                p.price,
                p.sku,
                p.stock,
                p.min_stock,
                p.image_url,
                p.specifications,
                p.features,
                p.tags,
                p.brand,
                p.weight,
                p.dimensions,
                p.is_featured,
                p.created_at,
                p.updated_at,
                c.name as category_name,
                c.id as category_id
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ${whereClause}
            ${orderBy}
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;

        queryParams.push(parseInt(limit), offset);

        const result = await db.query(query, queryParams);

        // Consulta para contar el total
        const countQuery = `
            SELECT COUNT(*) as total
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ${whereClause}
        `;

        const countResult = await db.query(countQuery, queryParams.slice(0, -2));
        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/products/:id - Obtener un producto por ID
router.get('/:id', optionalAuth, validateId, async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT 
                p.*,
                c.name as category_name,
                c.description as category_description
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = $1 AND p.is_active = true
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const product = result.rows[0];
        
        // Incrementar vistas si el usuario está autenticado
        if (req.user) {
            await db.query(
                'UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1',
                [id]
            );
        }

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/products/category/:categoryId - Obtener productos por categoría
router.get('/category/:categoryId', optionalAuth, validateId, async (req, res, next) => {
    try {
        const { categoryId } = req.params;
        const { limit = 12, page = 1 } = req.query;
        const offset = (page - 1) * limit;

        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.description,
                p.price,
                p.sku,
                p.stock,
                p.image_url,
                p.specifications,
                p.features,
                p.tags,
                p.brand,
                p.is_featured,
                p.created_at
            FROM products p
            WHERE p.category_id = $1 AND p.is_active = true
            ORDER BY p.is_featured DESC, p.name ASC
            LIMIT $2 OFFSET $3
        `, [categoryId, parseInt(limit), offset]);

        const countResult = await db.query(
            'SELECT COUNT(*) as total FROM products WHERE category_id = $1 AND is_active = true',
            [categoryId]
        );

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/products/featured - Obtener productos destacados
router.get('/featured/list', optionalAuth, async (req, res, next) => {
    try {
        const { limit = 8 } = req.query;

        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.description,
                p.price,
                p.sku,
                p.stock,
                p.image_url,
                p.specifications,
                p.features,
                p.tags,
                p.brand,
                p.created_at,
                c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_featured = true AND p.is_active = true
            ORDER BY p.created_at DESC
            LIMIT $1
        `, [parseInt(limit)]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/products - Crear nuevo producto (Admin)
router.post('/', authenticateToken, requireAdmin, validateProduct, async (req, res, next) => {
    try {
        const {
            name,
            description,
            price,
            category_id,
            sku,
            stock = 0,
            min_stock = 5,
            image_url,
            specifications,
            features,
            tags,
            brand,
            weight,
            dimensions,
            is_featured = false
        } = req.body;

        const parsedStock = parseInteger(stock);
        const parsedMinStock = parseInteger(min_stock, 5);
        let parsedSpecifications;
        let parsedDimensions;
        try {
            parsedSpecifications = parseNullableJson(specifications);
            parsedDimensions = parseNullableJson(dimensions);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message || 'Formato JSON inválido en especificaciones o dimensiones'
            });
        }
        const parsedFeatures = parseStringArray(features);
        const parsedTags = parseStringArray(tags);
        const parsedWeight = parseNumeric(weight);
        const sanitizedImage = typeof image_url === 'string' && image_url.trim().length > 0 ? image_url.trim() : null;

        const result = await db.query(`
            INSERT INTO products (
                name, description, price, category_id, sku, stock, min_stock,
                image_url, specifications, features, tags, brand, weight,
                dimensions, is_featured
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [
            name,
            description,
            price,
            category_id,
            sku,
            parsedStock,
            parsedMinStock,
            sanitizedImage,
            parsedSpecifications,
            parsedFeatures,
            parsedTags,
            brand,
            parsedWeight,
            parsedDimensions,
            is_featured
        ]);

        const product = result.rows[0];

        // Sincronizar con Dolibarr automáticamente (sin bloquear la respuesta)
        if (process.env.DOLIBARR_URL && process.env.DOLIBARR_AUTO_SYNC !== 'false') {
            dolibarrService.syncProduct(product).catch(error => {
                console.error('⚠️ Error sincronizando producto con Dolibarr (no crítico):', error.message);
            });
        }

        res.status(201).json({
            success: true,
            data: product,
            message: 'Producto creado exitosamente'
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/products/:id - Actualizar producto (Admin)
router.put('/:id', authenticateToken, requireAdmin, validateId, validateProduct, async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            price,
            category_id,
            sku,
            stock,
            min_stock,
            image_url,
            specifications,
            features,
            tags,
            brand,
            weight,
            dimensions,
            is_featured,
            is_active
        } = req.body;

        const parsedStock = parseInteger(stock, null);
        const parsedMinStock = parseInteger(min_stock, null);
        let parsedSpecifications;
        let parsedDimensions;
        try {
            parsedSpecifications = parseNullableJson(specifications);
            parsedDimensions = parseNullableJson(dimensions);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message || 'Formato JSON inválido en especificaciones o dimensiones'
            });
        }
        const parsedFeatures = parseStringArray(features);
        const parsedTags = parseStringArray(tags);
        const parsedWeight = parseNumeric(weight);
        const sanitizedImage = typeof image_url === 'string' ? image_url.trim() : null;

        // Verificar que el producto existe
        const existingProduct = await db.query(
            'SELECT id FROM products WHERE id = $1',
            [id]
        );

        if (existingProduct.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const result = await db.query(`
            UPDATE products SET
                name = $1,
                description = $2,
                price = $3,
                category_id = $4,
                sku = $5,
                stock = $6,
                min_stock = $7,
                image_url = $8,
                specifications = $9,
                features = $10,
                tags = $11,
                brand = $12,
                weight = $13,
                dimensions = $14,
                is_featured = $15,
                is_active = $16,
                updated_at = NOW()
            WHERE id = $17
            RETURNING *
        `, [
            name,
            description,
            price,
            category_id,
            sku,
            parsedStock,
            parsedMinStock,
            sanitizedImage,
            parsedSpecifications,
            parsedFeatures,
            parsedTags,
            brand,
            parsedWeight,
            parsedDimensions,
            is_featured,
            is_active,
            id
        ]);

        const product = result.rows[0];

        // Sincronizar con Dolibarr automáticamente (sin bloquear la respuesta)
        if (process.env.DOLIBARR_URL && process.env.DOLIBARR_AUTO_SYNC !== 'false') {
            dolibarrService.syncProduct(product).catch(error => {
                console.error('⚠️ Error sincronizando producto con Dolibarr (no crítico):', error.message);
            });
        }

        res.json({
            success: true,
            data: product,
            message: 'Producto actualizado exitosamente'
        });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/products/:id/stock - Actualizar stock de un producto (Admin)
router.patch('/:id/stock', authenticateToken, requireAdmin, validateId, async (req, res, next) => {
    try {
        const { id } = req.params;
        let { stock, min_stock } = req.body;

        if (stock === undefined || stock === null) {
            return res.status(400).json({
                success: false,
                error: 'El campo stock es requerido'
            });
        }

        const parsedStock = Number(stock);
        if (!Number.isFinite(parsedStock) || parsedStock < 0) {
            return res.status(400).json({
                success: false,
                error: 'El stock debe ser un número mayor o igual a 0'
            });
        }

        let parsedMinStock;
        if (min_stock !== undefined && min_stock !== null) {
            parsedMinStock = Number(min_stock);
            if (!Number.isFinite(parsedMinStock) || parsedMinStock < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'El stock mínimo debe ser un número mayor o igual a 0'
                });
            }
        }

        const existingProduct = await db.query(
            'SELECT id FROM products WHERE id = $1',
            [id]
        );

        if (existingProduct.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const updateFields = ['stock = $1', 'updated_at = NOW()'];
        const updateValues = [parsedStock];

        if (parsedMinStock !== undefined) {
            updateFields.push(`min_stock = $${updateValues.length + 1}`);
            updateValues.push(parsedMinStock);
        }

        updateValues.push(id);

        const result = await db.query(
            `
            UPDATE products
            SET ${updateFields.join(', ')}
            WHERE id = $${updateValues.length}
            RETURNING id, name, sku, stock, min_stock, updated_at
            `,
            updateValues
        );

        const productStock = result.rows[0];

        if (process.env.DOLIBARR_URL && process.env.DOLIBARR_AUTO_SYNC !== 'false') {
            db.query(`
                SELECT 
                    p.*,
                    c.name as category_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.id = $1
            `, [id]).then(fullProductResult => {
                const fullProduct = fullProductResult.rows[0];
                if (fullProduct) {
                    dolibarrService.syncProduct(fullProduct).catch(error => {
                        console.error('⚠️ Error sincronizando stock con Dolibarr (no crítico):', error.message);
                    });
                }
            }).catch(syncQueryError => {
                console.error('⚠️ Error obteniendo producto para sincronización:', syncQueryError.message);
            });
        }

        res.json({
            success: true,
            data: productStock,
            message: 'Stock actualizado exitosamente'
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/products/:id - Eliminar producto (Admin)
router.delete('/:id', authenticateToken, requireAdmin, validateId, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Verificar que el producto existe
        const existingProduct = await db.query(
            'SELECT id FROM products WHERE id = $1',
            [id]
        );

        if (existingProduct.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        // Soft delete - marcar como inactivo en lugar de eliminar
        await db.query(
            'UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1',
            [id]
        );

        res.json({
            success: true,
            message: 'Producto eliminado exitosamente'
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/products/categories/list - Obtener todas las categorías
router.get('/categories/list', async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT 
                c.id,
                c.name,
                c.description,
                c.image_url,
                c.is_active,
                COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
            WHERE c.is_active = true
            GROUP BY c.id, c.name, c.description, c.image_url, c.is_active
            ORDER BY c.name
        `);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
