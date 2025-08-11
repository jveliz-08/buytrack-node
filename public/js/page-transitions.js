// ============================
// SISTEMA DE TRANSICIONES SUTILES
// ============================

class PageTransitionManager {
    constructor() {
        this.isTransitioning = false;
        this.transitionDuration = 250; // Más rápido y sutil
        this.init();
    }

    init() {
        this.createOverlay();
        this.bindEvents();
        this.handlePageLoad();
    }

    createOverlay() {
        if (document.getElementById('page-transition-overlay')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'page-transition-overlay';
        overlay.className = 'page-transition-overlay';
        // Sin contenido adicional - solo un overlay blanco simple
        document.body.appendChild(overlay);
    }

    bindEvents() {
        // Interceptar clics en enlaces
        document.addEventListener('click', (e) => this.handleLinkClick(e));
        
        // Manejar navegación del navegador
        window.addEventListener('popstate', () => this.handlePopState());
        
        // Prevenir transiciones múltiples
        window.addEventListener('beforeunload', () => {
            this.isTransitioning = false;
        });
    }

    handleLinkClick(event) {
        const link = event.target.closest('a[href]');
        if (!link || this.isTransitioning) return;
        
        // Ignorar enlaces externos, mailto, tel, y targets especiales
        if (
            link.target === '_blank' ||
            link.href.startsWith('mailto:') ||
            link.href.startsWith('tel:') ||
            link.origin !== window.location.origin ||
            link.hasAttribute('data-no-transition')
        ) {
            return;
        }

        // Prevenir navegación por defecto
        event.preventDefault();
        
        const url = link.getAttribute('href');
        this.navigateWithTransition(url);
    }

    handlePopState() {
        if (!this.isTransitioning) {
            this.showTransition();
            setTimeout(() => {
                window.location.reload();
            }, 150); // Tiempo reducido
        }
    }

    handlePageLoad() {
        // Aplicar animación de entrada cuando la página carga
        const mainContainer = document.querySelector('.main-container');
        if (mainContainer) {
            mainContainer.classList.add('page-enter');
        }

        // Si había una transición en progreso, ocultarla
        this.hideTransition();
    }

    getMessageForUrl(url) {
        // Ya no necesitamos mensajes específicos para transiciones sutiles
        return null;
    }

    showTransition() {
        if (this.isTransitioning) return;
        
        const overlay = document.getElementById('page-transition-overlay');
        
        if (overlay) {
            overlay.classList.add('show');
        }
        
        this.isTransitioning = true;
        
        // Agregar clase de salida al contenido actual
        const mainContainer = document.querySelector('.main-container');
        if (mainContainer) {
            mainContainer.classList.add('page-exit');
        }
    }

    hideTransition() {
        const overlay = document.getElementById('page-transition-overlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
        this.isTransitioning = false;
    }

    navigateWithTransition(url) {
        if (this.isTransitioning) return;
        
        this.showTransition();
        
        // Tiempo reducido para transición más sutil
        setTimeout(() => {
            window.location.href = url;
        }, 150);
    }

    // Métodos públicos simplificados
    navigate(url) {
        this.navigateWithTransition(url);
    }

    show() {
        this.showTransition();
    }

    hide() {
        this.hideTransition();
    }
}

// Crear instancia global cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Solo crear si no existe ya
    if (!window.pageTransitionManager) {
        window.pageTransitionManager = new PageTransitionManager();
    }
});

// Exportar para uso directo
window.PageTransitionManager = PageTransitionManager;
