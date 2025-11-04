// API Client para comunicación con el backend
class ApiClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.token = localStorage.getItem('authToken');
    }

    // Configurar token de autenticación
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
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
        return this.get(`/products/${id}`);
    }

    async getProductsByCategory(categoryId, params = {}) {
        return this.get(`/products/category/${categoryId}`, params);
    }

    async getFeaturedProducts(limit = 8) {
        return this.get('/products/featured/list', { limit });
    }

    async getCategories() {
        return this.get('/products/categories/list');
    }

    // ===== CARRITO =====
    async getCart() {
        return this.get('/cart');
    }

    async addToCart(productId, quantity = 1) {
        return this.post('/cart/add', { product_id: productId, quantity });
    }

    async updateCartItem(productId, quantity) {
        return this.put('/cart/update', { product_id: productId, quantity });
    }

    async removeFromCart(productId) {
        return this.delete(`/cart/remove/${productId}`);
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
        return result;
    }

    async login(email, password) {
        const result = await this.post('/users/login', { email, password });
        if (result.data.token) {
            this.setToken(result.data.token);
        }
        return result;
    }

    async logout() {
        this.setToken(null);
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

    // ===== UTILIDADES =====
    async healthCheck() {
        return this.get('/health');
    }

    // Verificar si el usuario está autenticado
    isAuthenticated() {
        return !!this.token;
    }

    // Obtener información del usuario desde el token
    getUserFromToken() {
        if (!this.token) return null;
        
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            return {
                id: payload.userId,
                exp: payload.exp
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
