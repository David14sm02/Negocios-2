class ProductDetailManager {
    constructor() {
        this.product = null;
        this.productId = null;
        this.init();
    }

    async init() {
        const urlParams = Utils.getUrlParams();
        const idParam = urlParams.id;

        if (!idParam) {
            this.showError('No se proporcionó un ID de producto');
            return;
        }

        // Asegurar que el ID sea un número válido
        const productId = parseInt(idParam);
        if (isNaN(productId) || productId < 1) {
            this.showError('ID de producto inválido');
            return;
        }

        this.productId = productId;
        await this.loadProduct();
        this.bindEvents();
    }

    async loadProduct() {
        const loadingState = document.getElementById('loadingState');
        const errorState = document.getElementById('errorState');
        const productContent = document.getElementById('productContent');

        try {
            loadingState.style.display = 'block';
            errorState.style.display = 'none';
            productContent.style.display = 'none';

            if (!window.apiClient) {
                throw new Error('API client no disponible');
            }

            const response = await window.apiClient.getProduct(this.productId);
            
            if (!response.success || !response.data) {
                throw new Error(response.error || 'Producto no encontrado');
            }

            this.product = response.data;
            this.renderProduct();
            
            loadingState.style.display = 'none';
            productContent.style.display = 'block';

            document.title = `${this.product.name} - NetTech Solutions`;
            
            const metaDescription = document.querySelector('meta[name="description"]');
            if (metaDescription) {
                metaDescription.content = this.product.description || 'Detalles del producto';
            }

        } catch (error) {
            console.error('Error al cargar producto:', error);
            loadingState.style.display = 'none';
            errorState.style.display = 'block';
        }
    }

    renderProduct() {
        if (!this.product) return;

        const product = this.product;

        document.getElementById('productBreadcrumb').textContent = product.name;
        
        const productImage = document.getElementById('productImage');
        productImage.src = product.image_url || this.getPlaceholderImage(product.name);
        productImage.alt = product.name;

        document.getElementById('productName').textContent = product.name;
        document.getElementById('productSku').textContent = `SKU: ${product.sku}`;
        
        if (product.category_name) {
            document.getElementById('productCategory').textContent = product.category_name;
        } else {
            document.getElementById('productCategory').style.display = 'none';
        }

        document.getElementById('productPrice').textContent = Utils.formatPrice(product.price);
        
        const stockElement = document.getElementById('productStock');
        stockElement.textContent = `Stock disponible: ${product.stock} unidades`;
        
        const stockBadge = document.getElementById('stockBadge');
        if (product.stock < 10) {
            stockBadge.textContent = 'Poco Stock';
            stockBadge.className = 'stock-badge low-stock';
            stockBadge.style.display = 'block';
        } else if (product.stock === 0) {
            stockBadge.textContent = 'Sin Stock';
            stockBadge.className = 'stock-badge out-of-stock';
            stockBadge.style.display = 'block';
            document.getElementById('addToCartBtn').disabled = true;
        } else {
            stockBadge.style.display = 'none';
        }

        document.getElementById('productDescription').innerHTML = `<p>${product.description || 'Sin descripción disponible.'}</p>`;

        if (product.brand) {
            const brandInfo = document.createElement('div');
            brandInfo.className = 'product-brand';
            brandInfo.innerHTML = `<strong>Marca:</strong> ${product.brand}`;
            document.getElementById('productDescription').appendChild(brandInfo);
        }

        const quantityInput = document.getElementById('productQuantity');
        quantityInput.max = product.stock;

        if (product.features && Array.isArray(product.features) && product.features.length > 0) {
            const featuresContainer = document.getElementById('productFeatures');
            const featuresList = document.getElementById('featuresList');
            featuresList.innerHTML = product.features.map(feature => 
                `<li><i class="fas fa-check-circle"></i> ${feature}</li>`
            ).join('');
            featuresContainer.style.display = 'block';
        }

        if (product.specifications) {
            let specs = product.specifications;
            if (typeof specs === 'string') {
                try {
                    specs = JSON.parse(specs);
                } catch (e) {
                    specs = {};
                }
            }

            if (typeof specs === 'object' && Object.keys(specs).length > 0) {
                const specsContainer = document.getElementById('productSpecifications');
                const specsGrid = document.getElementById('specificationsGrid');
                specsGrid.innerHTML = Object.entries(specs).map(([key, value]) => `
                    <div class="spec-item">
                        <span class="spec-label">${this.formatSpecKey(key)}:</span>
                        <span class="spec-value">${value}</span>
                    </div>
                `).join('');
                specsContainer.style.display = 'block';
            }
        }

        if (product.tags && Array.isArray(product.tags) && product.tags.length > 0) {
            const tagsContainer = document.getElementById('productTags');
            const tagsList = document.getElementById('tagsContainer');
            tagsList.innerHTML = product.tags.map(tag => 
                `<span class="tag">${tag}</span>`
            ).join('');
            tagsContainer.style.display = 'block';
        }
    }

    formatSpecKey(key) {
        const keyMap = {
            'type': 'Tipo',
            'color': 'Color',
            'speed': 'Velocidad',
            'jacket': 'Cubierta',
            'length': 'Longitud',
            'conductor': 'Conductor',
            'frequency': 'Frecuencia',
            'ports': 'Puertos',
            'wifi': 'WiFi',
            'range': 'Alcance',
            'voltage': 'Voltaje',
            'current': 'Corriente',
            'weight': 'Peso',
            'dimensions': 'Dimensiones'
        };
        return keyMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
    }

    getPlaceholderImage(name) {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlbjwvdGV4dD48L3N2Zz4=';
    }

    bindEvents() {
        const decreaseBtn = document.getElementById('decreaseQty');
        const increaseBtn = document.getElementById('increaseQty');
        const quantityInput = document.getElementById('productQuantity');
        const addToCartBtn = document.getElementById('addToCartBtn');

        decreaseBtn.addEventListener('click', () => {
            const currentValue = parseInt(quantityInput.value) || 1;
            if (currentValue > 1) {
                quantityInput.value = currentValue - 1;
            }
        });

        increaseBtn.addEventListener('click', () => {
            const currentValue = parseInt(quantityInput.value) || 1;
            const maxValue = parseInt(quantityInput.max) || 100;
            if (currentValue < maxValue) {
                quantityInput.value = currentValue + 1;
            }
        });

        quantityInput.addEventListener('change', (e) => {
            const value = parseInt(e.target.value) || 1;
            const maxValue = parseInt(e.target.max) || 100;
            const minValue = parseInt(e.target.min) || 1;
            
            if (value < minValue) {
                e.target.value = minValue;
            } else if (value > maxValue) {
                e.target.value = maxValue;
            }
        });

        addToCartBtn.addEventListener('click', () => {
            this.addToCart();
        });
    }

    async addToCart() {
        if (!this.product) return;

        const quantity = parseInt(document.getElementById('productQuantity').value) || 1;
        const addToCartBtn = document.getElementById('addToCartBtn');

        try {
            addToCartBtn.disabled = true;
            addToCartBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Agregando...';

            if (!window.cart) {
                window.cart = new Cart();
            }

            const productData = {
                id: this.product.id,
                name: this.product.name,
                price: this.product.price,
                sku: this.product.sku,
                stock: this.product.stock,
                image_url: this.product.image_url,
                image: this.product.image_url
            };

            await window.cart.addItem(productData, quantity);
            
            addToCartBtn.innerHTML = '<i class="fas fa-check"></i> Agregado';
            
            setTimeout(() => {
                addToCartBtn.innerHTML = '<i class="fas fa-cart-plus"></i> Agregar al Carrito';
                addToCartBtn.disabled = false;
            }, 1500);

        } catch (error) {
            console.error('Error al agregar al carrito:', error);
            Utils.showToast('Error al agregar producto al carrito', 'error');
            addToCartBtn.innerHTML = '<i class="fas fa-cart-plus"></i> Agregar al Carrito';
            addToCartBtn.disabled = false;
        }
    }

    showError(message) {
        const loadingState = document.getElementById('loadingState');
        const errorState = document.getElementById('errorState');
        const productContent = document.getElementById('productContent');

        loadingState.style.display = 'none';
        productContent.style.display = 'none';
        errorState.style.display = 'block';
        
        const errorMessage = errorState.querySelector('p');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.productDetailManager = new ProductDetailManager();
});

window.ProductDetailManager = ProductDetailManager;
