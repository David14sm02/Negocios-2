// Funcionalidades principales del e-commerce
class ECommerceApp {
    constructor() {
        this.apiClient = window.apiClient;
        this.profileFetched = false;
        this.userMenu = null;
        this.userMenuToggle = null;
        this.handleUserMenuOutsideClick = this.handleUserMenuOutsideClick.bind(this);
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadFeaturedProducts();
        this.setupSearch();
        this.setupMobileMenu();
        this.setupScrollEffects();
        this.setupAuthentication();
    }

    bindEvents() {
        // Smooth scroll para enlaces internos
        document.addEventListener('click', (e) => {
            if (e.target.matches('a[href^="#"]')) {
                e.preventDefault();
                const targetId = e.target.getAttribute('href').substring(1);
                Utils.scrollToElement(targetId);
            }
        });

        // Lazy loading de imágenes
        Utils.setupLazyLoading();

        // Prevenir envío de formularios duplicados
        const forms = document.querySelectorAll('form');
        forms.forEach(form => Utils.preventDoubleSubmit(form));
    }

    // Cargar productos destacados
    async loadFeaturedProducts() {
        const featuredProductsContainer = document.getElementById('featuredProducts');
        if (!featuredProductsContainer) return;

        try {
            const response = await this.apiClient.getFeaturedProducts(4);
            const products = response.data;
            
            // Validar que todos los productos tengan IDs válidos
            const validProducts = products.filter(p => {
                const productId = parseInt(p.id);
                return !isNaN(productId) && productId > 0;
            });
            
            featuredProductsContainer.innerHTML = validProducts.map(product => `
                <div class="product-card">
                    <div class="product-image">
                        <img src="${product.image_url || this.getDefaultImage()}" alt="${product.name}" loading="lazy">
                        ${product.stock < 10 ? '<span class="stock-badge low-stock">Poco Stock</span>' : ''}
                    </div>
                    <div class="product-content">
                        <h3 class="product-title">${product.name}</h3>
                        <p class="product-description">${product.description}</p>
                        <div class="product-sku">SKU: ${product.sku}</div>
                        <div class="product-price">${Utils.formatPrice(product.price)}</div>
                        <div class="product-stock">Stock: ${product.stock} unidades</div>
                        <div class="product-actions">
                            <button class="btn-add-cart" data-product-id="${product.id}">
                                <i class="fas fa-cart-plus"></i> Agregar
                            </button>
                            <button class="btn-view" data-product-id="${product.id}">
                                Ver Detalles
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
            
            this.bindFeaturedProductEvents();
        } catch (error) {
            console.error('Error al cargar productos destacados:', error);
            // Fallback a productos mock
            const products = this.getMockProducts().slice(0, 4);
            featuredProductsContainer.innerHTML = products.map(product => `
                <div class="product-card">
                    <div class="product-image">
                        <img src="${product.image}" alt="${product.name}" loading="lazy">
                    </div>
                    <div class="product-content">
                        <h3 class="product-title">${product.name}</h3>
                        <p class="product-description">${product.description}</p>
                        <div class="product-price">${Utils.formatPrice(product.price)}</div>
                        <div class="product-actions">
                            <button class="btn-add-cart" data-product-id="${product.id}">
                                <i class="fas fa-cart-plus"></i> Agregar
                            </button>
                            <button class="btn-view" data-product-id="${product.id}">
                                Ver Detalles
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
            
            this.bindFeaturedProductEvents();
        }
    }

    // Bind eventos de productos destacados
    bindFeaturedProductEvents() {
        const featuredContainer = document.getElementById('featuredProducts');
        if (!featuredContainer) return;

        // Delegación de eventos para botones agregar al carrito
        featuredContainer.addEventListener('click', (e) => {
            const addCartBtn = e.target.closest('.btn-add-cart');
            const viewBtn = e.target.closest('.btn-view');

            if (addCartBtn) {
                e.preventDefault();
                const productId = addCartBtn.dataset.productId;
                
                if (window.apiClient) {
                    window.apiClient.getProduct(productId).then(response => {
                        if (response.success && response.data) {
                            const product = response.data;
                            if (window.cart) {
                                window.cart.addItem({
                                    id: product.id,
                                    name: product.name,
                                    price: product.price,
                                    sku: product.sku,
                                    stock: product.stock,
                                    image_url: product.image_url,
                                    image: product.image_url
                                });
                            }
                        }
                    }).catch(error => {
                        console.error('Error al obtener producto:', error);
                    });
                }
                            } else if (viewBtn) {
                    e.preventDefault();
                    const productId = viewBtn.dataset.productId;
                    if (productId) {
                        // Asegurar que el ID sea un número válido
                        const id = parseInt(productId);
                        if (!isNaN(id) && id > 0) {
                            window.location.href = `product-detail.html?id=${id}`;
                        } else {
                            console.error('ID de producto inválido:', productId);
                            Utils.showToast('Error: ID de producto inválido', 'error');
                        }
                    }
                }
        });
    }

    // Configurar búsqueda
    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');

        if (searchInput) {
            // Búsqueda con debounce
            const debouncedSearch = Utils.debounce((query) => {
                this.performSearch(query);
            }, 300);

            searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });

            // Búsqueda al presionar Enter
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.performSearch(e.target.value);
                }
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const query = searchInput?.value || '';
                this.performSearch(query);
            });
        }
    }

    // Realizar búsqueda
    performSearch(query) {
        if (!query.trim()) return;

        // Por ahora, redirigir al catálogo con parámetros de búsqueda
        const searchUrl = `catalog.html?search=${encodeURIComponent(query)}`;
        window.location.href = searchUrl;
    }

    // Configurar menú móvil
    setupMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const nav = document.querySelector('.nav');

        if (mobileMenuBtn && nav) {
            mobileMenuBtn.addEventListener('click', () => {
                nav.classList.toggle('mobile-open');
                mobileMenuBtn.classList.toggle('active');
            });

            // Cerrar menú al hacer click en un enlace
            nav.addEventListener('click', (e) => {
                if (e.target.classList.contains('nav-link')) {
                    nav.classList.remove('mobile-open');
                    mobileMenuBtn.classList.remove('active');
                }
            });

            // Cerrar menú al hacer click fuera
            document.addEventListener('click', (e) => {
                if (!nav.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                    nav.classList.remove('mobile-open');
                    mobileMenuBtn.classList.remove('active');
                }
            });
        }
    }

    // Configurar efectos de scroll
    setupScrollEffects() {
        let lastScrollTop = 0;
        const header = document.querySelector('.header');

        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            // Mostrar/ocultar header al hacer scroll
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                // Scrolling hacia abajo
                header?.classList.add('header-hidden');
            } else {
                // Scrolling hacia arriba
                header?.classList.remove('header-hidden');
            }

            lastScrollTop = scrollTop;

            // Efecto parallax en hero (opcional)
            const hero = document.querySelector('.hero');
            if (hero && scrollTop < hero.offsetHeight) {
                hero.style.transform = `translateY(${scrollTop * 0.5}px)`;
            }
        });

        // Botón de scroll to top
        this.createScrollToTopButton();
    }

    // Crear botón de scroll to top
    createScrollToTopButton() {
        const scrollBtn = document.createElement('button');
        scrollBtn.className = 'scroll-to-top';
        scrollBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
        scrollBtn.style.cssText = `
            position: fixed;
            bottom: 9rem;
            right: 2rem;
            width: 50px;
            height: 50px;
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
            z-index: 997;
            box-shadow: var(--shadow-lg);
        `;

        document.body.appendChild(scrollBtn);

        // Mostrar/ocultar botón
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                scrollBtn.style.opacity = '1';
                scrollBtn.style.visibility = 'visible';
            } else {
                scrollBtn.style.opacity = '0';
                scrollBtn.style.visibility = 'hidden';
            }
        });

        // Scroll to top al hacer click
        scrollBtn.addEventListener('click', () => {
            Utils.scrollToTop();
        });
    }

    // Obtener productos mock
    getMockProducts() {
        return [
            {
                id: '1',
                name: 'Cable Cat6 UTP 305m',
                description: 'Cable de red Cat6 UTP de 305 metros para instalaciones profesionales.',
                price: 2500,
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNhYmxlIENhdDY8L3RleHQ+PC9zdmc+',
                category: 'cables',
                sku: 'CAT6-305M',
                stock: 50
            },
            {
                id: '2',
                name: 'Conectores RJ45 Cat6',
                description: 'Conectores RJ45 para cable Cat6, paquete de 100 unidades.',
                price: 150,
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNvbmVjdG9yIFJKNjQ1PC90ZXh0Pjwvc3ZnPg==',
                category: 'conectores',
                sku: 'RJ45-CAT6',
                stock: 200
            },
            {
                id: '3',
                name: 'Switch 24 Puertos Gigabit',
                description: 'Switch de red 24 puertos Gigabit con gestión web.',
                price: 3500,
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlN3aXRjaCAyNFBvcnRzPC90ZXh0Pjwvc3ZnPg==',
                category: 'equipos',
                sku: 'SW-24G',
                stock: 15
            },
            {
                id: '4',
                name: 'Crimpeadora RJ45',
                description: 'Herramienta crimpeadora profesional para conectores RJ45.',
                price: 800,
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNyaW1wZWFkb3JhPC90ZXh0Pjwvc3ZnPg==',
                category: 'herramientas',
                sku: 'CRIMP-RJ45',
                stock: 25
            }
        ];
    }

    // Animar elementos al hacer scroll
    animateOnScroll() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        // Observar elementos animables
        const animateElements = document.querySelectorAll('.category-card, .product-card, .blog-card');
        animateElements.forEach(el => {
            el.classList.add('animate-element');
            observer.observe(el);
        });
    }

    // Configurar formularios de contacto
    setupContactForms() {
        const contactForms = document.querySelectorAll('form[data-type="contact"]');
        
        contactForms.forEach(form => {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);
                
                // Validar datos
                if (!this.validateContactForm(data)) {
                    return;
                }
                
                try {
                    // Simular envío
                    await this.submitContactForm(data);
                    Utils.showToast('Mensaje enviado exitosamente', 'success');
                    form.reset();
                } catch (error) {
                    Utils.showToast('Error al enviar mensaje', 'error');
                }
            });
        });
    }

    // Validar formulario de contacto
    validateContactForm(data) {
        if (!data.name || data.name.trim().length < 2) {
            Utils.showToast('El nombre debe tener al menos 2 caracteres', 'error');
            return false;
        }
        
        if (!Utils.isValidEmail(data.email)) {
            Utils.showToast('Ingresa un email válido', 'error');
            return false;
        }
        
        if (!data.message || data.message.trim().length < 10) {
            Utils.showToast('El mensaje debe tener al menos 10 caracteres', 'error');
            return false;
        }
        
        return true;
    }

    // Enviar formulario de contacto
    async submitContactForm(data) {
        // Simular delay de red
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Aquí se integraría con el backend
        console.log('Datos del formulario:', data);
        
        return true;
    }

    // Configurar filtros de productos
    setupProductFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remover clase active de todos los botones
                filterButtons.forEach(b => b.classList.remove('active'));
                
                // Agregar clase active al botón clickeado
                btn.classList.add('active');
                
                // Filtrar productos
                const category = btn.dataset.category;
                this.filterProducts(category);
            });
        });
    }

    // Filtrar productos
    filterProducts(category) {
        const products = document.querySelectorAll('.product-card');
        
        products.forEach(product => {
            const productCategory = product.dataset.category;
            
            if (category === 'all' || productCategory === category) {
                product.style.display = 'block';
                product.classList.add('animate-in');
            } else {
                product.style.display = 'none';
                product.classList.remove('animate-in');
            }
        });
    }

    // Configurar autenticación
    setupAuthentication() {
        this.renderUserProfile();
        this.updateAdminUI();
        // Verificar si hay un token válido al cargar la página
        if (this.apiClient && this.apiClient.isAuthenticated()) {
            this.updateAuthUI(true);
        } else {
            this.updateAuthUI(false);
        }
    }

    // Actualizar UI de autenticación
    updateAuthUI(isAuthenticated) {
        const authElements = document.querySelectorAll('.auth-required');
        const guestElements = document.querySelectorAll('.guest-only');
        
        if (isAuthenticated) {
            authElements.forEach(el => {
                const displayValue = el.dataset.authDisplay || 'inline-flex';
                el.style.display = displayValue;
            });
            guestElements.forEach(el => el.style.display = 'none');
        } else {
            authElements.forEach(el => el.style.display = 'none');
            guestElements.forEach(el => {
                const displayValue = el.dataset.authDisplay || 'inline-flex';
                el.style.display = displayValue;
            });
        }

        this.renderUserProfile();
    }

    // Obtener imagen por defecto
    getDefaultImage() {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlbiBubyBlbmNvbnRyYWRhPC90ZXh0Pjwvc3ZnPg==';
    }

    // Login
    async login(email, password) {
        try {
            const response = await this.apiClient.login(email, password);
            this.updateAuthUI(true);
            Utils.showToast('Inicio de sesión exitoso', 'success');
            return response;
        } catch (error) {
            Utils.showToast(error.message || 'Error al iniciar sesión', 'error');
            throw error;
        }
    }

    // Logout
    async logout() {
        this.apiClient.logout();
        this.profileFetched = false;
        this.updateAuthUI(false);
        Utils.showToast('Sesión cerrada', 'info');
        if (window.cart && typeof window.cart.loadCartFromAPI === 'function') {
            try {
                await window.cart.loadCartFromAPI();
                window.cart.updateCartDisplay();
            } catch (error) {
                console.warn('No se pudo recargar el carrito después de cerrar sesión:', error);
            }
        }
    }

    renderUserProfile() {
        const userProfile = document.getElementById('userProfile');
        if (!userProfile) return;

        const isAuthenticated = this.apiClient && this.apiClient.isAuthenticated();
        const currentUser = this.apiClient?.getCurrentUser();

        if (isAuthenticated && !currentUser && !this.profileFetched) {
            this.profileFetched = true;
            this.apiClient.getProfile().then(response => {
                if (response?.data?.user) {
                    this.apiClient.setCurrentUser(response.data.user);
                    this.renderUserProfile();
                }
            }).catch(() => {
                this.profileFetched = false;
            });
        }

        if (isAuthenticated && currentUser) {
            const isAdmin = this.apiClient?.isAdmin?.() ?? !!currentUser.is_admin;
            const adminMenuItem = isAdmin ? `
                        <a href="admin/products.html" class="user-menu-item admin-dashboard-link" role="menuitem">
                            <i class="fas fa-tools"></i>
                            Panel administrador
                        </a>
                        <div class="user-menu-divider admin-menu-divider"></div>
            ` : '';
            const initial = (currentUser.first_name?.[0] || currentUser.email?.[0] || '?').toUpperCase();
            const displayName = currentUser.first_name || currentUser.email;

            userProfile.innerHTML = `
                <div class="user-profile-logged">
                    <button type="button" class="user-menu-toggle" id="userMenuToggle" aria-haspopup="true" aria-expanded="false">
                        <div class="user-avatar">${initial}</div>
                        <div class="user-data">
                            <span class="user-name">${displayName}</span>
                            <span class="user-status">${isAdmin ? 'Administrador' : 'Sesión activa'}</span>
                        </div>
                        <i class="fas fa-chevron-down user-menu-icon"></i>
                    </button>
                    <div class="user-menu" id="userMenu" role="menu">
                        ${adminMenuItem}
                        <a href="orders.html" class="user-menu-item" role="menuitem">
                            <i class="fas fa-box"></i>
                            Mis pedidos
                        </a>
                        <div class="user-menu-divider"></div>
                        <button type="button" class="user-menu-item user-menu-logout" id="userLogoutBtn" role="menuitem">
                            <i class="fas fa-sign-out-alt"></i>
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            `;

            this.userMenu = userProfile.querySelector('#userMenu');
            this.userMenuToggle = userProfile.querySelector('#userMenuToggle');

            if (this.userMenuToggle && this.userMenu) {
                this.userMenuToggle.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const isOpen = this.userMenu.classList.toggle('open');
                    this.userMenuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                });
            }

            if (isAdmin) {
                const adminLink = userProfile.querySelector('.admin-dashboard-link');
                adminLink?.addEventListener('click', () => {
                    this.userMenu?.classList.remove('open');
                    this.userMenuToggle?.setAttribute('aria-expanded', 'false');
                });
            }

            const logoutBtn = userProfile.querySelector('#userLogoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    this.userMenu?.classList.remove('open');
                    this.userMenuToggle?.setAttribute('aria-expanded', 'false');
                    this.logout();
                });
            }

            document.removeEventListener('click', this.handleUserMenuOutsideClick);
            document.addEventListener('click', this.handleUserMenuOutsideClick);
        } else {
            this.profileFetched = false;
            userProfile.innerHTML = `
                <div class="user-profile-guest">
                    <i class="fas fa-user-circle"></i>
                    <div>
                        <span class="user-status">Invitado</span>
                        <div class="user-actions">
                            <a href="login.html">Iniciar Sesión</a>
                            <a href="register.html">Crear Cuenta</a>
                        </div>
                    </div>
                </div>
            `;

            document.removeEventListener('click', this.handleUserMenuOutsideClick);
            this.userMenu = null;
            this.userMenuToggle = null;
        }

        this.updateAdminUI();
    }

    updateAdminUI() {
        const adminElements = document.querySelectorAll('.admin-only');
        if (!adminElements.length) {
            return;
        }

        const isAdmin = this.apiClient?.isAdmin?.() === true || !!this.apiClient?.getCurrentUser?.()?.is_admin;

        adminElements.forEach((element) => {
            if (isAdmin) {
                const displayValue = element.dataset.adminDisplay || element.dataset.authDisplay || '';
                element.style.display = displayValue || '';
            } else {
                element.style.display = 'none';
            }
        });
    }

    handleUserMenuOutsideClick(event) {
        if (!this.userMenu || !this.userMenuToggle) {
            return;
        }

        if (this.userMenu.contains(event.target) || this.userMenuToggle.contains(event.target)) {
            return;
        }

        if (this.userMenu.classList.contains('open')) {
            this.userMenu.classList.remove('open');
            this.userMenuToggle.setAttribute('aria-expanded', 'false');
        }
    }

    // Registrar usuario
    async register(userData) {
        try {
            const response = await this.apiClient.register(userData);
            this.updateAuthUI(true);
            Utils.showToast('Registro exitoso', 'success');
            return response;
        } catch (error) {
            Utils.showToast(error.message || 'Error al registrar usuario', 'error');
            throw error;
        }
    }
}

// Inicializar aplicación cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ECommerceApp();
});

// Exportar para uso global
window.ECommerceApp = ECommerceApp;
