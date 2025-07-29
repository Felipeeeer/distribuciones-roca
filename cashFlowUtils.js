import { formatCurrency, formatNumber } from './formatters.js';

// --- Utilidades de Fechas ---

export function formatearFechaCompleta(fecha) {
  if (!fecha) return '';
  
  const fechaObj = new Date(fecha);
  return fechaObj.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatearFechaCorta(fecha) {
  if (!fecha) return '';
  
  const fechaObj = new Date(fecha);
  return fechaObj.toLocaleDateString('es-CO');
}

export function formatearHora(fecha) {
  if (!fecha) return '';
  
  const fechaObj = new Date(fecha);
  return fechaObj.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function obtenerRangoFechas(dias = 7) {
  const fechaFin = new Date();
  const fechaInicio = new Date();
  fechaInicio.setDate(fechaInicio.getDate() - dias);
  
  return {
    fechaInicio: fechaInicio.toISOString().split('T')[0],
    fechaFin: fechaFin.toISOString().split('T')[0]
  };
}

export function esMismoDia(fecha1, fecha2) {
  if (!fecha1 || !fecha2) return false;
  
  const d1 = new Date(fecha1).toISOString().split('T')[0];
  const d2 = new Date(fecha2).toISOString().split('T')[0];
  
  return d1 === d2;
}

// --- Utilidades de Cálculo ---

export function calcularSaldoAcumulado(movimientos, saldoInicial = 0) {
  let saldo = saldoInicial;
  
  // Ordenar movimientos por fecha (más antiguo primero)
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

export function calcularTendencia(periodoActual, periodoAnterior) {
  if (periodoAnterior === 0) {
    return periodoActual > 0 ? 100 : 0;
  }
  
  return ((periodoActual - periodoAnterior) / periodoAnterior) * 100;
}

export function obtenerClaseTendencia(tendencia) {
  if (tendencia > 5) return 'positive';
  if (tendencia < -5) return 'negative';
  return 'neutral';
}

export function obtenerIconoTendencia(tendencia) {
  if (tendencia > 5) return 'arrow-up';
  if (tendencia < -5) return 'arrow-down';
  return 'dash';
}

// --- Utilidades de Formateo ---

export function formatearMovimiento(movimiento) {
  return {
    ...movimiento,
    fechaFormateada: formatearFechaCorta(movimiento.fecha),
    horaFormateada: formatearHora(movimiento.fecha),
    montoFormateado: formatCurrency(movimiento.monto),
    saldoFormateado: formatCurrency(movimiento.saldoAcumulado || 0),
    tipoClase: movimiento.tipo === 'ingreso' ? 'success' : 'danger',
    iconoTipo: movimiento.tipo === 'ingreso' ? 'arrow-up-circle' : 'arrow-down-circle',
    signo: movimiento.tipo === 'ingreso' ? '+' : '-'
  };
}

export function formatearEstadisticas(estadisticas) {
  return {
    ...estadisticas,
    totalIngresosFormateado: formatCurrency(estadisticas.totalIngresos),
    totalEgresosFormateado: formatCurrency(estadisticas.totalEgresos),
    saldoFinalFormateado: formatCurrency(estadisticas.saldoFinal),
    promedioIngresosFormateado: formatCurrency(estadisticas.promedioIngresos),
    promedioEgresosFormateado: formatCurrency(estadisticas.promedioEgresos),
    mayorIngresoFormateado: formatCurrency(estadisticas.mayorIngreso),
    mayorEgresoFormateado: formatCurrency(estadisticas.mayorEgreso),
    cantidadMovimientosFormateado: formatNumber(estadisticas.cantidadMovimientos),
    diasConMovimientosFormateado: formatNumber(estadisticas.diasConMovimientos)
  };
}

// --- Utilidades de Validación ---

export function validarRangoFechas(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) {
    return { valido: false, mensaje: 'Ambas fechas son requeridas' };
  }
  
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
    return { valido: false, mensaje: 'Fechas inválidas' };
  }
  
  if (inicio > fin) {
    return { valido: false, mensaje: 'La fecha de inicio no puede ser posterior a la fecha de fin' };
  }
  
  const diferenciaDias = (fin - inicio) / (1000 * 60 * 60 * 24);
  if (diferenciaDias > 365) {
    return { valido: false, mensaje: 'El rango de fechas no puede exceder 1 año' };
  }
  
  return { valido: true };
}

export function validarMonto(monto) {
  if (typeof monto !== 'number' || isNaN(monto)) {
    return { valido: false, mensaje: 'El monto debe ser un número válido' };
  }
  
  if (monto < 0) {
    return { valido: false, mensaje: 'El monto no puede ser negativo' };
  }
  
  if (monto > 999999999) {
    return { valido: false, mensaje: 'El monto es demasiado alto' };
  }
  
  return { valido: true };
}

// --- Utilidades de Agrupación ---

export function agruparPorCategoria(movimientos) {
  const categorias = {};
  
  movimientos.forEach(movimiento => {
    const categoria = movimiento.categoria || 'otros';
    
    if (!categorias[categoria]) {
      categorias[categoria] = {
        nombre: categoria,
        ingresos: 0,
        egresos: 0,
        movimientos: []
      };
    }
    
    categorias[categoria].movimientos.push(movimiento);
    
    if (movimiento.tipo === 'ingreso') {
      categorias[categoria].ingresos += movimiento.monto;
    } else {
      categorias[categoria].egresos += movimiento.monto;
    }
  });
  
  return Object.values(categorias).map(cat => ({
    ...cat,
    saldo: cat.ingresos - cat.egresos,
    ingresosFormateado: formatCurrency(cat.ingresos),
    egresosFormateado: formatCurrency(cat.egresos),
    saldoFormateado: formatCurrency(cat.ingresos - cat.egresos)
  }));
}

export function agruparPorProveedor(movimientos) {
  const proveedores = {};
  
  movimientos.forEach(movimiento => {
    if (movimiento.tipo === 'egreso' && movimiento.proveedor) {
      if (!proveedores[movimiento.proveedor]) {
        proveedores[movimiento.proveedor] = {
          nombre: movimiento.proveedor,
          total: 0,
          movimientos: []
        };
      }
      
      proveedores[movimiento.proveedor].total += movimiento.monto;
      proveedores[movimiento.proveedor].movimientos.push(movimiento);
    }
  });
  
  return Object.values(proveedores)
    .map(prov => ({
      ...prov,
      totalFormateado: formatCurrency(prov.total)
    }))
    .sort((a, b) => b.total - a.total);
}

// --- Utilidades de Exportación ---

export function generarCSVFlujoCaja(movimientos, nombreArchivo = 'flujo_caja') {
  const headers = [
    'Fecha',
    'Hora',
    'Tipo',
    'Concepto',
    'Descripción',
    'Monto',
    'Saldo Acumulado'
  ];
  
  const filas = movimientos.map(mov => [
    formatearFechaCorta(mov.fecha),
    formatearHora(mov.fecha),
    mov.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
    mov.concepto,
    mov.descripcion,
    mov.monto,
    mov.saldoAcumulado || 0
  ]);
  
  const csvContent = [
    headers.join(','),
    ...filas.map(fila => fila.map(campo => `"${campo}"`).join(','))
  ].join('\n');
  
  return {
    contenido: csvContent,
    nombreArchivo: `${nombreArchivo}_${new Date().toISOString().split('T')[0]}.csv`
  };
}

// --- Utilidades de Análisis ---

export function calcularIndicadores(movimientos) {
  if (movimientos.length === 0) {
    return {
      liquidez: 0,
      rotacion: 0,
      eficiencia: 0
    };
  }
  
  const ingresos = movimientos.filter(m => m.tipo === 'ingreso');
  const egresos = movimientos.filter(m => m.tipo === 'egreso');
  
  const totalIngresos = ingresos.reduce((sum, m) => sum + m.monto, 0);
  const totalEgresos = egresos.reduce((sum, m) => sum + m.monto, 0);
  
  // Liquidez: capacidad de generar efectivo
  const liquidez = totalEgresos > 0 ? (totalIngresos / totalEgresos) * 100 : 0;
  
  // Rotación: frecuencia de movimientos
  const diasUnicos = new Set(movimientos.map(m => 
    m.fecha.toISOString().split('T')[0]
  )).size;
  const rotacion = diasUnicos > 0 ? movimientos.length / diasUnicos : 0;
  
  // Eficiencia: relación entre ingresos y egresos
  const eficiencia = totalEgresos > 0 ? 
    ((totalIngresos - totalEgresos) / totalEgresos) * 100 : 0;
  
  return {
    liquidez: Math.round(liquidez * 100) / 100,
    rotacion: Math.round(rotacion * 100) / 100,
    eficiencia: Math.round(eficiencia * 100) / 100
  };
}

// --- Utilidades de Persistencia ---

export function guardarConfiguracionFlujoCaja(config) {
  try {
    localStorage.setItem('cashFlowConfig', JSON.stringify(config));
    return true;
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    return false;
  }
}

export function cargarConfiguracionFlujoCaja() {
  try {
    const config = localStorage.getItem('cashFlowConfig');
    return config ? JSON.parse(config) : {
      vistaPorDefecto: 'detallado',
      rangoDiasPorDefecto: 7,
      mostrarSaldoInicial: true
    };
  } catch (error) {
    console.error('Error al cargar configuración:', error);
    return {
      vistaPorDefecto: 'detallado',
      rangoDiasPorDefecto: 7,
      mostrarSaldoInicial: true
    };
  }
} 