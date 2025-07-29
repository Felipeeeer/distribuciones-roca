import { db } from "../config/firebase.js";
import {
  ref,
  onValue,
  get,
  update
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

import { 
  formatCurrency,
  formatNumber,
} from '../utils/formatters.js';

// --- Estado del Servicio ---
let cashFlowCache = {
  ventas: [],
  compras: [],
  movimientos: [],
  saldoInicial: 0,
  pagosDeuda: []
};

// Fecha de implementación del módulo de compras (miércoles 2 de julio de 2025)
let FECHA_IMPLEMENTACION_COMPRAS = new Date('2025-07-02T00:00:00.000Z');

// Función para configurar la fecha de implementación
export function configurarFechaImplementacion(fecha) {
  FECHA_IMPLEMENTACION_COMPRAS = new Date(fecha);
  console.log(`📅 Fecha de implementación configurada: ${FECHA_IMPLEMENTACION_COMPRAS.toISOString()}`);
  
  // Reprocesar movimientos con la nueva fecha
  procesarMovimientos();
}

let listeners = [];

// --- Funciones de Carga de Datos ---

export async function cargarDatosFlujoCaja() {
  try {
    await Promise.all([
      cargarVentas(),
      cargarCompras(),
      cargarPagosDeuda()
    ]);
    
    procesarMovimientos();
    
    return true;
  } catch (error) {
    console.error("❌ Error al cargar datos del flujo de caja:", error);
    throw error;
  }
}

function cargarVentas() {
  return new Promise((resolve) => {
    const ventasRef = ref(db, 'ventas');
    onValue(ventasRef, (snapshot) => {
      cashFlowCache.ventas = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const venta = { id: childSnapshot.key, ...childSnapshot.val() };
          // Incluir todas las ventas que tengan total y fecha
          // Las ventas se consideran válidas si tienen total > 0
          if (venta.total > 0 && venta.fecha) {
            cashFlowCache.ventas.push(venta);
          }
        });
      }
      resolve();
    }, (error) => {
      console.error("Error al cargar ventas para flujo de caja:", error);
      resolve();
    });
  });
}

function cargarCompras() {
  return new Promise((resolve) => {
    const comprasRef = ref(db, 'compras');
    onValue(comprasRef, (snapshot) => {
      cashFlowCache.compras = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          cashFlowCache.compras.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
      }
      resolve();
    }, (error) => {
      console.error("Error al cargar compras para flujo de caja:", error);
      resolve();
    });
  });
}

function cargarPagosDeuda() {
  return new Promise((resolve) => {
    const deudasRef = ref(db, 'deudas');
    onValue(deudasRef, (snapshot) => {
      const pagos = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const deuda = child.val();
          if (deuda.pagos && Array.isArray(deuda.pagos)) {
            deuda.pagos.forEach(pago => {
              pagos.push({
                ...pago,
                deudaId: child.key,
                prestamista: deuda.prestamista
              });
            });
          }
        });
      }
      cashFlowCache.pagosDeuda = pagos;
      resolve();
    }, (error) => {
      console.error("Error al cargar pagos de deuda:", error);
      resolve();
    });
  });
}

// --- Procesamiento de Movimientos ---

function procesarMovimientos() {
  const movimientos = [];
  
  // Procesar ventas como ingresos (solo las posteriores a la implementación de compras)
  cashFlowCache.ventas.forEach(venta => {
    // Las ventas tienen campo 'total' no 'valorTotal'
    const monto = parseFloat(venta.total) || 0;
    const fecha = new Date(venta.fecha);
    
    // Solo incluir ventas posteriores a la implementación del módulo de compras
    if (monto > 0 && fecha && fecha >= FECHA_IMPLEMENTACION_COMPRAS) {
      // Obtener descripción de productos
      const productos = venta.productos || [];
      const descripcionProductos = productos.length > 0 
        ? productos.map(p => p.nombreProducto).join(', ')
        : 'Productos varios';
      
      movimientos.push({
        id: `venta_${venta.id}`,
        fecha: fecha,
        tipo: 'ingreso',
        concepto: 'Venta',
        descripcion: `Venta de ${descripcionProductos} a ${venta.cliente || 'cliente'}`,
        monto: monto,
        referencia: venta.id,
        categoria: 'ventas',
        cliente: venta.cliente,
        productos: productos
      });
    }
  });
  
  // Procesar compras como egresos (solo las posteriores a la implementación)
  cashFlowCache.compras.forEach(compra => {
    if (compra.valorTotal && compra.fecha) {
      const monto = parseFloat(compra.valorTotal) || 0;
      const fecha = new Date(compra.fecha);
      
      // Solo incluir compras posteriores a la implementación
      // --- NUEVO: Excluir compras financiadas ---
      if (fecha >= FECHA_IMPLEMENTACION_COMPRAS && !compra.financiada) {
        movimientos.push({
          id: `compra_${compra.id}`,
          fecha: fecha,
          tipo: 'egreso',
          concepto: 'Compra',
          descripcion: `Compra de ${compra.producto || 'producto'} a ${compra.proveedor || 'proveedor'}`,
          monto: monto,
          referencia: compra.id,
          categoria: 'compras'
        });
      }
    }
  });
  
  // --- NUEVO: Procesar pagos de deuda como egresos diferenciados ---
  (cashFlowCache.pagosDeuda || []).forEach(pago => {
    movimientos.push({
      id: `pagoDeuda_${pago.id}`,
      fecha: new Date(pago.fecha),
      tipo: 'egreso',
      concepto: 'Pago de deuda',
      descripcion: `Pago de deuda a ${pago.prestamista || 'prestamista'}`,
      monto: pago.monto,
      referencia: pago.deudaId,
      categoria: 'pagosDeuda'
    });
  });
  
  // Ordenar por fecha (más reciente primero)
  movimientos.sort((a, b) => b.fecha - a.fecha);
  
  cashFlowCache.movimientos = movimientos;
  
  // Notificar cambios para actualizar la interfaz
  notificarCambios();
}

// --- Cálculos de Saldo ---

export function calcularSaldoAcumulado(movimientos, saldoInicial = 0) {
  let saldo = saldoInicial;
  
  // Ordenar movimientos por fecha (más antiguo primero para cálculo correcto)
  const movimientosOrdenados = [...movimientos].sort((a, b) => a.fecha - b.fecha);
  
  return movimientosOrdenados.map(movimiento => {
    if (movimiento.tipo === 'ingreso') {
      saldo += movimiento.monto;
    } else {
      saldo -= movimiento.monto;
    }
    
    return {
      ...movimiento,
      saldoAcumulado: saldo
    };
  }).sort((a, b) => b.fecha - a.fecha); // Volver a ordenar por fecha descendente
}

export function calcularSaldoInicial(fechaInicio) {
  if (!fechaInicio) return 0;
  
  const fechaInicioObj = new Date(fechaInicio);
  const movimientosAnteriores = cashFlowCache.movimientos.filter(m => 
    m.fecha < fechaInicioObj
  );
  
  let saldo = 0;
  movimientosAnteriores.forEach(m => {
    if (m.tipo === 'ingreso') {
      saldo += m.monto;
    } else {
      saldo -= m.monto;
    }
  });
  
  return saldo;
}

// --- Filtros ---

export function filtrarMovimientosPorFecha(fechaInicio, fechaFin) {
  let movimientosFiltrados = [...cashFlowCache.movimientos];
  
  if (fechaInicio) {
    const fechaInicioObj = new Date(fechaInicio);
    fechaInicioObj.setHours(0, 0, 0, 0);
    movimientosFiltrados = movimientosFiltrados.filter(m => 
      m.fecha >= fechaInicioObj
    );
  }
  
  if (fechaFin) {
    const fechaFinObj = new Date(fechaFin);
    fechaFinObj.setHours(23, 59, 59, 999);
    movimientosFiltrados = movimientosFiltrados.filter(m => 
      m.fecha <= fechaFinObj
    );
  }
  
  return movimientosFiltrados;
}

export function agruparMovimientosPorDia(movimientos) {
  const grupos = {};
  
  movimientos.forEach(movimiento => {
    const fecha = movimiento.fecha.toISOString().split('T')[0];
    
    if (!grupos[fecha]) {
      grupos[fecha] = {
        fecha: fecha,
        fechaObj: new Date(fecha),
        ingresos: 0,
        egresos: 0,
        movimientos: []
      };
    }
    
    grupos[fecha].movimientos.push(movimiento);
    
    if (movimiento.tipo === 'ingreso') {
      grupos[fecha].ingresos += movimiento.monto;
    } else {
      grupos[fecha].egresos += movimiento.monto;
    }
  });
  
  // Convertir a array y ordenar por fecha descendente
  return Object.values(grupos).sort((a, b) => b.fechaObj - a.fechaObj);
}

// --- Análisis y Estadísticas ---

export function calcularEstadisticas(movimientos) {
  const estadisticas = {
    totalIngresos: 0,
    totalEgresos: 0,
    saldoFinal: 0,
    cantidadMovimientos: movimientos.length,
    promedioIngresos: 0,
    promedioEgresos: 0,
    mayorIngreso: 0,
    mayorEgreso: 0,
    diasConMovimientos: new Set()
  };
  
  const ingresos = [];
  const egresos = [];
  
  movimientos.forEach(movimiento => {
    estadisticas.diasConMovimientos.add(movimiento.fecha.toISOString().split('T')[0]);
    
    if (movimiento.tipo === 'ingreso') {
      estadisticas.totalIngresos += movimiento.monto;
      ingresos.push(movimiento.monto);
      estadisticas.mayorIngreso = Math.max(estadisticas.mayorIngreso, movimiento.monto);
    } else {
      estadisticas.totalEgresos += movimiento.monto;
      egresos.push(movimiento.monto);
      estadisticas.mayorEgreso = Math.max(estadisticas.mayorEgreso, movimiento.monto);
    }
  });
  
  estadisticas.saldoFinal = estadisticas.totalIngresos - estadisticas.totalEgresos;
  estadisticas.promedioIngresos = ingresos.length > 0 ? estadisticas.totalIngresos / ingresos.length : 0;
  estadisticas.promedioEgresos = egresos.length > 0 ? estadisticas.totalEgresos / egresos.length : 0;
  estadisticas.diasConMovimientos = estadisticas.diasConMovimientos.size;
  
  return estadisticas;
}

// --- Funciones de Utilidad ---

export function obtenerMovimientos() {
  return cashFlowCache.movimientos;
}

export function obtenerEstadisticasGenerales() {
  return calcularEstadisticas(cashFlowCache.movimientos);
}

export function formatearMovimiento(movimiento) {
  return {
    ...movimiento,
    fechaFormateada: movimiento.fecha.toLocaleDateString('es-CO'),
    horaFormateada: movimiento.fecha.toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    montoFormateado: formatCurrency(movimiento.monto),
    saldoFormateado: formatCurrency(movimiento.saldoAcumulado || 0),
    tipoClase: movimiento.tipo === 'ingreso' ? 'success' : 'danger',
    iconoTipo: movimiento.tipo === 'ingreso' ? 'arrow-up-circle' : 'arrow-down-circle'
  };
}

// --- Sistema de Eventos ---

export function suscribirseACambios(callback) {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

function notificarCambios() {
  listeners.forEach(callback => {
    try {
      callback(cashFlowCache);
    } catch (error) {
      console.error("Error en callback de flujo de caja:", error);
    }
  });
}

// --- Inicialización ---

export function inicializarFlujoCaja() {
  cargarDatosFlujoCaja().then(() => {
    console.log('✅ Servicio de flujo de caja inicializado correctamente');
  }).catch((error) => {
    console.error('❌ Error al inicializar flujo de caja:', error);
  });
}

// Función para forzar recarga y debug
export async function recargarYDebug() {
  try {
    await cargarDatosFlujoCaja();
    debugCashFlow();
    return true;
  } catch (error) {
    console.error('❌ Error en recarga:', error);
    return false;
  }
}

// --- Funciones de Debug ---
export function debugCashFlow() {
  console.log('🔍 DEBUG - Estado del Flujo de Caja:');
  console.log('📅 Fecha de implementación:', FECHA_IMPLEMENTACION_COMPRAS.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }));
  console.log('📦 Ventas cargadas:', cashFlowCache.ventas.length);
  console.log('🛒 Compras cargadas:', cashFlowCache.compras.length);
  console.log('📊 Movimientos procesados:', cashFlowCache.movimientos.length);
  
  if (cashFlowCache.ventas.length > 0) {
    console.log('💰 Ejemplo de venta:', cashFlowCache.ventas[0]);
    console.log('📋 Todas las ventas:');
    cashFlowCache.ventas.forEach((venta, index) => {
      const fecha = new Date(venta.fecha);
      const esValida = fecha >= FECHA_IMPLEMENTACION_COMPRAS;
      const estado = esValida ? '✅ Incluida' : '⏰ Excluida (anterior)';
      console.log(`  ${index + 1}. ID: ${venta.id}, Cliente: ${venta.cliente}, Total: $${venta.total}, Fecha: ${fecha.toLocaleDateString()}, ${estado}`);
    });
  }
  
  if (cashFlowCache.movimientos.length > 0) {
    const ingresos = cashFlowCache.movimientos.filter(m => m.tipo === 'ingreso');
    const egresos = cashFlowCache.movimientos.filter(m => m.tipo === 'egreso');
    
    console.log('📈 Ingresos:', ingresos.length, 'movimientos');
    console.log('📉 Egresos:', egresos.length, 'movimientos');
    
    const totalIngresos = ingresos.reduce((sum, m) => sum + m.monto, 0);
    const totalEgresos = egresos.reduce((sum, m) => sum + m.monto, 0);
    
    console.log('💵 Total ingresos:', formatCurrency(totalIngresos));
    console.log('💸 Total egresos:', formatCurrency(totalEgresos));
    console.log('💳 Saldo final:', formatCurrency(totalIngresos - totalEgresos));
    
    console.log('📋 Detalle de ingresos:');
    ingresos.forEach((ingreso, index) => {
      console.log(`  ${index + 1}. ${ingreso.descripcion} - $${ingreso.monto} - ${ingreso.fecha.toLocaleDateString()}`);
    });
  }
  
  return cashFlowCache;
}

// --- Exportar funciones principales ---
export {
  cargarDatosFlujoCaja as recargarDatos,
  obtenerMovimientos as getMovimientos,
  filtrarMovimientosPorFecha as filtrarPorFecha,
  calcularSaldoAcumulado as calcularSaldo,
  agruparMovimientosPorDia as agruparPorDia,
  calcularEstadisticas as getEstadisticas
};

export async function obtenerCompraPorId(compraId) {
  const comprasRef = ref(db, `compras/${compraId}`);
  const snapshot = await get(comprasRef);
  if (!snapshot.exists()) return null;
  return { id: compraId, ...snapshot.val() };
}

export async function actualizarCompraFinanciamiento(compraId, { financiada, deudaId, montoFinanciado }) {
  const compraRef = ref(db, `compras/${compraId}`);
  const snapshot = await get(compraRef);
  if (!snapshot.exists()) throw new Error('Compra no encontrada');
  const compra = snapshot.val();
  // Actualizar campos
  const updateData = {
    financiada: !!financiada,
    deudaId: financiada ? deudaId : null,
    montoFinanciado: financiada ? montoFinanciado : null
  };
  await update(compraRef, updateData);
  // Actualizar asociación en la deuda
  if (financiada && deudaId) {
    // Asociar compra a la deuda
    const deudasService = await import('../services/deudasService.js');
    await deudasService.asociarCompraFinanciada(deudaId, compraId, montoFinanciado);
  }
  // Si se desmarca financiada, eliminar de la deuda anterior
  if (!financiada && compra.deudaId) {
    const deudasService = await import('../services/deudasService.js');
    await deudasService.eliminarCompraFinanciada(compra.deudaId, compraId);
  }
}

export const recargarFlujoCaja = cargarDatosFlujoCaja; 