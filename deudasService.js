import { db } from "../config/firebase.js";
import {
  ref,
  onValue,
  push,
  update,
  get
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

let listeners = [];

export async function registrarDeuda(deudaData) {
  const deudasRef = ref(db, 'deudas');
  const nuevaDeuda = {
    ...deudaData,
    montoPendiente: deudaData.montoOriginal,
    comprasFinanciadas: [],
    pagos: [],
    estado: 'pendiente',
    fecha: deudaData.fecha || new Date().toISOString()
  };
  await push(deudasRef, nuevaDeuda);
}

export async function obtenerDeudas() {
  const deudasRef = ref(db, 'deudas');
  const snapshot = await get(deudasRef);
  const deudas = [];
  if (snapshot.exists()) {
    snapshot.forEach(child => {
      deudas.push({ id: child.key, ...child.val() });
    });
  }
  return deudas;
}

export async function registrarPago(deudaId, pagoData) {
  const deudaRef = ref(db, `deudas/${deudaId}`);
  const deudaSnap = await get(deudaRef);
  if (!deudaSnap.exists()) throw new Error('Deuda no encontrada');
  const deuda = deudaSnap.val();
  const pagos = deuda.pagos || [];
  pagos.push(pagoData);
  const montoPendiente = Math.max(0, deuda.montoPendiente - pagoData.monto);
  const estado = montoPendiente === 0 ? 'pagada' : 'pendiente';
  await update(deudaRef, { pagos, montoPendiente, estado });
}

export async function asociarCompraFinanciada(deudaId, compraId, monto) {
  const deudaRef = ref(db, `deudas/${deudaId}`);
  const deudaSnap = await get(deudaRef);
  if (!deudaSnap.exists()) throw new Error('Deuda no encontrada');
  const deuda = deudaSnap.val();
  const comprasFinanciadas = deuda.comprasFinanciadas || [];
  comprasFinanciadas.push({ compraId, monto });
  await update(deudaRef, { comprasFinanciadas });
}

export async function eliminarCompraFinanciada(deudaId, compraId) {
  const deudaRef = ref(db, `deudas/${deudaId}`);
  const deudaSnap = await get(deudaRef);
  if (!deudaSnap.exists()) throw new Error('Deuda no encontrada');
  const deuda = deudaSnap.val();
  let comprasFinanciadas = deuda.comprasFinanciadas || [];
  comprasFinanciadas = comprasFinanciadas.filter(c => c.compraId !== compraId);
  await update(deudaRef, { comprasFinanciadas });
}

export async function obtenerResumenDeudas() {
  const deudas = await obtenerDeudas();
  let totalPendiente = 0;
  let totalOriginal = 0;
  let totalComprasFinanciadas = 0;
  deudas.forEach(d => {
    totalPendiente += d.montoPendiente || 0;
    totalOriginal += d.montoOriginal || 0;
    if (d.comprasFinanciadas) {
      totalComprasFinanciadas += d.comprasFinanciadas.reduce((sum, c) => sum + (c.monto || 0), 0);
    }
  });
  return { totalPendiente, totalOriginal, totalComprasFinanciadas };
}

export function suscribirseACambios(callback) {
  const deudasRef = ref(db, 'deudas');
  onValue(deudasRef, snapshot => {
    const deudas = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        deudas.push({ id: child.key, ...child.val() });
      });
    }
    callback(deudas);
  });
  listeners.push(callback);
} 