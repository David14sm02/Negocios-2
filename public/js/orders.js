class OrdersPage {
    constructor() {
        this.apiClient = window.apiClient;
        this.ordersList = document.getElementById('ordersList');
        this.isLoading = false;
        this.init();
    }

    async init() {
        if (!this.ordersList) {
            return;
        }

        if (!this.apiClient || !this.apiClient.isAuthenticated()) {
            Utils.showToast('Debes iniciar sesión para ver tus pedidos.', 'warning');
            setTimeout(() => {
                window.location.href = 'login.html?redirect=orders.html';
            }, 1500);
            return;
        }

        this.renderLoading();

        try {
            const response = await this.apiClient.getOrders({ limit: 50 });
            if (response?.success && Array.isArray(response.data) && response.data.length > 0) {
                this.renderOrders(response.data);
            } else {
                this.renderEmptyState();
            }
        } catch (error) {
            console.error('Error al cargar los pedidos:', error);
            this.renderErrorState();
        }
    }

    renderLoading() {
        this.isLoading = true;
        this.ordersList.innerHTML = `
            <div class="orders-loading">
                <div class="spinner"></div>
            </div>
        `;
    }

    renderEmptyState() {
        this.isLoading = false;
        this.ordersList.innerHTML = `
            <div class="orders-empty">
                <i class="fas fa-box-open"></i>
                <h3>Sin pedidos todavía</h3>
                <p>Cuando realices una compra aparecerá aquí el historial de tus pedidos.</p>
                <a class="btn btn-primary" href="catalog.html">
                    Ir al catálogo
                </a>
            </div>
        `;
    }

    renderErrorState() {
        this.isLoading = false;
        this.ordersList.innerHTML = `
            <div class="orders-error">
                <i class="fas fa-triangle-exclamation"></i>
                <h3>No pudimos cargar tus pedidos</h3>
                <p>Ocurrió un problema al cargar el historial. Por favor, intenta nuevamente.</p>
                <button class="btn btn-outline" id="retryOrdersBtn">
                    Reintentar
                </button>
            </div>
        `;

        const retryBtn = document.getElementById('retryOrdersBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.init());
        }
    }

    renderOrders(orders) {
        this.isLoading = false;
        this.ordersList.innerHTML = orders.map(order => this.renderOrderCard(order)).join('');
    }

    renderOrderCard(order) {
        const statusBadge = this.getStatusBadge(order.status);
        const orderNumber = order.order_number || `ORD-${order.id}`;
        const createdAt = order.created_at ? Utils.formatDate(order.created_at) : 'Fecha no disponible';
        const subtotal = Utils.formatPrice(order.subtotal ?? order.total ?? 0);
        const total = Utils.formatPrice(order.total ?? 0);
        const items = Array.isArray(order.items) ? order.items : [];

        const itemsList = items.map(item => `
            <li class="order-item">
                <div class="order-item-info">
                    <span class="order-item-name">${item.product_name || 'Producto sin nombre'}</span>
                    <span class="order-item-sku">SKU: ${item.product_sku || 'N/D'}</span>
                </div>
                <div class="order-item-meta">
                    <span class="order-item-quantity">x${item.quantity}</span>
                    <span class="order-item-price">${Utils.formatPrice(item.price || 0)}</span>
                </div>
            </li>
        `).join('');

        return `
            <article class="order-card">
                <header class="order-card-header">
                    <div>
                        <h3 class="order-title">Pedido ${orderNumber}</h3>
                        <span class="order-date">${createdAt}</span>
                    </div>
                    ${statusBadge}
                </header>
                <div class="order-card-body">
                    <ul class="order-items">
                        ${itemsList}
                    </ul>
                </div>
                <footer class="order-card-footer">
                    <div class="order-summary">
                        <span class="order-subtotal">Subtotal: ${subtotal}</span>
                        <span class="order-total">Total pagado: ${total}</span>
                    </div>
                </footer>
            </article>
        `;
    }

    getStatusBadge(status = 'pending') {
        const map = {
            pending: { label: 'Pendiente', className: 'status-pending', icon: 'fa-clock' },
            processing: { label: 'Procesando', className: 'status-processing', icon: 'fa-gear' },
            shipped: { label: 'Enviado', className: 'status-shipped', icon: 'fa-truck' },
            delivered: { label: 'Entregado', className: 'status-delivered', icon: 'fa-circle-check' },
            cancelled: { label: 'Cancelado', className: 'status-cancelled', icon: 'fa-ban' }
        };

        const statusInfo = map[status] || map.pending;

        return `
            <span class="order-status ${statusInfo.className}">
                <i class="fas ${statusInfo.icon}"></i>
                ${statusInfo.label}
            </span>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new OrdersPage();
});

