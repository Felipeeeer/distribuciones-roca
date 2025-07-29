/**
 * 🛠️ Helpers - Distribuciones ROCA
 * Utilidades generales y funciones de conveniencia
 */

/**
 * 🔧 Utilidades DOM
 */
export const DOMUtils = {
  /**
   * Selecciona elemento con manejo de errores
   */
  select(selector, context = document) {
    try {
      return context.querySelector(selector);
    } catch (error) {
      console.error(`Error seleccionando elemento: ${selector}`, error);
      return null;
    }
  },

  /**
   * Selecciona múltiples elementos
   */
  selectAll(selector, context = document) {
    try {
      return Array.from(context.querySelectorAll(selector));
    } catch (error) {
      console.error(`Error seleccionando elementos: ${selector}`, error);
      return [];
    }
  },

  /**
   * Crea elemento con atributos
   */
  createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    if (content) {
      element.textContent = content;
    }
    
    return element;
  },

  /**
   * Verifica si elemento está visible
   */
  isVisible(element) {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  },

  /**
   * Hace scroll hacia un elemento
   */
  scrollToElement(element, behavior = 'smooth', block = 'center') {
    if (element) {
      element.scrollIntoView({ behavior, block });
    }
  },

  /**
   * Copia texto al portapapeles
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fallback para navegadores sin API clipboard
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      } catch (fallbackError) {
        document.body.removeChild(textArea);
        console.error('Error copiando al portapapeles:', fallbackError);
        return false;
      }
    }
  },

  /**
   * Detecta tipo de dispositivo
   */
  getDeviceType() {
    const userAgent = navigator.userAgent;
    
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    }
    
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
      return 'mobile';
    }
    
    return 'desktop';
  },

  /**
   * Detecta si es iOS
   */
  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },

  /**
   * Detecta modo oscuro
   */
  isDarkMode() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  },

  /**
   * Añade listeners de eventos múltiples
   */
  addEventListeners(element, events, handler) {
    events.split(' ').forEach(event => {
      element.addEventListener(event, handler);
    });
  },

  /**
   * Remueve listeners de eventos múltiples
   */
  removeEventListeners(element, events, handler) {
    events.split(' ').forEach(event => {
      element.removeEventListener(event, handler);
    });
  }
};

/**
 * 📊 Utilidades de datos
 */
export const DataUtils = {
  /**
   * Genera ID único
   */
  generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Clona objeto profundamente
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (typeof obj === 'object') {
      const clonedObj = {};
      Object.keys(obj).forEach(key => {
        clonedObj[key] = this.deepClone(obj[key]);
      });
      return clonedObj;
    }
  },

  /**
   * Agrupa array por propiedad
   */
  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  },

  /**
   * Ordena array por múltiples criterios
   */
  sortBy(array, ...keys) {
    return array.sort((a, b) => {
      for (let key of keys) {
        let dir = 1;
        if (key.startsWith('-')) {
          dir = -1;
          key = key.substring(1);
        }
        
        const aVal = this.getNestedValue(a, key);
        const bVal = this.getNestedValue(b, key);
        
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
      }
      return 0;
    });
  },

  /**
   * Obtiene valor anidado de objeto
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  },

  /**
   * Establece valor anidado en objeto
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  },

  /**
   * Filtra array con múltiples condiciones
   */
  filterBy(array, filters) {
    return array.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        const itemValue = this.getNestedValue(item, key);
        
        if (typeof value === 'string') {
          return itemValue?.toString().toLowerCase().includes(value.toLowerCase());
        }
        
        if (typeof value === 'function') {
          return value(itemValue, item);
        }
        
        return itemValue === value;
      });
    });
  },

  /**
   * Busca en array por texto
   */
  searchInArray(array, searchTerm, searchFields) {
    const term = searchTerm.toLowerCase();
    
    return array.filter(item => {
      return searchFields.some(field => {
        const value = this.getNestedValue(item, field);
        return value?.toString().toLowerCase().includes(term);
      });
    });
  },

  /**
   * Pagina array
   */
  paginate(array, page, size) {
    const start = (page - 1) * size;
    const end = start + size;
    
    return {
      data: array.slice(start, end),
      totalItems: array.length,
      totalPages: Math.ceil(array.length / size),
      currentPage: page,
      hasNext: end < array.length,
      hasPrev: page > 1
    };
  },

  /**
   * Elimina duplicados por propiedad
   */
  uniqueBy(array, key) {
    const seen = new Set();
    return array.filter(item => {
      const value = this.getNestedValue(item, key);
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  },

  /**
   * Calcula estadísticas básicas
   */
  calculateStats(array, key) {
    const values = array.map(item => this.getNestedValue(item, key)).filter(val => !isNaN(val));
    
    if (values.length === 0) return null;
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    const sorted = [...values].sort((a, b) => a - b);
    
    return {
      count: values.length,
      sum,
      average: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      median: sorted[Math.floor(sorted.length / 2)]
    };
  }
};

/**
 * 📅 Utilidades de fecha y tiempo
 */
export const DateUtils = {
  /**
   * Formatea fecha para input
   */
  formatForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },

  /**
   * Formatea hora para input
   */
  formatTimeForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toTimeString().slice(0, 5);
  },

  /**
   * Obtiene inicio del día
   */
  startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  /**
   * Obtiene fin del día
   */
  endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  },

  /**
   * Añade días a fecha
   */
  addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  },

  /**
   * Añade meses a fecha
   */
  addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  },

  /**
   * Diferencia en días
   */
  daysDifference(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Verifica si es mismo día
   */
  isSameDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.toDateString() === d2.toDateString();
  },

  /**
   * Verifica si es hoy
   */
  isToday(date) {
    return this.isSameDay(date, new Date());
  },

  /**
   * Obtiene rango de fechas
   */
  getDateRange(period) {
    const today = new Date();
    const startOfDay = this.startOfDay(today);
    const endOfDay = this.endOfDay(today);
    
    switch (period) {
      case 'today':
        return { start: startOfDay, end: endOfDay };
      
      case 'yesterday':
        const yesterday = this.addDays(startOfDay, -1);
        return { start: yesterday, end: this.endOfDay(yesterday) };
      
      case 'week':
        const startOfWeek = this.addDays(startOfDay, -startOfDay.getDay());
        return { start: startOfWeek, end: endOfDay };
      
      case 'month':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: startOfMonth, end: endOfDay };
      
      case 'year':
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        return { start: startOfYear, end: endOfDay };
      
      default:
        return { start: startOfDay, end: endOfDay };
    }
  },

  /**
   * Formatea duración
   */
  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
};

/**
 * 🌐 Utilidades de red y APIs
 */
export const NetworkUtils = {
  /**
   * Detecta estado de conexión
   */
  isOnline() {
    return navigator.onLine;
  },

  /**
   * Monitorea cambios de conexión
   */
  onConnectionChange(callback) {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
  },

  /**
   * Realiza petición con reintentos
   */
  async fetchWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
      } catch (error) {
        lastError = error;
        if (i < maxRetries) {
          // Esperar antes del siguiente intento
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }
    
    throw lastError;
  },

  /**
   * Descarga archivo
   */
  downloadFile(data, filename, type = 'application/octet-stream') {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Convierte a CSV
   */
  arrayToCSV(array, headers = null) {
    if (!array.length) return '';
    
    const csvHeaders = headers || Object.keys(array[0]);
    const csvRows = [csvHeaders.join(',')];
    
    array.forEach(item => {
      const row = csvHeaders.map(header => {
        const value = item[header];
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      });
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }
};

/**
 * 🎨 Utilidades de interfaz
 */
export const UIUtils = {
  /**
   * Debounce función
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle función
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Anima valor numérico
   */
  animateValue(element, start, end, duration = 1000, formatter = null) {
    const startTime = performance.now();
    const difference = end - start;
    
    const updateValue = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = start + (difference * easedProgress);
      
      element.textContent = formatter ? formatter(currentValue) : Math.floor(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(updateValue);
      }
    };
    
    requestAnimationFrame(updateValue);
  },

  /**
   * Calcula posición para tooltip
   */
  calculateTooltipPosition(trigger, tooltip, placement = 'top') {
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    let top, left;
    
    switch (placement) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = triggerRect.bottom + 8;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.left - tooltipRect.width - 8;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.right + 8;
        break;
    }
    
    // Ajustar si se sale del viewport
    if (left < 0) left = 8;
    if (left + tooltipRect.width > viewport.width) {
      left = viewport.width - tooltipRect.width - 8;
    }
    if (top < 0) top = 8;
    if (top + tooltipRect.height > viewport.height) {
      top = viewport.height - tooltipRect.height - 8;
    }
    
    return { top, left };
  },

  /**
   * Genera color aleatorio
   */
  randomColor() {
    const colors = [
      '#007AFF', '#34C759', '#FF9500', '#FF3B30', 
      '#AF52DE', '#5AC8FA', '#FFCC02', '#FF2D92'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  },

  /**
   * Convierte color hex a rgba
   */
  hexToRgba(hex, alpha = 1) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;
    
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
};

/**
 * 🔄 Utilidades de performance
 */
export const PerformanceUtils = {
  /**
   * Mide tiempo de ejecución
   */
  measureTime(name, func) {
    const start = performance.now();
    const result = func();
    const end = performance.now();
    console.log(`${name} ejecutado en ${end - start} milisegundos`);
    return result;
  },

  /**
   * Ejecuta función cuando el DOM esté listo
   */
  onDOMReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  },

  /**
   * Lazy loading de imágenes
   */
  setupLazyLoading() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            observer.unobserve(img);
          }
        });
      });
      
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  },

  /**
   * Preload recursos críticos
   */
  preloadResources(resources) {
    resources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.href;
      link.as = resource.as || 'fetch';
      if (resource.type) link.type = resource.type;
      document.head.appendChild(link);
    });
  }
};

/**
 * 🏪 Utilidades específicas del negocio
 */
export const BusinessUtils = {
  /**
   * Calcula descuento
   */
  calculateDiscount(price, discountPercent) {
    const discount = (price * discountPercent) / 100;
    return {
      originalPrice: price,
      discountAmount: discount,
      finalPrice: price - discount,
      discountPercent
    };
  },

  /**
   * Calcula impuestos
   */
  calculateTax(amount, taxRate = 19) {
    const tax = (amount * taxRate) / 100;
    return {
      subtotal: amount,
      taxAmount: tax,
      total: amount + tax,
      taxRate
    };
  },

  /**
   * Formatea número de factura
   */
  formatInvoiceNumber(number, prefix = 'F', padding = 6) {
    return `${prefix}${number.toString().padStart(padding, '0')}`;
  },

  /**
   * Valida código de barras
   */
  validateBarcode(barcode) {
    // Validación básica para códigos EAN-13
    if (!/^\d{13}$/.test(barcode)) return false;
    
    const digits = barcode.split('').map(Number);
    const checksum = digits.pop();
    
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    }
    
    const calculatedChecksum = (10 - (sum % 10)) % 10;
    return calculatedChecksum === checksum;
  },

  /**
   * Genera código de referencia único
   */
  generateReference(prefix = 'REF') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
  }
};

// Hacer disponibles globalmente las utilidades más usadas
window.DOMUtils = DOMUtils;
window.DataUtils = DataUtils;
window.DateUtils = DateUtils;
window.UIUtils = UIUtils;
window.BusinessUtils = BusinessUtils;

// Funciones de conveniencia globales
window.$ = DOMUtils.select;
window.$$ = DOMUtils.selectAll;
window.debounce = UIUtils.debounce;
window.throttle = UIUtils.throttle;

/**
 * Obtiene la ruta base correcta para los assets según la ubicación de la página
 * @returns {string} Ruta base para assets
 */
export function getAssetsBasePath() {
  // Obtener la ruta actual
  const currentPath = window.location.pathname;
  
  // Si estamos en el directorio raíz (index.html)
  if (currentPath === '/' || currentPath.endsWith('index.html') || currentPath.endsWith('/')) {
    return 'assets/';
  }
  
  // Si estamos en un subdirectorio (pages/)
  if (currentPath.includes('/pages/')) {
    return '../assets/';
  }
  
  // Por defecto, asumir que estamos en el directorio raíz
  return 'assets/';
}

/**
 * Construye la ruta completa para un asset
 * @param {string} assetPath - Ruta del asset (ej: 'sounds/notification.mp3')
 * @returns {string} Ruta completa del asset
 */
export function getAssetPath(assetPath) {
  return getAssetsBasePath() + assetPath;
}

export default {
  DOMUtils,
  DataUtils,
  DateUtils,
  NetworkUtils,
  UIUtils,
  PerformanceUtils,
  BusinessUtils
};