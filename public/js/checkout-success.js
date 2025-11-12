document.addEventListener('DOMContentLoaded', async () => {
    const yearEl = document.getElementById('currentYear');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const orderNumberEl = document.getElementById('orderNumber');
    const viewOrderBtn = document.getElementById('viewOrderBtn');
    const orderIdParam = urlParams.get('order_id');

    const setFallbackOrderInfo = () => {
        if (sessionId && orderNumberEl) {
            orderNumberEl.textContent = `${sessionId.substring(0, 20)}...`;
        }
        if (viewOrderBtn) {
            if (window.apiClient && window.apiClient.isAuthenticated()) {
                viewOrderBtn.href = orderIdParam
                    ? `../orders.html?order=${orderIdParam}`
                    : '../orders.html';
            } else {
                viewOrderBtn.style.display = 'none';
            }
        }
    };

    const updateOrderInfo = (order) => {
        if (!order) {
            setFallbackOrderInfo();
            return;
        }

        if (orderNumberEl && order.order_number) {
            orderNumberEl.textContent = order.order_number;
        }

        if (viewOrderBtn) {
            viewOrderBtn.href = order.id
                ? `../orders.html?order=${order.id}`
                : (orderIdParam ? `../orders.html?order=${orderIdParam}` : '../orders.html');
        }
    };

    const loadOrderFallback = async () => {
        try {
            if (orderIdParam) {
                const singleOrderResponse = await window.apiClient.getOrder(orderIdParam);
                if (singleOrderResponse?.success && singleOrderResponse?.data) {
                    updateOrderInfo(singleOrderResponse.data);
                    return;
                }
            }

            const response = await window.apiClient.getOrders({ limit: 1 });
            if (response?.success && Array.isArray(response.data) && response.data.length > 0) {
                updateOrderInfo(response.data[0]);
                return;
            }

            setFallbackOrderInfo();
        } catch (error) {
            setFallbackOrderInfo();
        }
    };

    if (sessionId && window.apiClient && window.apiClient.isAuthenticated()) {
        try {
            const confirmResponse = await window.apiClient.confirmOrderPayment(sessionId);
            if (confirmResponse?.success && confirmResponse?.data?.order) {
                updateOrderInfo(confirmResponse.data.order);
            } else {
                await loadOrderFallback();
            }
        } catch (error) {
            await loadOrderFallback();
        }
    } else {
        setFallbackOrderInfo();
    }

    if (window.cart && typeof window.cart.clearCart === 'function') {
        window.cart.clearCart().catch(err => {
            console.warn('No se pudo limpiar el carrito:', err);
        });
    }
});

