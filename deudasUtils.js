export function formatearMonto(monto) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(monto || 0);
}

export function validarDeuda(deuda) {
  if (!deuda.prestamista || !deuda.montoOriginal || deuda.montoOriginal <= 0) {
    throw new Error('Datos de deuda inválidos');
  }
  return true;
}

export function validarPago(pago, deuda) {
  if (!pago.monto || pago.monto <= 0 || pago.monto > deuda.montoPendiente) {
    throw new Error('Monto de pago inválido');
  }
  return true;
}

export function calcularPendiente(deuda) {
  return Math.max(0, (deuda.montoOriginal || 0) - (deuda.pagos?.reduce((sum, p) => sum + (p.monto || 0), 0) || 0));
}

export function calcularPorcentajePagado(deuda) {
  if (!deuda.montoOriginal) return 0;
  const pagado = deuda.montoOriginal - (deuda.montoPendiente || 0);
  return Math.round((pagado / deuda.montoOriginal) * 100);
} 