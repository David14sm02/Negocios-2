class AdminProductsPage {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.products = [];
        this.imageData = null;
        this.originalImageData = null;
        this.imageMarkedForRemoval = false;
        this.editingProductId = null;
        this.editingProduct = null;
        this.categories = [];
        this.editingCategoryId = null;
        this.editingCategory = null;
        this.isLoadingCategories = false;
        this.currentSection = 'categories';
        this.pagination = {
            page: 1,
            limit: 10,
            totalPages: 1,
            total: 0,
            hasNext: false,
            hasPrev: false
        };
        this.isLoadingProducts = false;
        this.elements = {};
        this.init();
    }

    async init() {
        if (!this.apiClient) {
            console.error('API client no disponible');
            Utils.showToast('No se pudo inicializar el panel de administración.', 'error');
            return;
        }

        this.cacheElements();
        this.bindEvents();
        this.showSection(this.currentSection);

        await this.loadCategories();
        await this.loadProducts();
    }

    escapeHtml(value) {
        if (value === undefined || value === null) return '';
        return String(value).replace(/[&<>"']/g, (match) => {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return map[match] || match;
        });
    }

    showSection(section) {
        if (!section) return;
        this.currentSection = section;

        if (this.elements.sectionPanels && this.elements.sectionPanels.length > 0) {
            this.elements.sectionPanels.forEach((panel) => {
                const isTarget = panel.dataset.adminSection === section;
                panel.classList.toggle('hidden', !isTarget);
            });
        }

        if (this.elements.sectionToggleButtons && this.elements.sectionToggleButtons.length > 0) {
            this.elements.sectionToggleButtons.forEach((button) => {
                const isTarget = button.dataset.sectionTarget === section;
                button.classList.toggle('btn-primary', isTarget);
                button.classList.toggle('btn-outline', !isTarget);
            });
        }
    }

    cacheElements() {
        this.elements.productsTableBody = document.getElementById('productsTableBody');
        this.elements.paginationInfo = document.getElementById('paginationInfo');
        this.elements.refreshBtn = document.getElementById('refreshProductsBtn');
        this.elements.prevPageBtn = document.getElementById('prevPageBtn');
        this.elements.nextPageBtn = document.getElementById('nextPageBtn');
        this.elements.categoriesTableBody = document.getElementById('categoriesTableBody');
        this.elements.refreshCategoriesBtn = document.getElementById('refreshCategoriesBtn');
        this.elements.categoryForm = document.getElementById('categoryForm');
        this.elements.categoryNameInput = document.getElementById('categoryName');
        this.elements.categoryDescriptionInput = document.getElementById('categoryDescription');
        this.elements.categoryParentSelect = document.getElementById('categoryParent');
        this.elements.categoryImageInput = document.getElementById('categoryImageUrl');
        this.elements.categoryIsActiveCheckbox = document.getElementById('categoryIsActive');
        this.elements.categorySubmitBtn = document.getElementById('categorySubmitBtn');
        this.elements.categoryResetBtn = document.getElementById('categoryResetBtn');
        this.elements.categoryCancelEditBtn = document.getElementById('categoryCancelEditBtn');
        this.elements.sectionToggleButtons = Array.from(document.querySelectorAll('[data-section-target]'));
        this.elements.sectionPanels = Array.from(document.querySelectorAll('[data-admin-section]'));
        this.elements.createProductForm = document.getElementById('createProductForm');
        this.elements.submitProductBtn = document.getElementById('submitProductBtn');
        this.elements.resetProductFormBtn = document.getElementById('resetProductFormBtn');
        this.elements.cancelEditBtn = document.getElementById('cancelEditBtn');
        this.elements.productCategorySelect = document.getElementById('productCategory');
        this.elements.productStockInput = document.getElementById('productStock');
        this.elements.productMinStockInput = document.getElementById('productMinStock');
        this.elements.imageDropzone = document.getElementById('productImageDropzone');
        this.elements.imageInput = document.getElementById('productImageInput');
        this.elements.imageContent = document.getElementById('productImageContent');
        this.elements.imagePreview = document.getElementById('productImagePreview');
        this.elements.imagePreviewImg = document.getElementById('productImagePreviewImg');
        this.elements.imageRemoveBtn = document.getElementById('productImageRemoveBtn');
    }

    bindEvents() {
        if (this.elements.sectionToggleButtons && this.elements.sectionToggleButtons.length > 0) {
            this.elements.sectionToggleButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    const target = button.dataset.sectionTarget;
                    if (target) {
                        this.showSection(target);
                    }
                });
            });
        }

        this.elements.refreshCategoriesBtn?.addEventListener('click', () => {
            this.loadCategories(true);
        });

        this.elements.categoryForm?.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handleCategorySubmit();
        });

        this.elements.categoryForm?.addEventListener('reset', () => {
            // Permitir que el formulario limpie los inputs antes de restaurar valores por defecto
            setTimeout(() => this.resetCategoryForm(), 0);
        });

        this.elements.categoryCancelEditBtn?.addEventListener('click', () => {
            this.exitCategoryEditMode();
        });

        this.elements.categoriesTableBody?.addEventListener('click', (event) => {
            const editButton = event.target.closest('[data-action="edit-category"]');
            if (editButton) {
                const categoryId = Number(editButton.dataset.categoryId);
                if (!categoryId) {
                    Utils.showToast('Categoría inválida.', 'error');
                    return;
                }
                const category = this.categories.find(item => item.id === categoryId);
                if (!category) {
                    Utils.showToast('No se encontró la categoría seleccionada.', 'error');
                    return;
                }
                this.enterCategoryEditMode(category);
                return;
            }

            const deleteButton = event.target.closest('[data-action="delete-category"]');
            if (deleteButton) {
                const categoryId = Number(deleteButton.dataset.categoryId);
                if (!categoryId) {
                    Utils.showToast('Categoría inválida.', 'error');
                    return;
                }
                this.handleCategoryDelete(categoryId);
            }
        });

        this.elements.refreshBtn?.addEventListener('click', () => {
            this.loadProducts(true);
        });

        this.elements.prevPageBtn?.addEventListener('click', () => {
            if (this.pagination.page > 1) {
                this.pagination.page -= 1;
                this.loadProducts();
            }
        });

        this.elements.nextPageBtn?.addEventListener('click', () => {
            if (this.pagination.hasNext) {
                this.pagination.page += 1;
                this.loadProducts();
            }
        });

        this.elements.createProductForm?.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handleSubmitProduct();
        });

        this.elements.createProductForm?.addEventListener('reset', () => {
            if (this.elements.productStockInput) {
                this.elements.productStockInput.value = '0';
            }
            if (this.elements.productMinStockInput) {
                this.elements.productMinStockInput.value = '5';
            }
            this.resetImageDropzone();
            if (this.editingProductId) {
                this.exitEditMode();
            }
        });

        this.elements.productsTableBody?.addEventListener('click', (event) => {
            const stockButton = event.target.closest('[data-action="update-stock"]');
            if (stockButton) {
                const productId = Number(stockButton.dataset.productId);
                if (!productId) {
                    Utils.showToast('Producto inválido.', 'error');
                    return;
                }

                const row = stockButton.closest('tr');
                this.handleStockUpdate(productId, row, stockButton);
                return;
            }

            const editButton = event.target.closest('[data-action="edit-product"]');
            if (editButton) {
                const productId = Number(editButton.dataset.productId);
                if (!productId) {
                    Utils.showToast('Producto inválido.', 'error');
                    return;
                }

                const product = this.products.find((item) => item.id === productId);
                if (!product) {
                    Utils.showToast('No se encontró el producto seleccionado.', 'error');
                    return;
                }

                this.enterEditMode(product);
                return;
            }

            const deleteButton = event.target.closest('[data-action="delete-product"]');
            if (deleteButton) {
                const productId = Number(deleteButton.dataset.productId);
                if (!productId) {
                    Utils.showToast('Producto inválido.', 'error');
                    return;
                }
                this.handleProductDelete(productId);
            }
        });

        if (this.elements.imageDropzone && this.elements.imageInput) {
            const dropzone = this.elements.imageDropzone;

            const preventDefaults = (event) => {
                event.preventDefault();
                event.stopPropagation();
            };

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
                dropzone.addEventListener(eventName, preventDefaults, false);
            });

            ['dragenter', 'dragover'].forEach((eventName) => {
                dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
            });

            ['dragleave', 'drop'].forEach((eventName) => {
                dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
            });

            dropzone.addEventListener('drop', (event) => {
                const files = event.dataTransfer?.files;
                if (files && files.length > 0) {
                    this.handleImageFile(files[0]);
                }
            });

            dropzone.addEventListener('click', () => {
                this.elements.imageInput?.click();
            });

            this.elements.imageInput.addEventListener('change', (event) => {
                const file = event.target.files?.[0];
                if (file) {
                    this.handleImageFile(file);
                }
            });
        }

        this.elements.imageRemoveBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            this.resetImageDropzone(true);
        });

        this.elements.cancelEditBtn?.addEventListener('click', () => {
            this.exitEditMode();
            this.elements.createProductForm?.reset();
            if (this.elements.productStockInput) {
                this.elements.productStockInput.value = '0';
            }
            if (this.elements.productMinStockInput) {
                this.elements.productMinStockInput.value = '5';
            }
            this.resetImageDropzone();
        });
    }

    async loadCategories(fromRefresh = false) {
        if (this.isLoadingCategories) return;
        this.isLoadingCategories = true;

        if (this.elements.categorySubmitBtn) {
            this.elements.categorySubmitBtn.disabled = true;
        }
        if (this.elements.refreshCategoriesBtn) {
            this.elements.refreshCategoriesBtn.disabled = true;
        }

        this.setCategoriesTableLoading(true, fromRefresh);

        try {
            const response = await this.apiClient.getAllCategories();
            this.categories = Array.isArray(response.data) ? response.data : response.data?.categories || [];
            this.renderCategoriesTable();
            this.renderCategoryOptions();
            this.populateCategoryParentSelect();
        } catch (error) {
            console.error('Error al cargar categorías:', error);
            this.renderCategoriesError(error?.message || 'No se pudo cargar el listado de categorías.');
            Utils.showToast('No se pudieron cargar las categorías.', 'warning');
        } finally {
            this.isLoadingCategories = false;
            this.setCategoriesTableLoading(false);
            if (this.elements.categorySubmitBtn) {
                this.elements.categorySubmitBtn.disabled = false;
            }
            if (this.elements.refreshCategoriesBtn) {
                this.elements.refreshCategoriesBtn.disabled = false;
            }
        }
    }


    renderCategoryOptions() {
        if (!this.elements.productCategorySelect) return;

        const activeCategories = this.categories.filter(category => category.is_active);
        const options = ['<option value="">Selecciona una categoría</option>'];

        if (activeCategories.length === 0) {
            options.push('<option value="" disabled>No hay categorías disponibles</option>');
            this.elements.productCategorySelect.disabled = true;
        } else {
            activeCategories.forEach((category) => {
                options.push(`<option value="${category.id}">${category.name}</option>`);
            });
            this.elements.productCategorySelect.disabled = false;
        }

        this.elements.productCategorySelect.innerHTML = options.join('');
    }

    setCategoriesTableLoading(isLoading, fromRefresh = false) {
        if (!this.elements.categoriesTableBody) return;

        if (isLoading) {
            const message = fromRefresh ? 'Actualizando categorías...' : 'Cargando categorías...';
            this.elements.categoriesTableBody.innerHTML = `
                <tr>
                    <td class="table-empty" colspan="5">
                        <i class="fas fa-spinner fa-spin"></i> ${message}
                    </td>
                </tr>
            `;
        }
    }

    renderCategoriesTable() {
        if (!this.elements.categoriesTableBody) return;

        if (this.categories.length === 0) {
            this.elements.categoriesTableBody.innerHTML = `
                <tr>
                    <td class="table-empty" colspan="5">
                        No hay categorías registradas. Crea una nueva para comenzar.
                    </td>
                </tr>
            `;
            return;
        }

        const rows = this.categories.map((category) => {
            const activeBadge = category.is_active
                ? '<span class="status-badge active"><i class="fas fa-check-circle"></i> Activa</span>'
                : '<span class="status-badge inactive"><i class="fas fa-ban"></i> Inactiva</span>';

            return `
                <tr data-category-id="${category.id}">
                    <td>
                        <div class="table-product">
                            <strong>${this.escapeHtml(category.name)}</strong>
                            <div class="table-product-meta">
                                ID: ${category.id}${category.parent_name ? ` · Padre: ${this.escapeHtml(category.parent_name)}` : ''}
                            </div>
                        </div>
                    </td>
                    <td>${category.description ? this.escapeHtml(category.description) : '—'}</td>
                    <td>${category.active_product_count ?? 0}</td>
                    <td>${activeBadge}</td>
                    <td>
                        <div class="table-actions">
                            <button
                                type="button"
                                class="btn btn-outline btn-sm"
                                data-action="edit-category"
                                data-category-id="${category.id}"
                            >
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button
                                type="button"
                                class="btn btn-outline btn-sm"
                                data-action="delete-category"
                                data-category-id="${category.id}"
                            >
                                <i class="fas fa-trash"></i> Eliminar
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.elements.categoriesTableBody.innerHTML = rows;
    }

    renderCategoriesError(message) {
        if (!this.elements.categoriesTableBody) return;
        this.elements.categoriesTableBody.innerHTML = `
            <tr>
                <td class="table-empty" colspan="5">${message}</td>
            </tr>
        `;
    }

    populateCategoryParentSelect(excludeId = null) {
        if (!this.elements.categoryParentSelect) return;

        const options = ['<option value="">Sin categoría padre</option>'];

        this.categories
            .filter(category => category.id !== excludeId)
            .forEach(category => {
                const disabled = !category.is_active ? 'disabled' : '';
                options.push(`<option value="${category.id}" ${disabled}>${category.name}</option>`);
            });

        this.elements.categoryParentSelect.innerHTML = options.join('');
    }

    resetCategoryForm() {
        if (!this.elements.categoryForm) return;

        this.elements.categoryNameInput.value = '';
        this.elements.categoryDescriptionInput.value = '';
        this.elements.categoryImageInput.value = '';
        this.elements.categoryIsActiveCheckbox.checked = true;
        this.exitCategoryEditMode();
    }

    setCategoryFormLoading(isLoading) {
        if (this.elements.categorySubmitBtn) {
            this.elements.categorySubmitBtn.disabled = isLoading;
        }
        if (this.elements.refreshCategoriesBtn) {
            this.elements.refreshCategoriesBtn.disabled = isLoading;
        }
    }

    async handleCategorySubmit() {
        if (!this.elements.categoryForm || !this.apiClient) return;

        const formData = new FormData(this.elements.categoryForm);
        const name = formData.get('name')?.toString().trim();
        const description = formData.get('description')?.toString().trim();
        const parentIdValue = formData.get('parent_id')?.toString().trim();
        const imageUrl = formData.get('image_url')?.toString().trim();

        const payload = {
            name,
            description: description ? description : null,
            parent_id: parentIdValue ? parentIdValue : null,
            image_url: imageUrl ? imageUrl : null,
            is_active: this.elements.categoryIsActiveCheckbox?.checked ?? true
        };

        if (!payload.name) {
            Utils.showToast('El nombre de la categoría es obligatorio.', 'warning');
            return;
        }

        this.setCategoryFormLoading(true);

        try {
            if (this.editingCategoryId) {
                await this.apiClient.updateCategory(this.editingCategoryId, payload);
                Utils.showToast('Categoría actualizada correctamente.', 'success');
            } else {
                await this.apiClient.createCategory(payload);
                Utils.showToast('Categoría creada correctamente.', 'success');
            }

            await this.loadCategories(true);
            this.elements.categoryForm.reset();
        } catch (error) {
            console.error('Error al guardar categoría:', error);
            Utils.showToast(error?.message || 'No se pudo guardar la categoría.', 'error');
        } finally {
            this.setCategoryFormLoading(false);
        }
    }

    enterCategoryEditMode(category) {
        if (!category || !this.elements.categoryForm) return;

        this.showSection('categories');

        this.editingCategoryId = category.id;
        this.editingCategory = category;

        this.elements.categoryNameInput.value = category.name || '';
        this.elements.categoryDescriptionInput.value = category.description || '';
        this.elements.categoryImageInput.value = category.image_url || '';
        this.elements.categoryIsActiveCheckbox.checked = category.is_active === true;

        this.populateCategoryParentSelect(category.id);
        if (this.elements.categoryParentSelect) {
            this.elements.categoryParentSelect.value = category.parent_id || '';
        }

        if (this.elements.categorySubmitBtn) {
            this.elements.categorySubmitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar categoría';
        }
        if (this.elements.categoryCancelEditBtn) {
            this.elements.categoryCancelEditBtn.classList.remove('hidden');
        }
    }

    exitCategoryEditMode() {
        this.editingCategoryId = null;
        this.editingCategory = null;

        if (this.elements.categorySubmitBtn) {
            this.elements.categorySubmitBtn.innerHTML = '<i class="fas fa-folder-plus"></i> Crear categoría';
        }
        if (this.elements.categoryCancelEditBtn) {
            this.elements.categoryCancelEditBtn.classList.add('hidden');
        }

        this.populateCategoryParentSelect();
    }

    async handleCategoryDelete(categoryId) {
        if (!this.apiClient) return;

        const category = this.categories.find(item => item.id === categoryId);
        if (!category) {
            Utils.showToast('La categoría seleccionada no existe.', 'error');
            return;
        }

        const confirmDelete = window.confirm(
            `¿Seguro que deseas eliminar la categoría "${category.name}"? Esta acción marcará la categoría como inactiva. Los productos asociados permanecerán visibles, pero ya no podrán seleccionarse en nuevas altas.`
        );

        if (!confirmDelete) {
            return;
        }

        this.setCategoryFormLoading(true);

        try {
            await this.apiClient.deleteCategory(categoryId);
            Utils.showToast('Categoría eliminada correctamente.', 'success');
            await this.loadCategories(true);

            if (this.editingCategoryId === categoryId) {
                this.exitCategoryEditMode();
                this.elements.categoryForm?.reset();
            }
        } catch (error) {
            console.error('Error al eliminar categoría:', error);
            Utils.showToast(error?.message || 'No se pudo eliminar la categoría.', 'error');
        } finally {
            this.setCategoryFormLoading(false);
        }
    }

    async loadProducts(fromRefresh = false) {
        if (this.isLoadingProducts) return;
        this.isLoadingProducts = true;

        this.setProductsTableLoading(true, fromRefresh);

        try {
            const { page, limit } = this.pagination;
            const response = await this.apiClient.getProducts({
                page,
                limit,
                sort: 'created_at',
                order: 'desc'
            });

            this.products = Array.isArray(response.data) ? response.data : [];
            const paginationData = response.pagination || {};

            this.pagination = {
                ...this.pagination,
                ...paginationData,
                page: paginationData.page || page,
                limit: paginationData.limit || limit,
                total: typeof paginationData.total === 'number' ? paginationData.total : this.products.length,
                totalPages: paginationData.totalPages || paginationData.total_pages || this.pagination.totalPages,
                hasNext: !!paginationData.hasNext,
                hasPrev: !!paginationData.hasPrev
            };

            this.renderProducts();
            this.updatePaginationControls();
        } catch (error) {
            console.error('Error al cargar productos:', error);
            this.renderProductsError(error.message || 'No se pudo cargar el inventario.');
        } finally {
            this.isLoadingProducts = false;
            this.setProductsTableLoading(false);
        }
    }

    setProductsTableLoading(isLoading, fromRefresh = false) {
        if (!this.elements.productsTableBody) return;

        if (isLoading) {
            const message = fromRefresh ? 'Actualizando lista...' : 'Cargando productos...';
            this.elements.productsTableBody.innerHTML = `
                <tr>
                    <td class="table-empty" colspan="7">
                        <i class="fas fa-spinner fa-spin"></i> ${message}
                    </td>
                </tr>
            `;
        }
    }

    renderProducts() {
        if (!this.elements.productsTableBody) return;

        if (this.products.length === 0) {
            this.elements.productsTableBody.innerHTML = `
                <tr>
                    <td class="table-empty" colspan="7">
                        No hay productos registrados. Crea uno nuevo para comenzar.
                    </td>
                </tr>
            `;
            return;
        }

        const rows = this.products.map((product) => {
            const stock = Number(product.stock ?? 0);
            const minStock = Number(product.min_stock ?? 0);
            const isLowStock = stock <= minStock;
            const formattedPrice = Utils.formatPrice(product.price || 0);
            const updatedAt = product.updated_at ? Utils.formatDate(product.updated_at) : '—';

            return `
                <tr data-product-id="${product.id}">
                    <td>
                        <div class="table-product">
                            <strong>${product.name}</strong>
                            <div class="table-product-meta">ID: ${product.id}</div>
                        </div>
                    </td>
                    <td>${product.sku || '—'}</td>
                    <td>${formattedPrice}</td>
                    <td>
                        <div class="stock-control">
                            <input 
                                type="number" 
                                class="stock-input ${isLowStock ? 'low' : ''}" 
                                data-field="stock" 
                                min="0" 
                                step="1" 
                                value="${stock}"
                                aria-label="Stock actual"
                            >
                            <input 
                                type="number" 
                                class="stock-input" 
                                data-field="min_stock" 
                                min="0" 
                                step="1" 
                                value="${minStock}"
                                aria-label="Stock mínimo"
                            >
                            <button 
                                type="button" 
                                class="btn btn-primary btn-sm btn-update-stock" 
                                data-action="update-stock" 
                                data-product-id="${product.id}"
                            >
                                <i class="fas fa-save"></i>
                                Actualizar
                            </button>
                        </div>
                        ${isLowStock ? '<small class="text-warning">Stock bajo</small>' : ''}
                    </td>
                    <td>
                        <span class="status-badge ${product.is_active ? 'active' : 'inactive'}">
                            <i class="fas ${product.is_active ? 'fa-check-circle' : 'fa-ban'}"></i>
                            ${product.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td data-column="updated-at">${updatedAt}</td>
                    <td>
                        <div class="table-actions">
                            <button 
                                type="button" 
                                class="btn btn-outline btn-sm" 
                                data-action="edit-product"
                                data-product-id="${product.id}"
                            >
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button 
                                type="button" 
                                class="btn btn-outline btn-sm" 
                                data-action="delete-product"
                                data-product-id="${product.id}"
                            >
                                <i class="fas fa-trash"></i> Eliminar
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.elements.productsTableBody.innerHTML = rows;
    }

    renderProductsError(message) {
        if (!this.elements.productsTableBody) return;
        this.elements.productsTableBody.innerHTML = `
            <tr>
                <td class="table-empty" colspan="7">${message}</td>
            </tr>
        `;
    }

    updatePaginationControls() {
        const { page, totalPages, total, hasNext, hasPrev } = this.pagination;

        if (this.elements.paginationInfo) {
            const safeTotalPages = Math.max(totalPages || 1, 1);
            const safeTotal = typeof total === 'number' ? total : this.products.length;
            this.elements.paginationInfo.textContent = `Página ${page} de ${safeTotalPages} · ${safeTotal} productos`;
        }

        if (this.elements.prevPageBtn) {
            this.elements.prevPageBtn.disabled = !hasPrev;
        }

        if (this.elements.nextPageBtn) {
            this.elements.nextPageBtn.disabled = !hasNext;
        }
    }

    async handleSubmitProduct() {
        if (!this.elements.createProductForm || !this.elements.submitProductBtn) return;

        const formElement = this.elements.createProductForm;
        const submitBtn = this.elements.submitProductBtn;

        const formData = new FormData(formElement);

        const name = formData.get('name')?.toString().trim();
        const sku = formData.get('sku')?.toString().trim();
        const price = Number(formData.get('price'));
        const categoryId = Number(formData.get('category_id'));

        if (!name || name.length < 2) {
            Utils.showToast('El nombre del producto es obligatorio.', 'warning');
            return;
        }

        if (!sku || sku.length < 3) {
            Utils.showToast('El SKU debe tener al menos 3 caracteres.', 'warning');
            return;
        }

        if (!Number.isFinite(price) || price < 0) {
            Utils.showToast('El precio debe ser un número válido.', 'warning');
            return;
        }

        if (!Number.isInteger(categoryId) || categoryId < 1) {
            Utils.showToast('Selecciona una categoría válida.', 'warning');
            return;
        }

        const stock = Number(formData.get('stock') ?? 0);
        const minStock = Number(formData.get('min_stock') ?? 0);
        const weightRaw = formData.get('weight')?.toString().trim();
        const specificationsRaw = formData.get('specifications')?.toString().trim();
        const featuresRaw = formData.get('features')?.toString().trim();
        const tagsRaw = formData.get('tags')?.toString().trim();
        const dimensionsRaw = formData.get('dimensions')?.toString().trim();

        const payload = {
            name,
            sku,
            price,
            category_id: categoryId,
            stock: Number.isFinite(stock) && stock >= 0 ? Math.floor(stock) : 0,
            min_stock: Number.isFinite(minStock) && minStock >= 0 ? Math.floor(minStock) : 0,
            description: formData.get('description')?.toString().trim() || undefined,
            brand: formData.get('brand')?.toString().trim() || undefined,
            weight: weightRaw && weightRaw.length > 0 ? weightRaw : undefined,
            is_featured: formData.get('is_featured') === 'on'
        };

        if (specificationsRaw) {
            try {
                payload.specifications = JSON.parse(specificationsRaw);
            } catch (error) {
                Utils.showToast('Las especificaciones deben estar en formato JSON válido.', 'warning');
                return;
            }
        }

        if (dimensionsRaw) {
            try {
                payload.dimensions = JSON.parse(dimensionsRaw);
            } catch (error) {
                Utils.showToast('Las dimensiones deben estar en formato JSON válido.', 'warning');
                return;
            }
        }

        if (featuresRaw) {
            const featuresArray = featuresRaw
                .split('\n')
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
            if (featuresArray.length > 0) {
                payload.features = featuresArray;
            }
        }

        if (tagsRaw) {
            const tagsArray = tagsRaw
                .split(',')
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
            if (tagsArray.length > 0) {
                payload.tags = tagsArray;
            }
        }

        if (this.editingProductId) {
            payload.is_active = this.editingProduct?.is_active !== false;
        }

        if (this.imageMarkedForRemoval) {
            payload.image_url = null;
        } else if (this.imageData) {
            payload.image_url = this.imageData;
        } else if (this.editingProductId && this.originalImageData) {
            payload.image_url = this.originalImageData;
        }

        const actionLabel = this.editingProductId ? 'Guardar cambios' : 'Crear producto';
        this.setButtonLoading(submitBtn, true, actionLabel);

        try {
            if (this.editingProductId) {
                const response = await this.apiClient.updateProduct(this.editingProductId, payload);
                Utils.showToast(response.message || 'Producto actualizado correctamente.', 'success');
                await this.loadProducts(true);
                this.exitEditMode();
            } else {
                const response = await this.apiClient.createProduct(payload);
                Utils.showToast(response.message || 'Producto creado correctamente.', 'success');
                this.pagination.page = 1;
                await this.loadProducts(true);
            }

            formElement.reset();
            if (this.elements.productStockInput) {
                this.elements.productStockInput.value = '0';
            }
            if (this.elements.productMinStockInput) {
                this.elements.productMinStockInput.value = '5';
            }
            this.resetImageDropzone();
        } catch (error) {
            console.error('Error al guardar producto:', error);
            Utils.showToast(error.message || 'No se pudo guardar el producto.', 'error');
        } finally {
            this.setButtonLoading(submitBtn, false);
        }
    }

    async handleStockUpdate(productId, row, button) {
        if (!row || !button) return;

        const stockInput = row.querySelector('input[data-field="stock"]');
        const minStockInput = row.querySelector('input[data-field="min_stock"]');

        const stockValue = Number(stockInput?.value ?? 0);
        const minStockValue = Number(minStockInput?.value ?? 0);

        if (!Number.isFinite(stockValue) || stockValue < 0) {
            Utils.showToast('El stock debe ser un número mayor o igual a cero.', 'warning');
            stockInput?.focus();
            return;
        }

        if (minStockInput && (!Number.isFinite(minStockValue) || minStockValue < 0)) {
            Utils.showToast('El stock mínimo debe ser un número mayor o igual a cero.', 'warning');
            minStockInput.focus();
            return;
        }

        const payload = {
            stock: Math.floor(stockValue)
        };

        if (minStockInput) {
            payload.min_stock = Math.floor(minStockValue);
        }

        this.setButtonLoading(button, true, 'Actualizar');

        try {
            const response = await this.apiClient.updateProductStock(productId, payload);
            Utils.showToast(response.message || 'Stock actualizado.', 'success');

            const updatedData = response.data || {};

            if (stockInput && typeof updatedData.stock !== 'undefined') {
                stockInput.value = updatedData.stock;
            }

            if (minStockInput && typeof updatedData.min_stock !== 'undefined') {
                minStockInput.value = updatedData.min_stock;
            }

            this.refreshRowStyles(row, updatedData.updated_at);
            this.updateStoredProduct(productId, updatedData);
        } catch (error) {
            console.error('Error al actualizar stock:', error);
            Utils.showToast(error.message || 'No se pudo actualizar el stock.', 'error');
        } finally {
            this.setButtonLoading(button, false);
        }
    }

    async handleProductDelete(productId) {
        if (!this.apiClient) return;

        const product = this.products.find(item => item.id === productId);
        if (!product) {
            Utils.showToast('El producto seleccionado no existe.', 'error');
            return;
        }

        const confirmDelete = window.confirm(
            `¿Seguro que deseas eliminar el producto "${product.name}"? Esta acción marcará el producto como inactivo.`
        );

        if (!confirmDelete) {
            return;
        }

        // Deshabilitar botones mientras se procesa
        const deleteButton = document.querySelector(`[data-action="delete-product"][data-product-id="${productId}"]`);
        if (deleteButton) {
            this.setButtonLoading(deleteButton, true, 'Eliminando...');
        }

        try {
            await this.apiClient.deleteProduct(productId);
            Utils.showToast('Producto eliminado correctamente.', 'success');
            await this.loadProducts(true);

            if (this.editingProductId === productId) {
                this.exitEditMode();
                this.elements.createProductForm?.reset();
                if (this.elements.productStockInput) {
                    this.elements.productStockInput.value = '0';
                }
                if (this.elements.productMinStockInput) {
                    this.elements.productMinStockInput.value = '5';
                }
                this.resetImageDropzone();
            }
        } catch (error) {
            console.error('Error al eliminar producto:', error);
            Utils.showToast(error?.message || 'No se pudo eliminar el producto.', 'error');
        } finally {
            if (deleteButton) {
                this.setButtonLoading(deleteButton, false);
            }
        }
    }

    refreshRowStyles(row, updatedAt) {
        const stockInput = row.querySelector('input[data-field="stock"]');
        const minStockInput = row.querySelector('input[data-field="min_stock"]');

        if (!stockInput) return;

        const stockValue = Number(stockInput.value ?? 0);
        const minStockValue = Number(minStockInput?.value ?? 0);

        const isLowStock = Number.isFinite(stockValue) && Number.isFinite(minStockValue) && stockValue <= minStockValue;
        stockInput.classList.toggle('low', isLowStock);

        if (isLowStock) {
            if (!row.querySelector('.text-warning')) {
                const warning = document.createElement('small');
                warning.className = 'text-warning';
                warning.textContent = 'Stock bajo';
                const stockControl = row.querySelector('.stock-control');
                stockControl?.appendChild(warning);
            }
        } else {
            const warning = row.querySelector('.text-warning');
            warning?.remove();
        }

        const updatedCell = row.querySelector('td[data-column="updated-at"]');
        if (updatedCell) {
            if (updatedAt) {
                updatedCell.textContent = Utils.formatDate(updatedAt);
            } else {
                updatedCell.textContent = Utils.formatDate(new Date());
            }
        }
    }

    updateStoredProduct(productId, updatedData) {
        const productIndex = this.products.findIndex((item) => item.id === productId);
        if (productIndex === -1) return;

        this.products[productIndex] = {
            ...this.products[productIndex],
            ...updatedData
        };
    }

    setButtonLoading(button, isLoading, fallbackLabel = '') {
        if (!button) return;

        if (isLoading) {
            button.dataset.originalContent = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        } else {
            button.disabled = false;
            const original = button.dataset.originalContent;
            button.innerHTML = original || fallbackLabel || 'Guardar';
            delete button.dataset.originalContent;
        }
    }

    handleImageFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            Utils.showToast('Selecciona un archivo de imagen válido.', 'warning');
            return;
        }

        const maxSizeMB = 2;
        if (file.size > maxSizeMB * 1024 * 1024) {
            Utils.showToast(`La imagen no debe superar ${maxSizeMB} MB.`, 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result === 'string') {
                this.imageData = result;
                this.imageMarkedForRemoval = false;
                this.showImagePreview(result);
            }
        };
        reader.onerror = () => {
            Utils.showToast('No se pudo leer la imagen seleccionada.', 'error');
        };
        reader.readAsDataURL(file);
    }

    showImagePreview(dataUrl) {
        if (!this.elements.imagePreview || !this.elements.imagePreviewImg || !this.elements.imageContent) {
            return;
        }
        this.elements.imagePreviewImg.src = dataUrl;
        this.elements.imagePreview.classList.remove('hidden');
        this.elements.imageContent.classList.add('hidden');
        this.imageMarkedForRemoval = false;
    }

    resetImageDropzone(markRemoval = false) {
        this.imageData = null;
        if (markRemoval) {
            this.originalImageData = null;
            this.imageMarkedForRemoval = true;
        } else {
            this.imageMarkedForRemoval = false;
        }
        if (this.elements.imageInput) {
            this.elements.imageInput.value = '';
        }
        if (this.elements.imagePreview) {
            this.elements.imagePreview.classList.add('hidden');
        }
        if (this.elements.imagePreviewImg) {
            this.elements.imagePreviewImg.src = '';
        }
        if (this.elements.imageContent) {
            this.elements.imageContent.classList.remove('hidden');
        }
    }

    enterEditMode(product) {
        this.showSection('products');

        this.editingProductId = product.id;
        this.editingProduct = product;
        this.originalImageData = product.image_url || null;
        this.imageData = null;
        this.imageMarkedForRemoval = false;

        this.populateFormFields(product);
        this.updateFormMode(true);

        this.elements.createProductForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    exitEditMode() {
        this.editingProductId = null;
        this.editingProduct = null;
        this.originalImageData = null;
        this.imageData = null;
        this.imageMarkedForRemoval = false;
        this.updateFormMode(false);
    }

    populateFormFields(product) {
        const setValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value ?? '';
            }
        };

        const stringifyJson = (value) => {
            if (!value) return '';
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    return JSON.stringify(parsed, null, 2);
                } catch {
                    return value;
                }
            }
            try {
                return JSON.stringify(value, null, 2);
            } catch {
                return '';
            }
        };

        const normalizeArray = (value) => {
            if (Array.isArray(value)) return value;
            if (typeof value === 'string' && value.length > 0) {
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) return parsed;
                } catch {
                    const cleaned = value.replace(/^\{|\}$/g, '');
                    return cleaned
                        .split(',')
                        .map((item) => item.replace(/^"+|"+$/g, '').trim())
                        .filter(Boolean);
                }
            }
            return [];
        };

        setValue('productName', product.name ?? '');
        setValue('productSku', product.sku ?? '');
        setValue('productPrice', product.price ?? '');
        setValue('productStock', product.stock ?? 0);
        setValue('productMinStock', product.min_stock ?? 0);
        if (this.elements.productStockInput) {
            this.elements.productStockInput.value = product.stock ?? 0;
        }
        if (this.elements.productMinStockInput) {
            this.elements.productMinStockInput.value = product.min_stock ?? 0;
        }
        setValue('productBrand', product.brand ?? '');
        setValue('productWeight', product.weight ?? '');
        setValue('productDescription', product.description ?? '');
        setValue('productSpecifications', stringifyJson(product.specifications));
        setValue('productDimensions', stringifyJson(product.dimensions));

        const featuresArray = normalizeArray(product.features);
        setValue('productFeatures', featuresArray.join('\n'));

        const tagsArray = normalizeArray(product.tags);
        setValue('productTags', tagsArray.join(', '));

        if (this.elements.productCategorySelect) {
            const categoryValue = product.category_id ? String(product.category_id) : '';
            this.elements.productCategorySelect.value = categoryValue;
        }

        const featuredCheckbox = document.getElementById('productFeatured');
        if (featuredCheckbox) {
            featuredCheckbox.checked = product.is_featured === true;
        }

        if (product.image_url) {
            this.showImagePreview(product.image_url);
        } else {
            this.resetImageDropzone();
        }
    }

    updateFormMode(isEditing) {
        if (this.elements.submitProductBtn) {
            this.elements.submitProductBtn.innerHTML = isEditing
                ? '<i class="fas fa-save"></i> Guardar cambios'
                : '<i class="fas fa-plus-circle"></i> Crear producto';
        }

        if (this.elements.cancelEditBtn) {
            this.elements.cancelEditBtn.classList.toggle('hidden', !isEditing);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const apiClient = window.apiClient;

    const hasAccess = Utils.redirectIfNotAdmin({
        apiClient,
        redirectTo: '../login.html',
        toastMessage: 'Debes iniciar sesión como administrador para acceder.',
        includeCurrentPath: false
    });

    if (!hasAccess) {
        return;
    }

    window.adminProductsPage = new AdminProductsPage(apiClient);
});

