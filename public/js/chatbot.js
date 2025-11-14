// Chatbot robusto para preguntas frecuentes
class Chatbot {
    constructor() {
        this.isOpen = false;
        this.faqs = [];
        this.greetings = [];
        this.fallback = "";
        this.suggestions = [];
        this.categories = {};
        this.chatHistory = [];
        this.lastCategory = null;
        this.synonyms = {
            "pago": ["pagar", "pagos", "metodo pago", "forma pago", "tarjeta", "credito", "debito"],
            "envio": ["envios", "entrega", "shipping", "delivery", "enviar", "enviado"],
            "pedido": ["orden", "compra", "order", "pedidos", "ordenes"],
            "producto": ["productos", "articulo", "artículo", "item", "items"],
            "devolucion": ["devoluciones", "reembolso", "retorno", "cambio", "cambiar"],
            "garantia": ["garantía", "warranty", "cobertura", "asegurado"],
            "stock": ["disponible", "disponibilidad", "inventario", "existencia", "hay"],
            "contacto": ["contactar", "soporte", "ayuda", "comunicarse", "hablar"],
            "precio": ["costo", "valor", "tarifa", "cuanto cuesta", "precio"],
            "tiempo": ["cuanto tarda", "demora", "plazo", "duracion", "duración"]
        };
        this.init();
    }

    async init() {
        await this.loadFAQs();
        this.createChatbotUI();
        this.bindEvents();
        this.addWelcomeMessage();
    }

    async loadFAQs() {
        try {
            const response = await fetch('data/faq.json');
            const data = await response.json();
            this.faqs = data.faqs || [];
            this.greetings = data.greetings || [];
            this.fallback = data.fallback || "Lo siento, no entendí tu pregunta.";
            this.suggestions = data.suggestions || [];
            this.categories = data.categories || {};
        } catch (error) {
            console.error('Error cargando FAQs:', error);
            this.faqs = [];
        }
    }

    createChatbotUI() {
        // Botón flotante del chatbot
        const chatbotButton = document.createElement('button');
        chatbotButton.id = 'chatbotButton';
        chatbotButton.className = 'chatbot-button';
        chatbotButton.innerHTML = '<i class="fas fa-comments"></i>';
        chatbotButton.setAttribute('aria-label', 'Abrir chatbot');
        document.body.appendChild(chatbotButton);

        // Contenedor del chatbot
        const chatbotContainer = document.createElement('div');
        chatbotContainer.id = 'chatbotContainer';
        chatbotContainer.className = 'chatbot-container';
        chatbotContainer.innerHTML = `
            <div class="chatbot-header">
                <div class="chatbot-header-content">
                    <div class="chatbot-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="chatbot-header-info">
                        <h3>Asistente Virtual</h3>
                        <span class="chatbot-status">En línea</span>
                    </div>
                </div>
                <button class="chatbot-close" id="chatbotClose">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="chatbot-messages" id="chatbotMessages">
                <!-- Los mensajes se agregarán aquí -->
            </div>
            <div class="chatbot-suggestions" id="chatbotSuggestions">
                <!-- Sugerencias rápidas -->
            </div>
            <div class="chatbot-input-container">
                <input 
                    type="text" 
                    id="chatbotInput" 
                    class="chatbot-input" 
                    placeholder="Escribe tu pregunta..."
                    autocomplete="off"
                />
                <button class="chatbot-send" id="chatbotSend">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;
        document.body.appendChild(chatbotContainer);

        // Overlay (similar al carrito)
        const chatbotOverlay = document.createElement('div');
        chatbotOverlay.id = 'chatbotOverlay';
        chatbotOverlay.className = 'chatbot-overlay';
        document.body.appendChild(chatbotOverlay);
    }

    bindEvents() {
        const button = document.getElementById('chatbotButton');
        const closeBtn = document.getElementById('chatbotClose');
        const sendBtn = document.getElementById('chatbotSend');
        const input = document.getElementById('chatbotInput');
        const overlay = document.getElementById('chatbotOverlay');

        button?.addEventListener('click', () => this.toggleChatbot());
        closeBtn?.addEventListener('click', () => this.closeChatbot());
        overlay?.addEventListener('click', () => this.closeChatbot());
        sendBtn?.addEventListener('click', () => this.sendMessage());
        
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Cerrar con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeChatbot();
            }
        });
    }

    toggleChatbot() {
        if (this.isOpen) {
            this.closeChatbot();
        } else {
            this.openChatbot();
        }
    }

    openChatbot() {
        this.isOpen = true;
        const container = document.getElementById('chatbotContainer');
        const overlay = document.getElementById('chatbotOverlay');
        const input = document.getElementById('chatbotInput');
        
        container?.classList.add('open');
        overlay?.classList.add('active');
        
        // Focus en el input
        setTimeout(() => {
            input?.focus();
        }, 300);
    }

    closeChatbot() {
        this.isOpen = false;
        const container = document.getElementById('chatbotContainer');
        const overlay = document.getElementById('chatbotOverlay');
        
        container?.classList.remove('open');
        overlay?.classList.remove('active');
    }

    addWelcomeMessage() {
        const greeting = this.greetings[Math.floor(Math.random() * this.greetings.length)];
        this.addMessage(greeting, 'bot');
        this.showSuggestions();
    }

    showSuggestions(specificSuggestions = null) {
        const suggestionsContainer = document.getElementById('chatbotSuggestions');
        if (!suggestionsContainer) return;

        const suggestionsToShow = specificSuggestions || this.suggestions;
        if (suggestionsToShow.length === 0) return;

        suggestionsContainer.innerHTML = suggestionsToShow
            .slice(0, 6) // Máximo 6 sugerencias
            .map(suggestion => `
                <button class="chatbot-suggestion-btn" data-question="${suggestion}">
                    ${suggestion}
                </button>
            `)
            .join('');

        // Agregar eventos a los botones de sugerencia
        suggestionsContainer.querySelectorAll('.chatbot-suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.getAttribute('data-question');
                this.processUserMessage(question);
            });
        });
    }

    sendMessage() {
        const input = document.getElementById('chatbotInput');
        const message = input?.value.trim();
        
        if (!message) return;

        this.addMessage(message, 'user');
        input.value = '';
        this.hideSuggestions();
        
        // Simular "escribiendo..."
        this.showTypingIndicator();
        
        // Procesar mensaje después de un pequeño delay
        setTimeout(() => {
            this.hideTypingIndicator();
            this.processUserMessage(message);
        }, 500);
    }

    processUserMessage(message) {
        const normalizedMessage = message.toLowerCase().trim();
        
        // Detectar saludos
        if (this.isGreeting(normalizedMessage)) {
            this.addMessage("¡Hola! ¿En qué puedo ayudarte?", 'bot');
            setTimeout(() => this.showSuggestions(), 500);
            return;
        }

        // Detectar despedidas
        if (this.isFarewell(normalizedMessage)) {
            this.addMessage("¡Gracias por contactarnos! Si tienes más preguntas, estaré aquí para ayudarte.", 'bot');
            return;
        }
        
        // Buscar coincidencias en las FAQs
        const matches = this.findMatches(normalizedMessage);
        
        if (matches.length > 0) {
            const bestMatch = matches[0];
            this.lastCategory = bestMatch.faq.category;
            
            // Mostrar la mejor respuesta
            this.addMessage(bestMatch.faq.answer, 'bot');
            
            // Si hay múltiples buenas coincidencias, ofrecerlas
            if (matches.length > 1 && matches[1].score >= bestMatch.score * 0.7) {
                setTimeout(() => {
                    this.addMessage("También podría interesarte:", 'bot');
                    matches.slice(1, 3).forEach(match => {
                        this.addMessage(`• ${match.faq.question}`, 'bot', true);
                    });
                }, 800);
            }
            
            // Mostrar sugerencias relacionadas por categoría
            setTimeout(() => {
                const relatedSuggestions = this.getRelatedSuggestions(bestMatch.faq.category);
                if (relatedSuggestions.length > 0) {
                    this.showSuggestions(relatedSuggestions);
                } else {
                    this.showSuggestions();
                }
            }, 1000);
        } else {
            // Fallback mejorado con sugerencias inteligentes
            this.addMessage(this.fallback, 'bot');
            setTimeout(() => {
                const smartSuggestions = this.getSmartSuggestions(normalizedMessage);
                this.showSuggestions(smartSuggestions.length > 0 ? smartSuggestions : this.suggestions);
            }, 500);
        }
    }

    isGreeting(message) {
        const greetings = ["hola", "hi", "hey", "buenos dias", "buenos días", "buenas tardes", "buenas noches", "saludos"];
        return greetings.some(g => message.includes(g));
    }

    isFarewell(message) {
        const farewells = ["adios", "adiós", "chao", "bye", "hasta luego", "gracias", "muchas gracias"];
        return farewells.some(f => message.includes(f));
    }

    findMatches(message) {
        const matches = [];
        
        for (const faq of this.faqs) {
            const score = this.calculateMatchScore(message, faq);
            if (score > 0) {
                matches.push({ faq, score });
            }
        }
        
        // Ordenar por score descendente
        matches.sort((a, b) => b.score - a.score);
        
        return matches;
    }

    calculateMatchScore(message, faq) {
        let score = 0;
        const messageWords = this.tokenize(message);
        const normalizedMessage = message.toLowerCase();
        
        // Expandir sinónimos en el mensaje
        const expandedMessage = this.expandSynonyms(normalizedMessage);
        
        // 1. Coincidencias exactas en keywords (mayor peso)
        for (const keyword of faq.keywords) {
            const keywordLower = keyword.toLowerCase();
            
            // Coincidencia exacta completa
            if (expandedMessage.includes(keywordLower) || normalizedMessage.includes(keywordLower)) {
                score += 5;
            }
            
            // Coincidencia de palabra completa
            if (messageWords.some(word => word === keywordLower)) {
                score += 4;
            }
            
            // Coincidencia parcial (solo palabras de 4+ caracteres)
            for (const word of messageWords) {
                if (word.length >= 4) {
                    if (keywordLower.includes(word) || word.includes(keywordLower)) {
                        score += 2;
                    }
                }
            }
        }
        
        // 2. Coincidencias en la pregunta (peso medio)
        const questionLower = faq.question.toLowerCase();
        const questionWords = this.tokenize(questionLower);
        
        for (const word of messageWords) {
            if (word.length >= 4) {
                // Coincidencia exacta en pregunta
                if (questionWords.includes(word)) {
                    score += 3;
                }
                // Coincidencia parcial
                if (questionLower.includes(word) || word.includes(questionLower)) {
                    score += 1;
                }
            }
        }
        
        // 3. Coincidencias en la respuesta (peso bajo)
        const answerLower = faq.answer.toLowerCase();
        for (const word of messageWords) {
            if (word.length >= 5 && answerLower.includes(word)) {
                score += 1;
            }
        }
        
        // 4. Bonus por categoría si hay contexto previo
        if (this.lastCategory && faq.category === this.lastCategory) {
            score += 2;
        }
        
        // 5. Penalizar si el mensaje es muy corto y no hay coincidencias fuertes
        if (messageWords.length < 3 && score < 5) {
            score *= 0.5;
        }
        
        return score;
    }

    tokenize(text) {
        // Remover acentos y caracteres especiales, luego dividir en palabras
        return text
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 0);
    }

    expandSynonyms(message) {
        let expanded = message;
        for (const [key, synonyms] of Object.entries(this.synonyms)) {
            for (const synonym of synonyms) {
                if (message.includes(synonym)) {
                    expanded += ' ' + key;
                }
            }
        }
        return expanded;
    }

    getRelatedSuggestions(category) {
        if (!category || !this.categories[category]) {
            return this.suggestions;
        }
        return this.categories[category] || this.suggestions;
    }

    getSmartSuggestions(message) {
        // Analizar el mensaje y sugerir preguntas relacionadas
        const suggestions = [];
        const messageWords = this.tokenize(message);
        
        // Buscar FAQs que tengan palabras relacionadas
        const relatedFAQs = this.faqs
            .filter(faq => {
                const faqText = (faq.question + ' ' + faq.answer).toLowerCase();
                return messageWords.some(word => 
                    word.length >= 4 && faqText.includes(word)
                );
            })
            .slice(0, 4);
        
        relatedFAQs.forEach(faq => {
            // Extraer palabras clave de la pregunta para la sugerencia
            const questionWords = faq.question.split(' ');
            if (questionWords.length <= 6) {
                suggestions.push(faq.question.replace('¿', '').replace('?', ''));
            } else {
                // Acortar si es muy larga
                suggestions.push(questionWords.slice(0, 4).join(' ') + '...');
            }
        });
        
        return suggestions.length > 0 ? suggestions : this.suggestions;
    }

    addMessage(text, type, isSubMessage = false) {
        const messagesContainer = document.getElementById('chatbotMessages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chatbot-message chatbot-message-${type}${isSubMessage ? ' chatbot-submessage' : ''}`;
        
        if (type === 'bot') {
            messageDiv.innerHTML = `
                <div class="chatbot-message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="chatbot-message-content">
                    ${this.formatMessage(text)}
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="chatbot-message-content">
                    ${this.formatMessage(text)}
                </div>
                <div class="chatbot-message-avatar">
                    <i class="fas fa-user"></i>
                </div>
            `;
        }

        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Guardar en historial
        this.chatHistory.push({ text, type, timestamp: new Date() });
    }

    formatMessage(text) {
        // Escapar HTML primero
        let formatted = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // Convertir URLs a enlaces
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');
        
        // Convertir emails a enlaces
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
        formatted = formatted.replace(emailRegex, '<a href="mailto:$1">$1</a>');
        
        // Convertir números de teléfono
        const phoneRegex = /(\+?\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,9})/g;
        formatted = formatted.replace(phoneRegex, '<a href="tel:$1">$1</a>');
        
        // Convertir saltos de línea
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chatbotMessages');
        if (!messagesContainer) return;

        const typingDiv = document.createElement('div');
        typingDiv.id = 'chatbotTyping';
        typingDiv.className = 'chatbot-message chatbot-message-bot chatbot-typing';
        typingDiv.innerHTML = `
            <div class="chatbot-message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="chatbot-message-content">
                <span class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </span>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typing = document.getElementById('chatbotTyping');
        typing?.remove();
    }

    hideSuggestions() {
        const suggestions = document.getElementById('chatbotSuggestions');
        if (suggestions) {
            suggestions.innerHTML = '';
        }
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatbotMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
}

// Inicializar chatbot cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.chatbot = new Chatbot();
    });
} else {
    window.chatbot = new Chatbot();
}
