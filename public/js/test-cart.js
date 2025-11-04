// Script de prueba para verificar funcionalidad del carrito
console.log('🧪 Iniciando pruebas del carrito de compras...');

// Función para probar la API
async function testAPI() {
    try {
        console.log('📡 Probando conexión con la API...');
        const response = await fetch('/api/health');
        const data = await response.json();
        console.log('✅ API Health Check:', data);
        return true;
    } catch (error) {
        console.log('⚠️  API no disponible, usando localStorage:', error.message);
        return false;
    }
}

// Función para probar el carrito
function testCart() {
    try {
        console.log('🛒 Probando funcionalidad del carrito...');
        
        // Verificar que el carrito existe
        if (!window.cart) {
            console.error('❌ Carrito no inicializado');
            return false;
        }
        
        console.log('✅ Carrito inicializado');
        console.log('📊 Items en carrito:', window.cart.items.length);
        console.log('💰 Total:', window.cart.total);
        
        return true;
    } catch (error) {
        console.error('❌ Error en carrito:', error);
        return false;
    }
}

// Función para probar agregar producto
function testAddProduct() {
    try {
        const testProduct = {
            id: 999,
            name: 'Producto de Prueba',
            price: 100,
            sku: 'TEST-001',
            image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlRlc3Q8L3RleHQ+PC9zdmc+'
        };
        
        console.log('➕ Agregando producto de prueba...');
        window.cart.addItem(testProduct, 2);
        
        console.log('✅ Producto agregado');
        console.log('📊 Items después de agregar:', window.cart.items.length);
        console.log('💰 Total después de agregar:', window.cart.total);
        
        return true;
    } catch (error) {
        console.error('❌ Error agregando producto:', error);
        return false;
    }
}

// Función para probar limpiar carrito
function testClearCart() {
    try {
        console.log('🗑️  Limpiando carrito...');
        window.cart.clearCart();
        
        console.log('✅ Carrito limpiado');
        console.log('📊 Items después de limpiar:', window.cart.items.length);
        console.log('💰 Total después de limpiar:', window.cart.total);
        
        return true;
    } catch (error) {
        console.error('❌ Error limpiando carrito:', error);
        return false;
    }
}

// Ejecutar todas las pruebas
async function runAllTests() {
    console.log('🚀 Ejecutando todas las pruebas...');
    
    const apiTest = await testAPI();
    const cartTest = testCart();
    const addTest = testAddProduct();
    const clearTest = testClearCart();
    
    console.log('\n📋 Resumen de pruebas:');
    console.log(`API: ${apiTest ? '✅' : '❌'}`);
    console.log(`Carrito: ${cartTest ? '✅' : '❌'}`);
    console.log(`Agregar: ${addTest ? '✅' : '❌'}`);
    console.log(`Limpiar: ${clearTest ? '✅' : '❌'}`);
    
    const allPassed = apiTest && cartTest && addTest && clearTest;
    console.log(`\n🎯 Resultado general: ${allPassed ? '✅ TODAS LAS PRUEBAS PASARON' : '❌ ALGUNAS PRUEBAS FALLARON'}`);
    
    return allPassed;
}

// Exportar funciones para uso manual
window.cartTests = {
    testAPI,
    testCart,
    testAddProduct,
    testClearCart,
    runAllTests
};

// Ejecutar pruebas automáticamente después de 2 segundos
setTimeout(runAllTests, 2000);
