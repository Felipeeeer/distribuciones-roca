// Utilidades de Ganancias
// Aquí irán funciones auxiliares para ganancias

import { formatCurrency, formatNumber } from './formatters.js';

export function calcularGananciaTotal(ganancia) {
  return (ganancia.gananciaCliente || 0) + (ganancia.gananciaDistribuidor || 0);
}

export function validarRetiroGanancia(monto, saldoDisponible) {
  if (monto <= 0) {
    throw new Error('El monto debe ser mayor a cero');
  }
  
  if (monto > saldoDisponible) {
    throw new Error('El monto excede el saldo disponible');
  }
  
  return true;
}

export function obtenerRetirosPorProducto(retiros, productoId) {
  return retiros
    .filter(r => r.productoId === productoId)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

export function calcularEstadisticasGanancias(gananciasCache) {
  const productosGanancias = Object.values(gananciasCache);
  
  const totales = {
    gananciaClienteTotal: 0,
    gananciaDistribuidorTotal: 0,
    gananciaTotal: 0,
    productosConGanancias: 0,
    productoConMayorGanancia: null,
    gananciaPromedio: 0
  };
  
  if (productosGanancias.length > 0) {
    productosGanancias.forEach(ganancia => {
      const gananciaCliente = ganancia.gananciaCliente || 0;
      const gananciaDist = ganancia.gananciaDistribuidor || 0;
      const gananciaTotal = gananciaCliente + gananciaDist;
      
      totales.gananciaClienteTotal += gananciaCliente;
      totales.gananciaDistribuidorTotal += gananciaDist;
      totales.gananciaTotal += gananciaTotal;
      
      if (gananciaTotal > 0) {
        totales.productosConGanancias++;
      }
    });
    
    // Producto con mayor ganancia
    const productoConMayorGanancia = productosGanancias.reduce((max, actual) => {
      const gananciaActual = calcularGananciaTotal(actual);
      const gananciaMax = calcularGananciaTotal(max);
      return gananciaActual > gananciaMax ? actual : max;
    });
    
    totales.productoConMayorGanancia = productoConMayorGanancia;
    totales.gananciaPromedio = totales.gananciaTotal / productosGanancias.length;
  }
  
  return totales;
}

export function crearSeccionGanancias() {
  const mainContent = document.querySelector('.main-content .container');
  if (!mainContent) return null;
  
  const section = document.createElement('section');
  section.className = 'data-section';
  section.innerHTML = `
    <div class="data-container">
      <div class="section-header">
        <h2><i class="bi bi-cash-coin"></i> Ganancias por Producto</h2>
      </div>
      <div id="gananciasProductosContainer"></div>
    </div>
  `;
  mainContent.appendChild(section);
  
  return section.querySelector('#gananciasProductosContainer');
}

export function detectarDispositivoMovil() {
  return window.innerWidth <= 700;
}

export function formatearFecha(fecha) {
  return new Date(fecha).toLocaleString('es-CO');
}

export function formatearMoneda(valor) {
  return formatCurrency(valor || 0);
}

export function obtenerSaldoDisponible(ganancia) {
  return calcularGananciaTotal(ganancia);
}

export function validarGanancia(ganancia) {
  if (!ganancia || !ganancia.nombre) {
    throw new Error('Ganancia inválida');
  }
  
  return true;
}

export function calcularProgresoReinversion(gananciaAcumulada, precioCompra) {
  const porcentaje = Math.min(100, (gananciaAcumulada / precioCompra) * 100);
  const recompras = Math.floor(gananciaAcumulada / precioCompra);
  return { porcentaje, recompras };
} 