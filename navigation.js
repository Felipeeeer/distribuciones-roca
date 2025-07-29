/**
 * 🧭 Navigation Component - Distribuciones ROCA
 * Maneja toda la navegación del sistema
 */

class NavigationManager {
  constructor() {
    this.mobileMenuOpen = false;
    this.currentPage = this.getCurrentPage();
    
    this.elements = {
      mobileToggle: document.getElementById('mobileMenuToggle'),
      mobileSidebar: document.getElementById('mobileSidebar'),
      closeSidebar: document.getElementById('closeSidebar'),
      navLinks: document.querySelectorAll('.nav-link'),
      sidebarLinks: document.querySelectorAll('.sidebar-link'),
      bottomNavItems: document.querySelectorAll('.bottom-nav-item')
    };
    
    this.init();
  }

  /**
   * Inicializa el componente de navegación
   */
  init() {
    this.setupEventListeners();
    this.setActiveStates();
    this.setupKeyboardNavigation();
    this.handleUrlChanges();
  }

  /**
   * Configura los event listeners
   */
  setupEventListeners() {
    // Toggle del menú móvil
    if (this.elements.mobileToggle) {
      this.elements.mobileToggle.addEventListener('click', () => {
        this.toggleMobileMenu();
      });
    }

    // Cerrar sidebar móvil
    if (this.elements.closeSidebar) {
      this.elements.closeSidebar.addEventListener('click', () => {
        this.closeMobileMenu();
      });
    }

    // Cerrar menú al hacer clic en overlay
    document.addEventListener('click', (e) => {
      if (this.mobileMenuOpen && !this.elements.mobileSidebar?.contains(e.target) && 
          !this.elements.mobileToggle?.contains(e.target)) {
        this.closeMobileMenu();
      }
    });

    // Cerrar menú al cambiar de orientación
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.closeMobileMenu(), 100);
    });

    // Navegación con links
    this.elements.sidebarLinks.forEach(link => {
      link.addEventListener('click', () => {
        this.closeMobileMenu();
      });
    });

    // Escuchar cambios de hash/URL
    window.addEventListener('popstate', () => {
      this.currentPage = this.getCurrentPage();
      this.setActiveStates();
    });
  }

  /**
   * Abre/cierra el menú móvil
   */
  toggleMobileMenu() {
    if (this.mobileMenuOpen) {
      this.closeMobileMenu();
    } else {
      this.openMobileMenu();
    }
  }

  /**
   * Abre el menú móvil
   */
  openMobileMenu() {
    this.mobileMenuOpen = true;
    
    // Agregar clases y overlay
    if (this.elements.mobileSidebar) {
      this.elements.mobileSidebar.classList.add('open');
    }
    
    if (this.elements.mobileToggle) {
      this.elements.mobileToggle.classList.add('active');
    }

    // Crear overlay si no existe
    this.createOverlay();
    
    // Prevenir scroll del body
    document.body.style.overflow = 'hidden';
    
    // Focus en el primer elemento del menú
    setTimeout(() => {
      const firstLink = this.elements.mobileSidebar?.querySelector('.sidebar-link');
      if (firstLink) {
        firstLink.focus();
      }
    }, 100);
  }

  /**
   * Cierra el menú móvil
   */
  closeMobileMenu() {
    this.mobileMenuOpen = false;
    
    // Remover clases
    if (this.elements.mobileSidebar) {
      this.elements.mobileSidebar.classList.remove('open');
    }
    
    if (this.elements.mobileToggle) {
      this.elements.mobileToggle.classList.remove('active');
    }

    // Remover overlay
    this.removeOverlay();
    
    // Restaurar scroll del body
    document.body.style.overflow = '';
  }

  /**
   * Crea el overlay para el menú móvil
   */
  createOverlay() {
    if (document.getElementById('sidebar-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay open';
    
    overlay.addEventListener('click', () => {
      this.closeMobileMenu();
    });
    
    document.body.appendChild(overlay);
  }

  /**
   * Remueve el overlay
   */
  removeOverlay() {
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
      overlay.classList.remove('open');
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }
  }

  /**
   * Obtiene la página actual
   */
  getCurrentPage() {
    const path = window.location.pathname;
    let page = path.split('/').pop() || 'index.html';
    
    // Normalizar diferentes formas de llegar al index
    if (page === '' || page === '/' || page === 'index') {
      page = 'index.html';
    }
    
    return page;
  }

  /**
   * Establece los estados activos en la navegación
   */
  setActiveStates() {
    const currentPage = this.getCurrentPage();
    
    // Mapeo de páginas a rutas
    const pageMap = {
      'index.html': ['index.html', '', '/'],
      'productos.html': ['productos.html', 'pages/productos.html'],
      'clientes.html': ['clientes.html', 'pages/clientes.html'],
      'ventas.html': ['ventas.html', 'pages/ventas.html'],
      'facturas.html': ['facturas.html', 'pages/facturas.html'],
      'deudas.html': ['deudas.html', 'pages/deudas.html'],
      'analisis.html': ['analisis.html', 'pages/analisis.html']
    };

    // Limpiar estados activos
    this.clearActiveStates();

    // Encontrar y activar links correspondientes
    Object.entries(pageMap).forEach(([page, routes]) => {
      if (routes.some(route => currentPage.includes(route) || window.location.href.includes(route))) {
        this.setActiveForPage(page);
      }
    });
  }

  /**
   * Limpia todos los estados activos
   */
  clearActiveStates() {
    [...this.elements.navLinks, ...this.elements.sidebarLinks, ...this.elements.bottomNavItems]
      .forEach(link => {
        link.classList.remove('active');
      });
  }

  /**
   * Establece activo para una página específica
   */
  setActiveForPage(page) {
    const selectors = [
      `.nav-link[href*="${page}"]`,
      `.sidebar-link[href*="${page}"]`,
      `.bottom-nav-item[href*="${page}"]`
    ];

    selectors.forEach(selector => {
      const links = document.querySelectorAll(selector);
      links.forEach(link => {
        link.classList.add('active');
      });
    });
  }

  /**
   * Configura la navegación por teclado
   */
  setupKeyboardNavigation() {
    // Cerrar menú con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.mobileMenuOpen) {
        this.closeMobileMenu();
      }
    });

    // Navegación por teclado en el sidebar
    if (this.elements.mobileSidebar) {
      this.elements.mobileSidebar.addEventListener('keydown', (e) => {
        this.handleSidebarKeyNavigation(e);
      });
    }
  }

  /**
   * Maneja la navegación por teclado en el sidebar
   */
  handleSidebarKeyNavigation(e) {
    const focusableElements = this.elements.mobileSidebar.querySelectorAll(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    
    const focusedIndex = Array.from(focusableElements).indexOf(document.activeElement);
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = (focusedIndex + 1) % focusableElements.length;
        focusableElements[nextIndex].focus();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = focusedIndex === 0 ? focusableElements.length - 1 : focusedIndex - 1;
        focusableElements[prevIndex].focus();
        break;
        
      case 'Home':
        e.preventDefault();
        focusableElements[0].focus();
        break;
        
      case 'End':
        e.preventDefault();
        focusableElements[focusableElements.length - 1].focus();
        break;
    }
  }

  /**
   * Maneja cambios de URL
   */
  handleUrlChanges() {
    // Observer para cambios en la URL
    const observer = new MutationObserver(() => {
      const newPage = this.getCurrentPage();
      if (newPage !== this.currentPage) {
        this.currentPage = newPage;
        this.setActiveStates();
      }
    });

    observer.observe(document.querySelector('title'), {
      childList: true,
      subtree: true
    });
  }

  /**
   * Navega a una página específica
   */
  navigateTo(url) {
    // Cerrar menú móvil si está abierto
    if (this.mobileMenuOpen) {
      this.closeMobileMenu();
    }

    // Navegar
    window.location.href = url;
  }

  /**
   * Agrega un indicador de loading a un link
   */
  addLoadingState(linkElement) {
    if (!linkElement) return;

    const originalContent = linkElement.innerHTML;
    linkElement.innerHTML = `
      <div class="nav-loading d-flex align-items-center gap-2">
        <div class="spinner-border spinner-border-sm" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
        ${linkElement.textContent}
      </div>
    `;

    // Restaurar después de un tiempo máximo
    setTimeout(() => {
      if (linkElement.innerHTML.includes('nav-loading')) {
        linkElement.innerHTML = originalContent;
      }
    }, 3000);
  }

  /**
   * Resalta un módulo como nuevo
   */
  highlightNewFeature(selector, duration = 5000) {
    const element = document.querySelector(selector);
    if (!element) return;

    element.classList.add('highlight-new-feature');
    
    setTimeout(() => {
      element.classList.remove('highlight-new-feature');
    }, duration);
  }

  /**
   * Actualiza el badge de notificaciones en un enlace
   */
  updateNotificationBadge(linkSelector, count) {
    const link = document.querySelector(linkSelector);
    if (!link) return;

    // Remover badge existente
    const existingBadge = link.querySelector('.nav-notification-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    // Agregar nuevo badge si hay notificaciones
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'nav-notification-badge';
      badge.textContent = count > 99 ? '99+' : count;
      
      // Inyectar estilos del badge si no existen
      this.injectBadgeStyles();
      
      link.appendChild(badge);
    }
  }

  /**
   * Inyecta estilos para los badges de notificación
   */
  injectBadgeStyles() {
    if (document.getElementById('nav-badge-styles')) return;

    const style = document.createElement('style');
    style.id = 'nav-badge-styles';
    style.textContent = `
      .nav-notification-badge {
        position: absolute;
        top: -8px;
        right: -8px;
        background: var(--ios-red);
        color: white;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 16px;
        text-align: center;
        line-height: 1.2;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        animation: badgePulse 2s infinite;
      }

      .nav-link, .sidebar-link, .bottom-nav-item {
        position: relative;
      }

      @keyframes badgePulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      .highlight-new-feature {
        animation: highlightPulse 1s ease-in-out 3;
      }

      @keyframes highlightPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(255, 149, 0, 0); }
        50% { box-shadow: 0 0 0 8px rgba(255, 149, 0, 0.3); }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Obtiene información del estado actual de navegación
   */
  getNavigationState() {
    return {
      currentPage: this.currentPage,
      mobileMenuOpen: this.mobileMenuOpen,
      activeLinks: document.querySelectorAll('.nav-link.active, .sidebar-link.active, .bottom-nav-item.active').length
    };
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.navigationManager = new NavigationManager();
  
  // Resaltar módulo de análisis como nuevo por primera vez
  setTimeout(() => {
    if (window.navigationManager) {
      window.navigationManager.highlightNewFeature('.new-feature', 3000);
    }
  }, 2000);

  // --- Función genérica para mostrar submódulos de una sección (Finanzas/Ventas) ---
  function mostrarSubmoduloSeccion(nombre, config) {
    // config: { submodulos, menuPrincipal, statsSection }
    if (config.menuPrincipal) config.menuPrincipal.style.display = 'none';
    if (config.statsSection) config.statsSection.style.display = 'none';
    config.submodulos.forEach(div => {
      if (div) div.style.display = 'none';
    });
    const activo = document.getElementById(config.prefix + nombre);
    if (activo) activo.style.display = 'block';
  }

  // --- Utilidad para obtener parámetro de submódulo ---
  function getSubmoduloParam() {
    const params = new URLSearchParams(window.location.search);
    return params.get('submodulo');
  }

  // --- Función global para acceder al flujo de caja desde cualquier página ---
  function navegarAFlujoCaja() {
    if (!window.location.pathname.endsWith('finanzas.html')) {
      window.location.href = 'finanzas.html?submodulo=flujo-caja';
    } else {
      // Si ya estamos en finanzas, mostrar el submódulo directamente
      mostrarSubmoduloSeccion('flujo-caja', {
        submodulos: submodulosFinanzas,
        menuPrincipal: submodulosMenuFinanzas,
        statsSection: statsSectionFinanzas,
        prefix: 'submodulo-'
      });
      // Resaltar el enlace activo
      submenuLinksFinanzas.forEach(l => {
        if (l.getAttribute('data-submodulo') === 'flujo-caja') l.classList.add('active');
        else l.classList.remove('active');
      });
    }
  }

  // Exponer función globalmente
  window.navegarAFlujoCaja = navegarAFlujoCaja;

  // --- Finanzas ---
  const finanzasLink = document.getElementById('sidebarFinanzasLink');
  const finanzasToggle = document.getElementById('finanzasSubmenuToggle');
  const finanzasSubmenu = document.getElementById('finanzasSubmenu');
  const submenuLinksFinanzas = document.querySelectorAll('.sidebar-link-finanzas + .sidebar-submenu .sidebar-submenu-link');
  const submodulosMenuFinanzas = document.getElementById('finanzasSubmodulosMenu');
  const submodulosBtnsFinanzas = document.querySelectorAll('.submodulo-btn');
  const submodulosFinanzas = [
    document.getElementById('submodulo-analisis'),
    document.getElementById('submodulo-ganancias'),
    document.getElementById('submodulo-oportunidades'),
    document.getElementById('submodulo-compras'),
    document.getElementById('submodulo-flujo-caja')
  ];
  const statsSectionFinanzas = null; // Si tienes una sección de stats específica para Finanzas, asígnala aquí

  // Flecha Finanzas
  if (finanzasToggle) {
    finanzasToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (finanzasLink) finanzasLink.classList.toggle('open');
      if (finanzasSubmenu) finanzasSubmenu.classList.toggle('show');
    });
  }

  // Submenú lateral Finanzas universal
  if (submenuLinksFinanzas && submodulosFinanzas && submodulosMenuFinanzas) {
    submenuLinksFinanzas.forEach(btn => {
      btn.addEventListener('click', () => {
        const submodulo = btn.getAttribute('data-submodulo');
        
        // Caso especial para flujo de caja - disponible en todas las páginas
        if (submodulo === 'flujo-caja') {
          navegarAFlujoCaja();
          return;
        }
        
        // Si no estamos en finanzas.html, redirigir con parámetro
        if (!window.location.pathname.endsWith('finanzas.html')) {
          window.location.href = 'finanzas.html?submodulo=' + encodeURIComponent(submodulo);
          return;
        }
        mostrarSubmoduloSeccion(submodulo, {
          submodulos: submodulosFinanzas,
          menuPrincipal: submodulosMenuFinanzas,
          statsSection: statsSectionFinanzas,
          prefix: 'submodulo-'
        });
        submenuLinksFinanzas.forEach(l => l.classList.remove('active'));
        btn.classList.add('active');
        if (finanzasLink) finanzasLink.classList.remove('open');
        if (finanzasSubmenu) finanzasSubmenu.classList.remove('show');
        // Cerrar menú móvil si está abierto
        const mobileSidebar = document.getElementById('mobileSidebar');
        if (mobileSidebar && mobileSidebar.classList.contains('open')) {
          mobileSidebar.classList.remove('open');
          const overlay = document.querySelector('.sidebar-overlay');
          if (overlay) overlay.classList.remove('open');
        }
      });
    });
  }
  // Botones grandes Finanzas
  submodulosBtnsFinanzas.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const submodulo = btn.getAttribute('data-submodulo');
      
      // Caso especial para flujo de caja - disponible en todas las páginas
      if (submodulo === 'flujo-caja') {
        navegarAFlujoCaja();
        return;
      }
      
      mostrarSubmoduloSeccion(submodulo, {
        submodulos: submodulosFinanzas,
        menuPrincipal: submodulosMenuFinanzas,
        statsSection: statsSectionFinanzas,
        prefix: 'submodulo-'
      });
      submodulosBtnsFinanzas.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // --- Ventas ---
  const ventasLink = document.getElementById('sidebarVentasLink');
  const ventasToggle = document.getElementById('ventasSubmenuToggle');
  const ventasSubmenu = document.getElementById('ventasSubmenu');
  const submenuLinksVentas = document.querySelectorAll('.sidebar-submenu-link[data-submodulo]');
  const submodulosVentas = [
    document.getElementById('submodulo-registrar-venta'),
    document.getElementById('submodulo-facturas'),
    document.getElementById('submodulo-reportes')
  ];
  const menuPrincipalVentas = document.querySelector('.ventas-submodulos-menu');
  const statsSectionVentas = document.querySelector('.quick-stats');

  // Flecha Ventas
  if (ventasToggle) {
    ventasToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (ventasLink) ventasLink.classList.toggle('open');
      if (ventasSubmenu) ventasSubmenu.classList.toggle('show');
    });
  }

  // Submenú lateral Ventas universal
  if (submenuLinksVentas && submodulosVentas && menuPrincipalVentas && statsSectionVentas) {
    submenuLinksVentas.forEach(btn => {
      btn.addEventListener('click', () => {
        const submodulo = btn.getAttribute('data-submodulo');
        // Si no estamos en ventas.html, redirigir con parámetro
        if (!window.location.pathname.endsWith('ventas.html')) {
          window.location.href = 'ventas.html?submodulo=' + encodeURIComponent(submodulo);
          return;
        }
        mostrarSubmoduloSeccion(submodulo, {
          submodulos: submodulosVentas,
          menuPrincipal: menuPrincipalVentas,
          statsSection: statsSectionVentas,
          prefix: 'submodulo-'
        });
        submenuLinksVentas.forEach(l => l.classList.remove('active'));
        btn.classList.add('active');
        if (ventasLink) ventasLink.classList.remove('open');
        if (ventasSubmenu) ventasSubmenu.classList.remove('show');
        // Cerrar menú móvil si está abierto
        const mobileSidebar = document.getElementById('mobileSidebar');
        if (mobileSidebar && mobileSidebar.classList.contains('open')) {
          mobileSidebar.classList.remove('open');
          const overlay = document.querySelector('.sidebar-overlay');
          if (overlay) overlay.classList.remove('open');
        }
      });
    });
  }
  // Botones grandes Ventas
  const submodulosBtnsVentas = document.querySelectorAll('.ventas-submodulo-btn');
  submodulosBtnsVentas.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const submodulo = btn.getAttribute('data-submodulo');
      mostrarSubmoduloSeccion(submodulo, {
        submodulos: submodulosVentas,
        menuPrincipal: menuPrincipalVentas,
        statsSection: statsSectionVentas,
        prefix: 'submodulo-'
      });
      submodulosBtnsVentas.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Al volver al módulo principal, mostrar menú principal y stats, ocultar submódulos
  if (window.location.pathname.endsWith('ventas.html')) {
    if (menuPrincipalVentas) menuPrincipalVentas.style.display = '';
    if (statsSectionVentas) statsSectionVentas.style.display = '';
    submodulosVentas.forEach(div => {
      if (div) div.style.display = 'none';
    });
    submenuLinksVentas.forEach(l => l.classList.remove('active'));
    ventasLink.classList.remove('open');
    ventasSubmenu.classList.remove('show');
  }

  // --- Mostrar submódulo automáticamente si hay parámetro en la URL ---
  document.addEventListener('DOMContentLoaded', () => {
    // Finanzas
    if (window.location.pathname.endsWith('finanzas.html')) {
      const submodulo = getSubmoduloParam();
      if (submodulo) {
        mostrarSubmoduloSeccion(submodulo, {
          submodulos: submodulosFinanzas,
          menuPrincipal: submodulosMenuFinanzas,
          statsSection: statsSectionFinanzas,
          prefix: 'submodulo-'
        });
        // Resaltar el submenú activo
        submenuLinksFinanzas.forEach(l => {
          if (l.getAttribute('data-submodulo') === submodulo) l.classList.add('active');
          else l.classList.remove('active');
        });
      }
    }
    // Ventas
    if (window.location.pathname.endsWith('ventas.html')) {
      const submodulo = getSubmoduloParam();
      if (submodulo) {
        mostrarSubmoduloSeccion(submodulo, {
          submodulos: submodulosVentas,
          menuPrincipal: menuPrincipalVentas,
          statsSection: statsSectionVentas,
          prefix: 'submodulo-'
        });
        // Resaltar el submenú activo
        submenuLinksVentas.forEach(l => {
          if (l.getAttribute('data-submodulo') === submodulo) l.classList.add('active');
          else l.classList.remove('active');
        });
      }
    }
    
    // Verificar si hay parámetro de flujo de caja en cualquier página
    const submoduloFlujoCaja = getSubmoduloParam();
    if (submoduloFlujoCaja === 'flujo-caja') {
      // Redirigir a finanzas con el submódulo de flujo de caja
      window.location.href = 'finanzas.html?submodulo=flujo-caja';
    }
  });
});

// Exportar para uso en otros módulos
export default NavigationManager;