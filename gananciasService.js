// Servicios de Ganancias
// Aquí irán las funciones de comunicación con Firebase y lógica de negocio

import { db } from '../config/firebase.js';
import {
  ref,
  onValue,
  push,
  update,
  remove,
  set,
  get
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

import { validarRetiroGanancia } from '../utils/gananciasUtils.js';
import * as CashFlowService from './cashFlowService.js';

export function cargarGanancias(onGananciasCargadas) {
  const gananciasRef = ref(db, 'ganancias');
  onValue(gananciasRef, (snapshot) => {
    const gananciasCache = {};
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        gananciasCache[childSnapshot.key] = { id: childSnapshot.key, ...childSnapshot.val() };
      });
    }
    if (onGananciasCargadas) {
      onGananciasCargadas(gananciasCache);
    }
  }, (error) => {
    console.error("Error al cargar ganancias:", error);
    throw error;
  });
}

export async function registrarRetiroGanancia(productoId, monto, motivo) {
  try {
    // Validar el retiro
    const gananciaRef = ref(db, `ganancias/${productoId}`);
    const gananciaSnap = await get(gananciaRef);
    
    if (!gananciaSnap.exists()) {
      throw new Error('Ganancia no encontrada');
    }
    
    const ganancia = gananciaSnap.val();
    const saldoDisponible = (ganancia.gananciaCliente || 0) + (ganancia.gananciaDistribuidor || 0);
    
    validarRetiroGanancia(monto, saldoDisponible);
    
    // Registrar el retiro
    const retiroData = {
      productoId,
      productoNombre: ganancia.nombre,
      monto,
      motivo: motivo || '',
      fecha: new Date().toISOString(),
      fechaRegistro: new Date().toISOString()
    };
    
    const retirosRef = ref(db, 'retiros_ganancias');
    await push(retirosRef, retiroData);
    await CashFlowService.recargarFlujoCaja();
    
    return true;
  } catch (error) {
    console.error("Error al registrar retiro de ganancia:", error);
    throw error;
  }
}

export async function obtenerRetirosGanancias() {
  try {
    const retirosRef = ref(db, 'retiros_ganancias');
    const retirosSnap = await get(retirosRef);
    
    if (retirosSnap.exists()) {
      return Object.values(retirosSnap.val());
    }
    
    return [];
  } catch (error) {
    console.error("Error al obtener retiros de ganancias:", error);
    throw error;
  }
}

export async function obtenerRetirosPorProducto(productoId) {
  try {
    const retiros = await obtenerRetirosGanancias();
    return retiros
      .filter(r => r.productoId === productoId)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  } catch (error) {
    console.error("Error al obtener retiros por producto:", error);
    throw error;
  }
}

export async function actualizarGanancia(productoId, datosGanancia) {
  try {
    const gananciaRef = ref(db, `ganancias/${productoId}`);
    await update(gananciaRef, {
      ...datosGanancia,
      fechaActualizacion: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error("Error al actualizar ganancia:", error);
    throw error;
  }
}

export async function crearGanancia(productoId, datosGanancia) {
  try {
    const gananciaRef = ref(db, `ganancias/${productoId}`);
    await set(gananciaRef, {
      ...datosGanancia,
      fechaCreacion: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error("Error al crear ganancia:", error);
    throw error;
  }
}

export async function eliminarGanancia(productoId) {
  try {
    const gananciaRef = ref(db, `ganancias/${productoId}`);
    await remove(gananciaRef);
    
    return true;
  } catch (error) {
    console.error("Error al eliminar ganancia:", error);
    throw error;
  }
}

export async function calcularGananciasPorVentas(ventasCache, productosCache) {
  try {
    const gananciasCalculadas = {};
    
    // Procesar cada venta para calcular ganancias
    ventasCache.forEach(venta => {
      const producto = productosCache.find(p => p.nombre === venta.producto);
      if (!producto) return;
      
      const productoId = producto.id;
      
      if (!gananciasCalculadas[productoId]) {
        gananciasCalculadas[productoId] = {
          id: productoId,
          nombre: producto.nombre,
          gananciaCliente: 0,
          gananciaDistribuidor: 0,
          ventasCliente: 0,
          ventasDistribuidor: 0
        };
      }
      
      const ganancia = gananciasCalculadas[productoId];
      const cantidad = venta.cantidad || 0;
      
      if (venta.tipoCliente === 'cliente') {
        const gananciaPorUnidad = (producto.precioCliente || 0) - (producto.precioCompra || 0);
        ganancia.gananciaCliente += gananciaPorUnidad * cantidad;
        ganancia.ventasCliente += cantidad;
      } else if (venta.tipoCliente === 'distribuidor') {
        const gananciaPorUnidad = (producto.precioDistribuidor || 0) - (producto.precioCompra || 0);
        ganancia.gananciaDistribuidor += gananciaPorUnidad * cantidad;
        ganancia.ventasDistribuidor += cantidad;
      }
    });
    
    return gananciasCalculadas;
  } catch (error) {
    console.error("Error al calcular ganancias por ventas:", error);
    throw error;
  }
}

export async function sincronizarGananciasConVentas(ventasCache, productosCache) {
  try {
    const gananciasCalculadas = await calcularGananciasPorVentas(ventasCache, productosCache);
    
    // Actualizar ganancias en Firebase
    for (const [productoId, ganancia] of Object.entries(gananciasCalculadas)) {
      if (ganancia.gananciaCliente > 0 || ganancia.gananciaDistribuidor > 0) {
        await actualizarGanancia(productoId, ganancia);
      }
    }
    
    return gananciasCalculadas;
  } catch (error) {
    console.error("Error al sincronizar ganancias con ventas:", error);
    throw error;
  }
}

export async function obtenerEstadisticasGanancias(gananciasCache) {
  try {
    const productosGanancias = Object.values(gananciasCache);
    
    const estadisticas = {
      totalProductos: productosGanancias.length,
      productosConGanancias: 0,
      gananciaTotal: 0,
      gananciaClienteTotal: 0,
      gananciaDistribuidorTotal: 0,
      gananciaPromedio: 0,
      productoConMayorGanancia: null
    };
    
    if (productosGanancias.length > 0) {
      productosGanancias.forEach(ganancia => {
        const gananciaCliente = ganancia.gananciaCliente || 0;
        const gananciaDist = ganancia.gananciaDistribuidor || 0;
        const gananciaTotal = gananciaCliente + gananciaDist;
        
        estadisticas.gananciaClienteTotal += gananciaCliente;
        estadisticas.gananciaDistribuidorTotal += gananciaDist;
        estadisticas.gananciaTotal += gananciaTotal;
        
        if (gananciaTotal > 0) {
          estadisticas.productosConGanancias++;
        }
      });
      
      // Producto con mayor ganancia
      const productoConMayorGanancia = productosGanancias.reduce((max, actual) => {
        const gananciaActual = (actual.gananciaCliente || 0) + (actual.gananciaDistribuidor || 0);
        const gananciaMax = (max.gananciaCliente || 0) + (max.gananciaDistribuidor || 0);
        return gananciaActual > gananciaMax ? actual : max;
      });
      
      estadisticas.productoConMayorGanancia = productoConMayorGanancia;
      estadisticas.gananciaPromedio = estadisticas.gananciaTotal / productosGanancias.length;
    }
    
    return estadisticas;
  } catch (error) {
    console.error("Error al obtener estadísticas de ganancias:", error);
    throw error;
  }
} 