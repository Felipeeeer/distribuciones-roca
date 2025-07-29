import { db } from "../config/firebase.js";
import {
  ref,
  onValue,
  push,
  update,
  remove,
  set
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

import { 
  formatCurrency,
  formatNumber,
} from '../utils/formatters.js';

import { 
  showModal as showModalComponent,
  confirmModal,
  alertModal,
  closeModal,
} from '../components/modal.js';

// --- DOM Elements ---
const loadingOverlay = document.getElementById('loadingOverlay');

// Pestañas
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Productos
const totalProductosElem = document.getElementById('totalProductos');
const valorTotalInventarioElem = document.getElementById('valorTotalInventario');
const productosBajoStockElem = document.getElementById('productosBajoStock');
const filtroProductoInput = document.getElementById('filtroProducto');
const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');
const tablaProductosBody = document.querySelector("#tablaProductos tbody");
const productosMobileContainer = document.getElementById("productosMobileContainer");
const paginationContainer = document.getElementById("pagination");
const btnNuevoProducto = document.getElementById('btnNuevoProducto');

// Promociones
const totalPromocionesActivasElem = document.getElementById('totalPromocionesActivas');
const totalPromocionesInactivasElem = document.getElementById('totalPromocionesInactivas');
const promocionesEsteMesElem = document.getElementById('promocionesEsteMes');
const filtroPromocionInput = document.getElementById('filtroPromocion');
const filtroEstadoPromocionSelect = document.getElementById('filtroEstadoPromocion');
const btnLimpiarFiltrosPromociones = document.getElementById('btnLimpiarFiltrosPromociones');
const tablaPromocionesBody = document.querySelector("#tablaPromociones tbody");
const promocionesMobileContainer = document.getElementById("promocionesMobileContainer");
const paginationPromocionesContainer = document.getElementById("paginationPromociones");
const btnNuevaPromocion = document.getElementById('btnNuevaPromocion');

// Botones de exportación
const btnExportarDatos = document.getElementById('btnExportarDatos');
const btnExportarPromociones = document.getElementById('btnExportarPromociones');

// --- Estado de la Aplicación ---
let productosCache = [];
let promocionesCache = [];
let productosFiltradosCache = []; // Cache para productos filtrados
let promocionesFiltradosCache = []; // Cache para promociones filtradas
let currentPage = 1;
let currentPagePromociones = 1;
const itemsPerPage = 5; // Cambiado a 5 productos por página
const BAJO_STOCK_THRESHOLD = 5;
let currentProductoId = null;
let currentPromocionId = null;

// --- Funciones de Pestañas ---

function inicializarPestanas() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      cambiarPestana(tabName);
    });
  });
}

function cambiarPestana(tabName) {
  // Actualizar botones
  tabButtons.forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Actualizar contenido
  tabContents.forEach(content => content.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  
  // Cargar datos específicos de la pestaña
  if (tabName === 'productos') {
    if (productosCache.length === 0) cargarProductos();
    setTimeout(() => actualizarEstadisticasEnTiempoReal(), 500);
  } else if (tabName === 'promociones') {
    if (promocionesCache.length === 0) cargarPromociones();
    setTimeout(() => actualizarEstadisticasEnTiempoReal(), 500);
  }
}

// --- Funciones de Productos ---

function cargarProductos() {
  loadingOverlay.classList.add('show');
  const productosRef = ref(db, 'productos');

  onValue(productosRef, (snapshot) => {
    productosCache = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        productosCache.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
      productosCache.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    
    aplicarFiltrosProductos();
    actualizarResumenProductos();
    loadingOverlay.classList.remove('show');
  }, (error) => {
    console.error("Error al cargar productos:", error);
    alertModal({ title: 'Error', content: 'No se pudieron cargar los productos.' });
    loadingOverlay.classList.remove('show');
  });
}

function renderProductos(productos) {
  if (!tablaProductosBody || !productosMobileContainer) return;
  
  tablaProductosBody.innerHTML = "";
  productosMobileContainer.innerHTML = "";

  

  if (productos.length === 0) {
    const emptyHtml = '<td colspan="8" class="text-center p-4">No se encontraron productos.</td>';
    tablaProductosBody.innerHTML = `<tr>${emptyHtml}</tr>`;
    productosMobileContainer.innerHTML = '<div class="empty-state"><i class="bi bi-box-seam"></i><p>No hay productos para mostrar</p></div>';
    return;
  }
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProductos = productos.slice(startIndex, endIndex);
  
  

  paginatedProductos.forEach(producto => {
    // Para la tabla de escritorio
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${producto.nombre}</td>
      <td>${producto.tipoUnidad || 'N/A'}</td>
      <td>${formatNumber(producto.stockCanastas || 0)}</td>
      <td>${formatCurrency(producto.precioCompra || 0)}</td>
      <td>${formatCurrency(producto.precioDistribuidor || 0)}</td>
      <td>${formatCurrency(producto.precioCliente || 0)}</td>
      <td>${formatCurrency(producto.valorTotal || 0)}</td>
      <td class="text-center">
        <div class="table-actions">
          <button class="table-action-btn primary btn-editar-producto" data-id="${producto.id}" title="Editar">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button class="table-action-btn danger btn-eliminar-producto" data-id="${producto.id}" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    tablaProductosBody.appendChild(tr);

    // Para las tarjetas móviles
    const card = document.createElement('div');
    card.className = 'table-card';
    card.innerHTML = `
      <div class="table-card-header">
        <span class="table-card-title">${producto.nombre}</span>
        <div class="table-actions">
           <button class="table-action-btn primary btn-editar-producto" data-id="${producto.id}" title="Editar">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button class="table-action-btn danger btn-eliminar-producto" data-id="${producto.id}" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <div class="table-card-body">
        <div class="table-card-row"><strong>Stock:</strong> ${formatNumber(producto.stockCanastas || 0)} ${producto.tipoUnidad || ''}s</div>
        <div class="table-card-row"><strong>P. Compra:</strong> ${formatCurrency(producto.precioCompra || 0)}</div>
        <div class="table-card-row"><strong>P. Cliente:</strong> ${formatCurrency(producto.precioCliente || 0)}</div>
        <div class="table-card-row"><strong>Valor Total:</strong> ${formatCurrency(producto.valorTotal || 0)}</div>
      </div>
    `;
    productosMobileContainer.appendChild(card);
  });
}

function aplicarFiltrosProductos() {
  const textoFiltro = filtroProductoInput.value.trim().toLowerCase();
  let productosFiltrados = productosCache;

  if (textoFiltro) {
    productosFiltrados = productosCache.filter(p => 
      p.nombre.toLowerCase().includes(textoFiltro) ||
      (p.tipoUnidad && p.tipoUnidad.toLowerCase().includes(textoFiltro))
    );
  }
  
  currentPage = 1;
  renderProductos(productosFiltrados);
  actualizarPaginacion(productosFiltrados, paginationContainer, 'productos');
}

function actualizarResumenProductos() {
  totalProductosElem.textContent = formatNumber(productosCache.length);
  
  const valorTotal = productosCache.reduce((sum, p) => sum + (p.valorTotal || 0), 0);
  valorTotalInventarioElem.textContent = formatCurrency(valorTotal);
  
  const bajoStockCount = productosCache.filter(p => (p.stockCanastas || 0) <= BAJO_STOCK_THRESHOLD).length;
  productosBajoStockElem.textContent = formatNumber(bajoStockCount);
}

// --- Funciones de Promociones ---

function cargarPromociones() {
  loadingOverlay.classList.add('show');
  const promocionesRef = ref(db, 'promociones');

  onValue(promocionesRef, (snapshot) => {
    promocionesCache = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        promocionesCache.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
      promocionesCache.sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));
    }
    
    aplicarFiltrosPromociones();
    actualizarResumenPromociones();
    loadingOverlay.classList.remove('show');
  }, (error) => {
    console.error("Error al cargar promociones:", error);
    alertModal({ title: 'Error', content: 'No se pudieron cargar las promociones.' });
    loadingOverlay.classList.remove('show');
  });
}

function renderPromociones(promociones) {
  if (!tablaPromocionesBody || !promocionesMobileContainer) return;
  
  tablaPromocionesBody.innerHTML = "";
  promocionesMobileContainer.innerHTML = "";

  

  if (promociones.length === 0) {
    const emptyHtml = '<td colspan="9" class="text-center p-4">No se encontraron promociones.</td>';
    tablaPromocionesBody.innerHTML = `<tr>${emptyHtml}</tr>`;
    promocionesMobileContainer.innerHTML = '<div class="empty-state"><i class="bi bi-percent"></i><p>No hay promociones para mostrar</p></div>';
    return;
  }
  
  const startIndex = (currentPagePromociones - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPromociones = promociones.slice(startIndex, endIndex);
  
  

  paginatedPromociones.forEach(promocion => {
    const fechaCreacion = new Date(promocion.fechaCreacion).toLocaleDateString();
    const ahorro = (promocion.precioDescuento || 0) - (promocion.precioPromocional || 0);
    const porcentajeAhorro = promocion.precioDescuento > 0 ? ((ahorro / promocion.precioDescuento) * 100).toFixed(0) : 0;
    
    // Para la tabla de escritorio
    const tr = document.createElement('tr');
    const statusClass = promocion.activa ? 'active' : 'inactive';
    const statusIcon = promocion.activa ? 'check-circle' : 'pause-circle';
    const statusText = promocion.activa ? 'Activa' : 'Inactiva';
    const toggleClass = promocion.activa ? 'warning' : 'success';
    const toggleIcon = promocion.activa ? 'pause' : 'play';
    const toggleTitle = promocion.activa ? 'Desactivar' : 'Activar';
    
    tr.innerHTML = `
      <td>
        <span class="promo-status ${statusClass}">
          <i class="bi bi-${statusIcon}"></i>
          ${statusText}
        </span>
      </td>
      <td>${promocion.productoPrincipal || 'N/A'}</td>
      <td>${promocion.productoDescuento || 'N/A'}</td>
      <td>
        <div class="promo-cantidad">
          <span>${promocion.cantidadPrincipal || 0}</span>
          <i class="bi bi-arrow-right arrow"></i>
          <span>${promocion.cantidadNecesaria || 0}</span>
        </div>
      </td>
      <td>${formatCurrency(promocion.precioDescuento || 0)}</td>
      <td>${formatCurrency(promocion.precioPromocional || 0)}</td>
      <td>
        <span class="ahorro-badge">-${porcentajeAhorro}%</span>
        <small style="display: block; margin-top: 4px;">${formatCurrency(ahorro)}</small>
      </td>
      <td>${fechaCreacion}</td>
      <td class="text-center">
        <div class="table-actions">
          <button class="table-action-btn ${toggleClass} btn-toggle-promocion" data-id="${promocion.id}" title="${toggleTitle}">
            <i class="bi bi-${toggleIcon}"></i>
          </button>
          <button class="table-action-btn primary btn-editar-promocion" data-id="${promocion.id}" title="Editar">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button class="table-action-btn danger btn-eliminar-promocion" data-id="${promocion.id}" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    tablaPromocionesBody.appendChild(tr);

    // Para las tarjetas móviles
    const card = document.createElement('div');
    card.className = 'table-card';
    card.innerHTML = `
      <div class="table-card-header">
        <div>
          <span class="table-card-title">${promocion.productoPrincipal} → ${promocion.productoDescuento}</span>
          <span class="promo-status ${statusClass}" style="margin-left: 12px;">
            <i class="bi bi-${statusIcon}"></i>
            ${statusText}
          </span>
        </div>
        <div class="table-actions">
          <button class="table-action-btn ${toggleClass} btn-toggle-promocion" data-id="${promocion.id}" title="${toggleTitle}">
            <i class="bi bi-${toggleIcon}"></i>
          </button>
          <button class="table-action-btn primary btn-editar-promocion" data-id="${promocion.id}" title="Editar">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button class="table-action-btn danger btn-eliminar-promocion" data-id="${promocion.id}" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <div class="table-card-body">
        <div class="table-card-row"><strong>Cantidades:</strong> ${promocion.cantidadPrincipal} → ${promocion.cantidadNecesaria}</div>
        <div class="table-card-row"><strong>Precio Original:</strong> ${formatCurrency(promocion.precioDescuento || 0)}</div>
        <div class="table-card-row"><strong>Precio Promocional:</strong> ${formatCurrency(promocion.precioPromocional || 0)}</div>
        <div class="table-card-row"><strong>Ahorro:</strong> <span class="ahorro-badge">-${porcentajeAhorro}%</span> (${formatCurrency(ahorro)})</div>
        <div class="table-card-row"><strong>Creada:</strong> ${fechaCreacion}</div>
      </div>
    `;
    promocionesMobileContainer.appendChild(card);
  });
}

function aplicarFiltrosPromociones() {
  const textoFiltro = filtroPromocionInput.value.trim().toLowerCase();
  const estadoFiltro = filtroEstadoPromocionSelect.value;
  let promocionesFiltradas = promocionesCache;

  if (textoFiltro) {
    promocionesFiltradas = promocionesFiltradas.filter(p => 
      (p.productoPrincipal && p.productoPrincipal.toLowerCase().includes(textoFiltro)) ||
      (p.productoDescuento && p.productoDescuento.toLowerCase().includes(textoFiltro))
    );
  }

  if (estadoFiltro) {
    const estadoBool = estadoFiltro === 'activa';
    promocionesFiltradas = promocionesFiltradas.filter(p => p.activa === estadoBool);
  }
  
  currentPagePromociones = 1;
  renderPromociones(promocionesFiltradas);
  actualizarPaginacion(promocionesFiltradas, paginationPromocionesContainer, 'promociones');
}

function actualizarResumenPromociones() {
  const activas = promocionesCache.filter(p => p.activa === true).length;
  const inactivas = promocionesCache.filter(p => p.activa === false).length;
  
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  
  const esteMes = promocionesCache.filter(p => {
    const fechaCreacion = new Date(p.fechaCreacion);
    return fechaCreacion >= inicioMes;
  }).length;

  totalPromocionesActivasElem.textContent = formatNumber(activas);
  totalPromocionesInactivasElem.textContent = formatNumber(inactivas);
  promocionesEsteMesElem.textContent = formatNumber(esteMes);
}

// --- Funciones de Modal para Productos ---

function createProductoFormHTML(producto = null) {
  const nombreValue = producto?.nombre ? producto.nombre.replace(/"/g, '&quot;') : '';
  const tipoUnidadValue = producto?.tipoUnidad ? producto.tipoUnidad.replace(/"/g, '&quot;') : 'canasta';
  const stockValue = producto?.stockCanastas !== undefined ? producto.stockCanastas : 0;
  const unidadesValue = producto?.unidadesPorTipo !== undefined ? producto.unidadesPorTipo : 30;
  const precioCompraValue = producto?.precioCompra !== undefined ? producto.precioCompra : 0;
  const precioDistribuidorValue = producto?.precioDistribuidor !== undefined ? producto.precioDistribuidor : 0;
  const precioClienteValue = producto?.precioCliente !== undefined ? producto.precioCliente : 0;
  
  return `
    <form id="formProductoModal" class="producto-form">
      <div class="form-row">
        <div class="form-group col-8">
          <label for="nombreModal" class="form-label">Nombre del Producto</label>
          <input type="text" class="form-control" id="nombreModal" required value="${nombreValue}">
        </div>
        <div class="form-group col-4">
          <label for="tipoUnidadModal" class="form-label">Tipo de Unidad</label>
          <input type="text" class="form-control" id="tipoUnidadModal" value="${tipoUnidadValue}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group col-6">
          <label for="stockCanastasModal" class="form-label">Stock en Canastas</label>
          <input type="number" class="form-control" id="stockCanastasModal" required min="0" value="${stockValue}">
        </div>
        <div class="form-group col-6">
          <label for="unidadesPorTipoModal" class="form-label">Unidades por Canasta</label>
          <input type="number" class="form-control" id="unidadesPorTipoModal" required min="1" value="${unidadesValue}">
        </div>
      </div>

      <div class="form-section-title">Precios</div>

      <div class="form-row">
        <div class="form-group col-4">
          <label for="precioCompraModal" class="form-label">Precio de Compra</label>
          <div class="input-group">
            <span class="input-group-text">$</span>
            <input type="number" class="form-control" id="precioCompraModal" required min="0" value="${precioCompraValue}">
          </div>
        </div>
        <div class="form-group col-4">
          <label for="precioDistribuidorModal" class="form-label">Precio Distribuidor</label>
          <div class="input-group">
            <span class="input-group-text">$</span>
            <input type="number" class="form-control" id="precioDistribuidorModal" required min="0" value="${precioDistribuidorValue}">
          </div>
        </div>
        <div class="form-group col-4">
          <label for="precioClienteModal" class="form-label">Precio Cliente</label>
          <div class="input-group">
            <span class="input-group-text">$</span>
            <input type="number" class="form-control" id="precioClienteModal" required min="0" value="${precioClienteValue}">
          </div>
        </div>
      </div>

      <div class="valor-total-display">
        <i class="bi bi-calculator"></i>
        <span>Valor Total del Inventario: <strong id="valorTotalCalculadoModal">$0</strong></span>
      </div>
    </form>
  `;
}

function actualizarValorCalculadoModal() {
  const stock = parseFloat(document.getElementById('stockCanastasModal')?.value) || 0;
  const precio = parseFloat(document.getElementById('precioCompraModal')?.value) || 0;
  const valorTotalElem = document.getElementById('valorTotalCalculadoModal');
  if (valorTotalElem) {
    valorTotalElem.textContent = formatCurrency(stock * precio);
  }
}

function setupModalFormListeners() {
  const stockInput = document.getElementById('stockCanastasModal');
  const precioInput = document.getElementById('precioCompraModal');
  
  if (stockInput) stockInput.addEventListener('input', actualizarValorCalculadoModal);
  if (precioInput) precioInput.addEventListener('input', actualizarValorCalculadoModal);
  
  actualizarValorCalculadoModal();
}

// --- Funciones de Modal para Promociones ---

function createPromocionFormHTML(promocion = null) {
  const productosOptions = productosCache.map(p => 
    `<option value="${p.nombre}" ${promocion && (promocion.productoPrincipal === p.nombre || promocion.productoDescuento === p.nombre) ? 'selected' : ''}>${p.nombre}</option>`
  ).join('');
  
  return `
    <form id="formPromocionModal" class="promocion-form">
      <div class="form-row">
        <div class="form-group col-6">
          <label for="productoPrincipalModal" class="form-label">Producto Principal</label>
          <select class="form-control" id="productoPrincipalModal" required>
            <option value="">Seleccionar producto...</option>
            ${productosOptions}
          </select>
          <small class="form-text">Producto que el cliente debe comprar</small>
        </div>
        <div class="form-group col-6">
          <label for="cantidadPrincipalModal" class="form-label">Cantidad Requerida</label>
          <input type="number" class="form-control" id="cantidadPrincipalModal" required min="1" value="${promocion?.cantidadPrincipal || 1}">
          <small class="form-text">Cuántas unidades debe comprar</small>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group col-6">
          <label for="productoDescuentoModal" class="form-label">Producto en Promoción</label>
          <select class="form-control" id="productoDescuentoModal" required>
            <option value="">Seleccionar producto...</option>
            ${productosOptions}
          </select>
          <small class="form-text">Producto que se vende con descuento</small>
        </div>
        <div class="form-group col-6">
          <label for="cantidadNecesariaModal" class="form-label">Cantidad en Promoción</label>
          <input type="number" class="form-control" id="cantidadNecesariaModal" required min="1" value="${promocion?.cantidadNecesaria || 1}">
          <small class="form-text">Cuántas unidades se venden con descuento</small>
        </div>
      </div>

      <div class="form-section-title">Precios</div>

      <div class="form-row">
        <div class="form-group col-6">
          <label for="precioDescuentoModal" class="form-label">Precio Original</label>
          <div class="input-group">
            <span class="input-group-text">$</span>
            <input type="number" class="form-control" id="precioDescuentoModal" required min="0" value="${promocion?.precioDescuento || 0}">
          </div>
          <small class="form-text">Precio normal del producto en promoción</small>
        </div>
        <div class="form-group col-6">
          <label for="precioPromocionalModal" class="form-label">Precio Promocional</label>
          <div class="input-group">
            <span class="input-group-text">$</span>
            <input type="number" class="form-control" id="precioPromocionalModal" required min="0" value="${promocion?.precioPromocional || 0}">
          </div>
          <small class="form-text">Precio con descuento</small>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group col-12">
          <label class="form-label">Estado de la Promoción</label>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="activaModal" ${promocion?.activa !== false ? 'checked' : ''}>
            <label class="form-check-label" for="activaModal">
              Promoción activa
            </label>
          </div>
        </div>
      </div>

      <div class="promocion-preview" id="promocionPreview">
        <div class="preview-header">
          <i class="bi bi-eye"></i>
          <span>Vista Previa de la Promoción</span>
        </div>
        <div class="preview-content" id="previewContent">
          <!-- Se llenará dinámicamente -->
        </div>
      </div>
    </form>
  `;
}

function actualizarVistaPrevia() {
  const productoPrincipal = document.getElementById('productoPrincipalModal')?.value;
  const cantidadPrincipal = document.getElementById('cantidadPrincipalModal')?.value;
  const productoDescuento = document.getElementById('productoDescuentoModal')?.value;
  const cantidadNecesaria = document.getElementById('cantidadNecesariaModal')?.value;
  const precioOriginal = parseFloat(document.getElementById('precioDescuentoModal')?.value) || 0;
  const precioPromocional = parseFloat(document.getElementById('precioPromocionalModal')?.value) || 0;
  const activa = document.getElementById('activaModal')?.checked;
  
  const previewContent = document.getElementById('previewContent');
  if (!previewContent) return;
  
  if (productoPrincipal && productoDescuento && cantidadPrincipal && cantidadNecesaria) {
    const ahorro = precioOriginal - precioPromocional;
    const porcentajeAhorro = precioOriginal > 0 ? ((ahorro / precioOriginal) * 100).toFixed(0) : 0;
    
    previewContent.innerHTML = `
      <div style="font-weight: 600; color: var(--ios-blue, #007aff); margin-bottom: 8px;">
        ${activa ? '🟢 PROMOCIÓN ACTIVA' : '🟡 PROMOCIÓN INACTIVA'}
      </div>
      <div style="font-size: 18px; margin-bottom: 12px;">
        Compra <strong>${cantidadPrincipal}</strong> ${productoPrincipal} 
        y lleva <strong>${cantidadNecesaria}</strong> ${productoDescuento}
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="text-decoration: line-through; color: var(--ios-text-secondary, #8e8e93);">
            Precio normal: ${formatCurrency(precioOriginal)}
          </div>
          <div style="font-size: 20px; font-weight: 700; color: var(--ios-green, #34c759);">
            Precio promocional: ${formatCurrency(precioPromocional)}
          </div>
        </div>
        <div style="background: var(--ios-red, #ff3b30); color: white; padding: 8px 12px; border-radius: 20px; font-weight: 600;">
          ¡Ahorra ${porcentajeAhorro}%!
        </div>
      </div>
    `;
  } else {
    previewContent.innerHTML = `
      <div style="text-align: center; color: var(--ios-text-secondary, #8e8e93); font-style: italic;">
        Completa todos los campos para ver la vista previa
      </div>
    `;
  }
}

function setupPromocionFormListeners() {
  const inputs = ['productoPrincipalModal', 'cantidadPrincipalModal', 'productoDescuentoModal', 'cantidadNecesariaModal', 'precioDescuentoModal', 'precioPromocionalModal', 'activaModal'];
  
  inputs.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('input', actualizarVistaPrevia);
      element.addEventListener('change', actualizarVistaPrevia);
    }
  });
  
  actualizarVistaPrevia();
}

// --- Funciones de Guardado ---

async function guardarProductoFromModal() {
  const nombreInput = document.getElementById('nombreModal');
  const tipoUnidadInput = document.getElementById('tipoUnidadModal');
  const stockCanastasInput = document.getElementById('stockCanastasModal');
  const unidadesPorTipoInput = document.getElementById('unidadesPorTipoModal');
  const precioCompraInput = document.getElementById('precioCompraModal');
  const precioDistribuidorInput = document.getElementById('precioDistribuidorModal');
  const precioClienteInput = document.getElementById('precioClienteModal');

  // Verificar que los elementos existen
  if (!nombreInput || !tipoUnidadInput || !stockCanastasInput || !precioCompraInput) {
    alertModal({ title: 'Error', content: 'Error en el formulario. Intenta nuevamente.' });
    return false;
  }

  // Obtener valores y hacer trim
  const nombre = nombreInput.value.trim();
  const tipoUnidad = tipoUnidadInput.value.trim();
  const stockCanastas = parseFloat(stockCanastasInput.value) || 0;
  const precioCompra = parseFloat(precioCompraInput.value) || 0;
  const unidadesPorTipo = parseFloat(unidadesPorTipoInput.value) || 30;

  // Validaciones básicas
  if (!nombre) {
    alertModal({ title: 'Error de Validación', content: 'El nombre del producto es obligatorio.' });
    nombreInput.focus();
    return false;
  }

  if (!tipoUnidad) {
    alertModal({ title: 'Error de Validación', content: 'El tipo de unidad es obligatorio.' });
    tipoUnidadInput.focus();
    return false;
  }

  // Validaciones de números
  if (stockCanastas < 0) {
    alertModal({ title: 'Error de Validación', content: 'El stock no puede ser negativo.' });
    stockCanastasInput.focus();
    return false;
  }

  if (unidadesPorTipo <= 0) {
    alertModal({ title: 'Error de Validación', content: 'Las unidades por canasta deben ser mayor a cero.' });
    unidadesPorTipoInput.focus();
    return false;
  }

  const precioDistribuidor = parseFloat(precioDistribuidorInput.value) || 0;
  const precioCliente = parseFloat(precioClienteInput.value) || 0;

  if (precioCompra < 0 || precioDistribuidor < 0 || precioCliente < 0) {
    alertModal({ title: 'Error de Validación', content: 'Los precios no pueden ser negativos.' });
    return false;
  }

  const productoData = {
    nombre: nombre,
    tipoUnidad: tipoUnidad,
    stockCanastas: stockCanastas,
    unidadesPorTipo: unidadesPorTipo,
    precioCompra: precioCompra,
    precioDistribuidor: precioDistribuidor,
    precioCliente: precioCliente,
    stock: stockCanastas * unidadesPorTipo,
    valorTotal: stockCanastas * precioCompra,
    fechaActualizacion: new Date().toISOString(),
  };

  loadingOverlay.classList.add('show');
  
  try {
    if (currentProductoId) {
      const productoRef = ref(db, `productos/${currentProductoId}`);
      await update(productoRef, productoData);
      showToast('Producto actualizado con éxito', 'success');
    } else {
      productoData.fechaIngreso = new Date().toISOString();
      const productosRef = ref(db, 'productos');
      await push(productosRef, productoData);
      showToast('Producto creado con éxito', 'success');
    }
    
    return true;
  } catch (error) {
    console.error("Error al guardar el producto:", error);
    alertModal({ title: 'Error', content: `No se pudo guardar el producto: ${error.message}` });
    return false;
  } finally {
    loadingOverlay.classList.remove('show');
    currentProductoId = null;
  }
}

async function guardarPromocionFromModal() {
  const productoPrincipalInput = document.getElementById('productoPrincipalModal');
  const cantidadPrincipalInput = document.getElementById('cantidadPrincipalModal');
  const productoDescuentoInput = document.getElementById('productoDescuentoModal');
  const cantidadNecesariaInput = document.getElementById('cantidadNecesariaModal');
  const precioDescuentoInput = document.getElementById('precioDescuentoModal');
  const precioPromocionalInput = document.getElementById('precioPromocionalModal');
  const activaInput = document.getElementById('activaModal');

  if (!productoPrincipalInput || !productoDescuentoInput || !cantidadPrincipalInput || !cantidadNecesariaInput) {
    alertModal({ title: 'Error', content: 'Error en el formulario. Intenta nuevamente.' });
    return false;
  }

  const promocionData = {
    productoPrincipal: productoPrincipalInput.value.trim(),
    cantidadPrincipal: parseInt(cantidadPrincipalInput.value) || 1,
    productoDescuento: productoDescuentoInput.value.trim(),
    cantidadNecesaria: parseInt(cantidadNecesariaInput.value) || 1,
    precioDescuento: parseFloat(precioDescuentoInput.value) || 0,
    precioPromocional: parseFloat(precioPromocionalInput.value) || 0,
    activa: activaInput.checked,
    fechaActualizacion: new Date().toISOString(),
  };

  if (!promocionData.productoPrincipal || !promocionData.productoDescuento) {
    alertModal({ title: 'Error de Validación', content: 'Debes seleccionar ambos productos.' });
    return false;
  }

  if (promocionData.productoPrincipal === promocionData.productoDescuento) {
    alertModal({ title: 'Error de Validación', content: 'El producto principal y el producto en promoción deben ser diferentes.' });
    return false;
  }

  loadingOverlay.classList.add('show');
  
  try {
    if (currentPromocionId) {
      const promocionRef = ref(db, `promociones/${currentPromocionId}`);
      await update(promocionRef, promocionData);
    } else {
      promocionData.fechaCreacion = new Date().toISOString();
      const promocionesRef = ref(db, 'promociones');
      await push(promocionesRef, promocionData);
    }
    
    showToast('Promoción guardada con éxito', 'success');
    return true;
  } catch (error) {
    console.error("Error al guardar la promoción:", error);
    alertModal({ title: 'Error', content: `No se pudo guardar la promoción: ${error.message}` });
    return false;
  } finally {
    loadingOverlay.classList.remove('show');
    currentPromocionId = null;
  }
}

// --- Funciones de Modal ---

async function abrirModalNuevoProducto() {
  currentProductoId = null;
  
  // Crear el modal manualmente para tener mejor control
  const modalContent = createProductoFormHTML();
  
  // Mostrar el modal sin auto-confirmar
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = `
    <div class="modal modal-large modal-info modal-scale">
      <div class="modal-header">
        <i class="bi bi-plus-circle modal-icon info"></i>
        <div class="modal-header-content">
          <h3 class="modal-title">Agregar Nuevo Producto</h3>
        </div>
        <button class="modal-close" data-action="close"><i class="bi bi-x"></i></button>
      </div>
      <div class="modal-body">
        ${modalContent}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ios secondary" data-action="cancel">Cancelar</button>
        <button class="btn btn-ios primary" data-action="confirm">Guardar Producto</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  // Mostrar modal
  requestAnimationFrame(() => {
    modalOverlay.classList.add('show');
  });
  
  // Configurar listeners después de que el modal se renderice
  setTimeout(() => {
    setupModalFormListeners();
  }, 100);
  
  // Retornar una promesa que se resuelve cuando el usuario interactúa
  return new Promise((resolve) => {
    const closeModal = () => {
      modalOverlay.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
      }, 300);
    };
    
    modalOverlay.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      
      if (action === 'confirm') {
        e.preventDefault();
        const guardado = await guardarProductoFromModal();
        if (guardado) {
          closeModal();
          resolve(true);
        }
        // Si no se guardó, mantener el modal abierto
      } else if (action === 'cancel' || action === 'close') {
        closeModal();
        currentProductoId = null;
        resolve(false);
      }
    });
    
    // Cerrar con backdrop
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModal();
        currentProductoId = null;
        resolve(false);
      }
    });
    
    // Cerrar con Escape
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        currentProductoId = null;
        resolve(false);
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  });
}

async function abrirModalEdicionProducto(id) {
  const producto = productosCache.find(p => p.id === id);
  if (!producto) {
    alertModal({ title: 'Error', content: 'Producto no encontrado.' });
    return;
  }

  currentProductoId = id;
  
  // Crear el modal manualmente para tener mejor control
  const modalContent = createProductoFormHTML(producto);
  
  // Mostrar el modal sin auto-confirmar
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = `
    <div class="modal modal-large modal-info modal-scale">
      <div class="modal-header">
        <i class="bi bi-pencil-square modal-icon info"></i>
        <div class="modal-header-content">
          <h3 class="modal-title">Editar Producto: ${producto.nombre}</h3>
        </div>
        <button class="modal-close" data-action="close"><i class="bi bi-x"></i></button>
      </div>
      <div class="modal-body">
        ${modalContent}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ios secondary" data-action="cancel">Cancelar</button>
        <button class="btn btn-ios primary" data-action="confirm">Actualizar Producto</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  // Mostrar modal
  requestAnimationFrame(() => {
    modalOverlay.classList.add('show');
  });
  
  // Configurar valores después de que el modal se renderice
  setTimeout(() => {
    // Rellenar los campos con los valores del producto
    const nombreInput = document.getElementById('nombreModal');
    const tipoUnidadInput = document.getElementById('tipoUnidadModal');
    const stockCanastasInput = document.getElementById('stockCanastasModal');
    const unidadesPorTipoInput = document.getElementById('unidadesPorTipoModal');
    const precioCompraInput = document.getElementById('precioCompraModal');
    const precioDistribuidorInput = document.getElementById('precioDistribuidorModal');
    const precioClienteInput = document.getElementById('precioClienteModal');
    
    if (nombreInput) nombreInput.value = producto.nombre || '';
    if (tipoUnidadInput) tipoUnidadInput.value = producto.tipoUnidad || 'canasta';
    if (stockCanastasInput) stockCanastasInput.value = producto.stockCanastas || 0;
    if (unidadesPorTipoInput) unidadesPorTipoInput.value = producto.unidadesPorTipo || 30;
    if (precioCompraInput) precioCompraInput.value = producto.precioCompra || 0;
    if (precioDistribuidorInput) precioDistribuidorInput.value = producto.precioDistribuidor || 0;
    if (precioClienteInput) precioClienteInput.value = producto.precioCliente || 0;
    
    setupModalFormListeners();
  }, 100);
  
  // Retornar una promesa que se resuelve cuando el usuario interactúa
  return new Promise((resolve) => {
    const closeModal = () => {
      modalOverlay.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
      }, 300);
    };
    
    modalOverlay.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      
      if (action === 'confirm') {
        e.preventDefault();
        const guardado = await guardarProductoFromModal();
        if (guardado) {
          closeModal();
          resolve(true);
        }
        // Si no se guardó, mantener el modal abierto
      } else if (action === 'cancel' || action === 'close') {
        closeModal();
        currentProductoId = null;
        resolve(false);
      }
    });
    
    // Cerrar con backdrop
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModal();
        currentProductoId = null;
        resolve(false);
      }
    });
    
    // Cerrar con Escape
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        currentProductoId = null;
        resolve(false);
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  });
}

async function abrirModalNuevaPromocion() {
  currentPromocionId = null;
  const modalContent = createPromocionFormHTML();
  
  const result = await showModalComponent({
    title: 'Crear Nueva Promoción',
    content: modalContent,
    size: 'large',
    confirmText: 'Guardar Promoción',
    cancelText: 'Cancelar',
    type: 'info'
  });
  
  if (result) {
    setTimeout(() => setupPromocionFormListeners(), 100);
    return await guardarPromocionFromModal();
  }
  return false;
}

async function abrirModalEdicionPromocion(id) {
  const promocion = promocionesCache.find(p => p.id === id);
  if (!promocion) {
    alertModal({ title: 'Error', content: 'Promoción no encontrada.' });
    return;
  }

  currentPromocionId = id;
  const modalContent = createPromocionFormHTML(promocion);
  
  const result = await showModalComponent({
    title: `Editar Promoción: ${promocion.productoPrincipal} → ${promocion.productoDescuento}`,
    content: modalContent,
    size: 'large',
    confirmText: 'Actualizar Promoción',
    cancelText: 'Cancelar',
    type: 'info'
  });
  
  if (result) {
    setTimeout(() => {
      const productoPrincipalSelect = document.getElementById('productoPrincipalModal');
      const productoDescuentoSelect = document.getElementById('productoDescuentoModal');
      
      if (productoPrincipalSelect) productoPrincipalSelect.value = promocion.productoPrincipal;
      if (productoDescuentoSelect) productoDescuentoSelect.value = promocion.productoDescuento;
      
      setupPromocionFormListeners();
    }, 100);
    
    return await guardarPromocionFromModal();
  }
  
  currentPromocionId = null;
  return false;
}

// --- Funciones de Eliminación ---

async function eliminarProducto(id) {
  const producto = productosCache.find(p => p.id === id);
  const confirmed = await confirmModal({
    title: `¿Eliminar ${producto?.nombre || 'Producto'}?`,
    content: 'Esta acción no se puede deshacer. Se eliminará el producto permanentemente.',
    confirmText: 'Sí, Eliminar',
    type: 'danger',
  });

  if (confirmed) {
    loadingOverlay.classList.add('show');
    try {
      await remove(ref(db, `productos/${id}`));
      showToast('Producto eliminado correctamente', 'success');
    } catch (error) {
      console.error("Error al eliminar el producto:", error);
      alertModal({ title: 'Error', content: `No se pudo eliminar el producto: ${error.message}` });
    } finally {
      loadingOverlay.classList.remove('show');
    }
  }
}

async function eliminarPromocion(id) {
  const promocion = promocionesCache.find(p => p.id === id);
  const confirmed = await confirmModal({
    title: '¿Eliminar promoción?',
    content: `¿Estás seguro de eliminar la promoción "${promocion?.productoPrincipal} → ${promocion?.productoDescuento}"? Esta acción no se puede deshacer.`,
    confirmText: 'Sí, Eliminar',
    type: 'danger',
  });

  if (confirmed) {
    loadingOverlay.classList.add('show');
    try {
      await remove(ref(db, `promociones/${id}`));
      showToast('Promoción eliminada correctamente', 'success');
    } catch (error) {
      console.error("Error al eliminar la promoción:", error);
      alertModal({ title: 'Error', content: `No se pudo eliminar la promoción: ${error.message}` });
    } finally {
      loadingOverlay.classList.remove('show');
    }
  }
}

async function toggleEstadoPromocion(id) {
  const promocion = promocionesCache.find(p => p.id === id);
  if (!promocion) return;

  const nuevoEstado = !promocion.activa;
  const textoAccion = nuevoEstado ? 'activar' : 'desactivar';
  
  const confirmed = await confirmModal({
    title: `¿${textoAccion.charAt(0).toUpperCase() + textoAccion.slice(1)} promoción?`,
    content: `¿Estás seguro de ${textoAccion} la promoción "${promocion.productoPrincipal} → ${promocion.productoDescuento}"?`,
    confirmText: `Sí, ${textoAccion}`,
    type: nuevoEstado ? 'success' : 'warning'
  });

  if (confirmed) {
    loadingOverlay.classList.add('show');
    try {
      const promocionRef = ref(db, `promociones/${id}`);
      await update(promocionRef, { 
        activa: nuevoEstado,
        fechaActualizacion: new Date().toISOString()
      });
      showToast(`Promoción ${nuevoEstado ? 'activada' : 'desactivada'} correctamente`, 'success');
    } catch (error) {
      console.error("Error al actualizar promoción:", error);
      alertModal({ title: 'Error', content: `No se pudo ${textoAccion} la promoción: ${error.message}` });
    } finally {
      loadingOverlay.classList.remove('show');
    }
  }
}

// --- Funciones de Exportación ---

function exportarProductos() {
  if (productosCache.length === 0) {
    alertModal({ title: 'Sin Datos', content: 'No hay productos para exportar.' });
    return;
  }

  const headers = ['Nombre', 'Tipo Unidad', 'Stock Canastas', 'Unidades por Canasta', 'Stock Total', 'Precio Compra', 'Precio Distribuidor', 'Precio Cliente', 'Valor Total', 'Fecha Ingreso'];
  
  const csvContent = [
    headers.join(','),
    ...productosCache.map(producto => [
      `"${producto.nombre || ''}"`,
      `"${producto.tipoUnidad || ''}"`,
      producto.stockCanastas || 0,
      producto.unidadesPorTipo || 0,
      producto.stock || 0,
      producto.precioCompra || 0,
      producto.precioDistribuidor || 0,
      producto.precioCliente || 0,
      producto.valorTotal || 0,
      `"${producto.fechaIngreso ? new Date(producto.fechaIngreso).toLocaleDateString() : ''}"`
    ].join(','))
  ].join('\n');

  descargarCSV(csvContent, `productos_${new Date().toISOString().split('T')[0]}.csv`);
  showToast('Productos exportados correctamente', 'success');
}

function exportarPromociones() {
  if (promocionesCache.length === 0) {
    alertModal({ title: 'Sin Datos', content: 'No hay promociones para exportar.' });
    return;
  }

  const headers = ['Estado', 'Producto Principal', 'Cantidad Principal', 'Producto Descuento', 'Cantidad Descuento', 'Precio Original', 'Precio Promocional', 'Ahorro', '% Ahorro', 'Fecha Creación'];
  
  const csvContent = [
    headers.join(','),
    ...promocionesCache.map(promocion => {
      const ahorro = (promocion.precioDescuento || 0) - (promocion.precioPromocional || 0);
      const porcentajeAhorro = promocion.precioDescuento > 0 ? ((ahorro / promocion.precioDescuento) * 100).toFixed(2) : 0;
      
      return [
        `"${promocion.activa ? 'Activa' : 'Inactiva'}"`,
        `"${promocion.productoPrincipal || ''}"`,
        promocion.cantidadPrincipal || 0,
        `"${promocion.productoDescuento || ''}"`,
        promocion.cantidadNecesaria || 0,
        promocion.precioDescuento || 0,
        promocion.precioPromocional || 0,
        ahorro.toFixed(2),
        `${porcentajeAhorro}%`,
        `"${promocion.fechaCreacion ? new Date(promocion.fechaCreacion).toLocaleDateString() : ''}"`
      ].join(',');
    })
  ].join('\n');

  descargarCSV(csvContent, `promociones_${new Date().toISOString().split('T')[0]}.csv`);
  showToast('Promociones exportadas correctamente', 'success');
}

function descargarCSV(content, filename) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// --- Funciones de Utilidad ---

/**
 * Genera y actualiza los controles de paginación.
 * @param {Array} items - La lista de items para la que se genera la paginación.
 * @param {HTMLElement} container - Contenedor de la paginación.
 * @param {string} type - Tipo de paginación ('productos' o 'promociones').
 */
function actualizarPaginacion(items, container, type) {
  if (!container) return;
  
  container.innerHTML = "";
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const currentPageVar = type === 'productos' ? currentPage : currentPagePromociones;

  if (totalPages <= 1) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'flex';

  // Función para crear elementos de paginación
  const createPageItem = (text, page, isDisabled = false, isActive = false) => {
    const li = document.createElement("li");
    li.className = `pagination-btn ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
    
    const a = document.createElement('a');
    a.href = "#";
    a.textContent = text;
    a.dataset.page = page.toString();
    a.dataset.type = type;
    
    // Prevenir comportamiento por defecto
    a.addEventListener('click', (e) => {
      e.preventDefault();
    });
    
    li.appendChild(a);
    return li;
  };

  // Crear botones de paginación
  container.appendChild(createPageItem('‹ Anterior', currentPageVar - 1, currentPageVar === 1));
  
  // Mostrar páginas (lógica inteligente para no mostrar demasiadas)
  let startPage = Math.max(1, currentPageVar - 2);
  let endPage = Math.min(totalPages, currentPageVar + 2);
  
  // Ajustar si estamos cerca del inicio o final
  if (currentPageVar <= 3) {
    endPage = Math.min(5, totalPages);
  }
  if (currentPageVar >= totalPages - 2) {
    startPage = Math.max(totalPages - 4, 1);
  }
  
  // Agregar primera página si no está visible
  if (startPage > 1) {
    container.appendChild(createPageItem('1', 1, false, 1 === currentPageVar));
    if (startPage > 2) {
      const dots = document.createElement('li');
      dots.className = 'pagination-btn disabled';
      dots.innerHTML = '<span>...</span>';
      container.appendChild(dots);
    }
  }
  
  // Agregar páginas del rango
  for (let i = startPage; i <= endPage; i++) {
    container.appendChild(createPageItem(i.toString(), i, false, i === currentPageVar));
  }
  
  // Agregar última página si no está visible
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('li');
      dots.className = 'pagination-btn disabled';
      dots.innerHTML = '<span>...</span>';
      container.appendChild(dots);
    }
    container.appendChild(createPageItem(totalPages.toString(), totalPages, false, totalPages === currentPageVar));
  }
  
  container.appendChild(createPageItem('Siguiente ›', currentPageVar + 1, currentPageVar === totalPages));
  
  // Event delegation para manejar clicks
  container.addEventListener('click', handlePaginationClick);
}

/**
 * Maneja los clicks en la paginación usando event delegation
 */
function handlePaginationClick(e) {
  e.preventDefault();
  
  const target = e.target.closest('a[data-page]');
  if (!target || target.parentElement.classList.contains('disabled')) {
    return;
  }
  
  const newPage = parseInt(target.dataset.page);
  const pageType = target.dataset.type;
  
  
  
  if (isNaN(newPage) || newPage < 1) {
    console.warn('⚠️ Página inválida:', newPage);
    return;
  }
  
  if (pageType === 'productos') {
    const totalPages = Math.ceil(productosFiltradosCache.length / itemsPerPage);
    if (newPage > totalPages) {
      console.warn('⚠️ Página fuera de rango para productos:', newPage, 'máximo:', totalPages);
      return;
    }
    
    
    currentPage = newPage;
    renderProductos(); // Solo renderizar, no aplicar filtros
    actualizarPaginacion(productosFiltradosCache, paginationContainer, 'productos');
    
  } else if (pageType === 'promociones') {
    const totalPages = Math.ceil(promocionesFiltradosCache.length / itemsPerPage);
    if (newPage > totalPages) {
      console.warn('⚠️ Página fuera de rango para promociones:', newPage, 'máximo:', totalPages);
      return;
    }
    
    
    currentPagePromociones = newPage;
    renderPromociones(); // Solo renderizar, no aplicar filtros
    actualizarPaginacion(promocionesFiltradosCache, paginationPromocionesContainer, 'promociones');
  }
}

/**
 * Limpia los event listeners de paginación para evitar duplicados
 */
function limpiarEventListenersPaginacion() {
  if (paginationContainer) {
    paginationContainer.removeEventListener('click', handlePaginationClick);
  }
  if (paginationPromocionesContainer) {
    paginationPromocionesContainer.removeEventListener('click', handlePaginationClick);
  }
}

function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  if (window.showToast) {
    window.showToast(message, type, { duration: 3000 });
  } else {

  }
}

function actualizarEstadisticasEnTiempoReal() {
  const activeTab = document.querySelector('.tab-button.active')?.dataset.tab;
  
  if (activeTab === 'productos') {

  } else if (activeTab === 'promociones') {
    
  }
}

// --- Inicialización ---

function inicializar() {
  inicializarPestanas();
  cargarProductos();

  // Listeners para productos
  btnNuevoProducto.addEventListener('click', abrirModalNuevoProducto);
  filtroProductoInput.addEventListener('input', aplicarFiltrosProductos);
  btnLimpiarFiltros.addEventListener('click', () => {
    filtroProductoInput.value = '';
    aplicarFiltrosProductos();
  });
  
  if (btnExportarDatos) {
    btnExportarDatos.addEventListener('click', exportarProductos);
  }

  // Listeners para promociones
  btnNuevaPromocion.addEventListener('click', abrirModalNuevaPromocion);
  filtroPromocionInput.addEventListener('input', aplicarFiltrosPromociones);
  filtroEstadoPromocionSelect.addEventListener('change', aplicarFiltrosPromociones);
  btnLimpiarFiltrosPromociones.addEventListener('click', () => {
    filtroPromocionInput.value = '';
    filtroEstadoPromocionSelect.value = '';
    aplicarFiltrosPromociones();
  });
  
  if (btnExportarPromociones) {
    btnExportarPromociones.addEventListener('click', exportarPromociones);
  }

  // Listeners para acciones en las tablas
  document.body.addEventListener('click', (e) => {
    // Acciones de productos
    const editBtnProducto = e.target.closest('.btn-editar-producto');
    if (editBtnProducto) {
      abrirModalEdicionProducto(editBtnProducto.dataset.id);
      return;
    }
    
    const deleteBtnProducto = e.target.closest('.btn-eliminar-producto');
    if (deleteBtnProducto) {
      eliminarProducto(deleteBtnProducto.dataset.id);
      return;
    }

    // Acciones de promociones
    const toggleBtnPromocion = e.target.closest('.btn-toggle-promocion');
    if (toggleBtnPromocion) {
      toggleEstadoPromocion(toggleBtnPromocion.dataset.id);
      return;
    }
    
    const editBtnPromocion = e.target.closest('.btn-editar-promocion');
    if (editBtnPromocion) {
      abrirModalEdicionPromocion(editBtnPromocion.dataset.id);
      return;
    }
    
    const deleteBtnPromocion = e.target.closest('.btn-eliminar-promocion');
    if (deleteBtnPromocion) {
      eliminarPromocion(deleteBtnPromocion.dataset.id);
      return;
    }
  });
  
  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      const activeTab = document.querySelector('.tab-button.active')?.dataset.tab;
      if (activeTab === 'productos') {
        abrirModalNuevoProducto();
      } else if (activeTab === 'promociones') {
        abrirModalNuevaPromocion();
      }
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      const activeTab = document.querySelector('.tab-button.active')?.dataset.tab;
      if (activeTab === 'productos') {
        exportarProductos();
      } else if (activeTab === 'promociones') {
        exportarPromociones();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', inicializar);