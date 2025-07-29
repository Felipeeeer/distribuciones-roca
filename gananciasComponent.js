// Componente de Ganancias
// Aquí irá el renderizado de tablas, tarjetas, formularios y modales de ganancias

import { formatCurrency, formatNumber } from '../utils/formatters.js';
import { 
  calcularGananciaTotal, 
  detectarDispositivoMovil, 
  crearSeccionGanancias,
  formatearFecha,
  formatearMoneda,
  obtenerRetirosPorProducto,
  validarRetiroGanancia
} from '../utils/gananciasUtils.js';
import * as CashFlowService from '../services/cashFlowService.js';

let currentPage = 1;
const itemsPerPage = 5;

export function renderGanancias(gananciasCache, productosCache = []) {
  let container = document.getElementById('gananciasProductosContainer');
  if (!container) {
    container = crearSeccionGanancias();
  }
  if (!container) return;

  // --- Resumen superior ---
  const productosGanancias = Object.values(gananciasCache);
  const gananciaTotal = productosGanancias.reduce((sum, p) => sum + calcularGananciaTotal(p), 0);
  const productosConGanancias = productosGanancias.filter(p => calcularGananciaTotal(p) > 0).length;
  container.innerHTML = `
    <div class="ganancias-resumen-ios">
      <div><i class="bi bi-cash-coin"></i> <b>Ganancia total acumulada:</b> <span style="color:var(--ios-green)">${formatCurrency(gananciaTotal)}</span></div>
      <div><i class="bi bi-box"></i> <b>Productos con ganancias:</b> ${productosConGanancias}</div>
    </div>
    <div id="gananciasListadoContainer"></div>
    <div id="gananciasPaginacionContainer"></div>
  `;

  // --- Paginación ---
  const listadoContainer = document.getElementById('gananciasListadoContainer');
  const paginacionContainer = document.getElementById('gananciasPaginacionContainer');
  const totalPages = Math.ceil(productosGanancias.length / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const productosPagina = productosGanancias.slice(startIndex, endIndex);

  // --- Listado con barra de progreso ---
  listadoContainer.innerHTML = productosPagina.length === 0 ? `<div class='empty-state'><i class='bi bi-cash-coin'></i><p>No hay ganancias registradas aún.</p></div>` :
    `<div class="ganancias-cards-grid">
      ${productosPagina.map(p => {
        const producto = productosCache.find(prod => prod.id === p.id) || {};
        const precioCompra = producto.precioCompra || 1;
        const gananciaAcumulada = calcularGananciaTotal(p);
        const porcentaje = Math.min(100, (gananciaAcumulada / precioCompra) * 100);
        const recompras = Math.floor(gananciaAcumulada / precioCompra);
        return `
          <div class="ganancia-card-glass">
            <div class="ganancia-card-title">${p.nombre}</div>
            <div class="ganancia-card-row"><span class="ganancia-badge blue"><i class="bi bi-person"></i> Cliente</span> <span>${formatearMoneda(p.gananciaCliente)}</span></div>
            <div class="ganancia-card-row"><span class="ganancia-badge purple"><i class="bi bi-people"></i> Distribuidor</span> <span>${formatearMoneda(p.gananciaDistribuidor)}</span></div>
            <div class="ganancia-card-row"><span class="ganancia-badge green"><i class="bi bi-cash-coin"></i> Total</span> <span class="ganancia-card-total">${formatearMoneda(gananciaAcumulada)}</span></div>
            <div class="ganancia-progreso-container">
              <div class="ganancia-progreso-bar" style="width:${porcentaje}%; background: linear-gradient(90deg, var(--ios-green) 60%, var(--ios-blue) 100%);"></div>
              <div class="ganancia-progreso-text">${porcentaje.toFixed(2)}% para reinversión (${formatearMoneda(gananciaAcumulada)} / ${formatearMoneda(precioCompra)})</div>
            </div>
            ${recompras > 0 ? `<div class="ganancia-recompras">Puedes recomprar <b>${recompras}</b> unidad${recompras > 1 ? 'es' : ''} <button class="btn btn-ios primary btn-reinvertir-ganancia" data-producto-id="${p.id}" data-recompras="${recompras}"><i class="bi bi-arrow-repeat"></i> Reinvertir</button></div>` : ''}
            <div class="ganancia-card-actions">
              <button class="btn btn-ios primary btn-retirar-ganancia" data-producto-id="${p.id || ''}" data-producto-nombre="${p.nombre}"><i class="bi bi-cash-coin"></i> Retirar</button>
              <button class="btn btn-ios info btn-ver-ganancias" data-producto-id="${p.id || ''}" data-producto-nombre="${p.nombre}"><i class="bi bi-eye"></i> Ver</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>`;

  // --- Paginación UI ---
  paginacionContainer.innerHTML = totalPages > 1 ? `
    <div class="pagination-container">
      <button class="btn btn-ios secondary" ${currentPage === 1 ? 'disabled' : ''} id="gananciasPagPrev">&lt;</button>
      <span class="pagination-info">Página ${currentPage} de ${totalPages}</span>
      <button class="btn btn-ios secondary" ${currentPage === totalPages ? 'disabled' : ''} id="gananciasPagNext">&gt;</button>
    </div>
  ` : '';
  if (totalPages > 1) {
    document.getElementById('gananciasPagPrev').onclick = () => { currentPage--; renderGanancias(gananciasCache, productosCache); };
    document.getElementById('gananciasPagNext').onclick = () => { currentPage++; renderGanancias(gananciasCache, productosCache); };
  }

  // --- Reinvertir ganancias ---
  listadoContainer.querySelectorAll('.btn-reinvertir-ganancia').forEach(btn => {
    btn.onclick = async () => {
      const productoId = btn.dataset.productoId;
      const producto = productosCache.find(p => p.id === productoId);
      const precioCompra = producto.precioCompra || 1;
      const pGanancia = gananciasCache[productoId];
      const gananciaAcumulada = calcularGananciaTotal(pGanancia);
      const recompras = Math.floor(gananciaAcumulada / precioCompra);
      if (recompras > 0) {
        // Descontar la ganancia usada para la recompra
        const nuevaGanancia = {
          ...pGanancia,
          gananciaCliente: Math.max(0, (pGanancia.gananciaCliente || 0) - (precioCompra * recompras)),
          gananciaDistribuidor: Math.max(0, (pGanancia.gananciaDistribuidor || 0) - Math.max(0, precioCompra * recompras - (pGanancia.gananciaCliente || 0)))
        };
        // Actualizar en base de datos
        await import('../services/gananciasService.js').then(m => m.actualizarGanancia(productoId, nuevaGanancia));
        // Actualizar flujo de caja
        await CashFlowService.recargarDatos();
        renderGanancias(gananciasCache, productosCache);
      }
    };
  });
}

export function mostrarModalRetiroGanancia(productoId, productoNombre, ganancia, onRetirar) {
  const saldoDisponible = calcularGananciaTotal(ganancia);
  // Estado multistep
  let step = 1;
  const totalSteps = 2;
  let formData = {
    monto: '',
    motivo: ''
  };
  function renderStep() {
    const modalOverlay = document.querySelector('.modal-overlay') || document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = `
      <div class="modal modal-large modal-info modal-scale">
        <div class="modal-header">
          <i class="bi bi-cash-coin modal-icon info"></i>
          <div class="modal-header-content">
            <h3 class="modal-title">Retirar Ganancia</h3>
            <p>Producto: <strong>${productoNombre}</strong></p>
            <p>Saldo disponible: <strong style='color:var(--ios-green)'>${formatearMoneda(saldoDisponible)}</strong></p>
          </div>
          <button class="modal-close" data-action="close"><i class="bi bi-x"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-stepper">
            ${[1,2].map(n => `<div class="form-step${step===n? ' active' : step>n? ' completed':''}">${n}</div>`).join('')}
          </div>
          <form id="formRetiroGananciaMultistep" class="retiro-form">
            ${step === 1 ? `
              <div class="form-group">
                <label for="montoRetiro" class="form-label">Monto a retirar</label>
                <input type="number" class="form-control" id="montoRetiro" name="monto" min="1" max="${saldoDisponible}" step="0.01" required placeholder="Monto en $" value="${formData.monto}">
              </div>
              <div class="form-group">
                <label for="motivoRetiro" class="form-label">Motivo</label>
                <input type="text" class="form-control" id="motivoRetiro" name="motivo" maxlength="100" placeholder="Motivo del retiro (opcional)" value="${formData.motivo}">
              </div>
            ` : ''}
            ${step === 2 ? `
              <div class="form-group">
                <b>Confirma el retiro:</b>
                <ul style="margin-top:0.7em;">
                  <li><b>Monto:</b> ${formData.monto}</li>
                  <li><b>Motivo:</b> ${formData.motivo || '-'}</li>
                </ul>
              </div>
            ` : ''}
          </form>
        </div>
        <div class="modal-footer" style="display:flex;gap:1em;justify-content:${step>1?'space-between':'flex-end'};">
          ${step > 1 ? `<button class="btn btn-ios secondary" id="btnAnteriorStepRetiro" title="Anterior"><i class="bi bi-arrow-left"></i></button>` : ''}
          ${step < totalSteps ? `<button class="btn btn-ios primary" id="btnSiguienteStepRetiro" title="Siguiente"><i class="bi bi-arrow-right"></i></button>` : `<button class="btn btn-ios primary" id="btnFinalizarStepRetiro"><i class="bi bi-check-circle"></i></button>`}
        </div>
      </div>
    `;
    if (!document.body.contains(modalOverlay)) document.body.appendChild(modalOverlay);
    requestAnimationFrame(() => {
      modalOverlay.classList.add('show');
    });
    document.querySelector('.modal-close').onclick = () => closeModal();
    if (step > 1) document.getElementById('btnAnteriorStepRetiro').onclick = () => { step--; renderStep(); };
    if (step < totalSteps) {
      document.getElementById('btnSiguienteStepRetiro').onclick = e => {
        e.preventDefault();
        const form = document.getElementById('formRetiroGananciaMultistep');
        if (step === 1) {
          const monto = form.monto.value.trim();
          if (!monto || isNaN(monto) || parseFloat(monto) < 1 || parseFloat(monto) > saldoDisponible) {
            form.monto.classList.add('error');
            return;
          }
          formData.monto = monto;
          formData.motivo = form.motivo.value.trim();
        }
        step++;
        renderStep();
      };
    }
    if (step === totalSteps) {
      document.getElementById('btnFinalizarStepRetiro').onclick = async e => {
        e.preventDefault();
        try {
          validarRetiroGanancia(parseFloat(formData.monto), saldoDisponible);
          const resultado = await onRetirar(productoId, parseFloat(formData.monto), formData.motivo);
          closeModal();
          return resultado;
        } catch (err) {
          // El error será manejado por la función onRetirar
        }
        closeModal();
      };
    }
    function closeModal() {
      modalOverlay.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(modalOverlay)) document.body.removeChild(modalOverlay);
      }, 300);
    }
    // Cerrar con click fuera
    modalOverlay.onclick = (e) => {
      if (e.target === modalOverlay) closeModal();
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
  return new Promise((resolve) => {
    renderStep();
  });
}

export function mostrarModalDetalleGanancias(productoId, productoNombre, ganancia, retiros) {
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = `
    <div class="modal modal-large modal-info modal-scale">
      <div class="modal-header">
        <i class="bi bi-eye modal-icon info"></i>
        <div class="modal-header-content">
          <h3 class="modal-title">Detalle de Ganancias</h3>
          <p>Producto: <strong>${productoNombre}</strong></p>
        </div>
        <button class="modal-close" data-action="close"><i class="bi bi-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="ganancias-detalle">
          <div class="detalle-item">
            <span class="detalle-label">Ganancia Cliente:</span>
            <span class="detalle-value">${formatearMoneda(ganancia.gananciaCliente)}</span>
          </div>
          <div class="detalle-item">
            <span class="detalle-label">Ganancia Distribuidor:</span>
            <span class="detalle-value">${formatearMoneda(ganancia.gananciaDistribuidor)}</span>
          </div>
          <div class="detalle-item">
            <span class="detalle-label">Ganancia Total:</span>
            <span class="detalle-value"><strong>${formatearMoneda(calcularGananciaTotal(ganancia))}</strong></span>
          </div>
        </div>
        <hr/>
        <h4 style='margin-top:1em;'>Historial de Retiros</h4>
        ${retiros.length === 0 ? `<div class='empty-state'><i class='bi bi-cash'></i> <p>No hay retiros registrados para este producto.</p></div>` : `
          <div class='table-container'>
            <table class='data-table'>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                ${retiros.map(r => `
                  <tr>
                    <td data-label="Fecha">${formatearFecha(r.fecha)}</td>
                    <td data-label="Monto">${formatearMoneda(r.monto)}</td>
                    <td data-label="Motivo">${r.motivo || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
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

  return new Promise((resolve) => {
    const closeModal = () => {
      modalOverlay.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
      }, 300);
    };
    modalOverlay.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'close') {
        closeModal();
        resolve(false);
      }
    });
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        resolve(false);
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  });
}