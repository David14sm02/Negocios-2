// Sistema de Carrito de Compras
class Cart {
    constructor() {
        this.apiClient = window.apiClient;
        this.items = [];
        this.total = 0;
        this.isProcessingCheckout = false;
        this.cartEventsBound = false;
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
            if (response.success && response.data) {
                this.items = response.data.items || [];
                this.total = response.data.total || 0;
            } else {
                throw new Error('Respuesta inválida de la API');
            }
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
                let productId = product.id || product.product_id;
                
                // Si no hay productId pero tenemos SKU, buscar primero por SKU
                if (!productId && product.sku) {
                    try {
                        const productsResponse = await this.apiClient.getProducts({ limit: 100 });
                        if (productsResponse.success && productsResponse.data) {
                            const productsArray = Array.isArray(productsResponse.data) ? productsResponse.data : productsResponse.data.products || [];
                            const foundProduct = productsArray.find(p => p.sku === product.sku);
                            if (foundProduct) {
                                productId = foundProduct.id;
                                console.log(`✅ Producto encontrado por SKU: ${product.sku} -> ID: ${productId}`);
                            }
                        }
                    } catch (skuError) {
                        console.warn('No se pudo buscar producto por SKU:', skuError);
                    }
                }

                if (!productId) {
                    throw new Error('ID de producto no disponible');
                }

                const response = await this.apiClient.addToCart(productId, quantity);
                if (response.success && response.data) {
                    this.items = response.data.items || [];
                    this.total = response.data.total || 0;
                    this.updateCartDisplay();
                    Utils.showToast(`${product.name} agregado al carrito`, 'success');
                    return;
                } else {
                    throw new Error('Respuesta inválida del servidor');
                }
            } else {
                throw new Error('API client no disponible');
            }
        } catch (error) {
            console.error('Error al agregar al carrito:', error);
            
            // Fallback a localStorage solo si realmente no hay conexión
            if (error.message.includes('404') || error.message.includes('Producto no encontrado')) {
                // Si el error es 404, intentar buscar por SKU una vez más
                if (product.sku && this.apiClient) {
                    try {
                        const productsResponse = await this.apiClient.getProducts({ limit: 100 });
                        if (productsResponse.success && productsResponse.data) {
                            const productsArray = Array.isArray(productsResponse.data) ? productsResponse.data : productsResponse.data.products || [];
                            const foundProduct = productsArray.find(p => p.sku === product.sku);
                            if (foundProduct) {
                                console.log(`🔄 Reintentando con ID correcto por SKU: ${product.sku} -> ${foundProduct.id}`);
                                const retryResponse = await this.apiClient.addToCart(foundProduct.id, quantity);
                                if (retryResponse.success && retryResponse.data) {
                                    this.items = retryResponse.data.items || [];
                                    this.total = retryResponse.data.total || 0;
                                    this.updateCartDisplay();
                                    Utils.showToast(`${product.name} agregado al carrito`, 'success');
                                    return;
                                }
                            }
                        }
                    } catch (retryError) {
                        console.error('Error en reintento por SKU:', retryError);
                    }
                }
                
                Utils.showToast(`Error: No se pudo agregar ${product.name}. Verifique la conexión.`, 'error');
            } else {
                // Para otros errores, usar localStorage
                this.addItemToLocalStorage(product, quantity);
                this.total = this.getTotal();
                this.updateCartDisplay();
                Utils.showToast(`${product.name} agregado al carrito (modo offline)`, 'info');
            }
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
    async removeItem(productId) {
        try {
            if (this.apiClient) {
                const response = await this.apiClient.removeFromCart(productId);
                if (response.success && response.data) {
                    this.items = response.data.items || [];
                    this.total = response.data.total || 0;
                } else {
                    throw new Error('Respuesta inválida del servidor');
                }
                this.updateCartDisplay();
                Utils.showToast('Producto removido del carrito', 'success');
            } else {
                // Fallback a localStorage
                this.items = this.items.filter(item => {
                    const itemId = item.id || item.product_id;
                    return itemId !== productId && itemId !== parseInt(productId);
                });
                this.total = this.getTotal();
                this.saveToStorage();
                this.updateCartDisplay();
                Utils.showToast('Producto removido del carrito', 'info');
            }
        } catch (error) {
            console.error('Error al remover del carrito:', error);
            const errorMessage = error.message || 'Error al remover producto del carrito';
            Utils.showToast(errorMessage, 'error');
        }
    }

    // Actualizar cantidad de producto
    async updateQuantity(productId, quantity) {
        try {
            if (quantity <= 0) {
                await this.removeItem(productId);
                return;
            }

            if (this.apiClient) {
                const response = await this.apiClient.updateCartItem(productId, quantity);
                if (response.success && response.data) {
                    this.items = response.data.items || [];
                    this.total = response.data.total || 0;
                } else {
                    throw new Error('Respuesta inválida del servidor');
                }
                this.updateCartDisplay();
            } else {
                // Fallback a localStorage
                const item = this.items.find(item => {
                    const itemId = item.id || item.product_id;
                    return itemId === productId || itemId === parseInt(productId);
                });
                if (item) {
                    item.quantity = quantity;
                    this.total = this.getTotal();
                    this.saveToStorage();
                    this.updateCartDisplay();
                }
            }
        } catch (error) {
            console.error('Error al actualizar cantidad:', error);
            const errorMessage = error.message || 'Error al actualizar cantidad';
            Utils.showToast(errorMessage, 'error');
        }
    }

    // Limpiar carrito
    async clearCart() {
        try {
            if (this.apiClient) {
                await this.apiClient.clearCart();
            }
        } catch (error) {
            console.warn('Error al limpiar carrito en el servidor:', error);
        }
        this.items = [];
        this.total = 0;
        this.saveToStorage();
        this.updateCartDisplay();
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
            cartContent.innerHTML = this.items.map(item => {
                // Manejar tanto id como product_id del backend
                const productId = item.product_id || item.id;
                const imageUrl = item.image_url || item.image;
                
                return `
                <div class="cart-item" data-product-id="${productId}">
                    <div class="cart-item-image">
                        <img src="${imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSIzMiIgeT0iMzIiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlbjwvdGV4dD48L3N2Zz4='}" alt="${item.name}">
                    </div>
                    <div class="cart-item-details">
                        <h4>${item.name}</h4>
                        <p class="cart-item-price">${Utils.formatPrice(item.price)}</p>
                        <div class="cart-item-controls">
                            <button class="btn-quantity" data-action="decrease" data-product-id="${productId}">-</button>
                            <input
                                type="number"
                                class="cart-item-quantity"
                                value="${item.quantity}"
                                min="1"
                                data-product-id="${productId}"
                            >
                            <button class="btn-quantity" data-action="increase" data-product-id="${productId}">+</button>
                            <button class="btn-remove" data-product-id="${productId}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            }).join('');

            // Bind eventos para controles del carrito
            this.bindCartItemEvents();
        }
    }

    // Bind eventos para items del carrito
    bindCartItemEvents() {
        if (this.cartEventsBound) {
            return;
        }

        const cartContent = document.getElementById('cartContent');
        if (!cartContent) return;

        this.cartEventsBound = true;

        cartContent.addEventListener('click', (e) => {
            // Obtener el productId del botón clickeado o de su contenedor
            const button = e.target.closest('[data-product-id]');
            if (!button) return;

            const productId = button.dataset.productId;
            const action = button.dataset.action;

            // Buscar el item por product_id o id
            const item = this.items.find(item => {
                const itemId = item.product_id || item.id;
                return itemId == productId;
            });

            // Asegurar que productId sea un número
            const productIdNum = parseInt(productId);
            
            if (action === 'increase') {
                if (item) {
                    this.updateQuantity(productIdNum, item.quantity + 1);
                }
            } else if (action === 'decrease') {
                if (item) {
                    this.updateQuantity(productIdNum, item.quantity - 1);
                }
            } else if (e.target.classList.contains('btn-remove') || e.target.closest('.btn-remove')) {
                this.removeItem(productIdNum);
            }
        });

        cartContent.addEventListener('change', (e) => {
            if (!e.target.classList.contains('cart-item-quantity')) {
                return;
            }

            const input = e.target;
            const productId = parseInt(input.dataset.productId, 10);
            let newQuantity = parseInt(input.value, 10);

            if (Number.isNaN(newQuantity) || newQuantity < 1) {
                newQuantity = 1;
            }

            input.value = newQuantity;
            this.updateQuantity(productId, newQuantity);
        });

        cartContent.addEventListener('keydown', (e) => {
            if (!e.target.classList.contains('cart-item-quantity')) {
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });
    }

    // Actualizar total del carrito
    updateCartTotal() {
        const cartTotal = document.getElementById('cartTotal');
        const checkoutBtn = document.getElementById('checkoutBtn');
        
        if (cartTotal) {
            // Usar el total del backend si está disponible, sino calcularlo
            const total = this.total !== undefined ? this.total : this.getTotal();
            cartTotal.textContent = Utils.formatPrice(total);
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
    async proceedToCheckout() {
        if (this.isProcessingCheckout) {
            return;
        }

        if (this.items.length === 0) {
            Utils.showToast('El carrito está vacío', 'warning');
            return;
        }

        if (!this.apiClient || !this.apiClient.isAuthenticated()) {
            Utils.showToast('Debes iniciar sesión para completar la compra.', 'warning');
            return;
        }

        const checkoutBtn = document.getElementById('checkoutBtn');
        this.isProcessingCheckout = true;

        if (checkoutBtn) {
            checkoutBtn.disabled = true;
        }

        try {
            const orderItems = this.items
                .map(item => {
                    const productId = parseInt(item.product_id || item.id, 10);
                    return {
                        product_id: Number.isNaN(productId) ? null : productId,
                        quantity: item.quantity
                    };
                })
                .filter(item => item.product_id && item.quantity > 0);

            if (orderItems.length === 0) {
                throw new Error('No se pudieron preparar los productos del carrito.');
            }

            const orderPayload = {
                items: orderItems,
                payment_method: 'stripe'
            };

            const orderResponse = await this.apiClient.createOrder(orderPayload);

            if (!orderResponse?.success) {
                throw new Error(orderResponse?.error || 'No se pudo crear la orden de compra.');
            }

            const order = orderResponse?.data?.order;
            if (!order || !order.id) {
                throw new Error('No se pudo crear la orden de compra.');
            }

            const origin = window.location.origin;
            const checkoutResponse = await this.apiClient.createCheckoutSession({
                order_id: order.id,
                success_url: `${origin}/checkout/success?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${origin}/checkout/cancel?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`
            });

            const checkoutUrl = checkoutResponse?.data?.url;
            if (!checkoutUrl) {
                throw new Error('Stripe no devolvió una URL de checkout.');
            }

            Utils.showToast('Redirigiendo al checkout seguro...', 'info');
            window.location.href = checkoutUrl;
        } catch (error) {
            console.error('Error al iniciar el checkout:', error);
            
            let errorMessage = 'No se pudo iniciar el pago.';
            
            if (error.message) {
                if (error.message.includes('Invalid API Key')) {
                    errorMessage = 'Error de configuración: La clave API de Stripe no es válida. Por favor, contacta al administrador.';
                } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                    errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                } else if (error.message.includes('No se pudo crear la orden')) {
                    errorMessage = 'No se pudo crear la orden. Verifica que los productos estén disponibles.';
                } else {
                    errorMessage = error.message;
                }
            }
            
            Utils.showToast(errorMessage, 'error');
            this.isProcessingCheckout = false;
            if (checkoutBtn) {
                checkoutBtn.disabled = this.items.length === 0;
            }
        }
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
