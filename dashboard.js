/**
 * 📊 Dashboard Module - Distribuciones ROCA
 * Módulo principal del dashboard con funcionalidades optimizadas
 */

import { db } from '../config/firebase.js';
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";
import { formatCurrency, formatDate, formatRelativeTime } from '../utils/formatters.js';
import { showToast } from '../components/toast.js';
import { showModal, ModalUtils } from '../components/modal.js';

class DashboardManager {
  constructor() {
    this.productosData = [];
    this.ventasData = [];
    this.clientesData = [];
    this.deudasData = [];
    this.comprasData = [];
    this.topVendidosGlobal = [];
    this.isLoading = false;
    
    // Elementos DOM
    this.elements = {
      ventasHoy: document.getElementById('ventasHoy'),
      totalProductos: document.getElementById('totalProductos'),
      totalClientes: document.getElementById('totalClientes'),
      totalDeudas: document.getElementById('totalDeudas'),
      recentActivity: document.getElementById('recentActivity'),
      topProductsList: document.getElementById('topProductsList'),
      viewInventory: document.getElementById('viewInventory'),
      viewAllTopProducts: document.getElementById('viewAllTopProducts'),
      loadingOverlay: document.getElementById('loadingOverlay'),
      // Module stats
      moduleProductsCount: document.getElementById('moduleProductsCount'),
      moduleClientsCount: document.getElementById('moduleClientsCount'),
      moduleSalesCount: document.getElementById('moduleSalesCount')
    };
    
    this.init();
  }

  /**
   * Inicializa el dashboard
   */
  async init() {
    try {
      this.showLoading(true);
      await this.loadAllData();
      this.setupEventListeners();
      this.startRealTimeUpdates();
      showToast('Dashboard cargado correctamente', 'success');
    } catch (error) {
      console.error('Error inicializando dashboard:', error);
      showToast('Error al cargar el dashboard', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Carga todos los datos necesarios
   */
  async loadAllData() {
    try {
      await Promise.all([
        this.loadProductos(),
        this.loadVentas(),
        this.loadClientes(),
        this.loadDeudas(),
        this.loadCompras()
      ]);
      
      this.updateAllStats();
    } catch (error) {
      console.error('Error cargando datos:', error);
      throw error;
    }
  }

  /**
   * Carga productos
   */
  async loadProductos() {
    try {
      const snapshot = await get(ref(db, 'productos'));
      this.productosData = snapshot.exists() 
        ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data }))
        : [];
    } catch (error) {
      console.error('Error cargando productos:', error);
      this.productosData = [];
    }
  }

  /**
   * Carga ventas
   */
  async loadVentas() {
    try {
      const snapshot = await get(ref(db, 'ventas'));
      this.ventasData = snapshot.exists() 
        ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data }))
        : [];
      
      this.calculateTopVendidos();
    } catch (error) {
      console.error('Error cargando ventas:', error);
      this.ventasData = [];
    }
  }

  /**
   * Carga clientes
   */
  async loadClientes() {
    try {
      const snapshot = await get(ref(db, 'clientes'));
      this.clientesData = snapshot.exists() 
        ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data }))
        : [];
    } catch (error) {
      console.error('Error cargando clientes:', error);
      this.clientesData = [];
    }
  }

  /**
   * Carga deudas
   */
  async loadDeudas() {
    try {
      const snapshot = await get(ref(db, 'deudas'));
      this.deudasData = snapshot.exists() 
        ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data }))
        : [];
    } catch (error) {
      console.error('Error cargando deudas:', error);
      this.deudasData = [];
    }
  }

  /**
   * Carga compras
   */
  async loadCompras() {
    try {
      const snapshot = await get(ref(db, 'compras'));
      this.comprasData = snapshot.exists() 
        ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data }))
        : [];
    } catch (error) {
      console.error('Error cargando compras:', error);
      this.comprasData = [];
    }
  }

  /**
   * Calcula productos más vendidos
   */
  calculateTopVendidos() {
    const productosContador = {};
    
    this.ventasData.forEach(venta => {
      if (venta.productos && Array.isArray(venta.productos)) {
        venta.productos.forEach(producto => {
          const nombre = producto.nombreProducto || producto.nombre || 'Producto desconocido';
          if (!productosContador[nombre]) {
            productosContador[nombre] = {
              nombre,
              cantidad: 0,
              ventas: 0
            };
          }
          productosContador[nombre].cantidad += producto.cantidad || 0;
          productosContador[nombre].ventas += 1;
        });
      } else if (venta.producto) {
        // Formato antiguo de ventas
        const nombre = venta.producto;
        if (!productosContador[nombre]) {
          productosContador[nombre] = {
            nombre,
            cantidad: 0,
            ventas: 0
          };
        }
        productosContador[nombre].cantidad += venta.cantidad || 0;
        productosContador[nombre].ventas += 1;
      }
    });
    
    this.topVendidosGlobal = Object.values(productosContador)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);
  }

  /**
   * Actualiza todas las estadísticas
   */
  updateAllStats() {
    this.updateVentasHoy();
    this.updateTopVendidos();
    this.updateRecentActivity();
    this.updateModuleStats();
  }

  /**
   * Actualiza ventas de hoy
   */
  updateVentasHoy() {
    const hoy = new Date().toISOString().split('T')[0];
    const ventasHoy = this.getVentasHoy();
    const montoHoy = ventasHoy.reduce((total, venta) => total + (venta.total || 0), 0);
    
    this.animateCounter(this.elements.ventasHoy, ventasHoy.length);
    
    // Actualizar monto si existe el elemento
    const elementoMonto = document.getElementById('montoVentasHoy');
    if (elementoMonto) {
      elementoMonto.textContent = formatCurrency(montoHoy);
    }
  }

  /**
   * Obtiene ventas de hoy
   */
  getVentasHoy() {
    const hoy = new Date().toISOString().split('T')[0];
    return this.ventasData.filter(venta => {
      const fechaVenta = venta.fecha ? venta.fecha.split('T')[0] : null;
      return fechaVenta === hoy;
    });
  }

  /**
   * Actualiza productos más vendidos
   */
  updateTopVendidos() {
    if (!this.elements.topProductsList) return;
    
    if (this.topVendidosGlobal.length === 0) {
      this.elements.topProductsList.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-graph-up text-muted"></i>
          <p class="text-muted">No hay datos de ventas disponibles</p>
        </div>
      `;
      return;
    }
    
    this.elements.topProductsList.innerHTML = this.topVendidosGlobal
      .slice(0, 5)
      .map((producto, index) => `
        <div class="top-product-item">
          <div class="rank-badge rank-${index + 1}">${index + 1}</div>
          <div class="product-info">
            <h6 class="product-name">${producto.nombre}</h6>
            <small class="product-stats">${producto.cantidad} unidades • ${producto.ventas} ventas</small>
          </div>
        </div>
      `).join('');
  }

  /**
   * Actualiza actividad reciente
   */
  updateRecentActivity() {
    if (!this.elements.recentActivity) return;
    
    // Combinar todas las actividades (ventas, compras, gastos)
    const todasLasActividades = [];
    
    // Agregar ventas
    this.ventasData.forEach(venta => {
      todasLasActividades.push({
        tipo: 'venta',
        fecha: venta.fecha,
        titulo: `Venta a ${venta.cliente || 'Cliente anónimo'}`,
        monto: venta.total || 0,
        icono: 'bi-graph-up',
        clase: 'sale'
      });
    });
    
    // Agregar compras
    this.comprasData.forEach(compra => {
      todasLasActividades.push({
        tipo: 'compra',
        fecha: compra.fecha,
        titulo: `Compra de ${compra.proveedor || 'Proveedor'}`,
        monto: compra.valorTotal || compra.total || 0,
        icono: 'bi-bag-plus',
        clase: 'purchase'
      });
    });
    
    // Ordenar por fecha (más reciente primero) y tomar las últimas 5
    const actividadesRecientes = todasLasActividades
      .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
      .slice(0, 5);
    
    if (actividadesRecientes.length === 0) {
      this.elements.recentActivity.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-activity text-muted"></i>
          <p class="text-muted">No hay actividad reciente</p>
        </div>
      `;
      return;
    }
    
    this.elements.recentActivity.innerHTML = actividadesRecientes
      .map(actividad => `
        <div class="activity-item">
          <div class="activity-icon ${actividad.clase}">
            <i class="bi ${actividad.icono}"></i>
          </div>
          <div class="activity-content">
            <p class="activity-text">
              <strong>${actividad.titulo}</strong>
            </p>
            <small class="activity-time">${formatRelativeTime(actividad.fecha)}</small>
          </div>
          <div class="activity-amount ${actividad.tipo === 'compra' ? 'text-danger' : 'text-success'}">
            ${actividad.tipo === 'compra' ? '-' : '+'}${formatCurrency(Math.abs(actividad.monto))}
          </div>
        </div>
      `).join('');
  }

  /**
   * Actualiza estadísticas de módulos
   */
  updateModuleStats() {
    this.animateCounter(this.elements.totalProductos, this.productosData.length);
    this.animateCounter(this.elements.totalClientes, this.clientesData.length);
    
    // Actualizar stats específicos si existen
    if (this.elements.moduleProductsCount) {
      this.animateCounter(this.elements.moduleProductsCount, this.productosData.length);
    }
    if (this.elements.moduleClientsCount) {
      this.animateCounter(this.elements.moduleClientsCount, this.clientesData.length);
    }
    if (this.elements.moduleSalesCount) {
      const ventasHoy = this.getVentasHoy();
      this.animateCounter(this.elements.moduleSalesCount, ventasHoy.length);
    }
    
    // Calcular deudas totales
    const totalDeudas = this.deudasData.reduce((total, deuda) => total + (deuda.saldo || 0), 0);
    this.animateCounter(this.elements.totalDeudas, totalDeudas, formatCurrency);
  }

  /**
   * Anima contador con efecto incremental
   */
  animateCounter(element, targetValue, formatter = null) {
    if (!element) return;
    
    const currentValue = parseInt(element.textContent.replace(/[^0-9]/g, '')) || 0;
    const increment = (targetValue - currentValue) / 20;
    let current = currentValue;
    
    const updateValue = () => {
      current += increment;
      const value = Math.round(current);
      element.textContent = formatter ? formatter(value) : value;
      
      const progress = Math.abs(current - currentValue) / Math.abs(targetValue - currentValue);
      element.style.transform = `scale(${1 + progress * 0.1})`;
      
      if (progress >= 1) {
        element.textContent = formatter ? formatter(targetValue) : targetValue;
        element.style.transform = 'scale(1)';
      } else {
        requestAnimationFrame(updateValue);
      }
    };
    
    if (currentValue !== targetValue) {
      requestAnimationFrame(updateValue);
    }
  }

  /**
   * Configura los event listeners
   */
  setupEventListeners() {
    // Ver inventario
    if (this.elements.viewInventory) {
      this.elements.viewInventory.addEventListener('click', () => {
        this.showInventoryModal();
      });
    }

    // Ver todos los productos más vendidos
    if (this.elements.viewAllTopProducts) {
      this.elements.viewAllTopProducts.addEventListener('click', () => {
        this.showTopProductsModal();
      });
    }
  }

  /**
   * Muestra modal de inventario usando nuestro sistema
   */
  async showInventoryModal() {
    const productosConStock = this.productosData.filter(p => (p.stockCanastas || p.stock || 0) > 0);
    const productosSinStock = this.productosData.filter(p => (p.stockCanastas || p.stock || 0) === 0);
    const valorTotalInventario = this.productosData.reduce((total, p) => {
      return total + ((p.stockCanastas || 0) * (p.precioVenta || 0));
    }, 0);
    
    await showModal({
      title: '📦 Estado del Inventario',
      content: `
        <div class="inventory-summary">
          <div class="inventory-stats">
            <div class="stat-item success">
              <div class="stat-icon">
                <i class="bi bi-check-circle-fill"></i>
              </div>
              <div class="stat-content">
                <h4>${productosConStock.length}</h4>
                <p>Productos en Stock</p>
              </div>
            </div>
            <div class="stat-item danger">
              <div class="stat-icon">
                <i class="bi bi-x-circle-fill"></i>
              </div>
              <div class="stat-content">
                <h4>${productosSinStock.length}</h4>
                <p>Productos Agotados</p>
              </div>
            </div>
            <div class="stat-item primary">
              <div class="stat-icon">
                <i class="bi bi-currency-dollar"></i>
              </div>
              <div class="stat-content">
                <h4>${formatCurrency(valorTotalInventario)}</h4>
                <p>Valor Total</p>
              </div>
            </div>
          </div>
          ${productosSinStock.length > 0 ? `
            <div class="alert-section">
              <h6><i class="bi bi-exclamation-triangle text-warning"></i> Productos Agotados:</h6>
              <ul class="products-list">
                ${productosSinStock.slice(0, 5).map(p => `<li>${p.nombre}</li>`).join('')}
                ${productosSinStock.length > 5 ? `<li class="text-muted">...y ${productosSinStock.length - 5} más</li>` : ''}
              </ul>
            </div>
          ` : ''}
        </div>
      `,
      type: 'info',
      size: 'medium',
      showCancel: false,
      confirmText: 'Cerrar'
    });
  }

  /**
   * Muestra modal de productos más vendidos usando nuestro sistema
   */
  async showTopProductsModal() {
    if (this.topVendidosGlobal.length === 0) {
      return ModalUtils.warning('No hay datos de ventas disponibles para mostrar productos más vendidos.');
    }

    const topProductsContent = `
      <div class="top-products-list">
        ${this.topVendidosGlobal.slice(0, 10).map((producto, index) => `
          <div class="top-product-item-detailed">
            <div class="rank-badge-large ${this.getRankClass(index)}">
              ${index + 1}
            </div>
            <div class="product-details">
              <h6 class="product-name">${producto.nombre}</h6>
              <div class="product-metrics">
                <span class="metric">
                  <i class="bi bi-box"></i>
                  ${producto.cantidad} unidades
                </span>
                <span class="metric">
                  <i class="bi bi-graph-up"></i>
                  ${producto.ventas} ventas
                </span>
              </div>
            </div>
            <div class="product-trend">
              <i class="bi bi-arrow-up text-success"></i>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    await showModal({
      title: '🏆 Productos Más Vendidos',
      content: topProductsContent,
      type: 'info',
      size: 'large',
      showCancel: false,
      confirmText: 'Cerrar'
    });
  }

  /**
   * Obtiene la clase CSS para el ranking
   */
  getRankClass(index) {
    switch (index) {
      case 0: return 'rank-gold';
      case 1: return 'rank-silver';
      case 2: return 'rank-bronze';
      default: return 'rank-default';
    }
  }

  /**
   * Inicia actualizaciones en tiempo real
   */
  startRealTimeUpdates() {
    // Escuchar cambios en productos
    const productosRef = ref(db, 'productos');
    onValue(productosRef, (snapshot) => {
      this.loadProductos().then(() => {
        this.updateModuleStats();
      });
    });

    // Escuchar cambios en ventas
    const ventasRef = ref(db, 'ventas');
    onValue(ventasRef, (snapshot) => {
      this.loadVentas().then(() => {
        this.updateVentasHoy();
        this.updateTopVendidos();
        this.updateRecentActivity();
        this.updateModuleStats();
      });
    });

    // Escuchar cambios en clientes
    const clientesRef = ref(db, 'clientes');
    onValue(clientesRef, (snapshot) => {
      this.loadClientes().then(() => {
        this.updateModuleStats();
      });
    });

    // Escuchar cambios en deudas
    const deudasRef = ref(db, 'deudas');
    onValue(deudasRef, (snapshot) => {
      this.loadDeudas().then(() => {
        this.updateModuleStats();
      });
    });

    // Escuchar cambios en compras
    const comprasRef = ref(db, 'compras');
    onValue(comprasRef, (snapshot) => {
      this.loadCompras().then(() => {
        this.updateRecentActivity();
      });
    });
  }

  /**
   * Muestra/oculta el overlay de loading
   */
  showLoading(show) {
    if (this.elements.loadingOverlay) {
      if (show) {
        this.elements.loadingOverlay.classList.add('show');
      } else {
        this.elements.loadingOverlay.classList.remove('show');
      }
    }
    this.isLoading = show;
  }

  /**
   * Obtiene estadísticas resumidas
   */
  getStats() {
    return {
      ventas: {
        hoy: this.getVentasHoy().length,
        total: this.ventasData.length,
        montoHoy: this.getVentasHoy().reduce((total, venta) => total + (venta.total || 0), 0)
      },
      productos: {
        total: this.productosData.length,
        enStock: this.productosData.filter(p => (p.stockCanastas || p.stock || 0) > 0).length,
        agotados: this.productosData.filter(p => (p.stockCanastas || p.stock || 0) === 0).length
      },
      clientes: {
        total: this.clientesData.length
      },
      deudas: {
        total: this.deudasData.length,
        monto: this.deudasData.reduce((total, deuda) => total + (deuda.saldo || 0), 0)
      },
      compras: {
        total: this.comprasData.length,
        montoTotal: this.comprasData.reduce((total, compra) => total + (compra.total || 0), 0)
      }
    };
  }

  /**
   * Añade estilos específicos para el dashboard
   */
  addDashboardStyles() {
    if (document.getElementById('dashboard-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'dashboard-styles';
    style.textContent = `
      /* Dashboard Specific Styles */
      .inventory-summary {
        padding: 20px 0;
      }
      
      .inventory-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }
      
      .stat-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid var(--ios-separator, #e5e5e7);
      }
      
      .stat-item.success { background: rgba(52, 199, 89, 0.1); }
      .stat-item.danger { background: rgba(255, 59, 48, 0.1); }
      .stat-item.primary { background: rgba(0, 122, 255, 0.1); }
      
      .stat-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        color: white;
      }
      
      .stat-item.success .stat-icon { background: var(--ios-green, #34c759); }
      .stat-item.danger .stat-icon { background: var(--ios-red, #ff3b30); }
      .stat-item.primary .stat-icon { background: var(--ios-blue, #007aff); }
      
      .stat-content h4 {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        color: var(--ios-text-primary, #000);
      }
      
      .stat-content p {
        margin: 4px 0 0;
        font-size: 14px;
        color: var(--ios-text-secondary, #8e8e93);
      }
      
      .alert-section {
        padding: 20px;
        background: var(--ios-fill-quaternary, #f2f2f7);
        border-radius: 12px;
        border-left: 4px solid var(--ios-orange, #ff9500);
      }
      
      .alert-section h6 {
        margin: 0 0 12px;
        color: var(--ios-text-primary, #000);
      }
      
      .products-list {
        margin: 0;
        padding-left: 20px;
        list-style: disc;
      }
      
      .products-list li {
        margin: 4px 0;
        color: var(--ios-text-secondary, #8e8e93);
      }
      
      /* Top Products Modal */
      .top-products-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      
      .top-product-item-detailed {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 20px;
        border: 1px solid var(--ios-separator, #e5e5e7);
        border-radius: 12px;
        transition: all 0.2s ease;
      }
      
      .top-product-item-detailed:hover {
        background: var(--ios-fill-quaternary, #f2f2f7);
        transform: translateY(-2px);
      }
      
      .rank-badge-large {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        font-weight: 700;
        color: white;
        flex-shrink: 0;
      }
      
      .rank-gold { background: linear-gradient(135deg, #ffd700, #ffed4e); color: #8b6914; }
      .rank-silver { background: linear-gradient(135deg, #c0c0c0, #e8e8e8); color: #6b6b6b; }
      .rank-bronze { background: linear-gradient(135deg, #cd7f32, #daa520); color: #5c4317; }
      .rank-default { background: var(--ios-blue, #007aff); }
      
      .product-details {
        flex: 1;
      }
      
      .product-details .product-name {
        margin: 0 0 8px;
        font-size: 18px;
        font-weight: 600;
        color: var(--ios-text-primary, #000);
      }
      
      .product-metrics {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
      }
      
      .metric {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        color: var(--ios-text-secondary, #8e8e93);
      }
      
      .metric i {
        color: var(--ios-blue, #007aff);
      }
      
      .product-trend {
        font-size: 24px;
      }
      
      /* Dashboard Activity Items */
      .top-product-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid var(--ios-separator, #e5e5e7);
      }
      
      .top-product-item:last-child {
        border-bottom: none;
      }
      
      .rank-badge {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        color: white;
        flex-shrink: 0;
      }
      
      .rank-1 { background: var(--ios-orange, #ff9500); }
      .rank-2 { background: var(--ios-gray, #8e8e93); }
      .rank-3 { background: var(--ios-brown, #a2845e); }
      .rank-4, .rank-5 { background: var(--ios-blue, #007aff); }
      
      .product-info {
        flex: 1;
      }
      
      .product-name {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--ios-text-primary, #000);
      }
      
      .product-stats {
        color: var(--ios-text-secondary, #8e8e93);
        font-size: 12px;
      }
      
      .activity-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid var(--ios-separator, #e5e5e7);
      }
      
      .activity-item:last-child {
        border-bottom: none;
      }
      
      .activity-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: var(--ios-blue, #007aff);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
      }
      
      .activity-content {
        flex: 1;
      }
      
      .activity-text {
        margin: 0;
        font-size: 14px;
        color: var(--ios-text-primary, #000);
      }
      
      .activity-time {
        color: var(--ios-text-secondary, #8e8e93);
        font-size: 12px;
      }
      
      .activity-amount {
        font-size: 14px;
        font-weight: 600;
        color: var(--ios-green, #34c759);
      }
      
      .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--ios-text-tertiary, #c7c7cc);
      }
      
      .empty-state i {
        font-size: 48px;
        margin-bottom: 12px;
        display: block;
      }
      
      @media (max-width: 768px) {
        .inventory-stats {
          grid-template-columns: 1fr;
        }
        
        .product-metrics {
          flex-direction: column;
          gap: 8px;
        }
        
        .top-product-item-detailed {
          padding: 16px;
        }
      }
    `;
    
    document.head.appendChild(style);
  }
}

// Inicializar dashboard cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.dashboardManager = new DashboardManager();
  // Añadir estilos específicos
  window.dashboardManager.addDashboardStyles();
});

// Exponer funciones globales si es necesario
window.showInventoryDetails = () => {
  if (window.dashboardManager) {
    window.dashboardManager.showInventoryModal();
  }
};

window.showAllTopProducts = () => {
  if (window.dashboardManager) {
    window.dashboardManager.showTopProductsModal();
  }
};

export default DashboardManager;