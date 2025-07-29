import * as CashFlowService from '../services/cashFlowService.js';
import { formatCurrency, formatNumber } from '../utils/formatters.js';
import * as DeudasService from '../services/deudasService.js';

// --- Estado del Componente ---
let currentView = 'detallado'; // 'detallado' o 'resumido'
let currentFilters = {
  fechaInicio: null,
  fechaFin: null
};
let currentPage = 1;
const itemsPerPage = 5; // 5 elementos por página

// --- Elementos DOM ---
let cashFlowContainer = null;
let estadisticasContainer = null;
let filtrosContainer = null;
let movimientosContainer = null;

// --- Inicialización del Componente ---

export function inicializarComponente(containerId) {
  
  
  cashFlowContainer = document.getElementById(containerId);
  if (!cashFlowContainer) {
    console.error(`❌ Contenedor de flujo de caja no encontrado: ${containerId}`);
    return;
  }
  
  
  renderizarComponente();
  configurarEventos();
  suscribirseACambios();
  
  
}

function renderizarComponente() {
  cashFlowContainer.innerHTML = `
    <div class="cash-flow-module">
      <!-- Header del módulo -->
      <div class="module-header">
        <div class="header-content">
          <h2><i class="bi bi-cash-stack"></i> Flujo de Caja</h2>
          <p>Análisis cronológico de movimientos de dinero</p>
          <div class="implementation-notice">
            <i class="bi bi-info-circle"></i>
            <span>Movimientos desde el 2 de julio de 2025 (implementación del módulo de compras)</span>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn btn-ios secondary" id="btnExportarCSV">
            <i class="bi bi-file-earmark-spreadsheet"></i> Exportar CSV
          </button>
          <button class="btn btn-ios secondary" id="btnExportarPDF">
            <i class="bi bi-file-earmark-pdf"></i> Exportar PDF
          </button>
          <button class="btn btn-ios primary" id="btnRecargarFlujoCaja">
            <i class="bi bi-arrow-clockwise"></i> Recargar
          </button>
        </div>
      </div>
      <!-- Resumen financiero se insertará aquí por JS -->
      <div id="resumenFinancieroFlujoCaja"></div>
      <!-- Estadísticas principales -->
      <div class="stats-grid" id="estadisticasFlujoCaja">
        <!-- Se llenará dinámicamente -->
      </div>
      <!-- Filtros -->
      <div class="filters-section" id="filtrosFlujoCaja">
        <!-- Se llenará dinámicamente -->
      </div>
      <!-- Controles de vista -->
      <div class="view-controls">
        <div class="view-toggle">
          <button class="btn btn-ios ${currentView === 'detallado' ? 'primary' : 'secondary'}" 
                  data-view="detallado">
            <i class="bi bi-list-ul"></i> Detallado
          </button>
          <button class="btn btn-ios ${currentView === 'resumido' ? 'primary' : 'secondary'}" 
                  data-view="resumido">
            <i class="bi bi-calendar-week"></i> Resumido
          </button>
        </div>
      </div>
      <!-- Contenedor de movimientos -->
      <div class="movements-container" id="movimientosFlujoCaja">
        <!-- Se llenará dinámicamente -->
      </div>
      <!-- Paginación -->
      <div class="pagination-container" id="paginacionFlujoCaja">
        <!-- Se llenará dinámicamente -->
      </div>
    </div>
  `;
  
  // Asignar referencias a elementos
  estadisticasContainer = document.getElementById('estadisticasFlujoCaja');
  filtrosContainer = document.getElementById('filtrosFlujoCaja');
  movimientosContainer = document.getElementById('movimientosFlujoCaja');
  
  // Renderizar resumen financiero
  renderizarResumenFinanciero();
  // Renderizar secciones
  renderizarEstadisticas();
  renderizarFiltros();
  renderizarMovimientos();
}

// --- Renderizado de Secciones ---

async function renderizarResumenFinanciero() {
  const resumen = await DeudasService.obtenerResumenDeudas();
  const efectivoReal = CashFlowService.obtenerEstadisticasGenerales().saldoFinal - resumen.totalPendiente;
  let resumenDiv = document.getElementById('resumenFinancieroFlujoCaja');
  if (!resumenDiv) {
    resumenDiv = document.createElement('div');
    resumenDiv.id = 'resumenFinancieroFlujoCaja';
    resumenDiv.style.margin = '1.5em 0';
    resumenDiv.style.background = 'var(--ios-card-background)';
    resumenDiv.style.padding = '1em';
    resumenDiv.style.borderRadius = 'var(--ios-border-radius)';
    resumenDiv.style.boxShadow = 'var(--ios-shadow-sm)';
    const modulo = document.querySelector('.cash-flow-module');
    if (modulo) modulo.prepend(resumenDiv);
  }
  resumenDiv.innerHTML = `
    <b>Resumen Financiero:</b><br>
    Efectivo real: <span style='color:var(--ios-green)'>${resumen.totalPendiente >= 0 ? efectivoReal.toLocaleString('es-CO', {style:'currency',currency:'COP'}) : '-'}</span><br>
    Deuda pendiente: <span style='color:var(--ios-red)'>${resumen.totalPendiente.toLocaleString('es-CO', {style:'currency',currency:'COP'})}</span><br>
    Compras financiadas: <span style='color:var(--ios-blue)'>${resumen.totalComprasFinanciadas.toLocaleString('es-CO', {style:'currency',currency:'COP'})}</span>
  `;
}

function renderizarEstadisticas() {
  if (!estadisticasContainer) return;
  
  const movimientos = obtenerMovimientosFiltrados();
  const estadisticas = CashFlowService.calcularEstadisticas(movimientos);
  const saldoInicial = CashFlowService.calcularSaldoInicial(currentFilters.fechaInicio);
  
  estadisticasContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon success">
        <i class="bi bi-arrow-up-circle"></i>
      </div>
      <div class="stat-content">
        <h3>${formatCurrency(estadisticas.totalIngresos)}</h3>
        <p>Total Ingresos</p>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon danger">
        <i class="bi bi-arrow-down-circle"></i>
      </div>
      <div class="stat-content">
        <h3>${formatCurrency(estadisticas.totalEgresos)}</h3>
        <p>Total Egresos</p>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon ${estadisticas.saldoFinal >= 0 ? 'success' : 'danger'}">
        <i class="bi bi-cash-stack"></i>
      </div>
      <div class="stat-content">
        <h3>${formatCurrency(estadisticas.saldoFinal)}</h3>
        <p>Saldo Final</p>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon info">
        <i class="bi bi-graph-up"></i>
      </div>
      <div class="stat-content">
        <h3>${formatNumber(estadisticas.cantidadMovimientos)}</h3>
        <p>Movimientos</p>
      </div>
    </div>
    
    ${currentFilters.fechaInicio ? `
      <div class="stat-card">
        <div class="stat-icon warning">
          <i class="bi bi-calendar-check"></i>
        </div>
        <div class="stat-content">
          <h3>${formatCurrency(saldoInicial)}</h3>
          <p>Saldo Inicial</p>
        </div>
      </div>
    ` : ''}
  `;
}

function renderizarFiltros() {
  if (!filtrosContainer) return;
  
  const fechaHoy = new Date().toISOString().split('T')[0];
  const fechaHace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  filtrosContainer.innerHTML = `
    <div class="filters-row">
      <div class="filter-group">
        <label for="fechaInicioFlujoCaja" class="form-label">Fecha Inicio</label>
        <input type="date" class="form-control" id="fechaInicioFlujoCaja" 
               value="${currentFilters.fechaInicio || fechaHace7Dias}">
      </div>
      
      <div class="filter-group">
        <label for="fechaFinFlujoCaja" class="form-label">Fecha Fin</label>
        <input type="date" class="form-control" id="fechaFinFlujoCaja" 
               value="${currentFilters.fechaFin || fechaHoy}">
      </div>
      
      <div class="filter-actions">
        <button class="btn btn-ios secondary" id="btnLimpiarFiltrosFlujoCaja">
          <i class="bi bi-x-circle"></i> Limpiar
        </button>
        <button class="btn btn-ios primary" id="btnAplicarFiltrosFlujoCaja">
          <i class="bi bi-funnel"></i> Aplicar
        </button>
      </div>
    </div>
  `;
}

function renderizarMovimientos() {
  if (!movimientosContainer) return;
  
  const movimientos = obtenerMovimientosFiltrados();
  const saldoInicial = CashFlowService.calcularSaldoInicial(currentFilters.fechaInicio);
  const movimientosConSaldo = CashFlowService.calcularSaldoAcumulado(movimientos, saldoInicial);
  
  if (currentView === 'resumido') {
    renderizarVistaResumida(movimientosConSaldo);
  } else {
    renderizarVistaDetallada(movimientosConSaldo);
  }
  
  // Renderizar paginación
  renderizarPaginacion(movimientosConSaldo);
}

function renderizarVistaDetallada(movimientos) {
  if (movimientos.length === 0) {
    movimientosContainer.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-cash-stack"></i>
        <p>No hay movimientos en el período seleccionado</p>
      </div>
    `;
    return;
  }
  
  // Aplicar paginación
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const movimientosPaginados = movimientos.slice(startIndex, endIndex);
  const movimientosFormateados = movimientosPaginados.map(m => CashFlowService.formatearMovimiento(m));
  movimientosContainer.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Tipo</th>
            <th>Concepto</th>
            <th>Descripción</th>
            <th>Monto</th>
            <th>Saldo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${movimientosFormateados.map(m => `
            <tr class="movement-row ${m.tipoClase} ${m.concepto === 'Pago de deuda' ? 'pago-deuda' : ''}">
              <td data-label="Fecha">${m.fechaFormateada}</td>
              <td data-label="Hora">${m.horaFormateada}</td>
              <td data-label="Tipo">
                <span class="movement-type ${m.tipoClase}">
                  <i class="bi bi-${m.iconoTipo}"></i>
                  ${m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                </span>
              </td>
              <td data-label="Concepto">${m.concepto}</td>
              <td data-label="Descripción">${m.descripcion}</td>
              <td data-label="Monto" class="amount ${m.tipoClase}">
                ${m.tipo === 'ingreso' ? '+' : '-'}${m.montoFormateado}
              </td>
              <td data-label="Saldo" class="balance">
                ${m.saldoFormateado}
              </td>
              <td data-label="Acciones">
                ${m.tipo === 'egreso' && m.concepto === 'Compra' ? `<button class='btn btn-sm btn-primary btn-editar-egreso' data-id='${m.referencia}'>Editar</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  // Eventos para editar egreso
  movimientosContainer.querySelectorAll('.btn-editar-egreso').forEach(btn => {
    btn.addEventListener('click', () => mostrarModalEditarEgreso(btn.dataset.id));
  });
}

function renderizarVistaResumida(movimientos) {
  const gruposPorDia = CashFlowService.agruparMovimientosPorDia(movimientos);
  
  if (gruposPorDia.length === 0) {
    movimientosContainer.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-calendar-week"></i>
        <p>No hay movimientos en el período seleccionado</p>
      </div>
    `;
    return;
  }
  
  movimientosContainer.innerHTML = `
    <div class="daily-summary-grid">
      ${gruposPorDia.map(grupo => {
        const fechaFormateada = grupo.fechaObj.toLocaleDateString('es-CO', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        const saldoDia = grupo.ingresos - grupo.egresos;
        const saldoClase = saldoDia >= 0 ? 'success' : 'danger';
        
        return `
          <div class="daily-summary-card">
            <div class="summary-header">
              <h4>${fechaFormateada}</h4>
              <span class="day-balance ${saldoClase}">
                ${saldoDia >= 0 ? '+' : ''}${formatCurrency(saldoDia)}
              </span>
            </div>
            
            <div class="summary-stats">
              <div class="stat-item">
                <span class="stat-label">Ingresos:</span>
                <span class="stat-value success">${formatCurrency(grupo.ingresos)}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Egresos:</span>
                <span class="stat-value danger">${formatCurrency(grupo.egresos)}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Movimientos:</span>
                <span class="stat-value">${grupo.movimientos.length}</span>
              </div>
            </div>
            
            <div class="summary-details">
              <button class="btn btn-ios secondary btn-ver-detalles" 
                      data-fecha="${grupo.fecha}">
                <i class="bi bi-eye"></i> Ver Detalles
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// --- Funciones de Utilidad ---

function obtenerMovimientosFiltrados() {
  return CashFlowService.filtrarMovimientosPorFecha(
    currentFilters.fechaInicio,
    currentFilters.fechaFin
  );
}

function actualizarFiltros() {
  const fechaInicio = document.getElementById('fechaInicioFlujoCaja')?.value;
  const fechaFin = document.getElementById('fechaFinFlujoCaja')?.value;
  
  currentFilters = {
    fechaInicio: fechaInicio || null,
    fechaFin: fechaFin || null
  };
  
  renderizarEstadisticas();
  renderizarMovimientos();
}

// --- Configuración de Eventos ---

function configurarEventos() {
  // Botón recargar
  document.getElementById('btnRecargarFlujoCaja')?.addEventListener('click', async () => {

    try {
      await CashFlowService.recargarDatos();
      
    } catch (error) {
      console.error('❌ Error al recargar datos:', error);
    }
  });
  
  // Cambio de vista
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.target.closest('[data-view]').dataset.view;
      cambiarVista(view);
    });
  });
  
  // Filtros
  document.getElementById('btnAplicarFiltrosFlujoCaja')?.addEventListener('click', actualizarFiltros);
  
  document.getElementById('btnLimpiarFiltrosFlujoCaja')?.addEventListener('click', () => {
    const fechaHoy = new Date().toISOString().split('T')[0];
    const fechaHace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    document.getElementById('fechaInicioFlujoCaja').value = fechaHace7Dias;
    document.getElementById('fechaFinFlujoCaja').value = fechaHoy;
    
    currentFilters = {
      fechaInicio: fechaHace7Dias,
      fechaFin: fechaHoy
    };
    
    actualizarFiltros();
  });
  
  // Ver detalles de día específico
  document.addEventListener('click', (e) => {
    const btnDetalles = e.target.closest('.btn-ver-detalles');
    if (btnDetalles) {
      const fecha = btnDetalles.dataset.fecha;
      mostrarDetallesDia(fecha);
    }
  });
  
  // Configurar eventos de exportación
  configurarEventosExportacion();
}

function cambiarVista(view) {
  currentView = view;
  
  // Actualizar botones
  document.querySelectorAll('[data-view]').forEach(btn => {
    const btnView = btn.dataset.view;
    btn.className = `btn btn-ios ${btnView === view ? 'primary' : 'secondary'}`;
  });
  
  renderizarMovimientos();
}

function mostrarDetallesDia(fecha) {
  const movimientos = obtenerMovimientosFiltrados();
  const movimientosDia = movimientos.filter(m => 
    m.fecha.toISOString().split('T')[0] === fecha
  );
  
  if (movimientosDia.length === 0) {
    alert('No hay movimientos para este día');
    return;
  }
  
  const fechaFormateada = new Date(fecha).toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const movimientosFormateados = movimientosDia.map(m => CashFlowService.formatearMovimiento(m));
  
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = `
    <div class="modal modal-large modal-info modal-scale">
      <div class="modal-header">
        <i class="bi bi-calendar-day modal-icon info"></i>
        <div class="modal-header-content">
          <h3 class="modal-title">Detalles del ${fechaFormateada}</h3>
          <p>${movimientosDia.length} movimientos</p>
        </div>
        <button class="modal-close" data-action="close"><i class="bi bi-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Concepto</th>
                <th>Descripción</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              ${movimientosFormateados.map(m => `
                <tr class="movement-row ${m.tipoClase}">
                  <td data-label="Hora">${m.horaFormateada}</td>
                  <td data-label="Tipo">
                    <span class="movement-type ${m.tipoClase}">
                      <i class="bi bi-${m.iconoTipo}"></i>
                      ${m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                    </span>
                  </td>
                  <td data-label="Concepto">${m.concepto}</td>
                  <td data-label="Descripción">${m.descripcion}</td>
                  <td data-label="Monto" class="amount ${m.tipoClase}">
                    ${m.tipo === 'ingreso' ? '+' : '-'}${m.montoFormateado}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ios primary" data-action="close">Cerrar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  requestAnimationFrame(() => {
    modalOverlay.classList.add('show');
  });
  
  const closeModal = () => {
    modalOverlay.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(modalOverlay);
    }, 300);
  };
  
  modalOverlay.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close' || e.target === modalOverlay) {
      closeModal();
    }
  });
  
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      document.removeEventListener('keydown', handleKeydown);
    }
  };
  document.addEventListener('keydown', handleKeydown);
}

// --- Suscripción a Cambios ---

function suscribirseACambios() {
  
  CashFlowService.suscribirseACambios((datos) => {
    
    currentPage = 1; // Resetear a primera página
    renderizarEstadisticas();
    renderizarMovimientos();
  });
}

// --- Funciones de Paginación ---

function renderizarPaginacion(movimientos) {
  const paginacionContainer = document.getElementById('paginacionFlujoCaja');
  if (!paginacionContainer) return;
  
  const totalPages = Math.ceil(movimientos.length / itemsPerPage);
  
  if (totalPages <= 1) {
    paginacionContainer.style.display = 'none';
    return;
  }
  
  paginacionContainer.style.display = 'flex';
  paginacionContainer.innerHTML = '';
  
  // Botón Anterior
  const btnAnterior = document.createElement('button');
  btnAnterior.className = `btn btn-ios secondary ${currentPage === 1 ? 'disabled' : ''}`;
  btnAnterior.innerHTML = '<i class="bi bi-chevron-left"></i> Anterior';
  btnAnterior.onclick = () => cambiarPagina(currentPage - 1);
  if (currentPage === 1) btnAnterior.disabled = true;
  paginacionContainer.appendChild(btnAnterior);
  
  // Números de página
  const paginasContainer = document.createElement('div');
  paginasContainer.className = 'pagination-numbers';
  
  for (let i = 1; i <= totalPages; i++) {
    const btnPagina = document.createElement('button');
    btnPagina.className = `btn btn-ios ${i === currentPage ? 'primary' : 'secondary'}`;
    btnPagina.textContent = i;
    btnPagina.onclick = () => cambiarPagina(i);
    paginasContainer.appendChild(btnPagina);
  }
  
  paginacionContainer.appendChild(paginasContainer);
  
  // Botón Siguiente
  const btnSiguiente = document.createElement('button');
  btnSiguiente.className = `btn btn-ios secondary ${currentPage === totalPages ? 'disabled' : ''}`;
  btnSiguiente.innerHTML = 'Siguiente <i class="bi bi-chevron-right"></i>';
  btnSiguiente.onclick = () => cambiarPagina(currentPage + 1);
  if (currentPage === totalPages) btnSiguiente.disabled = true;
  paginacionContainer.appendChild(btnSiguiente);
  
  // Información de página
  const infoPagina = document.createElement('div');
  infoPagina.className = 'pagination-info';
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, movimientos.length);
  infoPagina.textContent = `Mostrando ${startIndex}-${endIndex} de ${movimientos.length} movimientos`;
  paginacionContainer.appendChild(infoPagina);
}

function cambiarPagina(nuevaPagina) {
  const movimientos = obtenerMovimientosFiltrados();
  const totalPages = Math.ceil(movimientos.length / itemsPerPage);
  
  if (nuevaPagina >= 1 && nuevaPagina <= totalPages) {
    currentPage = nuevaPagina;
    renderizarMovimientos();
  }
}

// --- Funciones de Exportación ---

function exportarCSV() {
  const movimientos = obtenerMovimientosFiltrados();
  
  try {
    if (!movimientos || !Array.isArray(movimientos)) {
      console.error('❌ Error: movimientos no es un array válido:', movimientos);
      mostrarNotificacion('Error: No se pudieron obtener los movimientos', 'danger');
      return;
    }
    
    const estadisticas = CashFlowService.calcularEstadisticas(movimientos);
    
    // Validar que hay movimientos para exportar
    if (movimientos.length === 0) {
      mostrarNotificacion('No hay movimientos para exportar', 'warning');
      return;
    }
    
    // Crear contenido CSV
    const headers = [
      'Fecha',
      'Hora',
      'Tipo',
      'Concepto',
      'Descripción',
      'Monto',
      'Saldo Acumulado'
    ];
    
    const rows = movimientos.map((movimiento, index) => {
      // Validar que el movimiento tiene las propiedades necesarias
      if (!movimiento || !movimiento.fecha) {
        console.error(`❌ Movimiento ${index + 1} inválido:`, movimiento);
        return [
          'Fecha inválida',
          'Hora inválida',
          'Tipo inválido',
          'Concepto inválido',
          'Descripción inválida',
          '0.00',
          '0.00'
        ];
      }
      
      const fecha = new Date(movimiento.fecha).toLocaleDateString('es-CO');
      const hora = new Date(movimiento.fecha).toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const tipo = movimiento.tipo === 'ingreso' ? 'Ingreso' : 'Egreso';
      const monto = movimiento.tipo === 'ingreso' ? (movimiento.monto || 0) : -(movimiento.monto || 0);
      const saldoAcumulado = movimiento.saldoAcumulado || 0;
      
      return [
        fecha,
        hora,
        tipo,
        movimiento.concepto || '',
        movimiento.descripcion || '',
        monto.toFixed(2),
        saldoAcumulado.toFixed(2)
      ];
    });
    
    // Agregar resumen al final
    rows.push([]); // Línea vacía
    rows.push(['RESUMEN', '', '', '', '', '', '']);
    rows.push(['Total Ingresos', '', '', '', '', (estadisticas.totalIngresos || 0).toFixed(2), '']);
    rows.push(['Total Egresos', '', '', '', '', (estadisticas.totalEgresos || 0).toFixed(2), '']);
    rows.push(['Saldo Final', '', '', '', '', (estadisticas.saldoFinal || 0).toFixed(2), '']);
    rows.push(['Cantidad Movimientos', '', '', '', '', (estadisticas.cantidadMovimientos || 0).toString(), '']);
    
    // Generar CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Descargar archivo
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const fechaExportacion = new Date().toISOString().split('T')[0];
    const nombreArchivo = `flujo_caja_${fechaExportacion}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', nombreArchivo);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    mostrarNotificacion('CSV exportado correctamente', 'success');
    
  } catch (error) {
    console.error('❌ Error al exportar CSV:', error);
    mostrarNotificacion(`Error al exportar CSV: ${error.message}`, 'danger');
  }
}

function exportarPDF() {
  const movimientos = obtenerMovimientosFiltrados();
  const estadisticas = CashFlowService.calcularEstadisticas(movimientos);
  
  try {
    // Validar que hay movimientos para exportar
    if (!movimientos || movimientos.length === 0) {
      mostrarNotificacion('No hay movimientos para exportar', 'warning');
      return;
    }
    
    // Crear contenido HTML para el PDF
    const fechaExportacion = new Date().toLocaleDateString('es-CO');
    const rangoFechas = currentFilters.fechaInicio && currentFilters.fechaFin 
      ? `${new Date(currentFilters.fechaInicio).toLocaleDateString('es-CO')} - ${new Date(currentFilters.fechaFin).toLocaleDateString('es-CO')}`
      : 'Todos los movimientos';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Flujo de Caja - Distribuciones ROCA</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #007aff;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #007aff;
            margin: 0;
          }
          .header p {
            margin: 5px 0;
            color: #666;
          }
          .stats {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            flex-wrap: wrap;
          }
          .stat-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            min-width: 150px;
            margin: 5px;
          }
          .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #007aff;
          }
          .stat-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          .table th, .table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            font-size: 12px;
          }
          .table th {
            background-color: #f8f9fa;
            font-weight: bold;
          }
          .ingreso {
            color: #28a745;
          }
          .egreso {
            color: #dc3545;
          }
          .summary {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          .summary h3 {
            margin-top: 0;
            color: #007aff;
          }
          .page-break {
            page-break-before: always;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Flujo de Caja</h1>
          <p>Distribuciones ROCA</p>
          <p>Fecha de exportación: ${fechaExportacion}</p>
          <p>Período: ${rangoFechas}</p>
        </div>
        
        <div class="stats">
          <div class="stat-item">
            <div class="stat-value">${formatCurrency(estadisticas.totalIngresos || 0)}</div>
            <div class="stat-label">Total Ingresos</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${formatCurrency(estadisticas.totalEgresos || 0)}</div>
            <div class="stat-label">Total Egresos</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${formatCurrency(estadisticas.saldoFinal || 0)}</div>
            <div class="stat-label">Saldo Final</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${estadisticas.cantidadMovimientos || 0}</div>
            <div class="stat-label">Movimientos</div>
          </div>
        </div>
        
        <table class="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Tipo</th>
              <th>Concepto</th>
              <th>Descripción</th>
              <th>Monto</th>
              <th>Saldo Acumulado</th>
            </tr>
          </thead>
          <tbody>
            ${movimientos.map(movimiento => {
              const fecha = new Date(movimiento.fecha).toLocaleDateString('es-CO');
              const hora = new Date(movimiento.fecha).toLocaleTimeString('es-CO', {
                hour: '2-digit',
                minute: '2-digit'
              });
              const tipo = movimiento.tipo === 'ingreso' ? 'Ingreso' : 'Egreso';
              const monto = movimiento.tipo === 'ingreso' ? (movimiento.monto || 0) : -(movimiento.monto || 0);
              const claseMonto = movimiento.tipo === 'ingreso' ? 'ingreso' : 'egreso';
              const saldoAcumulado = movimiento.saldoAcumulado || 0;
              
              return `
                <tr>
                  <td>${fecha}</td>
                  <td>${hora}</td>
                  <td>${tipo}</td>
                  <td>${movimiento.concepto || ''}</td>
                  <td>${movimiento.descripcion || ''}</td>
                  <td class="${claseMonto}">${monto >= 0 ? '+' : ''}${formatCurrency(monto)}</td>
                  <td>${formatCurrency(saldoAcumulado)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        
        <div class="summary">
          <h3>Resumen del Período</h3>
          <p><strong>Total Ingresos:</strong> ${formatCurrency(estadisticas.totalIngresos || 0)}</p>
          <p><strong>Total Egresos:</strong> ${formatCurrency(estadisticas.totalEgresos || 0)}</p>
          <p><strong>Saldo Final:</strong> ${formatCurrency(estadisticas.saldoFinal || 0)}</p>
          <p><strong>Cantidad de Movimientos:</strong> ${estadisticas.cantidadMovimientos || 0}</p>
          <p><strong>Fecha de Implementación:</strong> 2 de julio de 2025</p>
        </div>
      </body>
      </html>
    `;
    
    // Crear ventana para imprimir
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Esperar a que se cargue el contenido
    printWindow.onload = function() {
      printWindow.print();
      printWindow.close();
    };
    
    mostrarNotificacion('PDF generado correctamente', 'success');
    
  } catch (error) {
    console.error('❌ Error al exportar PDF:', error);
    mostrarNotificacion(`Error al exportar PDF: ${error.message}`, 'danger');
  }
}

function mostrarNotificacion(mensaje, tipo = 'info') {
  // Usar el sistema de notificaciones existente si está disponible
  if (window.showToast) {
    window.showToast(mensaje, tipo, { duration: 3000 });
  } else {
    // Fallback: alert simple
    alert(mensaje);
  }
}

// --- Configuración de Eventos de Exportación ---

function configurarEventosExportacion() {
  const btnExportarCSV = document.getElementById('btnExportarCSV');
  const btnExportarPDF = document.getElementById('btnExportarPDF');
  
  if (btnExportarCSV) {
    btnExportarCSV.addEventListener('click', exportarCSV);
  }
  
  if (btnExportarPDF) {
    btnExportarPDF.addEventListener('click', exportarPDF);
  }
}

async function mostrarModalEditarEgreso(compraId) {
  // Obtener la compra original
  const compra = await CashFlowService.obtenerCompraPorId(compraId);
  if (!compra) return alert('Compra no encontrada');
  // Obtener deudas pendientes
  const deudas = await DeudasService.obtenerDeudas();
  const deudasPendientes = deudas.filter(d => d.estado === 'pendiente');
  // Estado multistep
  let step = 1;
  const totalSteps = 2;
  let formData = {
    financiada: !!compra.financiada,
    deudaId: compra.deudaId || '',
    montoFinanciado: compra.montoFinanciado || '',
  };
  function renderStep() {
    const modal = document.querySelector('.modal-overlay') || document.createElement('div');
    modal.className = 'modal-overlay show';
    modal.innerHTML = `
      <div class="modal modal-scale">
        <div class="modal-header">
          <h3>Editar Egreso (Compra)</h3>
          <button class="modal-close" id="cerrarModalEditarEgreso">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-stepper">
            ${[1,2].map(n => `<div class="form-step${step===n? ' active' : step>n? ' completed':''}">${n}</div>`).join('')}
          </div>
          <form id="formEditarEgresoMultistep">
            <div class="modal-section">
              <div class="form-group">
                <label>Producto:</label>
                <div class="input-group">
                  <i class="bi bi-box ios-input-icon"></i>
                  <input type="text" name="producto" value="${compra.producto || ''}" readonly>
                </div>
              </div>
              <div class="form-group">
                <label>Proveedor:</label>
                <div class="input-group">
                  <i class="bi bi-person-badge ios-input-icon"></i>
                  <input type="text" name="proveedor" value="${compra.proveedor || ''}" readonly>
                </div>
              </div>
              <div class="form-group">
                <label>Valor Total:</label>
                <div class="input-group">
                  <i class="bi bi-cash-coin ios-input-icon"></i>
                  <input type="number" name="valorTotal" value="${compra.valorTotal || 0}" readonly>
                </div>
              </div>
            </div>
            <div class="modal-section" style="border-top:1.5px solid var(--ios-border-color); margin-top:1.2em; padding-top:1.2em;">
              ${step === 1 ? `
                <div class="form-group">
                  <label class="ios-label"><input type="checkbox" id="compraFinanciadaEdit" name="financiada" class="ios-checkbox" ${formData.financiada ? 'checked' : ''}> Compra financiada</label>
                </div>
                <div id="financiamientoFields" style="display:${formData.financiada ? '' : 'none'};margin-top:0.5em;">
                  <div class="form-group">
                    <label>Deuda asociada:</label>
                    <div class="input-group">
                      <i class="bi bi-bank ios-input-icon"></i>
                      <select id="deudaAsociadaEdit" name="deudaId">
                        <option value="">Selecciona una deuda</option>
                        ${deudasPendientes.map(d => `<option value="${d.id}" ${formData.deudaId === d.id ? 'selected' : ''}>${d.prestamista} (${d.montoPendiente} pendientes)</option>`).join('')}
                      </select>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Monto financiado:</label>
                    <div class="input-group">
                      <i class="bi bi-currency-dollar ios-input-icon"></i>
                      <input type="number" id="montoFinanciadoEdit" name="montoFinanciado" min="0" max="${compra.valorTotal || 0}" value="${formData.montoFinanciado}">
                    </div>
                  </div>
                </div>
              ` : ''}
              ${step === 2 ? `
                <div class="form-group">
                  <b>Confirma los cambios:</b>
                  <ul style="margin-top:0.7em;">
                    <li><b>Compra financiada:</b> ${formData.financiada ? 'Sí' : 'No'}</li>
                    <li><b>Deuda asociada:</b> ${formData.deudaId ? deudasPendientes.find(d => d.id === formData.deudaId)?.prestamista : '-'}</li>
                    <li><b>Monto financiado:</b> ${formData.montoFinanciado || '-'}</li>
                  </ul>
                </div>
              ` : ''}
            </div>
          </form>
        </div>
        <div class="modal-footer" style="display:flex;gap:1em;justify-content:${step>1?'space-between':'flex-end'};">
          ${step > 1 ? `<button class="btn btn-ios secondary" id="btnAnteriorStepEditEgreso" title="Anterior"><i class="bi bi-arrow-left"></i></button>` : ''}
          ${step < totalSteps ? `<button class="btn btn-ios primary" id="btnSiguienteStepEditEgreso" title="Siguiente"><i class="bi bi-arrow-right"></i></button>` : `<button class="btn btn-ios primary" id="btnFinalizarStepEditEgreso"><i class="bi bi-check-circle"></i></button>`}
        </div>
      </div>
    `;
    if (!document.body.contains(modal)) document.body.appendChild(modal);
    // Mostrar/ocultar campos de financiamiento
    setTimeout(() => {
      const chk = modal.querySelector('#compraFinanciadaEdit');
      const fields = modal.querySelector('#financiamientoFields');
      if (chk && fields) {
        chk.onchange = () => {
          fields.style.display = chk.checked ? '' : 'none';
        };
      }
    }, 100);
    // Cerrar modal
    modal.querySelector('#cerrarModalEditarEgreso').onclick = () => closeModal();
    if (step > 1) modal.querySelector('#btnAnteriorStepEditEgreso').onclick = () => { step--; renderStep(); };
    if (step < totalSteps) {
      modal.querySelector('#btnSiguienteStepEditEgreso').onclick = e => {
        e.preventDefault();
        const chk = modal.querySelector('#compraFinanciadaEdit');
        formData.financiada = chk.checked;
        if (formData.financiada) {
          formData.deudaId = modal.querySelector('#deudaAsociadaEdit').value;
          formData.montoFinanciado = modal.querySelector('#montoFinanciadoEdit').value;
        } else {
          formData.deudaId = '';
          formData.montoFinanciado = '';
        }
        step++;
        renderStep();
      };
    }
    if (step === totalSteps) {
      modal.querySelector('#btnFinalizarStepEditEgreso').onclick = async e => {
        e.preventDefault();
        await CashFlowService.actualizarCompraFinanciamiento(compraId, {
          financiada: formData.financiada,
          deudaId: formData.deudaId,
          montoFinanciado: parseFloat(formData.montoFinanciado) || 0
        });
        closeModal();
      };
    }
    function closeModal() {
      modal.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(modal)) document.body.removeChild(modal);
      }, 300);
    }
    // Cerrar con click fuera
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
    // Cerrar con escape
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  }
  renderStep();
}

// --- Exportar funciones principales ---
export {
  inicializarComponente as init,
  renderizarEstadisticas as renderStats,
  renderizarMovimientos as renderMovements,
  actualizarFiltros as updateFilters
}; 