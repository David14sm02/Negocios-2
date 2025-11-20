const express = require('express');
const db = require('../config/database');
const router = express.Router();

// POST /api/contact - Enviar formulario de contacto
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        // Validaciones básicas
        if (!name || name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'El nombre debe tener al menos 2 caracteres'
            });
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Email inválido'
            });
        }

        if (!message || message.trim().length < 10) {
            return res.status(400).json({
                success: false,
                error: 'El mensaje debe tener al menos 10 caracteres'
            });
        }

        // Simular guardado en base de datos (opcional: crear tabla contact_messages)
        // Por ahora, solo logueamos y simulamos el envío
        const contactData = {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone ? phone.trim() : null,
            subject: subject ? subject.trim() : null,
            message: message.trim(),
            created_at: new Date(),
            status: 'pending'
        };

        // Aquí se podría guardar en la base de datos si se desea
        // await db.query('INSERT INTO contact_messages ...', [...]);
        
        console.log('📧 Mensaje de contacto recibido:', contactData);

        // Simular delay de procesamiento (simula envío de correo)
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Respuesta exitosa
        res.json({
            success: true,
            message: '¡Mensaje enviado exitosamente! Nos pondremos en contacto contigo a la brevedad posible.',
            data: {
                id: Date.now(), // ID simulado
                ...contactData
            }
        });

    } catch (error) {
        console.error('Error al procesar formulario de contacto:', error);
        res.status(500).json({
            success: false,
            error: 'Error al procesar tu mensaje. Por favor, intenta más tarde.'
        });
    }
});

module.exports = router;


