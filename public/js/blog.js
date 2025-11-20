// Funcionalidades del blog
class BlogManager {
    constructor() {
        this.articles = [];
        this.filteredArticles = [];
        this.currentPage = 1;
        this.articlesPerPage = 6;
        this.currentCategory = 'all';
        this.currentType = 'all';
        this.searchQuery = '';
        this.init();
    }

    async init() {
        await this.loadArticles();
        this.render();
        this.bindEvents();
    }

    // Cargar artículos desde el JSON
    async loadArticles() {
        try {
            const response = await fetch('data/products.json');
            const data = await response.json();
            this.articles = data.blog || [];
            // Ordenar por fecha (más recientes primero)
            this.articles.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.filteredArticles = [...this.articles];
        } catch (error) {
            console.error('Error al cargar artículos del blog:', error);
            this.articles = [];
            this.filteredArticles = [];
        }
    }

    // Obtener artículos destacados
    getFeaturedArticles(limit = 3) {
        return this.articles
            .filter(article => article.featured === true)
            .slice(0, limit);
    }

    // Filtrar artículos
    filterArticles() {
        this.filteredArticles = this.articles.filter(article => {
            // Filtro por categoría
            const matchesCategory = this.currentCategory === 'all' || 
                                   article.category === this.currentCategory ||
                                   article.type === this.currentCategory;
            
            // Filtro por tipo
            const matchesType = this.currentType === 'all' || 
                               article.type === this.currentType;
            
            // Filtro por búsqueda
            const matchesSearch = !this.searchQuery ||
                                 article.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                                 article.excerpt.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                                 article.tags.some(tag => tag.toLowerCase().includes(this.searchQuery.toLowerCase()));
            
            return matchesCategory && matchesType && matchesSearch;
        });
        
        this.currentPage = 1;
        this.render();
    }

    // Formatear fecha
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('es-ES', options);
    }

    // Obtener icono según tipo
    getTypeIcon(type) {
        const icons = {
            'manual': 'fas fa-wrench',
            'guia': 'fas fa-book',
            'noticia': 'fas fa-newspaper'
        };
        return icons[type] || 'fas fa-file-alt';
    }

    // Renderizar artículos destacados (para index.html)
    renderFeaturedArticles(container) {
        if (!container) return;
        
        const featuredArticles = this.getFeaturedArticles(3);
        
        if (featuredArticles.length === 0) {
            container.innerHTML = '<p>No hay artículos destacados disponibles.</p>';
            return;
        }

        container.innerHTML = featuredArticles.map(article => `
            <article class="blog-card">
                <div class="blog-image">
                    ${article.image ? 
                        `<img src="${article.image}" alt="${article.title}" loading="lazy">` :
                        `<div class="blog-placeholder">
                            <i class="${this.getTypeIcon(article.type)}"></i>
                        </div>`
                    }
                    ${article.featured ? '<span class="blog-badge featured">Destacado</span>' : ''}
                    <span class="blog-badge type">${article.type === 'manual' ? 'Manual' : article.type === 'guia' ? 'Guía' : 'Noticia'}</span>
                </div>
                <div class="blog-content">
                    <div class="blog-meta">
                        <span class="blog-category">${article.category}</span>
                        <span class="blog-date">${this.formatDate(article.date)}</span>
                    </div>
                    <h3 class="blog-title">${article.title}</h3>
                    <p class="blog-excerpt">${article.excerpt}</p>
                    ${article.tags && article.tags.length > 0 ? `
                    <div class="blog-tags">
                        ${article.tags.slice(0, 3).map(tag => `<span class="blog-tag">${tag}</span>`).join('')}
                    </div>
                    ` : ''}
                    <a href="blog.html?id=${article.id}" class="blog-link">Leer más <i class="fas fa-arrow-right"></i></a>
                </div>
            </article>
        `).join('');
    }

    // Renderizar artículo destacado grande (para blog.html)
    renderFeaturedArticle(container) {
        if (!container) return;
        
        const featuredArticles = this.filteredArticles.filter(a => a.featured);
        const featuredArticle = featuredArticles.length > 0 ? featuredArticles[0] : this.filteredArticles[0];
        
        if (!featuredArticle) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <article class="featured-article">
                <div class="featured-image">
                    ${featuredArticle.image ? 
                        `<img src="${featuredArticle.image}" alt="${featuredArticle.title}" loading="lazy">` :
                        `<div class="blog-placeholder">
                            <i class="${this.getTypeIcon(featuredArticle.type)}"></i>
                        </div>`
                    }
                    ${featuredArticle.featured ? '<span class="blog-badge featured">Destacado</span>' : ''}
                </div>
                <div class="featured-content">
                    <div class="article-meta">
                        <span class="article-category">${featuredArticle.category}</span>
                        <span class="article-date">${this.formatDate(featuredArticle.date)}</span>
                    </div>
                    <h2>${featuredArticle.title}</h2>
                    <p>${featuredArticle.excerpt}</p>
                    <a href="blog.html?id=${featuredArticle.id}" class="btn btn-primary">Leer Artículo</a>
                </div>
            </article>
        `;
    }

    // Renderizar grid de artículos
    renderArticlesGrid(container) {
        if (!container) return;

        const startIndex = (this.currentPage - 1) * this.articlesPerPage;
        const endIndex = startIndex + this.articlesPerPage;
        const articlesToShow = this.filteredArticles.slice(startIndex, endIndex);

        if (articlesToShow.length === 0) {
            container.innerHTML = `
                <div class="blog-empty">
                    <i class="fas fa-inbox"></i>
                    <p>No se encontraron artículos con los filtros seleccionados.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = articlesToShow.map(article => `
            <article class="blog-card">
                <div class="blog-image">
                    ${article.image ? 
                        `<img src="${article.image}" alt="${article.title}" loading="lazy">` :
                        `<div class="blog-placeholder">
                            <i class="${this.getTypeIcon(article.type)}"></i>
                        </div>`
                    }
                    ${article.featured ? '<span class="blog-badge featured">Destacado</span>' : ''}
                    <span class="blog-badge type">${article.type === 'manual' ? 'Manual' : article.type === 'guia' ? 'Guía' : 'Noticia'}</span>
                </div>
                <div class="blog-content">
                    <div class="blog-meta">
                        <span class="blog-category">${article.category}</span>
                        <span class="blog-date">${this.formatDate(article.date)}</span>
                    </div>
                    <h3 class="blog-title">${article.title}</h3>
                    <p class="blog-excerpt">${article.excerpt}</p>
                    ${article.tags && article.tags.length > 0 ? `
                    <div class="blog-tags">
                        ${article.tags.slice(0, 3).map(tag => `<span class="blog-tag">${tag}</span>`).join('')}
                    </div>
                    ` : ''}
                    <a href="blog.html?id=${article.id}" class="blog-link">Leer más <i class="fas fa-arrow-right"></i></a>
                </div>
            </article>
        `).join('');

        // Mostrar/ocultar botón "Cargar Más"
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            if (endIndex >= this.filteredArticles.length) {
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'inline-block';
            }
        }
    }

    // Renderizar página completa
    render() {
        const blogGrid = document.getElementById('blogGrid');

        // Si estamos en blog.html con grid
        if (blogGrid) {
            // Renderizar todos los artículos en el grid con el mismo estilo
            this.renderArticlesGrid(blogGrid);
        }
    }

    // Cargar más artículos
    loadMore() {
        const totalPages = Math.ceil(this.filteredArticles.length / this.articlesPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            const startIndex = (this.currentPage - 1) * this.articlesPerPage;
            const endIndex = startIndex + this.articlesPerPage;
            const newArticles = this.filteredArticles.slice(startIndex, endIndex);
            
            const blogGrid = document.getElementById('blogGrid');
            if (blogGrid && newArticles.length > 0) {
                const newHTML = newArticles.map(article => `
                    <article class="blog-card">
                        <div class="blog-image">
                            ${article.image ? 
                                `<img src="${article.image}" alt="${article.title}" loading="lazy">` :
                                `<div class="blog-placeholder">
                                    <i class="${this.getTypeIcon(article.type)}"></i>
                                </div>`
                            }
                            ${article.featured ? '<span class="blog-badge featured">Destacado</span>' : ''}
                            <span class="blog-badge type">${article.type === 'manual' ? 'Manual' : article.type === 'guia' ? 'Guía' : 'Noticia'}</span>
                        </div>
                        <div class="blog-content">
                            <div class="blog-meta">
                                <span class="blog-category">${article.category}</span>
                                <span class="blog-date">${this.formatDate(article.date)}</span>
                            </div>
                            <h3 class="blog-title">${article.title}</h3>
                            <p class="blog-excerpt">${article.excerpt}</p>
                            ${article.tags && article.tags.length > 0 ? `
                            <div class="blog-tags">
                                ${article.tags.slice(0, 3).map(tag => `<span class="blog-tag">${tag}</span>`).join('')}
                            </div>
                            ` : ''}
                            <a href="blog.html?id=${article.id}" class="blog-link">Leer más <i class="fas fa-arrow-right"></i></a>
                        </div>
                    </article>
                `).join('');
                
                blogGrid.insertAdjacentHTML('beforeend', newHTML);
                
                // Ocultar botón si no hay más artículos
                const loadMoreBtn = document.getElementById('loadMoreBtn');
                if (loadMoreBtn && endIndex >= this.filteredArticles.length) {
                    loadMoreBtn.style.display = 'none';
                }
            }
        }
    }

    // Obtener artículo por ID
    getArticleById(id) {
        return this.articles.find(article => article.id === id);
    }

    // Bind eventos
    bindEvents() {
        // Botón "Cargar Más"
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMore();
            });
        }

        // Búsqueda en blog.html
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        
        if (searchInput) {
            const debouncedSearch = Utils?.debounce ? Utils.debounce((query) => {
                this.searchQuery = query;
                this.filterArticles();
            }, 300) : (query) => {
                setTimeout(() => {
                    this.searchQuery = query;
                    this.filterArticles();
                }, 300);
            };

            searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const query = searchInput?.value || '';
                this.searchQuery = query;
                this.filterArticles();
            });
        }
    }
}

// Funcionalidad para la página de inicio (cargar artículos destacados)
function loadFeaturedBlogArticles() {
    const blogManager = new BlogManager();
    
    // Guardar referencia global para acceso posterior
    window.blogManager = blogManager;
    
    // Esperar a que se carguen los artículos
    const checkInterval = setInterval(() => {
        if (blogManager.articles.length > 0) {
            const blogPreview = document.getElementById('featuredBlogArticles') || 
                              document.querySelector('.blog-preview .blog-grid');
            if (blogPreview) {
                blogManager.renderFeaturedArticles(blogPreview);
                clearInterval(checkInterval);
            }
        }
    }, 100);
    
    // Timeout de seguridad
    setTimeout(() => {
        clearInterval(checkInterval);
        // Si aún no se cargó, intentar una vez más
        const blogPreview = document.getElementById('featuredBlogArticles') || 
                          document.querySelector('.blog-preview .blog-grid');
        if (blogPreview && blogManager.articles.length > 0) {
            blogManager.renderFeaturedArticles(blogPreview);
        }
    }, 2000);
}

// Funcionalidad para blog.html
function initBlog() {
    window.blogManager = new BlogManager();
    
    // Si hay un ID en la URL, podríamos cargar un artículo individual en el futuro
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');
    
    if (articleId && window.blogManager) {
        // Por ahora, solo logueamos. En el futuro se podría implementar
        // una vista de detalle del artículo
        console.log('ID de artículo solicitado:', articleId);
    }
}

// Inicializar según la página cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('blogGrid')) {
        // Estamos en blog.html
        initBlog();
    } else if (document.getElementById('featuredBlogArticles') || document.querySelector('.blog-preview')) {
        // Estamos en index.html
        loadFeaturedBlogArticles();
    }
});

// Exportar para uso global
window.BlogManager = BlogManager;

