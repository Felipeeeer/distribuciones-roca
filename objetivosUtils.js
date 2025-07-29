// Fase 1: Utilidades de Objetivos - Placeholder
// Aquí irán validaciones y helpers para los objetivos

// Fase 2: Visualización y Seguimiento
// Fase 3: Notificaciones Inteligentes
// Fase 4: Creación Inteligente de Objetivos 

export function validarObjetivo(obj) {
  if (!obj.nombre || obj.nombre.length < 3) return 'El nombre es obligatorio (mínimo 3 caracteres).';
  if (!obj.tipo) return 'Selecciona el tipo de objetivo.';
  if (!obj.meta || isNaN(obj.meta) || Number(obj.meta) <= 0) return 'La meta debe ser un número mayor a 0.';
  if (!obj.fechaInicio) return 'La fecha de inicio es obligatoria.';
  if (!obj.fechaFin) return 'La fecha de fin es obligatoria.';
  if (new Date(obj.fechaFin) < new Date(obj.fechaInicio)) return 'La fecha de fin debe ser igual o posterior a la de inicio.';
  // Validaciones específicas por tipo
  if ((obj.tipo === 'ventas' || obj.tipo === 'ganancias') && Number(obj.meta) < 100) return 'La meta debe ser al menos $100.';
  if (obj.tipo === 'clientes' && Number(obj.meta) < 1) return 'La meta de clientes debe ser al menos 1.';
  if (obj.tipo === 'inventario' && Number(obj.meta) < 1) return 'La meta de inventario debe ser al menos 1.';
  // crecimiento general puede ser cualquier meta positiva
  return '';
} 