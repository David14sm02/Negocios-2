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
            // El backend ahora sincroniza automáticamente los estados de pago
            const response = await this.apiClient.getOrders({ limit: 50 });
            if (response?.success && Array.isArray(response.data) && response.data.length > 0) {
                // Esperar un poco para que la sincronización en el backend termine
                await new Promise(resolve => setTimeout(resolve, 1000));
                // Recargar los pedidos para obtener los estados actualizados
                const updatedResponse = await this.apiClient.getOrders({ limit: 50 });
                if (updatedResponse?.success && Array.isArray(updatedResponse.data)) {
                    this.renderOrders(updatedResponse.data);
                } else {
                    this.renderOrders(response.data);
                }
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
        
        // Agregar event listeners para los botones de descarga de factura
        this.setupInvoiceDownloadButtons();
    }

    setupInvoiceDownloadButtons() {
        const downloadButtons = document.querySelectorAll('.download-invoice-btn');
        downloadButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                const orderId = button.getAttribute('data-order-id');
                if (!orderId) return;

                try {
                    // Obtener la factura mediante petición autenticada
                    const token = localStorage.getItem('authToken');
                    if (!token) {
                        Utils.showToast('Debes iniciar sesión para descargar la factura.', 'warning');
                        return;
                    }

                    // Hacer petición autenticada para obtener la factura
                    const invoiceUrl = `/api/orders/${orderId}/invoice`;
                    const response = await fetch(invoiceUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'text/html,application/pdf,*/*'
                        },
                        redirect: 'follow' // Seguir redirecciones automáticamente (a Stripe si existe)
                    });

                    // Verificar si hubo redirección a Stripe
                    if (response.redirected && response.url && response.url !== window.location.origin + invoiceUrl) {
                        // Si fue redirigido a una URL diferente (probablemente Stripe), abrirla directamente
                        window.open(response.url, '_blank');
                        return;
                    }

                    if (response.ok) {
                        const contentType = response.headers.get('content-type') || '';
                        
                        if (contentType.includes('text/html')) {
                            // Es HTML (factura generada), abrir en nueva ventana
                            const html = await response.text();
                            const newWindow = window.open('', '_blank');
                            if (newWindow) {
                                newWindow.document.write(html);
                                newWindow.document.close();
                            }
                        } else if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
                            // Es PDF, descargar
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `factura-${orderId}.pdf`;
                            a.target = '_blank';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                        } else {
                            // Otro tipo, intentar abrir directamente
                            window.open(invoiceUrl, '_blank');
                        }
                    } else {
                        const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
                        Utils.showToast(error.error || 'No se pudo descargar la factura.', 'error');
                    }
                } catch (error) {
                    console.error('Error descargando factura:', error);
                    Utils.showToast('Error al descargar la factura. Por favor, intenta nuevamente.', 'error');
                }
            });
        });
    }

    renderOrderCard(order) {
        // Determinar el estado a mostrar basándose en payment_status
        let displayStatus = order.status;
        const paymentStatus = order.payment_status;
        
        // Si el pago es exitoso, mostrar como "paid" (Pagado)
        if (paymentStatus === 'succeeded' || paymentStatus === 'paid') {
            displayStatus = 'paid';
        }
        
        const statusBadge = this.getStatusBadge(displayStatus, paymentStatus);
        const orderNumber = order.order_number || `ORD-${order.id}`;
        const createdAt = order.created_at ? Utils.formatDate(order.created_at) : 'Fecha no disponible';
        const subtotal = Utils.formatPrice(order.subtotal ?? order.total ?? 0);
        const total = Utils.formatPrice(order.total ?? 0);
        const items = Array.isArray(order.items) ? order.items : [];
        const hasReceipt = Boolean(order.receipt_url);
        const hasInvoice = Boolean(order.invoice_pdf);
        
        // Si el pago es exitoso, siempre mostrar documentos disponibles
        const isPaymentSucceeded = paymentStatus === 'succeeded' || paymentStatus === 'paid';

        const documents = [];
        if (hasReceipt) {
            documents.push(`
                <a href="${order.receipt_url}" target="_blank" rel="noopener" class="btn btn-outline order-document-link">
                    <i class="fas fa-receipt"></i>
                    Ver recibo
                </a>
            `);
        }
        // Si el pago es exitoso, siempre mostrar botón de factura
        if (isPaymentSucceeded) {
            // Si hay factura de Stripe (URL HTTP), usar directamente sin autenticación
            if (hasInvoice && order.invoice_pdf && order.invoice_pdf.startsWith('http')) {
                documents.push(`
                    <a href="${order.invoice_pdf}" target="_blank" rel="noopener" class="btn btn-outline order-document-link">
                        <i class="fas fa-file-invoice"></i>
                        Descargar factura
                    </a>
                `);
            } else {
                // Si no hay factura o es un endpoint, usar botón que hace petición autenticada
                documents.push(`
                    <button type="button" class="btn btn-outline order-document-link download-invoice-btn" data-order-id="${order.id}">
                        <i class="fas fa-file-invoice"></i>
                        Descargar factura
                    </button>
                `);
            }
        }

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
                        <div class="order-documents">
                            ${documents.length > 0 ? documents.join('') : isPaymentSucceeded ? `
                                <div class="order-documents-placeholder">
                                    <i class="fas fa-info-circle"></i>
                                    <span>La factura se generará próximamente.</span>
                                </div>
                            ` : `
                                <div class="order-documents-placeholder">
                                    <i class="fas fa-info-circle"></i>
                                    <span>Los comprobantes estarán disponibles una vez confirmado el pago.</span>
                                </div>
                            `}
                        </div>
                    </div>
                </footer>
            </article>
        `;
    }

    getStatusBadge(status = 'pending', paymentStatus = null) {
        const map = {
            pending: { label: 'Pendiente', className: 'status-pending', icon: 'fa-clock' },
            paid: { label: 'Pagado', className: 'status-paid', icon: 'fa-check-circle' },
            processing: { label: 'Procesando', className: 'status-processing', icon: 'fa-gear' },
            shipped: { label: 'Enviado', className: 'status-shipped', icon: 'fa-truck' },
            delivered: { label: 'Entregado', className: 'status-delivered', icon: 'fa-circle-check' },
            cancelled: { label: 'Cancelado', className: 'status-cancelled', icon: 'fa-ban' }
        };

        // Si el pago es exitoso pero el estado es "pending", usar "paid"
        if ((paymentStatus === 'succeeded' || paymentStatus === 'paid') && status === 'pending') {
            status = 'paid';
        }

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


