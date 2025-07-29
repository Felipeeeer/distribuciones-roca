import { db } from "../config/firebase.js";
import {
  ref,
  onValue,
  push,
  update,
  remove,
  set,
  get
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

import * as CashFlowComponent from '../components/cashFlowComponent.js';
import * as CashFlowService from '../services/cashFlowService.js';
// IMPORTS MODULARIZADOS DE COMPRAS
import * as ComprasService from '../services/comprasService.js';
import * as ComprasComponent from '../components/comprasComponent.js';
import * as ComprasUtils from '../utils/comprasUtils.js';
// IMPORTS MODULARIZADOS DE GANANCIAS
import * as GananciasService from '../services/gananciasService.js';
import * as GananciasComponent from '../components/gananciasComponent.js';
import * as GananciasUtils from '../utils/gananciasUtils.js';
import * as DeudasComponent from '../components/deudasComponent.js';
import * as DeudasService from '../services/deudasService.js';
import * as ObjetivosComponent from '../components/objetivosComponent.js';
import { registrarServiceWorkerYFCM } from '../config/firebase.js';

// --- DOM Elements ---
const loadingOverlay = document.getElementById('loadingOverlay');

// Estadísticas
const comprasHoyElem = document.getElementById('comprasHoy');
const gastoHoyElem = document.getElementById('gastoHoy');
const proveedoresActivosElem = document.getElementById('proveedoresActivos');
const rentabilidadPromedioElem = document.getElementById('rentabilidadPromedio');
const trendComprasHoyElem = document.getElementById('trendComprasHoy');
const trendGastoHoyElem = document.getElementById('trendGastoHoy');
const mejorProveedorElem = document.getElementById('mejorProveedor');
const trendRentabilidadElem = document.getElementById('trendRentabilidad');

// Filtros
const filtroCompraInput = document.getElementById('filtroCompra');
const filtroProveedorSelect = document.getElementById('filtroProveedor');
const filtroFechaInput = document.getElementById('filtroFecha');
const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');
const resultadosInfoElem = document.getElementById('resultadosInfo');

// Tabla y contenedores
const tablaComprasBody = document.querySelector("#tablaCompras tbody");
const comprasMobileContainer = document.getElementById("comprasMobileContainer");
const paginationContainer = document.getElementById("pagination");

// Botones de acción
const btnNuevaCompra = document.getElementById('btnNuevaCompra');
const btnExportarCompras = document.getElementById('btnExportarCompras');

// Análisis
const mejoresProveedoresContainer = document.getElementById('mejoresProveedores');
const promocionesActivasContainer = document.getElementById('promocionesActivas');

// Ganancias
let gananciasCache = {};

// --- Estado de la Aplicación ---
let comprasCache = [];
let productosCache = [];
let promocionesCache = [];
let comprasFiltradosCache = [];
let currentPage = 1;
const itemsPerPage = 5;
let currentCompraId = null;

// --- Manejo de submódulos de finanzas ---
const submodulos = {
  analisis: document.getElementById('submodulo-analisis'),
  ganancias: document.getElementById('submodulo-ganancias'),
  compras: document.getElementById('submodulo-compras'),
  'flujo-caja': document.getElementById('submodulo-flujo-caja'),
  deudas: document.getElementById('submodulo-deudas'),
  objetivos: document.getElementById('submodulo-objetivos')
};

function mostrarSubmodulo(nombre) {
  Object.keys(submodulos).forEach(key => {
    if (submodulos[key]) submodulos[key].style.display = key === nombre ? '' : 'none';
  });
  if (nombre === 'deudas') {
    DeudasComponent.inicializarComponente('deudasContainer');
  }
  // Fase 1: Inicializar componente de objetivos
  if (nombre === 'objetivos') {
    ObjetivosComponent.inicializarComponente('objetivosFormContainer', 'objetivosListContainer');
  }
}

document.querySelectorAll('.submodulo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const submodulo = btn.getAttribute('data-submodulo');
    mostrarSubmodulo(submodulo);
  });
});

// --- Funciones de Carga de Datos ---

function cargarDatos() {
  cargarProductos();
  cargarPromociones();
  cargarCompras();
  cargarGanancias();
  cargarVentas();
  
  // Inicializar flujo de caja
  CashFlowService.inicializarFlujoCaja();
}

function cargarProductos() {
  const productosRef = ref(db, 'productos');
  onValue(productosRef, (snapshot) => {
    productosCache = [];
    window.productosCache = productosCache;
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        productosCache.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
      productosCache.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    productosListos = true;
    intentarRenderizarGanancias();
  }, (error) => {
    console.error("Error al cargar productos:", error);
  });
}

function cargarPromociones() {
  const promocionesRef = ref(db, 'promociones');
  onValue(promocionesRef, (snapshot) => {
    promocionesCache = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        promocionesCache.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
    }
    actualizarPromocionesActivas();
  }, (error) => {
    console.error("Error al cargar promociones:", error);
  });
}

function cargarCompras() {
  loadingOverlay.classList.add('show');
  const comprasRef = ref(db, 'compras');

  onValue(comprasRef, (snapshot) => {
    comprasCache = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        comprasCache.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
      comprasCache.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    }
    
    aplicarFiltros();
    actualizarEstadisticas();
    actualizarAnalisis();
    loadingOverlay.classList.remove('show');
  }, (error) => {
    console.error("Error al cargar compras:", error);
    alertModal({ title: 'Error', content: 'No se pudieron cargar las compras.' });
    loadingOverlay.classList.remove('show');
  });
}

function cargarVentas() {
  const ventasRef = ref(db, 'ventas');
  onValue(ventasRef, (snapshot) => {
    window.ventasCache = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        window.ventasCache.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
    }
    ventasListas = true;
    intentarRenderizarGanancias();
  }, (error) => {
    console.error("Error al cargar ventas:", error);
  });
}

function cargarGanancias() {
  GananciasService.cargarGanancias((ganancias) => {
    gananciasCache = ganancias;
    renderGanancias();
  });
}

// --- Funciones de Renderizado ---

function renderCompras(compras) {
  ComprasComponent.renderCompras(
    compras, 
    tablaComprasBody, 
    comprasMobileContainer, 
    resultadosInfoElem, 
    currentPage, 
    itemsPerPage, 
    productosCache, 
    comprasCache
  );
}

// --- Funciones de Filtros ---

function aplicarFiltros() {
  const filtros = {
    texto: filtroCompraInput.value.trim(),
    proveedor: filtroProveedorSelect.value,
    fecha: filtroFechaInput.value
  };
  
  comprasFiltradosCache = ComprasUtils.aplicarFiltros(comprasCache, filtroCompraInput, filtroProveedorSelect, filtroFechaInput);
  currentPage = 1;
  renderCompras(comprasFiltradosCache);
  ComprasUtils.actualizarPaginacion(comprasFiltradosCache, paginationContainer, 'compras', currentPage, itemsPerPage, renderCompras, actualizarPaginacion);
}

function actualizarFiltroProveedores() {
  ComprasUtils.actualizarFiltroProveedores(comprasCache, filtroProveedorSelect);
}

// --- Funciones de Estadísticas ---

function actualizarEstadisticas() {
  const estadisticas = ComprasUtils.calcularEstadisticas(comprasCache, productosCache);
  
  // Compras de hoy
  comprasHoyElem.textContent = formatNumber(estadisticas.comprasHoy);
  
  // Gasto total de hoy
  gastoHoyElem.textContent = formatCurrency(estadisticas.gastoHoy);
  
  // Proveedores activos
  proveedoresActivosElem.textContent = formatNumber(estadisticas.proveedoresActivos);
  
  // Mejor proveedor
  mejorProveedorElem.textContent = estadisticas.mejorProveedor;
  
  // Rentabilidad promedio
  rentabilidadPromedioElem.textContent = `${estadisticas.rentabilidadPromedio.porcentaje}%`;
  
  // Trend de rentabilidad
  trendRentabilidadElem.className = `stat-trend ${estadisticas.rentabilidadPromedio.trendClass}`;
  trendRentabilidadElem.innerHTML = `<i class="bi bi-${estadisticas.rentabilidadPromedio.trendIcon}"></i> ${estadisticas.rentabilidadPromedio.trendText}`;
  
  actualizarFiltroProveedores();
}

// --- Funciones de Análisis ---

function actualizarAnalisis() {
  actualizarMejoresProveedores();
  actualizarPromocionesActivas();
}

function actualizarMejoresProveedores() {
  const proveedoresList = ComprasUtils.analizarProveedores(comprasCache);
  ComprasComponent.renderMejoresProveedores(proveedoresList, mejoresProveedoresContainer);
}

function actualizarPromocionesActivas() {
  const promocionesActivas = ComprasUtils.analizarPromociones(promocionesCache);
  ComprasComponent.renderPromocionesActivas(promocionesActivas, promocionesActivasContainer);
}

// --- Funciones de Modal ---

function createCompraFormHTML(compra = null) {
  return ComprasComponent.createCompraFormHTML(compra);
}

function setupCompraFormListeners() {
  ComprasComponent.setupCompraFormListeners(productosCache, comprasCache);
}

function actualizarValorCalculadoModal() {
  ComprasComponent.actualizarValorCalculadoModal();
}

function actualizarAnalisisCompra() {
  ComprasComponent.actualizarAnalisisCompra(productosCache, comprasCache);
}

// --- Utilidad para combinar fecha y hora actual ---
function combinarFechaConHoraActual(fechaStr) {
  const ahora = new Date();
  const [year, month, day] = fechaStr.split('-');
  ahora.setFullYear(Number(year));
  ahora.setMonth(Number(month) - 1);
  ahora.setDate(Number(day));
  // Mantener la hora/minuto/segundo actuales
  return ahora.toISOString();
}

// --- Funciones de Guardado ---

async function guardarCompraFromModal(compraData) {
  // Validar que los datos requeridos estén presentes
  if (!compraData || !compraData.producto || !compraData.proveedor || !compraData.fecha || !compraData.cantidad || !compraData.valorUnitario) {
    alertModal({ title: 'Error', content: 'Error en el formulario. Intenta nuevamente.' });
    return false;
  }

  // --- NUEVO: Asociación a deuda si es financiada ---
  // (Opcional: puedes agregar aquí lógica para financiamiento si lo necesitas)

  try {
    // Validaciones usando utilidades
    ComprasUtils.validarCompra({
      ...compraData,
      fecha: compraData.fecha || new Date().toISOString()
    });
    
    // Verificar que el producto existe
    const productoExistente = productosCache.find(p => p.nombre === compraData.producto);
    if (!productoExistente) {
      alertModal({ title: 'Error de Validación', content: 'El producto seleccionado no existe en el inventario.' });
      return false;
    }

    // Usar la función para combinar fecha y hora actual
    const fechaReal = compraData.fecha ? combinarFechaConHoraActual(compraData.fecha) : new Date().toISOString();
    const compraDataFinal = {
      ...compraData,
      fecha: fechaReal,
      valorTotal: ComprasUtils.calcularValorTotal(compraData.cantidad, compraData.valorUnitario),
      fechaRegistro: fechaReal
    };

    loadingOverlay.classList.add('show');
    
    if (currentCompraId) {
      // Editar compra existente
      const compraRef = ref(db, `compras/${currentCompraId}`);
      await update(compraRef, compraDataFinal);
      showToast('Compra actualizada con éxito', 'success');
    } else {
      // Nueva compra
      const comprasRef = ref(db, 'compras');
      await push(comprasRef, compraDataFinal);
      
      // Actualizar stock y precio del producto
      const updateData = ComprasUtils.actualizarProductoPorCompra(productoExistente, compraData.cantidad, compraData.valorUnitario);
      const productoRef = ref(db, `productos/${productoExistente.id}`);
      await update(productoRef, updateData);
      
      showToast('Compra registrada con éxito', 'success');
    }
    
    // (Opcional: lógica de financiamiento aquí si es necesario)
    
    return true;
  } catch (error) {
    console.error("Error al guardar la compra:", error);
    alertModal({ title: 'Error', content: error.message || `No se pudo guardar la compra: ${error.message}` });
    return false;
  } finally {
    loadingOverlay.classList.remove('show');
    currentCompraId = null;
  }
}

// --- Funciones de Modal ---

async function abrirModalNuevaCompra() {
  currentCompraId = null;
  return ComprasComponent.mostrarModalCompra(null, productosCache, comprasCache, guardarCompraFromModal);
}

async function abrirModalEdicionCompra(id) {
  const compra = comprasCache.find(c => c.id === id);
  if (!compra) {
    alertModal({ title: 'Error', content: 'Compra no encontrada.' });
    return;
  }

  currentCompraId = id;
  await ComprasComponent.mostrarModalCompra(compra, productosCache, comprasCache, guardarCompraFromModal);
  // Agregar campos de financiamiento si hay deudas pendientes
  const deudas = await DeudasService.obtenerDeudas();
  const deudasPendientes = deudas.filter(d => d.estado === 'pendiente');
  if (deudasPendientes.length > 0) {
    const form = document.querySelector('#modalCompra form');
    if (form) {
      const financiamientoHTML = `<label><input type='checkbox' id='compraFinanciada' ${compra.financiada ? 'checked' : ''}> Compra financiada</label><br><div id='financiamientoFields' style='display:${compra.financiada ? '' : 'none'}; margin-top:0.5em;'><select id='deudaAsociada'>${deudasPendientes.map(d => `<option value='${d.id}' ${compra.deudaId === d.id ? 'selected' : ''}>${d.prestamista} (${d.montoPendiente} pendientes)</option>`)}</select><br><label>Monto financiado:<input type='number' id='montoFinanciado' min='0' value='${compra.montoFinanciado || ''}'></label></div>`;
      form.insertAdjacentHTML('beforeend', financiamientoHTML);
      const chk = form.querySelector('#compraFinanciada');
      const fields = form.querySelector('#financiamientoFields');
      chk.addEventListener('change', () => { fields.style.display = chk.checked ? '' : 'none'; });
    }
  }
}

// --- Funciones de Eliminación ---

async function eliminarCompra(id) {
  const compra = comprasCache.find(c => c.id === id);
  const confirmed = await confirmModal({
    title: `¿Eliminar compra?`,
    content: `¿Estás seguro de eliminar la compra de "${compra?.producto || 'producto'}" del proveedor "${compra?.proveedor || 'proveedor'}"? Esta acción no se puede deshacer.`,
    confirmText: 'Sí, Eliminar',
    type: 'danger',
  });

  if (confirmed) {
    loadingOverlay.classList.add('show');
    try {
      await remove(ref(db, `compras/${id}`));
      showToast('Compra eliminada correctamente', 'success');
      
      // Actualizar stock del producto al eliminar la compra
      if (compra && compra.producto && compra.cantidad) {
        const producto = productosCache.find(p => p.nombre === compra.producto);
        if (producto) {
          const updateData = ComprasUtils.revertirProductoPorEliminacion(producto, compra.cantidad);
          const productoRef = ref(db, `productos/${producto.id}`);
          await update(productoRef, updateData);
        }
      }
    } catch (error) {
      console.error("Error al eliminar la compra:", error);
      alertModal({ title: 'Error', content: `No se pudo eliminar la compra: ${error.message}` });
    } finally {
      loadingOverlay.classList.remove('show');
    }
  }
}

// --- Funciones de Exportación ---

function exportarCompras() {
  try {
    const csvContent = ComprasUtils.exportarCompras(comprasCache);
    ComprasUtils.descargarCSV(csvContent, `compras_${new Date().toISOString().split('T')[0]}.csv`);
    showToast('Compras exportadas correctamente', 'success');
  } catch (error) {
    alertModal({ title: 'Sin Datos', content: error.message });
  }
}

// --- Funciones de Paginación ---

function actualizarPaginacion(items, container, type) {
  ComprasUtils.actualizarPaginacion(items, container, type, currentPage, itemsPerPage, renderCompras, actualizarPaginacion);
}

function handlePaginationClick(e) {
  ComprasUtils.handlePaginationClick(e, comprasFiltradosCache, itemsPerPage, renderCompras, actualizarPaginacion);
}

// --- Funciones de Utilidad ---

function showToast(message, type = 'info') {
  if (window.showToast) {
    window.showToast(message, type, { duration: 3000 });
  } else {

  }
}

// --- Inicialización ---

function inicializar() {
  // Establecer fecha de hoy por defecto
  if (filtroFechaInput) {
    filtroFechaInput.value = new Date().toISOString().split('T')[0];
  }

  // Cargar datos
  cargarDatos();
  
  // Inicializar componente de flujo de caja
setTimeout(() => {
  CashFlowComponent.inicializarComponente('flujoCajaContainer');
}, 500);

// Exponer funciones de debug globalmente
window.debugCashFlow = CashFlowService.debugCashFlow;
window.recargarYDebug = CashFlowService.recargarYDebug;
window.configurarFechaImplementacion = CashFlowService.configurarFechaImplementacion;

  // Listeners para botones principales
  btnNuevaCompra.addEventListener('click', abrirModalNuevaCompra);
  
  if (btnExportarCompras) {
    btnExportarCompras.addEventListener('click', exportarCompras);
  }

  // Listeners para filtros
  filtroCompraInput.addEventListener('input', aplicarFiltros);
  filtroProveedorSelect.addEventListener('change', aplicarFiltros);
  filtroFechaInput.addEventListener('change', aplicarFiltros);
  
  btnLimpiarFiltros.addEventListener('click', () => {
    filtroCompraInput.value = '';
    filtroProveedorSelect.value = '';
    filtroFechaInput.value = new Date().toISOString().split('T')[0];
    aplicarFiltros();
  });

  // Listeners para acciones en las tablas
  document.body.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-editar-compra');
    if (editBtn) {
      abrirModalEdicionCompra(editBtn.dataset.id);
      return;
    }
    
    const deleteBtn = e.target.closest('.btn-eliminar-compra');
    if (deleteBtn) {
      eliminarCompra(deleteBtn.dataset.id);
      return;
    }

    // Listener para Retirar Ganancia
    const btnRetirar = e.target.closest('.btn-retirar-ganancia');
    if (btnRetirar) {
      const productoId = btnRetirar.dataset.productoId;
      const productoNombre = btnRetirar.dataset.productoNombre;
      const ganancia = gananciasCache[productoId];
      if (!ganancia) {
        showToast('Ganancia no encontrada', 'warning');
        return;
      }
      await GananciasComponent.mostrarModalRetiroGanancia(
        productoId,
        productoNombre,
        ganancia,
        async (productoId, monto, motivo) => {
          try {
            await GananciasService.registrarRetiroGanancia(productoId, monto, motivo);
            showToast('Retiro registrado correctamente', 'success');
            cargarGanancias();
            return true;
          } catch (err) {
            showToast('Error al registrar el retiro: ' + (err.message || err), 'danger');
            return false;
          }
        }
      );
      return;
    }

    // Listener para Ver Ganancias
    const btnVer = e.target.closest('.btn-ver-ganancias');
    if (btnVer) {
      const productoId = btnVer.dataset.productoId;
      const productoNombre = btnVer.dataset.productoNombre;
      const ganancia = gananciasCache[productoId];
      if (!ganancia) {
        showToast('No hay datos de ganancias para este producto', 'warning');
        return;
      }
      try {
        const retiros = await GananciasService.obtenerRetirosPorProducto(productoId);
        await GananciasComponent.mostrarModalDetalleGanancias(productoId, productoNombre, ganancia, retiros);
      } catch (err) {
        showToast('Error al cargar el historial de retiros', 'danger');
      }
      return;
    }
  });
  
  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      abrirModalNuevaCompra();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      exportarCompras();
    }
  });

  // Cambiar llamada a renderGanancias por versión async
  if (typeof renderGanancias === 'function') {
    renderGanancias();
  }

  // Fase 2: Renderizar barra de objetivos al cargar
  ObjetivosComponent.renderObjetivosBar('objetivosBarContainer');
  // Fase 3: Notificaciones de objetivos al cargar
  ObjetivosComponent.checkObjetivosNotificaciones();
  // FCM: Registrar Service Worker y activar notificaciones push
  registrarServiceWorkerYFCM();
}

document.addEventListener('DOMContentLoaded', inicializar);

// Renderizar sección de ganancias por producto
function renderGanancias() {
  GananciasComponent.renderGanancias(gananciasCache, productosCache);
}

// Exponer función para recargar ganancias desde otros módulos
window.recargarGananciasFinanzas = function() {
  cargarGanancias();
};

// Funciones de ganancias usando módulos
async function mostrarModalRetiroGanancia(productoId, productoNombre) {
  const ganancia = gananciasCache[productoId];
  if (!ganancia) {
    showToast('Ganancia no encontrada', 'warning');
    return;
  }
  
  await GananciasComponent.mostrarModalRetiroGanancia(
    productoId, 
    productoNombre, 
    ganancia, 
    async (productoId, monto, motivo) => {
      try {
        await GananciasService.registrarRetiroGanancia(productoId, monto, motivo);
        showToast('Retiro registrado correctamente', 'success');
        cargarGanancias();
        return true;
      } catch (err) {
        showToast('Error al registrar el retiro: ' + (err.message || err), 'danger');
        return false;
      }
    }
  );
}

async function mostrarModalDetalleGanancias(productoId, productoNombre) {
  const ganancia = gananciasCache[productoId];
  if (!ganancia) {
    showToast('No hay datos de ganancias para este producto', 'warning');
    return;
  }
  
  try {
    const retiros = await GananciasService.obtenerRetirosPorProducto(productoId);
    await GananciasComponent.mostrarModalDetalleGanancias(productoId, productoNombre, ganancia, retiros);
  } catch (err) {
    console.error('Error al obtener retiros:', err);
    showToast('Error al cargar el historial de retiros', 'danger');
  }
}

let ventasListas = false;
let productosListos = false;
function intentarRenderizarGanancias() {
  if (ventasListas && productosListos) {
    renderGanancias();
  }
}

// Fase 2: Actualizar barra de objetivos tras cambios
window.actualizarBarraObjetivos = () => {
  ObjetivosComponent.renderObjetivosBar('objetivosBarContainer');
  ObjetivosComponent.checkObjetivosNotificaciones();
};