document.addEventListener('DOMContentLoaded', () => {
    const yearEl = document.getElementById('currentYear');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    const retryBtn = document.getElementById('retryCheckoutBtn');

    if (!retryBtn) {
        return;
    }

    if (orderId && window.apiClient && window.apiClient.isAuthenticated()) {
        retryBtn.style.display = 'inline-block';
        retryBtn.addEventListener('click', async () => {
            try {
                const checkoutResponse = await window.apiClient.createCheckoutSession({
                    order_id: orderId,
                    success_url: `${window.location.origin}/checkout/success`,
                    cancel_url: `${window.location.origin}/checkout/cancel`
                });
                if (checkoutResponse?.data?.url) {
                    window.location.href = checkoutResponse.data.url;
                }
            } catch (error) {
                Utils.showToast('No se pudo reintentar el pago. Intenta más tarde.', 'error');
            }
        });
    } else {
        retryBtn.style.display = 'none';
    }
});

