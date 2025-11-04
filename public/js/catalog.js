// Funcionalidades del catálogo de productos
class CatalogManager {
    constructor() {
        this.products = [];
        this.filteredProducts = [];
        this.currentPage = 1;
        this.itemsPerPage = 8;
        this.currentCategory = 'all';
        this.currentSort = 'name';
        this.maxPrice = 5000;
        this.currentView = 'grid';
        
        this.init();
    }

    async init() {
        await this.loadProducts();
        this.bindEvents();
        this.renderProducts();
        this.updateProductsCount();
    }

    // Cargar productos desde la API o JSON como fallback
    async loadProducts() {
        try {
            // Intentar cargar desde la API primero
            if (window.apiClient) {
                const response = await window.apiClient.getProducts({ limit: 100 });
                if (response.success && response.data) {
                    // La API devuelve un array directamente en response.data (result.rows)
                    const productsArray = Array.isArray(response.data) ? response.data : [];
                    
                    // Normalizar productos de la API
                    this.products = productsArray.map(p => {
                        // Asegurar que el ID sea un número válido
                        const productId = parseInt(p.id);
                        if (isNaN(productId) || productId < 1) {
                            console.warn('Producto con ID inválido ignorado:', p);
                            return null;
                        }
                        return {
                            id: productId.toString(),
                            name: p.name,
                            description: p.description || '',
                            price: parseFloat(p.price),
                            category: (p.category_name || '').toLowerCase() || 'otros',
                            sku: p.sku,
                            stock: p.stock || 0,
                            image: p.image_url || this.getPlaceholderImage(p.name)
                        };
                    }).filter(p => p !== null); // Filtrar productos inválidos
                    this.filteredProducts = [...this.products];
                    console.log(`✅ Cargados ${this.products.length} productos desde la API`);
                    console.log('IDs de productos:', this.products.map(p => p.id).join(', '));
                    return;
                }
            }
        } catch (error) {
            console.warn('No se pudieron cargar productos desde la API, usando JSON como fallback:', error);
        }

        // Fallback: cargar desde JSON y mapear IDs reales
        try {
            const response = await fetch('data/products.json');
            const data = await response.json();
            this.products = data.products;
            
            console.log(`📦 Cargados ${this.products.length} productos desde JSON (IDs iniciales: ${this.products.map(p => p.id).join(', ')})`);
            
            // Mapear IDs reales desde la BD si es posible
            const mapped = await this.mapProductIdsFromDB();
            
            if (!mapped) {
                console.warn('⚠️ No se pudieron mapear IDs, los productos pueden tener IDs incorrectos');
            }
            
            this.filteredProducts = [...this.products];
            console.log(`✅ Productos listos para renderizar (IDs finales: ${this.products.map(p => p.id).join(', ')})`);
        } catch (error) {
            console.error('Error al cargar productos:', error);
            this.products = this.getMockProducts();
            this.filteredProducts = [...this.products];
        }
    }

    // Mapear IDs del JSON a IDs reales de la BD usando SKU
    async mapProductIdsFromDB() {
        if (!window.apiClient) {
            console.warn('⚠️ API client no disponible, no se pueden mapear IDs');
            return false;
        }

        try {
            // Obtener todos los productos de la BD para mapear por SKU
            const response = await window.apiClient.getProducts({ limit: 100 });
            if (response.success && response.data) {
                // La API devuelve un array directamente en response.data
                const productsArray = Array.isArray(response.data) ? response.data : [];
                const skuToIdMap = {};
                productsArray.forEach(p => {
                    if (p.sku && p.id) {
                        skuToIdMap[p.sku] = parseInt(p.id);
                    }
                });

                let mappedCount = 0;
                // Actualizar IDs en productos del JSON
                this.products.forEach(product => {
                    if (product.sku && skuToIdMap[product.sku]) {
                        const mappedId = skuToIdMap[product.sku];
                        const oldId = product.id;
                        product.id = mappedId.toString();
                        product._mappedFromDB = true;
                        mappedCount++;
                        if (oldId !== mappedId.toString()) {
                            console.log(`✅ ID mapeado: SKU ${product.sku} - ${oldId} → ${mappedId}`);
                        }
                    }
                });
                
                // Actualizar también filteredProducts
                this.filteredProducts = [...this.products];
                
                if (mappedCount > 0) {
                    console.log(`✅ ${mappedCount} productos mapeados desde la BD por SKU`);
                    console.log('IDs finales:', this.products.map(p => `SKU:${p.sku}→ID:${p.id}`).join(', '));
                } else {
                    console.warn('⚠️ No se encontraron productos para mapear');
                }
                return mappedCount > 0;
            }
        } catch (error) {
            console.error('❌ Error al mapear IDs desde la BD:', error);
            return false;
        }
        return false;
    }

    // Generar imagen placeholder
    getPlaceholderImage(name) {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlbjwvdGV4dD48L3N2Zz4=';
    }

    // Obtener productos mock como fallback
    getMockProducts() {
        return [
            {
                id: '1',
                name: 'Cable Cat6 UTP 305m',
                description: 'Cable de red Cat6 UTP de 305 metros para instalaciones profesionales.',
                price: 2500,
                category: 'cables',
                sku: 'CAT6-305M',
                stock: 50,
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNhYmxlIENhdDY8L3RleHQ+PC9zdmc+'
            },
            {
                id: '2',
                name: 'Conectores RJ45 Cat6',
                description: 'Conectores RJ45 para cable Cat6, paquete de 100 unidades.',
                price: 150,
                category: 'conectores',
                sku: 'RJ45-CAT6',
                stock: 200,
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNvbmVjdG9yIFJKNjQ1PC90ZXh0Pjwvc3ZnPg=='
            },
            {
                id: '3',
                name: 'Switch 24 Puertos Gigabit',
                description: 'Switch de red 24 puertos Gigabit con gestión web.',
                price: 3500,
                category: 'equipos',
                sku: 'SW-24G',
                stock: 15,
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlN3aXRjaCAyNFBvcnRzPC90ZXh0Pjwvc3ZnPg=='
            },
            {
                id: '4',
                name: 'Crimpeadora RJ45',
                description: 'Herramienta crimpeadora profesional para conectores RJ45.',
                price: 800,
                category: 'herramientas',
                sku: 'CRIMP-RJ45',
                stock: 25,
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNyaW1wZWFkb3JhPC90ZXh0Pjwvc3ZnPg=='
            }
        ];
    }

    // Bind eventos
    bindEvents() {
        // Filtros de categoría
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentCategory = btn.dataset.category;
                this.applyFilters();
            });
        });

        // Rango de precio
        const priceRange = document.getElementById('priceRange');
        if (priceRange) {
            priceRange.addEventListener('input', (e) => {
                this.maxPrice = parseInt(e.target.value);
                document.getElementById('maxPrice').textContent = Utils.formatPrice(this.maxPrice);
                this.applyFilters();
            });
        }

        // Ordenamiento
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.applyFilters();
            });
        }

        // Cambio de vista
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                viewButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentView = btn.dataset.view;
                this.renderProducts();
            });
        });

        // Búsqueda
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            const debouncedSearch = Utils.debounce((query) => {
                this.searchProducts(query);
            }, 300);

            searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });
        }

        // Cargar parámetros de URL
        this.loadUrlParams();
    }

    // Cargar parámetros de URL
    loadUrlParams() {
        const params = Utils.getUrlParams();
        
        if (params.category) {
            const categoryBtn = document.querySelector(`[data-category="${params.category}"]`);
            if (categoryBtn) {
                document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                categoryBtn.classList.add('active');
                this.currentCategory = params.category;
            }
        }

        if (params.search) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = params.search;
                this.searchProducts(params.search);
            }
        }

        this.applyFilters();
    }

    // Aplicar filtros
    applyFilters() {
        let filtered = [...this.products];

        // Filtrar por categoría
        if (this.currentCategory !== 'all') {
            filtered = filtered.filter(product => product.category === this.currentCategory);
        }

        // Filtrar por precio
        filtered = filtered.filter(product => product.price <= this.maxPrice);

        // Ordenar
        filtered = this.sortProducts(filtered, this.currentSort);

        this.filteredProducts = filtered;
        this.currentPage = 1;
        this.renderProducts();
        this.updateProductsCount();
        this.renderPagination();
    }

    // Buscar productos
    searchProducts(query) {
        if (!query.trim()) {
            this.filteredProducts = [...this.products];
        } else {
            const searchTerm = query.toLowerCase();
            this.filteredProducts = this.products.filter(product => 
                product.name.toLowerCase().includes(searchTerm) ||
                product.description.toLowerCase().includes(searchTerm) ||
                product.sku.toLowerCase().includes(searchTerm)
            );
        }

        this.currentPage = 1;
        this.renderProducts();
        this.updateProductsCount();
        this.renderPagination();
    }

    // Ordenar productos
    sortProducts(products, sortBy) {
        return products.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'price-low':
                    return a.price - b.price;
                case 'price-high':
                    return b.price - a.price;
                case 'newest':
                    return new Date(b.date || '2024-01-01') - new Date(a.date || '2024-01-01');
                default:
                    return 0;
            }
        });
    }

    // Renderizar productos
    renderProducts() {
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const productsToShow = this.filteredProducts.slice(startIndex, endIndex);

        if (this.currentView === 'grid') {
            productsGrid.className = 'products-grid';
            productsGrid.innerHTML = productsToShow.map(product => this.renderProductCard(product)).join('');
        } else {
            productsGrid.className = 'products-list';
            productsGrid.innerHTML = productsToShow.map(product => this.renderProductListItem(product)).join('');
        }

        // Bind eventos de productos
        this.bindProductEvents();
    }

    // Renderizar tarjeta de producto
    renderProductCard(product) {
        return `
            <div class="product-card" data-category="${product.category}">
                <div class="product-image">
                    <img src="${product.image}" alt="${product.name}" loading="lazy">
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
        `;
    }

    // Renderizar item de lista de producto
    renderProductListItem(product) {
        return `
            <div class="product-list-item" data-category="${product.category}">
                <div class="product-list-image">
                    <img src="${product.image}" alt="${product.name}" loading="lazy">
                </div>
                <div class="product-list-content">
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-description">${product.description}</p>
                    <div class="product-details">
                        <span class="product-sku">SKU: ${product.sku}</span>
                        <span class="product-stock">Stock: ${product.stock}</span>
                    </div>
                </div>
                <div class="product-list-actions">
                    <div class="product-price">${Utils.formatPrice(product.price)}</div>
                    <div class="product-buttons">
                        <button class="btn-add-cart" data-product-id="${product.id}">
                            <i class="fas fa-cart-plus"></i> Agregar
                        </button>
                        <button class="btn-view" data-product-id="${product.id}">
                            Ver Detalles
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Bind eventos de productos
    bindProductEvents() {
        const addCartButtons = document.querySelectorAll('.btn-add-cart');
        addCartButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.closest('.btn-add-cart').dataset.productId;
                // Buscar producto comparando tanto como string como número
                const product = this.products.find(p => {
                    const pId = p.id || p.product_id;
                    return pId == productId || String(pId) === String(productId);
                });
                if (product) {
                    // Esperar a que el carrito esté disponible
                    if (window.cart) {
                        window.cart.addItem(product);
                    } else {
                        // Crear carrito temporal si no existe
                        const tempCart = new Cart();
                        tempCart.addItem(product);
                    }
                } else {
                    console.warn('Producto no encontrado:', productId);
                }
            });
        });

        const viewButtons = document.querySelectorAll('.btn-view');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.target.closest('.btn-view');
                const productId = button.dataset.productId;
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
            });
        });
    }

    // Actualizar contador de productos
    updateProductsCount() {
        const productsCount = document.getElementById('productsCount');
        if (productsCount) {
            const count = this.filteredProducts.length;
            productsCount.textContent = `${count} producto${count !== 1 ? 's' : ''} encontrado${count !== 1 ? 's' : ''}`;
        }
    }

    // Renderizar paginación
    renderPagination() {
        const pagination = document.getElementById('pagination');
        if (!pagination) return;

        const totalPages = Math.ceil(this.filteredProducts.length / this.itemsPerPage);
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        // Botón anterior
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Números de página
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        if (startPage > 1) {
            paginationHTML += `<button class="pagination-btn" data-page="1">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span class="pagination-dots">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">
                    ${i}
                </button>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span class="pagination-dots">...</span>`;
            }
            paginationHTML += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
        }

        // Botón siguiente
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        pagination.innerHTML = paginationHTML;

        // Bind eventos de paginación
        pagination.addEventListener('click', (e) => {
            if (e.target.classList.contains('pagination-btn')) {
                const page = parseInt(e.target.dataset.page);
                if (page && page !== this.currentPage) {
                    this.currentPage = page;
                    this.renderProducts();
                    this.scrollToTop();
                }
            }
        });
    }

    // Scroll to top
    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    // Obtener producto por ID
    getProductById(id) {
        return this.products.find(product => product.id === id);
    }
}

// Inicializar catálogo cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    window.catalogManager = new CatalogManager();
});

// Exportar para uso global
window.CatalogManager = CatalogManager;
