// Utilidades generales del e-commerce
class Utils {
    // Formatear precio
    static formatPrice(price) {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(price);
    }

    // Formatear fecha
    static formatDate(date) {
        return new Intl.DateTimeFormat('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(new Date(date));
    }

    // Debounce para búsquedas
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Mostrar notificación toast
    static showToast(message, type = 'info', duration = null) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Duración por defecto según el tipo
        const defaultDuration = duration !== null ? duration : (type === 'success' ? 6000 : 5000);
        
        toast.innerHTML = `
            <div class="toast-header">
                <span class="toast-title">${this.getToastTitle(type)}</span>
                <button class="toast-close">&times;</button>
            </div>
            <div class="toast-message">${message}</div>
        `;

        document.body.appendChild(toast);

        // Mostrar toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto cerrar después de la duración especificada
        setTimeout(() => this.hideToast(toast), defaultDuration);

        // Cerrar al hacer click
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.hideToast(toast);
        });
    }

    static getToastTitle(type) {
        const titles = {
            success: 'Éxito',
            warning: 'Advertencia',
            error: 'Error',
            info: 'Información'
        };
        return titles[type] || 'Notificación';
    }

    static hideToast(toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    // Validar email
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validar teléfono
    static isValidPhone(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    }

    // Generar ID único
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Scroll suave a elemento
    static scrollToElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    // Obtener parámetros de URL
    static getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    }

    // Actualizar URL sin recargar página
    static updateUrl(params) {
        const url = new URL(window.location);
        Object.keys(params).forEach(key => {
            if (params[key]) {
                url.searchParams.set(key, params[key]);
            } else {
                url.searchParams.delete(key);
            }
        });
        window.history.pushState({}, '', url);
    }

    // Copiar texto al portapapeles
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Texto copiado al portapapeles', 'success');
        } catch (err) {
            console.error('Error al copiar: ', err);
            this.showToast('Error al copiar texto', 'error');
        }
    }

    // Cargar imagen con fallback
    static loadImage(src, fallback = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlbiBubyBlbmNvbnRyYWRhPC90ZXh0Pjwvc3ZnPg==') {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(src);
            img.onerror = () => resolve(fallback);
            img.src = src;
        });
    }

    // Animar contador
    static animateCounter(element, start, end, duration = 1000) {
        const startTime = performance.now();
        const range = end - start;

        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = Math.floor(start + (range * progress));
            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        }

        requestAnimationFrame(updateCounter);
    }

    // Detectar dispositivo móvil
    static isMobile() {
        return window.innerWidth <= 768;
    }

    // Detectar dispositivo táctil
    static isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    // Obtener orientación de pantalla
    static getScreenOrientation() {
        return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    }

    // Lazy loading para imágenes
    static setupLazyLoading() {
        const images = document.querySelectorAll('img[data-src]');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    observer.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }

    // Prevenir envío de formularios duplicados
    static preventDoubleSubmit(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            form.addEventListener('submit', () => {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
            });
        }
    }

    // Sanitizar HTML
    static sanitizeHtml(html) {
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    }

    // Obtener posición del scroll
    static getScrollPosition() {
        return {
            x: window.pageXOffset || document.documentElement.scrollLeft,
            y: window.pageYOffset || document.documentElement.scrollTop
        };
    }

    // Scroll a la parte superior
    static scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    // Redirigir si el usuario no es administrador
    static redirectIfNotAdmin(options = {}) {
        const {
            apiClient = window.apiClient,
            redirectTo = 'login.html',
            toastMessage = 'Se requieren permisos de administrador.',
            includeCurrentPath = true
        } = options;

        if (!apiClient || typeof apiClient.isAuthenticated !== 'function') {
            return false;
        }

        const isAuthenticated = apiClient.isAuthenticated();
        const isAdmin = typeof apiClient.isAdmin === 'function' ? apiClient.isAdmin() : false;

        if (isAuthenticated && isAdmin) {
            return true;
        }

        if (toastMessage) {
            this.showToast(toastMessage, 'warning');
        }

        if (includeCurrentPath) {
            const currentPath = `${window.location.pathname}${window.location.search}`;
            const separator = redirectTo.includes('?') ? '&' : '?';
            window.location.href = `${redirectTo}${separator}redirect=${encodeURIComponent(currentPath)}`;
        } else {
            window.location.href = redirectTo;
        }

        return false;
    }
}

// Exportar para uso global
window.Utils = Utils;
