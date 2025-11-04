// Sistema de Carrito de Compras
class Cart {
    constructor() {
        this.apiClient = window.apiClient;
        this.items = [];
        this.total = 0;
        this.init();
    }

    async init() {
        this.bindEvents();
        // Esperar a que apiClient esté disponible
        if (this.apiClient) {
            await this.loadCartFromAPI();
        } else {
            // Fallback a localStorage si apiClient no está disponible
            this.items = this.loadFromStorage();
            this.total = this.getTotal();
        }
        this.updateCartDisplay();
    }

    bindEvents() {
        // Abrir/cerrar carrito
        const cartIcon = document.getElementById('cartIcon');
        const cartClose = document.getElementById('cartClose');
        const cartOverlay = document.getElementById('cartOverlay');

        if (cartIcon) {
            cartIcon.addEventListener('click', () => this.openCart());
        }

        if (cartClose) {
            cartClose.addEventListener('click', () => this.closeCart());
        }

        if (cartOverlay) {
            cartOverlay.addEventListener('click', () => this.closeCart());
        }

        // Botón de checkout
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => this.proceedToCheckout());
        }

        // Delegación de eventos para botones de carrito
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-add-cart')) {
                const productId = e.target.dataset.productId;
                const product = this.getProductById(productId);
                if (product) {
                    this.addItem(product);
                }
            }
        });
    }

    // Cargar carrito desde la API
    async loadCartFromAPI() {
        try {
            if (!this.apiClient) {
                throw new Error('API client no disponible');
            }
            const response = await this.apiClient.getCart();
            this.items = response.data.items;
            this.total = response.data.total;
        } catch (error) {
            console.error('Error al cargar carrito:', error);
            // Fallback a localStorage
            this.items = this.loadFromStorage();
            this.total = this.getTotal();
        }
    }

    // Agregar producto al carrito
    async addItem(product, quantity = 1) {
        try {
            if (this.apiClient) {
                const response = await this.apiClient.addToCart(product.id, quantity);
                this.items = response.data.items;
                this.total = response.data.total;
            } else {
                // Fallback a localStorage si API no está disponible
                this.addItemToLocalStorage(product, quantity);
            }
            this.updateCartDisplay();
            Utils.showToast(`${product.name} agregado al carrito`, 'success');
        } catch (error) {
            console.error('Error al agregar al carrito:', error);
            // Fallback a localStorage en caso de error
            this.addItemToLocalStorage(product, quantity);
            this.updateCartDisplay();
            Utils.showToast(`${product.name} agregado al carrito (modo offline)`, 'info');
        }
    }

    // Agregar producto al localStorage (fallback)
    addItemToLocalStorage(product, quantity = 1) {
        const existingItem = this.items.find(item => item.id === product.id);
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.items.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: quantity,
                image: product.image,
                sku: product.sku
            });
        }
        
        this.saveToStorage();
    }

    // Remover producto del carrito
    removeItem(productId) {
        this.items = this.items.filter(item => item.id !== productId);
        this.saveToStorage();
        this.updateCartDisplay();
        Utils.showToast('Producto removido del carrito', 'info');
    }

    // Actualizar cantidad de producto
    updateQuantity(productId, quantity) {
        const item = this.items.find(item => item.id === productId);
        if (item) {
            if (quantity <= 0) {
                this.removeItem(productId);
            } else {
                item.quantity = quantity;
                this.saveToStorage();
                this.updateCartDisplay();
            }
        }
    }

    // Limpiar carrito
    clearCart() {
        this.items = [];
        this.saveToStorage();
        this.updateCartDisplay();
        Utils.showToast('Carrito vaciado', 'info');
    }

    // Obtener total del carrito
    getTotal() {
        return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    // Obtener cantidad total de items
    getTotalItems() {
        return this.items.reduce((total, item) => total + item.quantity, 0);
    }

    // Actualizar display del carrito
    updateCartDisplay() {
        this.updateCartCount();
        this.updateCartContent();
        this.updateCartTotal();
    }

    // Actualizar contador del carrito
    updateCartCount() {
        const cartCount = document.getElementById('cartCount');
        if (cartCount) {
            const totalItems = this.getTotalItems();
            cartCount.textContent = totalItems;
            cartCount.style.display = totalItems > 0 ? 'block' : 'none';
        }
    }

    // Actualizar contenido del carrito
    updateCartContent() {
        const cartContent = document.getElementById('cartContent');
        if (!cartContent) return;

        if (this.items.length === 0) {
            cartContent.innerHTML = `
                <div class="cart-empty">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Tu carrito está vacío</p>
                </div>
            `;
        } else {
            cartContent.innerHTML = this.items.map(item => `
                <div class="cart-item" data-product-id="${item.id}">
                    <div class="cart-item-image">
                        <img src="${item.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSIzMiIgeT0iMzIiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlbjwvdGV4dD48L3N2Zz4='}" alt="${item.name}">
                    </div>
                    <div class="cart-item-details">
                        <h4>${item.name}</h4>
                        <p class="cart-item-price">${Utils.formatPrice(item.price)}</p>
                        <div class="cart-item-controls">
                            <button class="btn-quantity" data-action="decrease" data-product-id="${item.id}">-</button>
                            <span class="cart-item-quantity">${item.quantity}</span>
                            <button class="btn-quantity" data-action="increase" data-product-id="${item.id}">+</button>
                            <button class="btn-remove" data-product-id="${item.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');

            // Bind eventos para controles del carrito
            this.bindCartItemEvents();
        }
    }

    // Bind eventos para items del carrito
    bindCartItemEvents() {
        const cartContent = document.getElementById('cartContent');
        if (!cartContent) return;

        cartContent.addEventListener('click', (e) => {
            const productId = e.target.dataset.productId;
            const action = e.target.dataset.action;

            if (action === 'increase') {
                const item = this.items.find(item => item.id === productId);
                if (item) {
                    this.updateQuantity(productId, item.quantity + 1);
                }
            } else if (action === 'decrease') {
                const item = this.items.find(item => item.id === productId);
                if (item) {
                    this.updateQuantity(productId, item.quantity - 1);
                }
            } else if (e.target.classList.contains('btn-remove') || e.target.closest('.btn-remove')) {
                this.removeItem(productId);
            }
        });
    }

    // Actualizar total del carrito
    updateCartTotal() {
        const cartTotal = document.getElementById('cartTotal');
        const checkoutBtn = document.getElementById('checkoutBtn');
        
        if (cartTotal) {
            cartTotal.textContent = Utils.formatPrice(this.getTotal());
        }

        if (checkoutBtn) {
            checkoutBtn.disabled = this.items.length === 0;
        }
    }

    // Abrir carrito
    openCart() {
        const cartSidebar = document.getElementById('cartSidebar');
        const cartOverlay = document.getElementById('cartOverlay');
        
        if (cartSidebar) {
            cartSidebar.classList.add('open');
        }
        
        if (cartOverlay) {
            cartOverlay.classList.add('active');
        }

        // Prevenir scroll del body
        document.body.style.overflow = 'hidden';
    }

    // Cerrar carrito
    closeCart() {
        const cartSidebar = document.getElementById('cartSidebar');
        const cartOverlay = document.getElementById('cartOverlay');
        
        if (cartSidebar) {
            cartSidebar.classList.remove('open');
        }
        
        if (cartOverlay) {
            cartOverlay.classList.remove('active');
        }

        // Restaurar scroll del body
        document.body.style.overflow = '';
    }

    // Proceder al checkout
    proceedToCheckout() {
        if (this.items.length === 0) {
            Utils.showToast('El carrito está vacío', 'warning');
            return;
        }

        // Por ahora, mostrar los datos del carrito
        const orderData = {
            items: this.items,
            total: this.getTotal(),
            totalItems: this.getTotalItems(),
            timestamp: new Date().toISOString()
        };

        console.log('Datos del pedido:', orderData);
        Utils.showToast('Redirigiendo al checkout...', 'info');
        
        // Aquí se integraría con el sistema de pagos
        // Por ahora, simulamos el proceso
        setTimeout(() => {
            this.clearCart();
            Utils.showToast('Pedido procesado exitosamente', 'success');
        }, 2000);
    }

    // Obtener producto por ID (simulado)
    getProductById(productId) {
        // En una implementación real, esto vendría de una API o base de datos
        const mockProducts = {
            '1': {
                id: '1',
                name: 'Cable Cat6 UTP 305m',
                price: 2500,
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNhYmxlIENhdDY8L3RleHQ+PC9zdmc+',
                sku: 'CAT6-305M'
            },
            '2': {
                id: '2',
                name: 'Conectores RJ45 Cat6',
                price: 150,
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNvbmVjdG9yIFJKNjQ1PC90ZXh0Pjwvc3ZnPg==',
                sku: 'RJ45-CAT6'
            }
        };

        return mockProducts[productId] || null;
    }

    // Guardar en localStorage
    saveToStorage() {
        try {
            localStorage.setItem('cart', JSON.stringify(this.items));
        } catch (error) {
            console.error('Error al guardar carrito:', error);
        }
    }

    // Cargar desde localStorage
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('cart');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error al cargar carrito:', error);
            return [];
        }
    }

    // Obtener datos del carrito para API
    getCartData() {
        return {
            items: this.items,
            total: this.getTotal(),
            totalItems: this.getTotalItems(),
            timestamp: new Date().toISOString()
        };
    }
}

// Inicializar carrito cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que apiClient esté disponible
    const initCart = () => {
        if (window.apiClient) {
            window.cart = new Cart();
        } else {
            // Reintentar después de un breve delay
            setTimeout(initCart, 100);
        }
    };
    initCart();
});

// Exportar para uso global
window.Cart = Cart;
