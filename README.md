# NetTech Solutions - E-commerce de Productos para Instalaciones de Redes

## Descripción del Proyecto

E-commerce moderno y minimalista especializado en productos para instalaciones de redes profesionales. Desarrollado con HTML, CSS y JavaScript vanilla, diseñado para integrarse con Dolibarr ERP y PostgreSQL.

## Características Principales

### 🎨 Diseño
- **Paleta de colores**: Azul tecnológico (#2563EB, #64748B, #06B6D4)
- **Estilo**: Moderno y minimalista
- **Responsive**: Adaptable a todos los dispositivos
- **Accesibilidad**: Cumple estándares de accesibilidad web

### 📱 Páginas Incluidas
- **Inicio**: Landing page con productos destacados y categorías
- **Catálogo**: Lista completa de productos con filtros y búsqueda
- **Blog**: Artículos técnicos sobre instalaciones de redes
- **Acerca de**: Información de la empresa, equipo y valores
- **Carrito**: Sistema de compras funcional

### 🛒 Funcionalidades del Carrito
- Agregar/eliminar productos
- Modificar cantidades
- Cálculo automático de totales
- Persistencia en localStorage
- Interfaz sidebar moderna

### 🔍 Sistema de Búsqueda y Filtros
- Búsqueda en tiempo real con debounce
- Filtros por categoría
- Rango de precios
- Ordenamiento múltiple
- Vista de cuadrícula y lista

## Estructura del Proyecto

```
e-commerce/
├── index.html              # Página principal
├── catalog.html            # Catálogo de productos
├── blog.html              # Blog técnico
├── about.html             # Acerca de nosotros
├── css/
│   ├── colors.css         # Variables de colores
│   ├── main.css           # Estilos principales
│   ├── components.css     # Componentes reutilizables
│   └── responsive.css     # Diseño responsive
├── js/
│   ├── utils.js           # Utilidades generales
│   ├── cart.js            # Sistema de carrito
│   ├── catalog.js         # Funcionalidades del catálogo
│   └── main.js            # Funcionalidades principales
├── data/
│   └── products.json      # Datos de productos mock
└── assets/
    ├── images/            # Imágenes del sitio
    └── icons/             # Iconos personalizados
```

## Tecnologías Utilizadas

### Frontend
- **HTML5**: Estructura semántica
- **CSS3**: Variables CSS, Grid, Flexbox, animaciones
- **JavaScript ES6+**: Clases, async/await, módulos
- **Font Awesome**: Iconografía
- **Google Fonts**: Tipografía Inter

### Futuras Integraciones
- **Dolibarr ERP**: API REST para sincronización
- **PostgreSQL**: Base de datos principal
- **Node.js**: Backend API
- **Express.js**: Framework web

## Instalación y Uso

### Requisitos
- Navegador web moderno
- Servidor web local (opcional)

### Instalación
1. Clona o descarga el proyecto
2. Abre `index.html` en tu navegador
3. Para desarrollo local, usa un servidor web:
   ```bash
   # Con Python
   python -m http.server 8000
   
   # Con Node.js
   npx serve .
   ```

### Uso
1. Navega por las diferentes páginas
2. Explora el catálogo de productos
3. Prueba el sistema de carrito
4. Utiliza los filtros y búsqueda

## Categorías de Productos

### Cables de Red
- Cat5e, Cat6, Cat6a, Cat7
- Fibra óptica
- Cables especializados

### Conectores
- RJ45, RJ11, RJ12
- Conectores de fibra
- Patch panels
- Adaptadores

### Equipos de Red
- Switches gestionados/no gestionados
- Routers WiFi 6
- Access points
- Modems

### Herramientas
- Crimpeadoras profesionales
- Testers de red
- Pelacables
- Herramientas de certificación