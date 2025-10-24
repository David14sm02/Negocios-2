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

## Integración con Dolibarr ERP

### Preparación para Integración
El proyecto está diseñado para integrarse con Dolibarr ERP mediante:

1. **API REST de Dolibarr**
   - Sincronización de productos
   - Gestión de inventario
   - Procesamiento de pedidos
   - Información de clientes

2. **Base de Datos PostgreSQL**
   - Esquema compatible con Dolibarr
   - Sincronización bidireccional
   - Integridad de datos

3. **Webhooks**
   - Actualizaciones en tiempo real
   - Notificaciones de cambios
   - Sincronización automática

### Campos de Sincronización
- **Productos**: nombre, descripción, precio, SKU, stock
- **Categorías**: jerarquía de categorías
- **Clientes**: datos de contacto, dirección
- **Pedidos**: productos, cantidades, totales, estado

## Personalización

### Colores
Modifica las variables CSS en `css/colors.css`:
```css
:root {
    --primary-color: #2563EB;
    --secondary-color: #64748B;
    --accent-color: #06B6D4;
    /* ... más variables */
}
```

### Productos
Edita `data/products.json` para agregar/modificar productos:
```json
{
    "id": "nuevo-producto",
    "name": "Nombre del Producto",
    "price": 1000,
    "category": "cables",
    "stock": 50
}
```

### Contenido
Modifica los archivos HTML para personalizar el contenido de cada página.

## Próximas Funcionalidades

### Fase 2: Backend y Base de Datos
- [ ] API REST con Node.js
- [ ] Base de datos PostgreSQL
- [ ] Sistema de autenticación
- [ ] Gestión de usuarios

### Fase 3: Integración ERP
- [ ] Conexión con Dolibarr
- [ ] Sincronización de datos
- [ ] Webhooks
- [ ] Reportes

### Fase 4: Funcionalidades Avanzadas
- [ ] Sistema de pagos
- [ ] Gestión de inventario
- [ ] Analytics
- [ ] Optimizaciones

## Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Contacto

**NetTech Solutions**
- Email: info@nettechsolutions.com
- Teléfono: +1 (555) 123-4567
- Sitio web: [www.nettechsolutions.com](https://www.nettechsolutions.com)

---

Desarrollado con ❤️ para profesionales de redes
