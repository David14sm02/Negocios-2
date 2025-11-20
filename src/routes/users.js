const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { validateUser, validateId } = require('../middleware/validation');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const requireDatabase = require('../middleware/requireDatabase');

const router = express.Router();

// Función para generar JWT
const generateToken = (userId, isAdmin = false) => {
    return jwt.sign(
        { userId, isAdmin },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// POST /api/users/register - Registrar nuevo usuario
router.post('/register', requireDatabase, validateUser, async (req, res, next) => {
    try {
        const { email, password, first_name, last_name, phone, company } = req.body;

        // Verificar si el usuario ya existe
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'El email ya está registrado'
            });
        }

        // Encriptar contraseña
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Crear usuario
        const result = await db.query(`
            INSERT INTO users (
                email,
                password_hash,
                first_name,
                last_name,
                phone,
                company
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING 
                id, 
                email, 
                first_name, 
                last_name, 
                phone, 
                company, 
                is_admin,
                created_at
        `, [email, passwordHash, first_name, last_name, phone, company]);

        const user = result.rows[0];
        const token = generateToken(user.id, user.is_admin);

        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    phone: user.phone,
                    company: user.company,
                    is_admin: user.is_admin,
                    created_at: user.created_at
                },
                token
            },
            message: 'Usuario registrado exitosamente'
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/users/login - Iniciar sesión
router.post('/login', requireDatabase, async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email y contraseña son requeridos'
            });
        }

        // Buscar usuario
        const result = await db.query(`
            SELECT id, email, password_hash, first_name, last_name, phone, company, is_active, is_admin
            FROM users 
            WHERE email = $1
        `, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Credenciales inválidas'
            });
        }

        const user = result.rows[0];

        // Verificar si el usuario está activo
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Cuenta desactivada'
            });
        }

        // Verificar contraseña
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Credenciales inválidas'
            });
        }

        const token = generateToken(user.id, user.is_admin);

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    phone: user.phone,
                    company: user.company,
                    is_admin: user.is_admin,
                    created_at: user.created_at
                },
                token
            },
            message: 'Inicio de sesión exitoso'
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/users/profile - Obtener perfil del usuario autenticado
router.get('/profile', authenticateToken, requireDatabase, async (req, res, next) => {
    try {
        const userId = req.user.id;

        const result = await db.query(`
            SELECT id, email, first_name, last_name, phone, company, 
                   address, city, state, postal_code, country, 
                   is_active, is_admin, email_verified, created_at, updated_at
            FROM users 
            WHERE id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }

        const user = result.rows[0];
        delete user.password_hash; // No enviar el hash de la contraseña

        res.json({
            success: true,
            data: { user }
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/users/profile - Actualizar perfil del usuario
router.put('/profile', authenticateToken, requireDatabase, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const {
            first_name,
            last_name,
            phone,
            company,
            address,
            city,
            state,
            postal_code,
            country
        } = req.body;

        const result = await db.query(`
            UPDATE users SET
                first_name = COALESCE($1, first_name),
                last_name = COALESCE($2, last_name),
                phone = COALESCE($3, phone),
                company = COALESCE($4, company),
                address = COALESCE($5, address),
                city = COALESCE($6, city),
                state = COALESCE($7, state),
                postal_code = COALESCE($8, postal_code),
                country = COALESCE($9, country),
                updated_at = NOW()
            WHERE id = $10
            RETURNING id, email, first_name, last_name, phone, company, 
                      address, city, state, postal_code, country, 
                      is_active, is_admin, email_verified, created_at, updated_at
        `, [
            first_name, last_name, phone, company, address,
            city, state, postal_code, country, userId
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            data: { user: result.rows[0] },
            message: 'Perfil actualizado exitosamente'
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/users/change-password - Cambiar contraseña
router.put('/change-password', authenticateToken, requireDatabase, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({
                success: false,
                error: 'Contraseña actual y nueva contraseña son requeridas'
            });
        }

        if (new_password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'La nueva contraseña debe tener al menos 6 caracteres'
            });
        }

        // Obtener contraseña actual
        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }

        // Verificar contraseña actual
        const isValidPassword = await bcrypt.compare(current_password, result.rows[0].password_hash);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Contraseña actual incorrecta'
            });
        }

        // Encriptar nueva contraseña
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

        // Actualizar contraseña
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [newPasswordHash, userId]
        );

        res.json({
            success: true,
            message: 'Contraseña actualizada exitosamente'
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/users/orders - Obtener órdenes del usuario
router.get('/orders', authenticateToken, requireDatabase, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const result = await db.query(`
            SELECT 
                o.id,
                o.order_number,
                o.status,
                o.total,
                o.subtotal,
                o.tax_amount,
                o.shipping_amount,
                o.discount_amount,
                o.payment_method,
                o.payment_status,
                o.notes,
                o.created_at,
                o.updated_at,
                json_agg(
                    json_build_object(
                        'id', oi.id,
                        'product_id', oi.product_id,
                        'product_name', p.name,
                        'product_sku', p.sku,
                        'quantity', oi.quantity,
                        'price', oi.price,
                        'total', oi.total
                    )
                ) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE o.user_id = $1
            GROUP BY o.id, o.order_number, o.status, o.total, o.subtotal, 
                     o.tax_amount, o.shipping_amount, o.discount_amount,
                     o.payment_method, o.payment_status, o.notes, o.created_at, o.updated_at
            ORDER BY o.created_at DESC
            LIMIT $2 OFFSET $3
        `, [userId, parseInt(limit), offset]);

        const countResult = await db.query(
            'SELECT COUNT(*) as total FROM orders WHERE user_id = $1',
            [userId]
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

// GET /api/users - Obtener todos los usuarios (Admin)
router.get('/', authenticateToken, requireAdmin, requireDatabase, async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        let queryParams = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            whereClause = `WHERE (email ILIKE $${paramCount} OR first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`;
            queryParams.push(`%${search}%`);
        }

        const result = await db.query(`
            SELECT 
                id, email, first_name, last_name, phone, company,
                is_active, is_admin, email_verified, created_at, updated_at
            FROM users
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `, [...queryParams, parseInt(limit), offset]);

        const countResult = await db.query(`
            SELECT COUNT(*) as total FROM users ${whereClause}
        `, queryParams);

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

// PUT /api/users/:id/toggle-status - Activar/desactivar usuario (Admin)
router.put('/:id/toggle-status', authenticateToken, requireAdmin, requireDatabase, validateId, async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            UPDATE users 
            SET is_active = NOT is_active, updated_at = NOW()
            WHERE id = $1
            RETURNING id, email, first_name, last_name, is_active
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: `Usuario ${result.rows[0].is_active ? 'activado' : 'desactivado'} exitosamente`
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
