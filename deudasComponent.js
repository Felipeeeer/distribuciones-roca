import * as DeudasService from '../services/deudasService.js';
import * as DeudasUtils from '../utils/deudasUtils.js';

let deudas = [];
let container = null;

export function inicializarComponente(containerId) {
  container = document.getElementById(containerId);
  if (!container) return;
  DeudasService.suscribirseACambios(datos => {
    deudas = datos;
    renderizarDeudas();
  });
  renderizarDeudas();
}

function renderizarDeudas() {
  if (!container) return;
  container.innerHTML = `
    <div class="deudas-module">
      <div class="module-header">
        <h2><i class="bi bi-cash"></i> Gestión de Deudas</h2>
        <button class="btn btn-primary" id="btnNuevaDeuda"><i class="bi bi-plus-circle"></i> Nueva Deuda</button>
      </div>
      <div class="deudas-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Prestamista</th>
              <th>Monto Original</th>
              <th>Pendiente</th>
              <th>Estado</th>
              <th>Compras Financiadas</th>
              <th>Pagos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${deudas.length === 0 ? `<tr><td colspan="7">No hay deudas registradas</td></tr>` :
              deudas.map(d => `
                <tr>
                  <td>${d.prestamista || '-'}</td>
                  <td>${DeudasUtils.formatearMonto(d.montoOriginal)}</td>
                  <td>${DeudasUtils.formatearMonto(d.montoPendiente)}</td>
                  <td><span class="badge ${d.estado === 'pendiente' ? 'danger' : 'success'}">${d.estado}</span></td>
                  <td>
                    ${d.comprasFinanciadas && d.comprasFinanciadas.length > 0 ?
                      `<button class='btn btn-sm btn-info btn-ver-compras' data-id='${d.id}'>Ver (${d.comprasFinanciadas.length})</button>` :
                      '0'}
                  </td>
                  <td>${d.pagos?.length || 0}</td>
                  <td>
                    <button class="btn btn-sm btn-success btn-pagar-deuda" data-id="${d.id}"><i class="bi bi-cash-coin"></i> Pagar</button>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
      <div id="modalDeuda"></div>
    </div>
  `;
  document.getElementById('btnNuevaDeuda')?.addEventListener('click', mostrarModalNuevaDeuda);
  container.querySelectorAll('.btn-pagar-deuda').forEach(btn => {
    btn.addEventListener('click', () => mostrarModalPagoDeuda(btn.dataset.id));
  });
  container.querySelectorAll('.btn-ver-compras').forEach(btn => {
    btn.addEventListener('click', () => mostrarModalComprasFinanciadas(btn.dataset.id));
  });
}

function mostrarModalNuevaDeuda() {
  const modal = document.getElementById('modalDeuda');
  if (!modal) return;
  // Estado del formulario multistep
  let step = 1;
  const totalSteps = 3;
  let formData = {
    prestamista: '',
    montoOriginal: '',
    tipo: '',
    observaciones: '',
    paraCompras: false
  };
  function renderStep() {
    modal.innerHTML = `
      <div class="modal-overlay show">
        <div class="modal modal-scale">
          <div class="modal-header">
            <span class="modal-icon"><i class="bi bi-person-badge"></i></span>
            <h3>Nueva Deuda</h3>
            <button class="modal-close" id="cerrarModalNuevaDeuda">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-stepper">
              ${[1,2,3].map(n => `<div class="form-step${step===n? ' active' : step>n? ' completed':''}">${n}</div>`).join('')}
            </div>
            <form id="formNuevaDeudaMultistep">
              ${step === 1 ? `
                <div class="form-group">
                  <label>Prestamista:</label>
                  <input type="text" name="prestamista" class="form-control" required value="${formData.prestamista}">
                </div>
                <div class="form-group">
                  <label>Monto:</label>
                  <input type="number" name="montoOriginal" class="form-control" required min="1" value="${formData.montoOriginal}">
                </div>
              ` : ''}
              ${step === 2 ? `
                <div class="form-group">
                  <label>Tipo:</label>
                  <input type="text" name="tipo" class="form-control" placeholder="Familiar, banco, etc." value="${formData.tipo}">
                </div>
                <div class="form-group">
                  <label>Observaciones:</label>
                  <input type="text" name="observaciones" class="form-control" value="${formData.observaciones}">
                </div>
                <div class="form-group">
                  <label class="ios-label">
                    <input type="checkbox" name="paraCompras" class="ios-checkbox" ${formData.paraCompras ? 'checked' : ''}> ¿Para compras financiadas?
                  </label>
                </div>
              ` : ''}
              ${step === 3 ? `
                <div class="form-group">
                  <b>Confirma los datos:</b>
                  <ul style="margin-top:0.7em;">
                    <li><b>Prestamista:</b> ${formData.prestamista}</li>
                    <li><b>Monto:</b> ${formData.montoOriginal}</li>
                    <li><b>Tipo:</b> ${formData.tipo || '-'}</li>
                    <li><b>Observaciones:</b> ${formData.observaciones || '-'}</li>
                    <li><b>¿Para compras?:</b> ${formData.paraCompras ? 'Sí' : 'No'}</li>
                  </ul>
                </div>
              ` : ''}
            </form>
          </div>
          <div class="modal-footer" style="display:flex;gap:1em;justify-content:${step>1?'space-between':'flex-end'};">
            ${step > 1 ? `<button class="btn btn-ios secondary" id="btnAnteriorStep" title="Anterior"><i class="bi bi-arrow-left"></i></button>` : ''}
            ${step < totalSteps ? `<button class="btn btn-ios primary" id="btnSiguienteStep" title="Siguiente"><i class="bi bi-arrow-right"></i></button>` : `<button class="btn btn-ios primary" id="btnFinalizarStep"><i class="bi bi-check-circle"></i></button>`}
          </div>
        </div>
      </div>
    `;
    document.getElementById('cerrarModalNuevaDeuda').onclick = () => modal.innerHTML = '';
    if (step > 1) document.getElementById('btnAnteriorStep').onclick = () => { step--; renderStep(); };
    if (step < totalSteps) {
      document.getElementById('btnSiguienteStep').onclick = e => {
        e.preventDefault();
        // Validar y guardar datos del paso actual
        const form = document.getElementById('formNuevaDeudaMultistep');
        if (step === 1) {
          const prestamista = form.prestamista.value.trim();
          const montoOriginal = form.montoOriginal.value.trim();
          if (!prestamista || !montoOriginal || isNaN(montoOriginal) || parseFloat(montoOriginal) < 1) {
            form.prestamista.classList.add('error');
            form.montoOriginal.classList.add('error');
            return;
          }
          formData.prestamista = prestamista;
          formData.montoOriginal = montoOriginal;
        }
        if (step === 2) {
          formData.tipo = form.tipo.value.trim();
          formData.observaciones = form.observaciones.value.trim();
          formData.paraCompras = form.paraCompras.checked;
        }
        step++;
        renderStep();
      };
    }
    if (step === totalSteps) {
      document.getElementById('btnFinalizarStep').onclick = async e => {
        e.preventDefault();
        // Registrar deuda
        const data = { ...formData, montoOriginal: parseFloat(formData.montoOriginal), paraCompras: !!formData.paraCompras };
        await DeudasService.registrarDeuda(data);
        modal.innerHTML = '';
      };
    }
  }
  renderStep();
}

function mostrarModalPagoDeuda(deudaId) {
  const deuda = deudas.find(d => d.id === deudaId);
  const modal = document.getElementById('modalDeuda');
  if (!modal || !deuda) return;
  // Estado del formulario multistep
  let step = 1;
  const totalSteps = 2;
  let formData = {
    monto: '',
    observaciones: ''
  };
  function renderStep() {
    modal.innerHTML = `
      <div class="modal-overlay show">
        <div class="modal modal-scale">
          <div class="modal-header">
            <span class="modal-icon"><i class="bi bi-cash-coin"></i></span>
            <h3>Pagar Deuda a ${deuda.prestamista}</h3>
            <button class="modal-close" id="cerrarModalPagoDeuda">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-stepper">
              ${[1,2].map(n => `<div class="form-step${step===n? ' active' : step>n? ' completed':''}">${n}</div>`).join('')}
            </div>
            <form id="formPagoDeudaMultistep">
              ${step === 1 ? `
                <div class="form-group">
                  <label>Monto a pagar:</label>
                  <input type="number" name="monto" class="form-control" required min="1" max="${deuda.montoPendiente}" value="${formData.monto}">
                </div>
                <div class="form-group">
                  <label>Observaciones:</label>
                  <input type="text" name="observaciones" class="form-control" value="${formData.observaciones}">
                </div>
              ` : ''}
              ${step === 2 ? `
                <div class="form-group">
                  <b>Confirma el pago:</b>
                  <ul style="margin-top:0.7em;">
                    <li><b>Monto:</b> ${formData.monto}</li>
                    <li><b>Observaciones:</b> ${formData.observaciones || '-'}</li>
                  </ul>
                </div>
              ` : ''}
            </form>
          </div>
          <div class="modal-footer" style="display:flex;gap:1em;justify-content:${step>1?'space-between':'flex-end'};">
            ${step > 1 ? `<button class="btn btn-ios secondary" id="btnAnteriorStepPago" title="Anterior"><i class="bi bi-arrow-left"></i></button>` : ''}
            ${step < totalSteps ? `<button class="btn btn-ios primary" id="btnSiguienteStepPago" title="Siguiente"><i class="bi bi-arrow-right"></i></button>` : `<button class="btn btn-ios primary" id="btnFinalizarStepPago"><i class="bi bi-check-circle"></i></button>`}
          </div>
        </div>
      </div>
    `;
    document.getElementById('cerrarModalPagoDeuda').onclick = () => modal.innerHTML = '';
    if (step > 1) document.getElementById('btnAnteriorStepPago').onclick = () => { step--; renderStep(); };
    if (step < totalSteps) {
      document.getElementById('btnSiguienteStepPago').onclick = e => {
        e.preventDefault();
        // Validar y guardar datos del paso actual
        const form = document.getElementById('formPagoDeudaMultistep');
        if (step === 1) {
          const monto = form.monto.value.trim();
          if (!monto || isNaN(monto) || parseFloat(monto) < 1 || parseFloat(monto) > deuda.montoPendiente) {
            form.monto.classList.add('error');
            return;
          }
          formData.monto = monto;
          formData.observaciones = form.observaciones.value.trim();
        }
        step++;
        renderStep();
      };
    }
    if (step === totalSteps) {
      document.getElementById('btnFinalizarStepPago').onclick = async e => {
        e.preventDefault();
        // Registrar pago
        const data = { monto: parseFloat(formData.monto), observaciones: formData.observaciones, fecha: new Date().toISOString() };
        await DeudasService.registrarPago(deudaId, data);
        modal.innerHTML = '';
      };
    }
  }
  renderStep();
}

function mostrarModalComprasFinanciadas(deudaId) {
  const deuda = deudas.find(d => d.id === deudaId);
  const modal = document.getElementById('modalDeuda');
  if (!modal || !deuda) return;
  modal.innerHTML = `
    <div class="modal-overlay show">
      <div class="modal modal-scale">
        <div class="modal-header">
          <h3>Compras Financiadas - ${deuda.prestamista}</h3>
          <button class="modal-close" id="cerrarModalComprasFinanciadas">&times;</button>
        </div>
        <div class="modal-body">
          ${deuda.comprasFinanciadas && deuda.comprasFinanciadas.length > 0 ?
            `<table class='data-table'>
              <thead><tr><th>Compra ID</th><th>Monto</th></tr></thead>
              <tbody>
                ${deuda.comprasFinanciadas.map(c => `<tr><td>${c.compraId}</td><td>${DeudasUtils.formatearMonto(c.monto)}</td></tr>`).join('')}
              </tbody>
            </table>`
            : '<p>No hay compras financiadas asociadas.</p>'}
        </div>
      </div>
    </div>
  `;
  document.getElementById('cerrarModalComprasFinanciadas').onclick = () => modal.innerHTML = '';
} 