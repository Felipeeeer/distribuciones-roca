// ganancias.js
// Lógica de gestión de ganancias, retiros y su historial
import { db } from "../config/firebase.js";
import {
  ref,
  get,
  set,
  update,
  remove,
  push
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

/**
 * Elimina la ganancia asociada a una venta y actualiza los saldos.
 * @param {string} ventaId - ID de la venta a eliminar
 * @param {string} productoId - ID del producto asociado
 * @param {string} socioId - ID del socio (si aplica)
 */
export async function eliminarGananciaPorVenta(ventaId, productoId, socioId = null) {
  try {
    // 1. Eliminar la ganancia de la venta
    await remove(ref(db, `ganancias_ventas/${ventaId}`));

    // 2. Recalcular el saldo de ganancias del producto
    await recalcularGananciaProducto(productoId);

    // 3. Actualizar totales generales y por socio
    await actualizarTotalesGanancias(socioId);

    // 4. Registrar movimiento en historial
    await registrarHistorialGanancias({
      tipo: 'eliminacion',
      ventaId,
      productoId,
      socioId,
      fecha: new Date().toISOString(),
      descripcion: `Eliminación de venta y su ganancia asociada.`
    });
  } catch (error) {
    console.error('Error al eliminar ganancia por venta:', error);
    throw error;
  }
}

/**
 * Recalcula el saldo de ganancias de un producto.
 * @param {string} productoId
 */
export async function recalcularGananciaProducto(productoId) {
  // Implementar lógica para recalcular el saldo de ganancias del producto
  // Sumar todas las ganancias activas asociadas a este producto
  // Actualizar el nodo correspondiente en la base de datos
}

/**
 * Actualiza los totales generales y por socio (si aplica).
 * @param {string|null} socioId
 */
export async function actualizarTotalesGanancias(socioId = null) {
  // Implementar lógica para actualizar los totales generales y por socio
}

/**
 * Registra un movimiento en el historial de ganancias.
 * @param {object} movimiento
 */
export async function registrarHistorialGanancias(movimiento) {
  await push(ref(db, 'historial_ganancias'), movimiento);
}

/**
 * Registra un retiro de ganancia para un producto y descuenta el saldo.
 * @param {string} productoId
 * @param {number} monto
 * @param {string} motivo
 */
export async function registrarRetiroGanancia(productoId, monto, motivo = '') {
  // 1. Registrar el retiro en la colección de retiros
  const retiro = {
    productoId,
    monto,
    motivo,
    fecha: new Date().toISOString(),
  };
  await push(ref(db, 'retiros_ganancias'), retiro);

  // 2. Restar el saldo de ganancia del producto (del total, afectando primero Cliente y luego Distribuidor)
  const gananciaRef = ref(db, `ganancias/${productoId}`);
  const snapshot = await get(gananciaRef);
  if (!snapshot.exists()) throw new Error('No se encontró la ganancia del producto');
  const data = snapshot.val();
  let restante = monto;
  let updateData = {};
  // Restar primero de gananciaCliente
  const clienteActual = data.gananciaCliente || 0;
  if (clienteActual >= restante) {
    updateData.gananciaCliente = clienteActual - restante;
    restante = 0;
  } else {
    updateData.gananciaCliente = 0;
    restante -= clienteActual;
  }
  // Si queda por descontar, restar de gananciaDistribuidor
  const distActual = data.gananciaDistribuidor || 0;
  if (restante > 0) {
    if (distActual >= restante) {
      updateData.gananciaDistribuidor = distActual - restante;
      restante = 0;
    } else {
      updateData.gananciaDistribuidor = 0;
      restante -= distActual;
    }
  }
  if (restante > 0) throw new Error('El monto a retirar excede el saldo disponible');
  await update(gananciaRef, updateData);

  // 3. Registrar en historial
  await registrarHistorialGanancias({
    tipo: 'retiro',
    productoId,
    monto,
    motivo,
    fecha: retiro.fecha,
    descripcion: `Retiro de ganancia por ${motivo || 'sin motivo'}`
  });
}

// --- Espacio para futuras funciones de retiros y proyecciones ---

// export async function registrarRetiro(...) { ... }
// export async function calcularProyeccionFinanciera(...) { ... } 