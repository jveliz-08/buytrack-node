// ============================
// VARIABLES GLOBALES
// ============================
let isLoading = false;
let isTransitioning = false;

// ============================
// FUNCIONES DE TRANSICIÓN DE PÁGINA
// ============================
function createPageTransitionOverlay() {
    if (document.getElementById('page-transition-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'page-transition-overlay';
    overlay.className = 'page-transition-overlay';
    // Solo un overlay simple sin contenido
    document.body.appendChild(overlay);
}

function showPageTransition() {
    if (isTransitioning) return;
    
    createPageTransitionOverlay();
    const overlay = document.getElementById('page-transition-overlay');
    
    overlay.classList.add('show');
    isTransitioning = true;
    
    // Agregar clase de salida al contenido actual
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        mainContainer.classList.add('page-exit');
    }
}

function navigateWithTransition(url) {
    if (isTransitioning) return;
    
    showPageTransition();
    
    // Delay reducido para transición sutil
    setTimeout(() => {
        window.location.href = url;
    }, 150);
}

// ============================
// FUNCIONES DE UTILIDAD
// ============================
function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('show');
        isLoading = true;
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        isLoading = false;
    }
}

function formatNumber(num) {
    return new Intl.NumberFormat('es-ES').format(num);
}

// Añadir helpers de moneda para uso global
function getCurrencySymbol(currency) {
    switch (currency) {
        case 'UF':
            return 'UF ';
        case 'USD':
            return 'US$ ';
        case 'CLP':
        default:
            return '$ ';
    }
}

function formatCurrency(amount, currency = 'CLP') {
    const num = Number(amount) || 0;
    if (currency === 'UF') {
        return `${getCurrencySymbol(currency)}${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(num)}`;
    }
    const fractionDigits = currency === 'CLP' ? 0 : 2;
    return `${getCurrencySymbol(currency)}${new Intl.NumberFormat('es-CL', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(num)}`;
}

function showNotification(message, type = 'info') {
    // Crear notificación temporal
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Agregar estilos si no existen
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                color: white;
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-width: 400px;
            }
            .notification-success { background: #27ae60; }
            .notification-error { background: #e74c3c; }
            .notification-info { background: #3498db; }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================
// API CALLS
// ============================
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`/api${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function getStats() {
    try {
        const [suppliersData, ordersData] = await Promise.all([
            fetchAPI('/suppliers'),
            fetchAPI('/orders')
        ]);
        
        const suppliers = suppliersData.suppliers || [];
        const orders = ordersData.orders || [];
        
        // Calcular productos totales
        let totalProducts = 0;
        for (const supplier of suppliers) {
            try {
                const productsData = await fetchAPI(`/suppliers/${supplier.id}/products`);
                totalProducts += productsData.products ? productsData.products.length : 0;
            } catch (error) {
                console.warn(`Error fetching products for supplier ${supplier.id}:`, error);
            }
        }
        
        return {
            suppliers: suppliers.length,
            orders: orders.length,
            products: totalProducts
        };
    } catch (error) {
        console.error('Error fetching stats:', error);
        return { suppliers: 0, orders: 0, products: 0 };
    }
}

// ============================
// FUNCIONES DE NAVEGACIÓN
// ============================
function navigateToModule(module) {
    if (isLoading || isTransitioning) return;
    
    navigateWithTransition(`/${module}`);
}

// Función para manejar navegación de enlaces normales
function handleLinkNavigation(event) {
    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.href.startsWith('mailto:') || link.href.startsWith('tel:')) {
        return;
    }
    
    // Solo interceptar enlaces internos
    if (link.origin === window.location.origin) {
        event.preventDefault();
        const url = link.getAttribute('href');
        navigateWithTransition(url);
    }
}

// ============================
// FUNCIONES DE NAVEGACIÓN Y SESIÓN
// ============================
function logout() {
    if (confirm('¿Está seguro de que desea cerrar sesión?')) {
        window.location.href = '/login';
    }
}

function navigateTo(path) {
    navigateWithTransition(path);
}

// ============================
// FUNCIONES DE INICIALIZACIÓN
// ============================
async function updateStats() {
    try {
        showLoading();
        const stats = await getStats();
        
        // Animar los números
        animateValue('suppliers-count', 0, stats.suppliers, 1000);
        animateValue('orders-count', 0, stats.orders, 1200);
        animateValue('products-count', 0, stats.products, 1400);
        
    } catch (error) {
        console.error('Error updating stats:', error);
        showNotification('Error al cargar las estadísticas', 'error');
        
        // Mostrar valores por defecto de forma segura
        ['suppliers-count', 'orders-count', 'products-count'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0';
        });
    } finally {
        hideLoading();
    }
}

function animateValue(elementId, start, end, duration) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startTime = performance.now();
    const startValue = start;
    const endValue = end;
    
    function updateValue(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Función de easing (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (endValue - startValue) * easeOut);
        
        element.textContent = formatNumber(currentValue);
        
        if (progress < 1) {
            requestAnimationFrame(updateValue);
        }
    }
    
    requestAnimationFrame(updateValue);
}

// ============================
// EVENT LISTENERS
// ============================
document.addEventListener('DOMContentLoaded', function() {
    console.log('BuyTrack System Initialized');
    
    // Agregar animación de entrada a la página
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        mainContainer.classList.add('page-enter');
    }
    
    // Interceptar navegación de enlaces
    document.addEventListener('click', handleLinkNavigation);
    
    // Interceptar navegación del botón atrás/adelante del navegador
    window.addEventListener('popstate', function(event) {
        // Agregar transición suave al usar botones del navegador
        showPageTransition();
        setTimeout(() => {
            window.location.reload();
        }, 150);
    });
    
    // Inicializar estadísticas
    updateStats();
    
    // Agregar listeners para las tarjetas de módulos
    const moduleCards = document.querySelectorAll('.module-card');
    moduleCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Agregar listeners para las características
    const featureItems = document.querySelectorAll('.feature-item');
    featureItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.1}s`;
    });
    
    // Listener para el overlay de loading
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.addEventListener('click', function(e) {
            if (e.target === this) {
                hideLoading();
            }
        });
    }
    
    // Agregar efecto parallax suave al hero
    let ticking = false;
    function updateParallax() {
        const scrolled = window.pageYOffset;
        const parallax = document.querySelector('.hero');
        if (parallax) {
            const speed = scrolled * 0.5;
            parallax.style.transform = `translateY(${speed}px)`;
        }
        ticking = false;
    }
    
    function requestParallaxUpdate() {
        if (!ticking) {
            requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', requestParallaxUpdate);
    
    // Añadir efecto de fade-in a las secciones cuando entran en viewport
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observar elementos que deben hacer fade-in
    const fadeElements = document.querySelectorAll('.modules, .features');
    fadeElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// ============================
// FUNCIONES DE UTILIDAD ADICIONALES
// ============================
function debounce(func, wait) {
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

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// ============================
// MANEJO DE ERRORES GLOBAL (DESACTIVADO)
// ============================
// Manejo de errores más silencioso - solo log en consola
window.addEventListener('error', function(e) {
    console.error('Error detectado:', e.error);
    // Removido: showNotification('Ha ocurrido un error inesperado', 'error');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Promise rejection:', e.reason);
    // Removido: showNotification('Error de conexión', 'error');
});

// ============================
// EXPORTAR FUNCIONES GLOBALES
// ============================
window.BuyTrack = {
    showLoading,
    hideLoading,
    showNotification,
    fetchAPI,
    navigateToModule,
    navigateWithTransition,
    showPageTransition,
    formatNumber,
    getCurrencySymbol,
    formatCurrency,
    logout,
    navigateTo
};

// Make specific functions available globally for HTML onclick
window.logout = logout;
window.navigateTo = navigateTo;
