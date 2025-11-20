// API Client para comunicación con el backend
class ApiClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.token = localStorage.getItem('authToken');
    }

    setCurrentUser(user) {
        if (user) {
            localStorage.setItem('authUser', JSON.stringify(user));
        } else {
            localStorage.removeItem('authUser');
        }
    }

    getCurrentUser() {
        try {
            const stored = localStorage.getItem('authUser');
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            return null;
        }
    }

    // Configurar token de autenticación
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
            this.setCurrentUser(null);
        }
    }

    // Obtener headers para las peticiones
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        // Agregar session ID para el carrito
        const sessionId = this.getSessionId();
        if (sessionId) {
            headers['X-Session-Id'] = sessionId;
        }

        return headers;
    }

    // Generar o obtener session ID
    getSessionId() {
        let sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    }

    // Método base para hacer peticiones
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error en la petición');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // GET request
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    // POST request
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // ===== PRODUCTOS =====
    async getProducts(params = {}) {
        return this.get('/products', params);
    }

    async getProduct(id) {
        // Asegurar que id sea un número válido
        const productId = parseInt(id);
        if (isNaN(productId) || productId < 1) {
            throw new Error('ID de producto inválido');
        }
        return this.get(`/products/${productId}`);
    }

    async getProductsByCategory(categoryId, params = {}) {
        return this.get(`/products/category/${categoryId}`, params);
    }

    async getFeaturedProducts(limit = 8) {
        return this.get('/products/featured/list', { limit });
    }

    async getCategories(params = {}) {
        return this.get('/products/categories/list', params);
    }

    async getAllCategories() {
        return this.get('/products/categories/manage');
    }

    async createProduct(productData) {
        return this.post('/products', productData);
    }

    async updateProduct(id, productData) {
        return this.put(`/products/${id}`, productData);
    }

    async updateProductStock(id, stockData) {
        return this.request(`/products/${id}/stock`, {
            method: 'PATCH',
            body: JSON.stringify(stockData)
        });
    }

    async deleteProduct(id) {
        return this.delete(`/products/${id}`);
    }

    async createCategory(categoryData) {
        return this.post('/products/categories', categoryData);
    }

    async updateCategory(id, categoryData) {
        return this.put(`/products/categories/${id}`, categoryData);
    }

    async deleteCategory(id) {
        return this.delete(`/products/categories/${id}`);
    }

    // ===== CARRITO =====
    async getCart() {
        return this.get('/cart');
    }

    async addToCart(productId, quantity = 1) {
        // Asegurar que productId sea un número
        const productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;
        return this.post('/cart/add', { product_id: productIdNum, quantity });
    }

    async updateCartItem(productId, quantity) {
        // Asegurar que productId sea un número
        const productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;
        return this.put('/cart/update', { product_id: productIdNum, quantity });
    }

    async removeFromCart(productId) {
        // Asegurar que productId sea un número
        const productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;
        return this.delete(`/cart/remove/${productIdNum}`);
    }

    async clearCart() {
        return this.delete('/cart/clear');
    }

    async getCartCount() {
        return this.get('/cart/count');
    }

    // ===== USUARIOS =====
    async register(userData) {
        const result = await this.post('/users/register', userData);
        if (result.data.token) {
            this.setToken(result.data.token);
        }
        if (result.data.user) {
            this.setCurrentUser(result.data.user);
        }
        return result;
    }

    async login(email, password) {
        const result = await this.post('/users/login', { email, password });
        if (result.data.token) {
            this.setToken(result.data.token);
        }
        if (result.data.user) {
            this.setCurrentUser(result.data.user);
        }
        return result;
    }

    async logout() {
        this.setToken(null);
        this.setCurrentUser(null);
    }

    async getProfile() {
        return this.get('/users/profile');
    }

    async updateProfile(profileData) {
        return this.put('/users/profile', profileData);
    }

    async changePassword(currentPassword, newPassword) {
        return this.put('/users/change-password', {
            current_password: currentPassword,
            new_password: newPassword
        });
    }

    async getUserOrders(params = {}) {
        return this.get('/users/orders', params);
    }

    // ===== ÓRDENES =====
    async createOrder(orderData) {
        return this.post('/orders', orderData);
    }

    async getOrders(params = {}) {
        return this.get('/orders', params);
    }

    async getOrder(id) {
        return this.get(`/orders/${id}`);
    }

    async cancelOrder(id) {
        return this.put(`/orders/${id}/cancel`);
    }

    async confirmOrderPayment(sessionId) {
        return this.post('/orders/confirm-payment', { session_id: sessionId });
    }

    async syncOrderPaymentStatus(orderId) {
        return this.post('/orders/sync-payment-status', { order_id: orderId });
    }

    // ===== PAGOS / STRIPE =====
    async createCheckoutSession({ order_id, success_url, cancel_url }) {
        const payload = { order_id };
        if (success_url) payload.success_url = success_url;
        if (cancel_url) payload.cancel_url = cancel_url;
        return this.post('/payments/checkout', payload);
    }

    // ===== UTILIDADES =====
    async healthCheck() {
        return this.get('/health');
    }

    // Verificar si el usuario está autenticado
    isAuthenticated() {
        return !!this.token;
    }

    // Verificar si el usuario actual es administrador
    isAdmin() {
        const currentUser = this.getCurrentUser();

        if (currentUser) {
            if (typeof currentUser.is_admin !== 'undefined') {
                return !!currentUser.is_admin;
            }

            if (typeof currentUser.isAdmin !== 'undefined') {
                return !!currentUser.isAdmin;
            }
        }

        const tokenUser = this.getUserFromToken();
        return tokenUser?.isAdmin === true;
    }

    // Obtener información del usuario desde el token
    getUserFromToken() {
        if (!this.token) return null;
        
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            return {
                id: payload.userId,
                exp: payload.exp,
                isAdmin: payload.isAdmin === true
            };
        } catch (error) {
            return null;
        }
    }
}

// Crear instancia global
window.apiClient = new ApiClient();

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
}
