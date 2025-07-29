import * as ObjetivosService from '../services/objetivosService.js';
import * as ObjetivosUtils from '../utils/objetivosUtils.js';
import { formatCurrency } from '../utils/formatters.js';
import { showModal } from './modal.js';

let editandoId = null;
let notiTimeout = null;
let sugerenciaActual = null;

// --- NUEVO: Estado multistep ---
let pasoActual = 1;
let datosParciales = {};
const TOTAL_PASOS = 3;

export async function inicializarComponente(formContainerId, listContainerId) {
  const formContainer = document.getElementById(formContainerId);
  const listContainer = document.getElementById(listContainerId);
  if (!formContainer || !listContainer) return;

  pasoActual = 1;
  datosParciales = {};
  formContainer.innerHTML = crearFormularioHTML(null, pasoActual, datosParciales);
  await renderizarListado(listContainer);
  registrarEventosFormulario(formContainer, listContainer);
}

function calcularSugerenciaObjetivo(tipo) {
  // Datos históricos
  const hoy = new Date();
  let metaSugerida = 0;
  let fechaFinSugerida = '';
  let promedio = 0;
  let texto = '';
  if (tipo === 'ventas' && window.ventasCache) {
    // Promedio mensual de ventas últimos 3 meses
    const ventas = window.ventasCache;
    const meses = {};
    ventas.forEach(v => {
      const d = new Date(v.fecha);
      const key = `${d.getFullYear()}-${d.getMonth()+1}`;
      meses[key] = (meses[key] || 0) + Number(v.total || 0);
    });
    const valores = Object.values(meses).slice(-3);
    promedio = valores.length ? Math.round(valores.reduce((a,b)=>a+b,0)/valores.length) : 0;
    metaSugerida = Math.round(promedio * 1.2); // 20% más ambicioso
    // Sugerir fin de mes actual
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0);
    fechaFinSugerida = finMes.toISOString().split('T')[0];
    texto = `Promedio mensual: $${promedio.toLocaleString('es-CO')}. Meta sugerida: $${metaSugerida.toLocaleString('es-CO')} para el ${fechaFinSugerida}.`;
  }
  if (tipo === 'ganancias' && window.ventasCache && window.productosCache) {
    // Promedio mensual de ganancias últimos 3 meses
    const meses = {};
    window.ventasCache.forEach(v => {
      const d = new Date(v.fecha);
      const key = `${d.getFullYear()}-${d.getMonth()+1}`;
      const producto = window.productosCache.find(p => p.nombre === v.producto);
      if (!producto) return;
      const cantidad = v.cantidad || 0;
      let ganancia = 0;
      if (v.tipoCliente === 'cliente') {
        ganancia = ((producto.precioCliente || 0) - (producto.precioCompra || 0)) * cantidad;
      } else if (v.tipoCliente === 'distribuidor') {
        ganancia = ((producto.precioDistribuidor || 0) - (producto.precioCompra || 0)) * cantidad;
      }
      meses[key] = (meses[key] || 0) + ganancia;
    });
    const valores = Object.values(meses).slice(-3);
    promedio = valores.length ? Math.round(valores.reduce((a,b)=>a+b,0)/valores.length) : 0;
    metaSugerida = Math.round(promedio * 1.2);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0);
    fechaFinSugerida = finMes.toISOString().split('T')[0];
    texto = `Promedio mensual: $${promedio.toLocaleString('es-CO')}. Meta sugerida: $${metaSugerida.toLocaleString('es-CO')} para el ${fechaFinSugerida}.`;
  }
  if (tipo === 'clientes' && window.clientesCache) {
    // Promedio mensual de clientes nuevos últimos 3 meses
    const meses = {};
    window.clientesCache.forEach(c => {
      const d = new Date(c.fechaRegistro || c.fechaAlta || c.fecha);
      const key = `${d.getFullYear()}-${d.getMonth()+1}`;
      meses[key] = (meses[key] || 0) + 1;
    });
    const valores = Object.values(meses).slice(-3);
    promedio = valores.length ? Math.round(valores.reduce((a,b)=>a+b,0)/valores.length) : 0;
    metaSugerida = Math.round(promedio * 1.2);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0);
    fechaFinSugerida = finMes.toISOString().split('T')[0];
    texto = `Promedio mensual: ${promedio}. Meta sugerida: ${metaSugerida} nuevos clientes para el ${fechaFinSugerida}.`;
  }
  if (tipo === 'inventario' && window.productosCache) {
    // Promedio mensual de productos nuevos últimos 3 meses
    const meses = {};
    window.productosCache.forEach(p => {
      if (!p.fechaCreacion) return;
      const d = new Date(p.fechaCreacion);
      const key = `${d.getFullYear()}-${d.getMonth()+1}`;
      meses[key] = (meses[key] || 0) + 1;
    });
    const valores = Object.values(meses).slice(-3);
    promedio = valores.length ? Math.round(valores.reduce((a,b)=>a+b,0)/valores.length) : 0;
    metaSugerida = Math.round(promedio * 1.2);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0);
    fechaFinSugerida = finMes.toISOString().split('T')[0];
    texto = `Promedio mensual: ${promedio}. Meta sugerida: ${metaSugerida} productos nuevos para el ${fechaFinSugerida}.`;
  }
  if (tipo === 'crecimiento') {
    texto = 'Sugerencia: Elige un objetivo compuesto basado en tus métricas clave.';
  }
  sugerenciaActual = { meta: metaSugerida, fechaFin: fechaFinSugerida, texto };
  return sugerenciaActual;
}

function crearBarraPasos(paso) {
  return `
    <div class="form-stepper" style="margin-bottom:1em;">
      ${[1,2,3].map(i => `
        <div class="form-step${paso===i?' active':''}${paso>i?' completed':''}">${i}</div>
      `).join('')}
    </div>
  `;
}

function crearFormularioHTML(objetivo = null, paso = 1, datos = {}) {
  // Si objetivo existe, es edición
  const tipo = datos.tipo ?? objetivo?.tipo ?? '';
  const meta = datos.meta ?? objetivo?.meta ?? '';
  const fechaInicio = datos.fechaInicio ?? objetivo?.fechaInicio ?? '';
  const fechaFin = datos.fechaFin ?? objetivo?.fechaFin ?? '';
  const nombre = datos.nombre ?? objetivo?.nombre ?? '';
  const descripcion = datos.descripcion ?? objetivo?.descripcion ?? '';
  const tipos = [
    { value: '', label: 'Selecciona tipo de objetivo' },
    { value: 'ventas', label: 'Aumentar ventas ($)' },
    { value: 'ganancias', label: 'Incrementar ganancias ($)' },
    { value: 'clientes', label: 'Nuevos clientes (cantidad)' },
    { value: 'inventario', label: 'Expandir inventario (productos/cantidad)' },
    { value: 'crecimiento', label: 'Crecimiento general (compuesto)' }
  ];
  // Sugerencia automática
  let sugerenciaHTML = '';
  if (tipo && paso === 2) {
    const sugerencia = calcularSugerenciaObjetivo(tipo);
    if (sugerencia && sugerencia.meta && sugerencia.fechaFin) {
      sugerenciaHTML = `
        <div class="objetivo-sugerencia-ia">
          <b>Sugerencia inteligente:</b> <span>${sugerencia.texto}</span>
          <button type="button" class="btn secondary btn-autocompletar-sugerencia">Usar sugerencia</button>
        </div>
      `;
    } else if (sugerencia && sugerencia.texto) {
      sugerenciaHTML = `<div class="objetivo-sugerencia-ia"><b>Sugerencia:</b> <span>${sugerencia.texto}</span></div>`;
    }
  }
  // --- Multistep: mostrar solo campos del paso actual ---
  let camposHTML = '';
  if (paso === 1) {
    camposHTML = `
      <div class="form-group">
        <label class="ios-label">Nombre del objetivo</label>
        <input type="text" name="nombre" class="form-control" value="${nombre}" required maxlength="60">
      </div>
      <div class="form-group">
        <label class="ios-label">Tipo de objetivo</label>
        <select name="tipo" class="form-control" required>
          ${tipos.map(t => `<option value="${t.value}" ${tipo===t.value?'selected':''}>${t.label}</option>`).join('')}
        </select>
      </div>
    `;
  } else if (paso === 2) {
    camposHTML = `
      <div class="form-group">
        <label class="ios-label">Meta (COP)</label>
        <input type="number" name="meta" class="form-control" value="${meta}" min="1" required>
        <div style="margin-top:0.3em;color:#007aff;font-weight:500;">${meta ? 'Meta: '+formatCurrency(meta) : ''}</div>
      </div>
      <div class="form-group">
        <label class="ios-label">Fecha de inicio</label>
        <input type="date" name="fechaInicio" class="form-control" value="${fechaInicio}" required>
      </div>
      <div class="form-group">
        <label class="ios-label">Fecha de fin</label>
        <input type="date" name="fechaFin" class="form-control" value="${fechaFin}" required>
      </div>
      ${sugerenciaHTML}
    `;
  } else if (paso === 3) {
    camposHTML = `
      <div class="form-group">
        <label class="ios-label">Descripción (opcional)</label>
        <textarea name="descripcion" class="form-control" maxlength="200">${descripcion}</textarea>
      </div>
      <div class="form-group" style="background:#f6faff;border-radius:10px;padding:1em;margin-bottom:1em;">
        <b>Resumen:</b><br>
        <ul style="margin:0.5em 0 0 1.2em;">
          <li><b>Nombre:</b> ${nombre || '—'}</li>
          <li><b>Tipo:</b> ${tipos.find(t=>t.value===tipo)?.label || '—'}</li>
          <li><b>Meta:</b> ${meta ? formatCurrency(meta) : '—'}</li>
          <li><b>Fecha inicio:</b> ${fechaInicio || '—'}</li>
          <li><b>Fecha fin:</b> ${fechaFin || '—'}</li>
          <li><b>Descripción:</b> ${descripcion || '—'}</li>
        </ul>
      </div>
    `;
  }
  // --- Navegación multistep ---
  let navHTML = `
    <div class="form-group" id="objetivoFormError" style="color:#ff3b30;font-weight:500;"></div>
    <div class="form-group" style="display:flex;gap:0.7em;justify-content:flex-end;">
      ${paso>1?'<button type="button" class="btn secondary" id="btnAnteriorPaso">Anterior</button>':''}
      ${paso<TOTAL_PASOS?'<button type="button" class="btn primary" id="btnSiguientePaso">Siguiente</button>':''}
      ${paso===TOTAL_PASOS?`<button type="submit" class="btn primary">${editandoId ? 'Actualizar' : 'Crear objetivo'}</button>`:''}
      ${editandoId && paso===TOTAL_PASOS?'<button type="button" class="btn secondary" id="cancelarEdicion">Cancelar</button>':''}
    </div>
  `;
  return `
    <form id="objetivoForm" class="objetivos-form-card">
      ${crearBarraPasos(paso)}
      ${camposHTML}
      ${navHTML}
    </form>
  `;
}

function registrarEventosFormulario(formContainer, listContainer) {
  const form = formContainer.querySelector('form');
  if (!form) return;
  // --- Multistep: Navegación ---
  const errorElem = form.querySelector('#objetivoFormError');
  // Siguiente paso
  const btnSiguiente = form.querySelector('#btnSiguientePaso');
  if (btnSiguiente) {
    btnSiguiente.onclick = (e) => {
      e.preventDefault();
      // Guardar datos del paso actual
      const datosForm = Object.fromEntries(new FormData(form));
      Object.assign(datosParciales, datosForm);
      // Validar campos del paso actual
      let error = '';
      if (pasoActual === 1) {
        if (!datosParciales.nombre || !datosParciales.tipo) {
          error = 'Completa el nombre y tipo de objetivo.';
        }
      } else if (pasoActual === 2) {
        if (!datosParciales.meta || !datosParciales.fechaInicio || !datosParciales.fechaFin) {
          error = 'Completa la meta y las fechas.';
        }
      }
      if (error) {
        errorElem.textContent = error;
        return;
      } else {
        errorElem.textContent = '';
      }
      pasoActual++;
      formContainer.innerHTML = crearFormularioHTML(null, pasoActual, datosParciales);
      registrarEventosFormulario(formContainer, listContainer);
    };
  }
  // Paso anterior
  const btnAnterior = form.querySelector('#btnAnteriorPaso');
  if (btnAnterior) {
    btnAnterior.onclick = (e) => {
      e.preventDefault();
      // Guardar datos del paso actual
      const datosForm = Object.fromEntries(new FormData(form));
      Object.assign(datosParciales, datosForm);
      pasoActual--;
      formContainer.innerHTML = crearFormularioHTML(null, pasoActual, datosParciales);
      registrarEventosFormulario(formContainer, listContainer);
    };
  }
  // Enviar (último paso)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datosForm = Object.fromEntries(new FormData(form));
    Object.assign(datosParciales, datosForm);
    datosParciales.meta = Number(datosParciales.meta);
    // Validar todos los campos
    const error = ObjetivosUtils.validarObjetivo(datosParciales);
    if (error) {
      errorElem.textContent = error;
      return;
    } else {
      errorElem.textContent = '';
    }
    try {
      if (editandoId) {
        await ObjetivosService.actualizarObjetivo(editandoId, datosParciales);
      } else {
        await ObjetivosService.crearObjetivo(datosParciales);
      }
      editandoId = null;
      pasoActual = 1;
      datosParciales = {};
      formContainer.innerHTML = crearFormularioHTML(null, pasoActual, datosParciales);
      registrarEventosFormulario(formContainer, listContainer);
      await renderizarListado(listContainer);
      if (window.actualizarBarraObjetivos) window.actualizarBarraObjetivos();
    } catch (err) {
      errorElem.textContent = 'Error al guardar: ' + (err.message || err);
    }
  });
  // Cancelar edición
  const cancelarBtn = form.querySelector('#cancelarEdicion');
  if (cancelarBtn) {
    cancelarBtn.onclick = () => {
      editandoId = null;
      pasoActual = 1;
      datosParciales = {};
      formContainer.innerHTML = crearFormularioHTML(null, pasoActual, datosParciales);
      registrarEventosFormulario(formContainer, listContainer);
    };
  }
  // Autocompletar sugerencia
  setTimeout(() => {
    const btn = form.querySelector('.btn-autocompletar-sugerencia');
    if (btn && sugerenciaActual) {
      btn.onclick = () => {
        if (form && sugerenciaActual) {
          if (form.meta) form.meta.value = sugerenciaActual.meta;
          if (form.fechaFin) form.fechaFin.value = sugerenciaActual.fechaFin;
        }
      };
    }
  }, 100);
}

async function renderizarListado(listContainer) {
  const objetivos = await ObjetivosService.obtenerObjetivos();
  if (!objetivos.length) {
    listContainer.innerHTML = '<div class="empty-state"><i class="bi bi-bullseye"></i> No hay objetivos registrados.</div>';
    return;
  }
  listContainer.innerHTML = `
    <div class="ganancias-cards-grid">
      ${objetivos.map(obj => renderObjetivoCard(obj)).join('')}
    </div>
  `;
  // Acciones editar/eliminar
  objetivos.forEach(obj => {
    const editBtn = listContainer.querySelector(`#editarObjetivo_${obj.id}`);
    if (editBtn) {
      editBtn.onclick = () => editarObjetivo(obj, listContainer);
    }
    const delBtn = listContainer.querySelector(`#eliminarObjetivo_${obj.id}`);
    if (delBtn) {
      delBtn.onclick = async () => {
        // Modal de confirmación en vez de confirm()
        const confirmado = await showModal({
          title: 'Eliminar objetivo',
          content: `<div style='padding:1em 0;'>¿Estás seguro de eliminar este objetivo?<br><b>${obj.nombre || obj.tipo}</b></div>`,
          type: 'danger',
          size: 'small',
          showCancel: true,
          showConfirm: true,
          confirmText: 'Eliminar',
          cancelText: 'Cancelar',
          animation: 'scale'
        });
        if (confirmado) {
          await ObjetivosService.eliminarObjetivo(obj.id);
          await renderizarListado(listContainer);
          if (window.actualizarBarraObjetivos) window.actualizarBarraObjetivos();
        }
      };
    }
  });
}

function renderObjetivoCard(obj) {
  const tipoLabel = {
    ventas: 'Aumentar ventas',
    ganancias: 'Incrementar ganancias',
    clientes: 'Nuevos clientes',
    inventario: 'Expandir inventario',
    crecimiento: 'Crecimiento general'
  }[obj.tipo] || obj.tipo;
  // Mostrar rango de fechas
  const fechaInicio = obj.fechaInicio || '—';
  const fechaFin = obj.fechaFin || '—';
  const rangoFechas = `${fechaInicio} a ${fechaFin}`;
  return `
    <div class="ganancia-card-glass">
      <div class="ganancia-card-title">${obj.nombre || tipoLabel}</div>
      <div class="ganancia-card-row"><span class="ganancia-badge blue"><i class="bi bi-bullseye"></i> ${tipoLabel}</span></div>
      <div class="ganancia-card-row"><b>Meta:</b> ${obj.meta ? formatCurrency(obj.meta) : '—'}</div>
      <div class="ganancia-card-row"><b>Fecha objetivo:</b> ${rangoFechas}</div>
      <div class="ganancia-card-row"><b>Descripción:</b> ${obj.descripcion || '—'}</div>
      <div class="ganancia-card-actions">
        <button class="btn info" id="editarObjetivo_${obj.id}"><i class="bi bi-pencil"></i> Editar</button>
        <button class="btn danger" id="eliminarObjetivo_${obj.id}"><i class="bi bi-trash"></i> Eliminar</button>
      </div>
    </div>
  `;
}

function editarObjetivo(obj, listContainer) {
  // Modal multistep para edición
  editandoId = obj.id;
  pasoActual = 1;
  datosParciales = { ...obj };
  function renderModalStep() {
    return crearFormularioHTML(obj, pasoActual, datosParciales);
  }
  function registrarEventosModal(modalElem, closeModalCallback) {
    const form = modalElem.querySelector('form');
    if (!form) return;
    const errorElem = form.querySelector('#objetivoFormError');
    // Siguiente paso
    const btnSiguiente = form.querySelector('#btnSiguientePaso');
    if (btnSiguiente) {
      btnSiguiente.onclick = (e) => {
        e.preventDefault();
        const datosForm = Object.fromEntries(new FormData(form));
        Object.assign(datosParciales, datosForm);
        let error = '';
        if (pasoActual === 1) {
          if (!datosParciales.nombre || !datosParciales.tipo) {
            error = 'Completa el nombre y tipo de objetivo.';
          }
        } else if (pasoActual === 2) {
          if (!datosParciales.meta || !datosParciales.fechaInicio || !datosParciales.fechaFin) {
            error = 'Completa la meta y las fechas.';
          }
        }
        if (error) {
          errorElem.textContent = error;
          return;
        } else {
          errorElem.textContent = '';
        }
        pasoActual++;
        modalElem.querySelector('.modal-body').innerHTML = renderModalStep();
        registrarEventosModal(modalElem, closeModalCallback);
      };
    }
    // Paso anterior
    const btnAnterior = form.querySelector('#btnAnteriorPaso');
    if (btnAnterior) {
      btnAnterior.onclick = (e) => {
        e.preventDefault();
        const datosForm = Object.fromEntries(new FormData(form));
        Object.assign(datosParciales, datosForm);
        pasoActual--;
        modalElem.querySelector('.modal-body').innerHTML = renderModalStep();
        registrarEventosModal(modalElem, closeModalCallback);
      };
    }
    // Enviar (último paso)
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const datosForm = Object.fromEntries(new FormData(form));
      Object.assign(datosParciales, datosForm);
      datosParciales.meta = Number(datosParciales.meta);
      const error = ObjetivosUtils.validarObjetivo(datosParciales);
      if (error) {
        errorElem.textContent = error;
        return;
      } else {
        errorElem.textContent = '';
      }
      try {
        await ObjetivosService.actualizarObjetivo(editandoId, datosParciales);
        editandoId = null;
        pasoActual = 1;
        datosParciales = {};
        closeModalCallback();
        await renderizarListado(listContainer);
        if (window.actualizarBarraObjetivos) window.actualizarBarraObjetivos();
      } catch (err) {
        errorElem.textContent = 'Error al guardar: ' + (err.message || err);
      }
    });
    // Cancelar edición
    const cancelarBtn = form.querySelector('#cancelarEdicion');
    if (cancelarBtn) {
      cancelarBtn.onclick = () => {
        editandoId = null;
        pasoActual = 1;
        datosParciales = {};
        closeModalCallback();
      };
    }
    // Autocompletar sugerencia
    setTimeout(() => {
      const btn = form.querySelector('.btn-autocompletar-sugerencia');
      if (btn && sugerenciaActual) {
        btn.onclick = () => {
          if (form && sugerenciaActual) {
            if (form.meta) form.meta.value = sugerenciaActual.meta;
            if (form.fechaFin) form.fechaFin.value = sugerenciaActual.fechaFin;
          }
        };
      }
    }, 100);
  }
  // Mostrar el modal
  showModal({
    title: 'Editar objetivo',
    content: renderModalStep(),
    size: 'medium',
    type: 'info',
    showCancel: false,
    showConfirm: false,
    showCloseButton: true,
    animation: 'scale'
  }).then(() => {
    // Al cerrar el modal, limpiar estado
    editandoId = null;
    pasoActual = 1;
    datosParciales = {};
  });
  // Esperar a que el modal esté en el DOM y registrar eventos
  setTimeout(() => {
    const modalElem = document.querySelector('.modal-overlay.show');
    if (modalElem) {
      // Para cerrar el modal desde el formulario
      const closeModalCallback = () => {
        if (modalElem) modalElem.classList.remove('show');
      };
      registrarEventosModal(modalElem, closeModalCallback);
    }
  }, 50);
}

function calcularProgreso(obj) {
  // Rango de fechas obligatorio
  if (!obj.fechaInicio || !obj.fechaFin) return 0;
  const desde = new Date(obj.fechaInicio);
  const hasta = new Date(obj.fechaFin);
  if (isNaN(desde) || isNaN(hasta) || desde > hasta) return 0;
  // Ventas
  if (obj.tipo === 'ventas' && window.ventasCache) {
    let total = 0;
    window.ventasCache.forEach(v => {
      const fechaVenta = new Date(v.fecha);
      if (fechaVenta >= desde && fechaVenta <= hasta) {
        total += Number(v.total) || 0;
      }
    });
    return Math.min(100, Math.round((total / obj.meta) * 100));
  }
  // Ganancias: sumar ganancias de ventas en el rango
  if (obj.tipo === 'ganancias' && window.ventasCache && window.productosCache) {
    let total = 0;
    window.ventasCache.forEach(v => {
      const fechaVenta = new Date(v.fecha);
      if (fechaVenta >= desde && fechaVenta <= hasta) {
        const producto = window.productosCache.find(p => p.nombre === v.producto);
        if (!producto) return;
        const cantidad = v.cantidad || 0;
        // Ganancia por cliente
        if (v.tipoCliente === 'cliente') {
          const gananciaPorUnidad = (producto.precioCliente || 0) - (producto.precioCompra || 0);
          total += gananciaPorUnidad * cantidad;
        } else if (v.tipoCliente === 'distribuidor') {
          const gananciaPorUnidad = (producto.precioDistribuidor || 0) - (producto.precioCompra || 0);
          total += gananciaPorUnidad * cantidad;
        }
      }
    });
    return Math.min(100, Math.round((total / obj.meta) * 100));
  }
  // Clientes
  if (obj.tipo === 'clientes' && window.clientesCache) {
    let total = 0;
    window.clientesCache.forEach(c => {
      const fechaCliente = new Date(c.fechaRegistro || c.fechaAlta || c.fecha);
      if (fechaCliente >= desde && fechaCliente <= hasta) {
        total++;
      }
    });
    return Math.min(100, Math.round((total / obj.meta) * 100));
  }
  // Inventario
  if (obj.tipo === 'inventario' && window.productosCache) {
    let total = 0;
    window.productosCache.forEach(p => {
      if (p.fechaCreacion) {
        const fechaProd = new Date(p.fechaCreacion);
        if (fechaProd >= desde && fechaProd <= hasta) {
          total += Number(p.stock || 0);
        }
      }
    });
    return Math.min(100, Math.round((total / obj.meta) * 100));
  }
  // Crecimiento
  if (obj.tipo === 'crecimiento') {
    const tipos = ['ventas','ganancias','clientes','inventario'];
    let suma = 0, cuenta = 0;
    tipos.forEach(tipo => {
      const fakeObj = { ...obj, tipo };
      const prog = calcularProgreso(fakeObj);
      if (!isNaN(prog)) { suma += prog; cuenta++; }
    });
    return cuenta ? Math.round(suma/cuenta) : 0;
  }
  return 0;
}

export async function renderObjetivosBar(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const objetivos = await ObjetivosService.obtenerObjetivos();
  if (!objetivos.length) {
    container.innerHTML = '';
    return;
  }
  // Mostrar solo objetivos en progreso (meta no alcanzada y fecha no vencida)
  const hoy = new Date();
  const activos = objetivos.filter(obj => {
    const prog = calcularProgreso(obj);
    const noVencido = !obj.fecha || new Date(obj.fecha) >= hoy;
    const noCumplido = prog < 100;
    return noVencido && noCumplido;
  });
  if (!activos.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <div class="objetivos-bar-ios objetivos-bar-fixed">
      ${activos.map(obj => renderBarItem(obj)).join('')}
    </div>
  `;
}

function renderBarItem(obj) {
  const progreso = calcularProgreso(obj);
  const desde = obj.fechaInicio ? obj.fechaInicio : '—';
  const hasta = obj.fechaFin ? obj.fechaFin : '—';
  let valorActual = 0;
  if (obj.tipo === 'ventas' && window.ventasCache) {
    window.ventasCache.forEach(v => {
      const fechaVenta = new Date(v.fecha);
      if (fechaVenta >= new Date(desde) && fechaVenta <= new Date(hasta)) {
        valorActual += Number(v.total) || 0;
      }
    });
  }
  if (obj.tipo === 'ganancias' && window.ventasCache && window.productosCache) {
    window.ventasCache.forEach(v => {
      const fechaVenta = new Date(v.fecha);
      if (fechaVenta >= new Date(desde) && fechaVenta <= new Date(hasta)) {
        const producto = window.productosCache.find(p => p.nombre === v.producto);
        if (!producto) return;
        const cantidad = v.cantidad || 0;
        if (v.tipoCliente === 'cliente') {
          const gananciaPorUnidad = (producto.precioCliente || 0) - (producto.precioCompra || 0);
          valorActual += gananciaPorUnidad * cantidad;
        } else if (v.tipoCliente === 'distribuidor') {
          const gananciaPorUnidad = (producto.precioDistribuidor || 0) - (producto.precioCompra || 0);
          valorActual += gananciaPorUnidad * cantidad;
        }
      }
    });
  }
  if (obj.tipo === 'clientes' && window.clientesCache) {
    window.clientesCache.forEach(c => {
      const fechaCliente = new Date(c.fechaRegistro || c.fechaAlta || c.fecha);
      if (fechaCliente >= new Date(desde) && fechaCliente <= new Date(hasta)) {
        valorActual++;
      }
    });
  }
  if (obj.tipo === 'inventario' && window.productosCache) {
    window.productosCache.forEach(p => {
      if (p.fechaCreacion) {
        const fechaProd = new Date(p.fechaCreacion);
        if (fechaProd >= new Date(desde) && fechaProd <= new Date(hasta)) {
          valorActual += Number(p.stock || 0);
        }
      }
    });
  }
  const diasRestantes = obj.fechaFin ? Math.max(0, Math.ceil((new Date(obj.fechaFin) - new Date())/86400000)) : '—';
  return `
    <div class="objetivo-bar-item">
      <div class="objetivo-bar-info">
        <span class="objetivo-bar-nombre"><i class="bi bi-bullseye"></i> ${obj.nombre}</span>
        <span class="objetivo-bar-meta">Meta: <b>${formatCurrency(obj.meta)}</b></span>
        <span class="objetivo-bar-actual">Actual: <b>${obj.tipo === 'clientes' || obj.tipo === 'inventario' ? valorActual : formatCurrency(valorActual)}</b></span>
        <span class="objetivo-bar-fechas">${desde} a ${hasta}</span>
        <span class="objetivo-bar-dias">Días restantes: <b>${diasRestantes}</b></span>
      </div>
      <div class="objetivo-bar-progreso">
        <div class="objetivo-bar-progreso-bar" style="width:${progreso}%"></div>
        <span class="objetivo-bar-progreso-text">${progreso}%</span>
      </div>
    </div>
  `;
}

export function showObjetivoNotification({ type = 'info', message = '', recommendation = '' }) {
  let container = document.getElementById('objetivosNotiContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'objetivosNotiContainer';
    container.className = 'objetivos-noti-container-ios';
    document.body.appendChild(container);
  }
  container.innerHTML = `
    <div class="objetivos-noti-ios ${type}">
      <div class="noti-title"><i class="bi bi-bullseye"></i> ${type === 'success' ? '¡Objetivo cumplido!' : 'Objetivo en progreso'}</div>
      <div class="noti-msg">${message}</div>
      ${recommendation ? `<div class="noti-reco"><i class='bi bi-lightbulb'></i> ${recommendation}</div>` : ''}
    </div>
  `;
  container.classList.add('show');
  clearTimeout(notiTimeout);
  notiTimeout = setTimeout(() => {
    container.classList.remove('show');
    setTimeout(() => { container.innerHTML = ''; }, 400);
  }, 5000);
}

// FCM: Enviar notificación push (solo para pruebas, no usar serverKey en producción)
async function enviarNotificacionFCM(token, titulo, mensaje) {
  const serverKey = 'cbKhnft9P_S97gfpgKGLwS:APA91bGfmirgkFl78XvX8s4KinDwQDhQ4mH1dPtEMV6OZgboGz_5LEwbf1icikQnnIpyQRJ6kI1gjo1VJxZIJKjjm04c9hP4IYbQ9MbGyds2olVcLkkT3h0'; // ¡NO usar en producción!
  const payload = {
    to: token,
    notification: {
      title: titulo,
      body: mensaje,
      icon: '/assets/images/logo-192x192.png'
    }
  };
  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'key=' + serverKey
    },
    body: JSON.stringify(payload)
  });
  if (response.ok) {
    console.log('Notificación FCM enviada correctamente');
  } else {
    const error = await response.text();
    console.error('Error al enviar notificación FCM:', error);
  }
}

// Fase 3: Lógica de eventos para notificaciones de objetivos
export async function checkObjetivosNotificaciones() {
  const objetivos = await ObjetivosService.obtenerObjetivos();
  if (!objetivos.length) return;
  const hoy = new Date();
  objetivos.forEach(obj => {
    const prog = calcularProgreso(obj);
    const desde = obj.fechaInicio ? new Date(obj.fechaInicio) : null;
    const hasta = obj.fechaFin ? new Date(obj.fechaFin) : null;
    if (!desde || !hasta || hoy < desde || hoy > hasta) return;
    // Notificación de cumplimiento
    if (prog >= 100) {
      showObjetivoNotification({
        type: 'success',
        message: `¡Has alcanzado la meta de "${obj.nombre}"!`,
        recommendation: getRecomendacionBasica(obj)
      });
      // Enviar push FCM si hay token (solo pruebas)
      if (window.fcmToken) {
        enviarNotificacionFCM(
          window.fcmToken,
          '¡Objetivo cumplido!',
          `Has alcanzado la meta de "${obj.nombre}".`
        );
      }
    } else if (prog > 0 && prog < 100) {
      showObjetivoNotification({
        type: 'info',
        message: `El objetivo "${obj.nombre}" está en progreso (${prog}%).`,
        recommendation: getRecomendacionBasica(obj)
      });
    }
  });
}

function getRecomendacionBasica(obj) {
  switch (obj.tipo) {
    case 'ventas':
      return 'Revisa tus productos más vendidos y potencia su promoción.';
    case 'ganancias':
      return 'Considera ajustar precios o reducir costos para mejorar el margen.';
    case 'clientes':
      return 'Lanza una campaña para captar nuevos clientes.';
    case 'inventario':
      return 'Evalúa reponer productos con alta rotación.';
    case 'crecimiento':
      return 'Analiza tus métricas clave y busca sinergias entre áreas.';
    default:
      return '';
  }
}