/**
 * 🛠️ Formatters Utilities - Distribuciones ROCA
 * Utilidades para formatear datos de manera consistente
 */

/**
 * Formatea un valor numérico como moneda colombiana
 * @param {number} value - Valor a formatear
 * @param {boolean} showDecimals - Si mostrar decimales
 * @returns {string} - Valor formateado como COP
 */
export function formatCurrency(value, showDecimals = false) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '$0';
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0
  }).format(value);
}

/**
 * Formatea un valor como moneda colombiana (alias para compatibilidad)
 * @param {number} valor - Valor a formatear
 * @returns {string} - Valor formateado como COP
 */
export function formatCOP(valor) {
  if (typeof valor !== 'number' || isNaN(valor)) {
    return '$0';
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(valor);
}

/**
 * Formatea un número con separadores de miles
 * @param {number} value - Valor a formatear
 * @returns {string} - Número formateado
 */
export function formatNumber(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }

  return new Intl.NumberFormat('es-CO').format(value);
}

/**
 * Formatea una fecha en formato legible
 * @param {string|Date} date - Fecha a formatear
 * @param {object} options - Opciones de formato
 * @returns {string} - Fecha formateada
 */
export function formatDate(date, options = {}) {
  if (!date) return 'Fecha no disponible';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Fecha inválida';
  }

  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Bogota'
  };

  const formatOptions = { ...defaultOptions, ...options };

  return new Intl.DateTimeFormat('es-CO', formatOptions).format(dateObj);
}

/**
 * Formatea una fecha con hora
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} - Fecha y hora formateada
 */
export function formatDateTime(date) {
  return formatDate(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formatea una fecha de manera compacta
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} - Fecha compacta (dd/mm/yyyy)
 */
export function formatDateCompact(date) {
  if (!date) return '--/--/----';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '--/--/----';
  }

  return dateObj.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Bogota'
  });
}

/**
 * Formatea el tiempo relativo (hace X tiempo)
 * @param {string|Date} date - Fecha a comparar
 * @returns {string} - Tiempo relativo
 */
export function formatRelativeTime(date) {
  if (!date) return 'Fecha desconocida';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Fecha inválida';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now - dateObj) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Hace unos segundos';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `Hace ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `Hace ${hours} hora${hours !== 1 ? 's' : ''}`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `Hace ${days} día${days !== 1 ? 's' : ''}`;
  } else if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `Hace ${months} mes${months !== 1 ? 'es' : ''}`;
  } else {
    const years = Math.floor(diffInSeconds / 31536000);
    return `Hace ${years} año${years !== 1 ? 's' : ''}`;
  }
}

/**
 * Formatea un porcentaje
 * @param {number} value - Valor decimal (0.15 para 15%)
 * @param {number} decimals - Número de decimales
 * @returns {string} - Porcentaje formateado
 */
export function formatPercentage(value, decimals = 1) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }

  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Formatea un número de teléfono colombiano
 * @param {string} phone - Número de teléfono
 * @returns {string} - Teléfono formateado
 */
export function formatPhone(phone) {
  if (!phone) return 'No especificado';

  // Remover todo excepto números
  const cleanPhone = phone.replace(/\D/g, '');

  // Formatear según la longitud
  if (cleanPhone.length === 10) {
    // Móvil: 3XX XXX XXXX
    return cleanPhone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
  } else if (cleanPhone.length === 7) {
    // Fijo: XXX XXXX
    return cleanPhone.replace(/(\d{3})(\d{4})/, '$1 $2');
  }

  return phone;
}

/**
 * Formatea un NIT colombiano
 * @param {string} nit - Número de NIT
 * @returns {string} - NIT formateado
 */
export function formatNIT(nit) {
  if (!nit) return 'No especificado';

  // Remover caracteres no numéricos excepto guión
  const cleanNIT = nit.replace(/[^\d-]/g, '');

  // Si ya tiene formato correcto, devolverlo
  if (cleanNIT.includes('-')) {
    return cleanNIT;
  }

  // Agregar guión antes del último dígito si tiene al menos 2 dígitos
  if (cleanNIT.length >= 2) {
    return cleanNIT.slice(0, -1) + '-' + cleanNIT.slice(-1);
  }

  return cleanNIT;
}

/**
 * Formatea el tamaño de archivo
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} - Tamaño formateado
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Capitaliza la primera letra de cada palabra
 * @param {string} str - Cadena a formatear
 * @returns {string} - Cadena capitalizada
 */
export function capitalize(str) {
  if (typeof str !== 'string') return '';

  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Trunca un texto a cierta longitud
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @param {string} suffix - Sufijo a agregar
 * @returns {string} - Texto truncado
 */
export function truncateText(text, maxLength = 50, suffix = '...') {
  if (typeof text !== 'string') return '';

  if (text.length <= maxLength) return text;

  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Formatea una dirección de manera consistente
 * @param {string} address - Dirección
 * @returns {string} - Dirección formateada
 */
export function formatAddress(address) {
  if (!address) return 'Dirección no especificada';

  return capitalize(address.trim());
}

/**
 * Formatea un stock con su unidad
 * @param {number} stock - Cantidad en stock
 * @param {string} unit - Unidad de medida
 * @returns {string} - Stock formateado
 */
export function formatStock(stock, unit = 'unid.') {
  if (typeof stock !== 'number' || isNaN(stock)) {
    return `0 ${unit}`;
  }

  // Manejar cantidades decimales para productos como "mitad"
  if (stock % 1 !== 0) {
    return `${stock.toFixed(1)} ${unit}`;
  }

  return `${formatNumber(stock)} ${unit}`;
}

/**
 * Formatea un estado de manera visual
 * @param {string} status - Estado
 * @returns {object} - Objeto con clase y texto
 */
export function formatStatus(status) {
  const statusMap = {
    // Estados de productos
    'disponible': { class: 'success', text: 'Disponible', icon: 'bi-check-circle' },
    'agotado': { class: 'danger', text: 'Agotado', icon: 'bi-x-circle' },
    'bajo_stock': { class: 'warning', text: 'Stock Bajo', icon: 'bi-exclamation-triangle' },
    
    // Estados de deudas
    'pendiente': { class: 'warning', text: 'Pendiente', icon: 'bi-clock' },
    'pagado': { class: 'success', text: 'Pagado', icon: 'bi-check-circle' },
    'vencido': { class: 'danger', text: 'Vencido', icon: 'bi-exclamation-triangle' },
    
    // Estados de ventas
    'completada': { class: 'success', text: 'Completada', icon: 'bi-check-circle' },
    'cancelada': { class: 'danger', text: 'Cancelada', icon: 'bi-x-circle' },
    'procesando': { class: 'info', text: 'Procesando', icon: 'bi-clock' },
    
    // Estado por defecto
    'default': { class: 'secondary', text: 'Sin estado', icon: 'bi-question-circle' }
  };

  return statusMap[status?.toLowerCase()] || statusMap.default;
}

/**
 * Formatea una lista de elementos para mostrar
 * @param {Array} items - Lista de elementos
 * @param {string} property - Propiedad a mostrar de cada elemento
 * @param {number} maxItems - Máximo número de elementos a mostrar
 * @returns {string} - Lista formateada
 */
export function formatList(items, property = 'nombre', maxItems = 3) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Sin elementos';
  }

  const displayItems = items.slice(0, maxItems);
  const displayText = displayItems
    .map(item => typeof item === 'string' ? item : item[property] || 'Sin nombre')
    .join(', ');

  if (items.length > maxItems) {
    return `${displayText} y ${items.length - maxItems} más...`;
  }

  return displayText;
}

/**
 * Formatea distancia entre dos coordenadas
 * @param {number} lat1 - Latitud punto 1
 * @param {number} lon1 - Longitud punto 1
 * @param {number} lat2 - Latitud punto 2
 * @param {number} lon2 - Longitud punto 2
 * @returns {string} - Distancia formateada
 */
export function formatDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 'Distancia no disponible';

  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  if (distance < 1) {
    return `${Math.round(distance * 1000)} metros`;
  } else {
    return `${distance.toFixed(1)} km`;
  }
}

/**
 * Formatea tiempo transcurrido
 * @param {number} seconds - Segundos transcurridos
 * @returns {string} - Tiempo formateado (HH:MM:SS)
 */
export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) {
    return '00:00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return [hours, minutes, secs]
    .map(v => v.toString().padStart(2, '0'))
    .join(':');
}

/**
 * Formatea JSON de manera legible
 * @param {object} data - Datos a formatear
 * @param {number} indent - Espacios de indentación
 * @returns {string} - JSON formateado
 */
export function formatJSON(data, indent = 2) {
  try {
    return JSON.stringify(data, null, indent);
  } catch (error) {
    console.error('Error formateando JSON:', error);
    return 'Error al formatear datos';
  }
}

/**
 * Formatea texto para URL (slug)
 * @param {string} text - Texto a convertir
 * @returns {string} - Slug generado
 */
export function formatSlug(text) {
  if (typeof text !== 'string') return '';

  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9 -]/g, '') // Solo letras, números, espacios y guiones
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/-+/g, '-') // Múltiples guiones a uno solo
    .trim('-'); // Remover guiones al inicio y final
}

// Alias para mantener compatibilidad con código existente
export const formatoCOP = formatCOP;
export const formatoFecha = formatDate;
export const formatoPorcentaje = formatPercentage;

// Exportar todas las funciones como un objeto para uso opcional
export default {
  formatCurrency,
  formatCOP,
  formatNumber,
  formatDate,
  formatDateTime,
  formatDateCompact,
  formatRelativeTime,
  formatPercentage,
  formatPhone,
  formatNIT,
  formatFileSize,
  capitalize, 
  truncateText,
  formatAddress,
  formatStock,
  formatStatus,
  formatList,
  formatDistance,
  formatDuration,
  formatJSON,
  formatSlug,
  // Alias
  formatoCOP,
  formatoFecha,
  formatoPorcentaje
};