/**
 * 🍞 Toast Notification System - Distribuciones ROCA
 * Sistema de notificaciones estilo iOS moderno
 */

import { getAssetPath } from '../utils/helpers.js';

class ToastManager {
  constructor() {
    this.container = null;
    this.toasts = new Map();
    this.zIndex = 1080;
    this.maxToasts = 5;
    this.defaultDuration = 4000;
    
    // Sistema de audio para notificaciones
    this.audioCache = {
      notification: null,
      success: null,
      error: null,
      warning: null,
      info: null
    };
    
    // Configuración de sonidos
    this.soundEnabled = this.getSoundPreference();
    
    this.init();
  }

  /**
   * Inicializa el contenedor de toasts
   */
  init() {
    this.createContainer();
    this.injectStyles();
    this.precargarAudios();
  }

  /**
   * Crea el contenedor principal de toasts
   */
  createContainer() {
    // Buscar contenedor existente
    this.container = document.getElementById('toastContainer');
    
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toastContainer';
      this.container.className = 'toast-container-ios';
      document.body.appendChild(this.container);
    }
  }

  /**
   * Inyecta los estilos CSS para los toasts
   */
  injectStyles() {
    const styleId = 'toast-ios-styles';
    
    if (document.getElementById(styleId)) {
      return; // Ya están inyectados
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .toast-container-ios {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: ${this.zIndex};
        pointer-events: none;
        max-width: 420px;
        width: 100%;
      }

      @media (max-width: 480px) {
        .toast-container-ios {
          top: 10px;
          right: 10px;
          left: 10px;
          max-width: none;
        }
      }

      .toast-ios {
        background: var(--ios-bg-elevated, #ffffff);
        border: 1px solid var(--ios-separator, #C6C6C8);
        border-radius: var(--radius-xl, 16px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        margin-bottom: 12px;
        padding: 16px;
        pointer-events: auto;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(20px);
        border-left: 4px solid var(--toast-accent-color);
        position: relative;
        overflow: hidden;
      }

      .toast-ios::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, var(--toast-accent-color), transparent);
        opacity: 0.05;
        pointer-events: none;
      }

      .toast-ios.show {
        transform: translateX(0);
        opacity: 1;
      }

      .toast-ios.hiding {
        transform: translateX(100%);
        opacity: 0;
      }

      .toast-content-ios {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        position: relative;
        z-index: 1;
      }

      .toast-icon-ios {
        width: 24px;
        height: 24px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: 600;
        flex-shrink: 0;
        background: var(--toast-accent-color);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      .toast-body-ios {
        flex: 1;
        min-width: 0;
      }

      .toast-title-ios {
        font-size: 14px;
        font-weight: 600;
        color: var(--ios-text-primary, #000000);
        margin-bottom: 4px;
        line-height: 1.3;
      }

      .toast-message-ios {
        font-size: 13px;
        color: var(--ios-text-secondary, #3C3C43);
        line-height: 1.4;
        margin: 0;
      }

      .toast-actions-ios {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }

      .toast-action-btn {
        background: none;
        border: 1px solid var(--toast-accent-color);
        color: var(--toast-accent-color);
        font-size: 12px;
        font-weight: 500;
        padding: 4px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .toast-action-btn:hover {
        background: var(--toast-accent-color);
        color: white;
      }

      .toast-close-ios {
        background: none;
        border: none;
        color: var(--ios-text-tertiary, #3C3C4399);
        font-size: 16px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s ease;
        flex-shrink: 0;
        line-height: 1;
      }

      .toast-close-ios:hover {
        background: var(--ios-fill-quaternary, #74748014);
        color: var(--ios-text-secondary, #3C3C43);
      }

      .toast-progress-ios {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        background: var(--toast-accent-color);
        transition: width linear;
        border-radius: 0 0 16px 16px;
      }

      /* Tipos de toast */
      .toast-ios.success {
        --toast-accent-color: var(--ios-green, #34C759);
      }

      .toast-ios.error {
        --toast-accent-color: var(--ios-red, #FF3B30);
      }

      .toast-ios.warning {
        --toast-accent-color: var(--ios-orange, #FF9500);
      }

      .toast-ios.info {
        --toast-accent-color: var(--ios-blue, #007AFF);
      }

      /* Animaciones de entrada escalonada */
      .toast-ios:nth-child(1) { animation-delay: 0ms; }
      .toast-ios:nth-child(2) { animation-delay: 100ms; }
      .toast-ios:nth-child(3) { animation-delay: 200ms; }
      .toast-ios:nth-child(4) { animation-delay: 300ms; }
      .toast-ios:nth-child(5) { animation-delay: 400ms; }

      @keyframes slideInFromRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      /* Soporte para modo oscuro */
      @media (prefers-color-scheme: dark) {
        .toast-ios {
          background: var(--ios-bg-elevated, #1C1C1E);
          border-color: var(--ios-separator, #38383A);
        }
        
        .toast-title-ios {
          color: var(--ios-text-primary, #FFFFFF);
        }
        
        .toast-message-ios {
          color: var(--ios-text-secondary, #EBEBF5);
        }
      }

      /* Responsivo */
      @media (max-width: 480px) {
        .toast-ios {
          margin-bottom: 8px;
          padding: 12px;
        }
        
        .toast-content-ios {
          gap: 10px;
        }
        
        .toast-icon-ios {
          width: 20px;
          height: 20px;
          font-size: 12px;
        }
        
        .toast-title-ios {
          font-size: 13px;
        }
        
        .toast-message-ios {
          font-size: 12px;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Precarga los sonidos de notificación
   */
  precargarAudios() {
    try {
      // Sonido general de notificación (usar el existente)
      this.audioCache.notification = new Audio(getAssetPath('sounds/notification.mp3'));
      this.audioCache.notification.preload = 'auto';
      this.audioCache.notification.volume = 0.5;
      
      // Intentar cargar sonidos específicos por tipo (opcionales)
      const sonidosEspecificos = {
        success: getAssetPath('sounds/success-notification.mp3'),
        error: getAssetPath('sounds/error-notification.mp3'),
        warning: getAssetPath('sounds/warning-notification.mp3'),
        info: getAssetPath('sounds/info-notification.mp3')
      };
      
      Object.entries(sonidosEspecificos).forEach(([tipo, ruta]) => {
        try {
          this.audioCache[tipo] = new Audio(ruta);
          this.audioCache[tipo].preload = 'auto';
          this.audioCache[tipo].volume = 0.5;
          
          // Manejar errores de carga
          this.audioCache[tipo].addEventListener('error', () => {
            this.audioCache[tipo] = null;
          });
        } catch (error) {
          this.audioCache[tipo] = null;
        }
      });
      
    } catch (error) {
      console.warn('No se pudieron precargar los sonidos de notificación:', error);
    }
  }

  /**
   * Obtiene la preferencia de sonido del usuario
   */
  getSoundPreference() {
    try {
      const saved = localStorage.getItem('toast_sound_enabled');
      return saved === null ? true : saved === 'true';
    } catch (error) {
      return true; // Por defecto habilitado
    }
  }

  /**
   * Guarda la preferencia de sonido del usuario
   */
  setSoundPreference(enabled) {
    try {
      localStorage.setItem('toast_sound_enabled', enabled.toString());
      this.soundEnabled = enabled;
    } catch (error) {
      console.warn('No se pudo guardar la preferencia de sonido:', error);
    }
  }

  /**
   * Habilita o deshabilita los sonidos de notificación
   */
  toggleSound() {
    this.setSoundPreference(!this.soundEnabled);
    return this.soundEnabled;
  }

  /**
   * Reproduce el sonido de notificación según el tipo
   */
  reproducirSonidoNotificacion(tipo = 'info') {
    // Verificar si los sonidos están habilitados
    if (!this.soundEnabled) {
      return;
    }

    try {
      // Verificar si el usuario ha interactuado con la página (requerido por navegadores)
      if (document.visibilityState === 'hidden') {
        // No reproducir sonido si la página no está visible
        return;
      }

      let audio = this.audioCache[tipo];
      
      // Si no existe sonido específico para el tipo, usar el general
      if (!audio || audio.error) {
        audio = this.audioCache.notification;
      }
      
      // Si tampoco existe el general, usar un sonido por defecto
      if (!audio || audio.error) {
        // Crear un sonido simple usando Web Audio API
        this.crearSonidoSimple(tipo);
        return;
      }
      
      // Reproducir el sonido
      audio.currentTime = 0;
      audio.play().catch(err => {
        // Fallback a sonido simple
        this.crearSonidoSimple(tipo);
      });
    } catch (error) {
      console.warn('Error reproduciendo sonido de notificación:', error);
      // Fallback a sonido simple
      this.crearSonidoSimple(tipo);
    }
  }

  /**
   * Crea un sonido simple usando Web Audio API como fallback
   */
  crearSonidoSimple(tipo) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Configurar frecuencia según el tipo
      const frequencies = {
        success: 800,
        error: 400,
        warning: 600,
        info: 700
      };
      
      oscillator.frequency.setValueAtTime(frequencies[tipo] || 700, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('No se pudo crear sonido simple:', error);
    }
  }

  /**
   * Muestra un toast con el tipo y mensaje especificado
   * @param {string} message - Mensaje principal
   * @param {string} type - Tipo: success, error, warning, info
   * @param {object} options - Opciones adicionales
   */
  show(message, type = 'info', options = {}) {
    const config = {
      title: this.getDefaultTitle(type),
      message,
      type,
      duration: this.defaultDuration,
      showProgress: true,
      closable: true,
      actions: [],
      ...options
    };

    return this.createToast(config);
  }

  /**
   * Muestra un toast de éxito
   */
  success(message, options = {}) {
    return this.show(message, 'success', {
      title: 'Éxito',
      ...options
    });
  }

  /**
   * Muestra un toast de error
   */
  error(message, options = {}) {
    return this.show(message, 'error', {
      title: 'Error',
      duration: 6000, // Más tiempo para errores
      ...options
    });
  }

  /**
   * Muestra un toast de advertencia
   */
  warning(message, options = {}) {
    return this.show(message, 'warning', {
      title: 'Advertencia',
      duration: 5000,
      ...options
    });
  }

  /**
   * Muestra un toast informativo
   */
  info(message, options = {}) {
    return this.show(message, 'info', {
      title: 'Información',
      ...options
    });
  }

  /**
   * Crea y muestra un toast
   */
  createToast(config) {
    const toastId = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Limitar número de toasts
    this.limitToasts();

    // Crear elemento del toast
    const toastElement = this.buildToastElement(toastId, config);
    
    // Agregar al contenedor
    this.container.appendChild(toastElement);
    
    // Guardar referencia
    this.toasts.set(toastId, {
      element: toastElement,
      config,
      timeoutId: null,
      progressInterval: null
    });

    // Mostrar con animación
    requestAnimationFrame(() => {
      toastElement.classList.add('show');
    });

    // Configurar auto-close
    if (config.duration > 0) {
      this.setupAutoClose(toastId, config);
    }

    // Reproducir sonido de notificación
    this.reproducirSonidoNotificacion(config.type);

    return toastId;
  }

  /**
   * Construye el elemento HTML del toast
   */
  buildToastElement(toastId, config) {
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast-ios ${config.type}`;
    
    const icon = this.getIcon(config.type);
    const actionsHtml = config.actions.length > 0 
      ? `<div class="toast-actions-ios">
          ${config.actions.map(action => 
            `<button class="toast-action-btn" onclick="toastManager.handleAction('${toastId}', '${action.id}')">${action.label}</button>`
          ).join('')}
         </div>`
      : '';

    const closeButton = config.closable 
      ? `<button class="toast-close-ios" onclick="toastManager.hide('${toastId}')" aria-label="Cerrar">
          <i class="bi bi-x"></i>
         </button>`
      : '';

    const progressBar = config.showProgress && config.duration > 0
      ? `<div class="toast-progress-ios" id="${toastId}-progress"></div>`
      : '';

    toast.innerHTML = `
      <div class="toast-content-ios">
        <div class="toast-icon-ios">
          <i class="bi ${icon}"></i>
        </div>
        <div class="toast-body-ios">
          ${config.title ? `<div class="toast-title-ios">${config.title}</div>` : ''}
          <div class="toast-message-ios">${config.message}</div>
          ${actionsHtml}
        </div>
        ${closeButton}
      </div>
      ${progressBar}
    `;

    return toast;
  }

  /**
   * Configura el auto-close del toast
   */
  setupAutoClose(toastId, config) {
    const toast = this.toasts.get(toastId);
    if (!toast) return;

    // Configurar progress bar
    if (config.showProgress) {
      const progressElement = document.getElementById(`${toastId}-progress`);
      if (progressElement) {
        progressElement.style.width = '100%';
        progressElement.style.transitionDuration = `${config.duration}ms`;
        
        requestAnimationFrame(() => {
          progressElement.style.width = '0%';
        });
      }
    }

    // Configurar timeout
    toast.timeoutId = setTimeout(() => {
      this.hide(toastId);
    }, config.duration);
  }

  /**
   * Oculta un toast específico
   */
  hide(toastId) {
    const toast = this.toasts.get(toastId);
    if (!toast) return;

    // Limpiar timers
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }
    if (toast.progressInterval) {
      clearInterval(toast.progressInterval);
    }

    // Animar salida
    toast.element.classList.add('hiding');
    toast.element.classList.remove('show');

    // Remover del DOM después de la animación
    setTimeout(() => {
      if (toast.element.parentNode) {
        toast.element.parentNode.removeChild(toast.element);
      }
      this.toasts.delete(toastId);
    }, 300);
  }

  /**
   * Maneja las acciones de los toasts
   */
  handleAction(toastId, actionId) {
    const toast = this.toasts.get(toastId);
    if (!toast) return;

    const action = toast.config.actions.find(a => a.id === actionId);
    if (action && typeof action.handler === 'function') {
      action.handler(toastId);
    }

    // Auto-cerrar después de la acción a menos que se especifique lo contrario
    if (!action.keepOpen) {
      this.hide(toastId);
    }
  }

  /**
   * Limita el número de toasts visibles
   */
  limitToasts() {
    if (this.toasts.size >= this.maxToasts) {
      const oldestToastId = this.toasts.keys().next().value;
      this.hide(oldestToastId);
    }
  }

  /**
   * Oculta todos los toasts
   */
  hideAll() {
    Array.from(this.toasts.keys()).forEach(toastId => {
      this.hide(toastId);
    });
  }

  /**
   * Obtiene el título por defecto para cada tipo
   */
  getDefaultTitle(type) {
    const titles = {
      success: 'Éxito',
      error: 'Error',
      warning: 'Advertencia',
      info: 'Información'
    };
    return titles[type] || 'Notificación';
  }

  /**
   * Obtiene el ícono para cada tipo de toast
   */
  getIcon(type) {
    const icons = {
      success: 'bi-check-circle-fill',
      error: 'bi-x-circle-fill',
      warning: 'bi-exclamation-triangle-fill',
      info: 'bi-info-circle-fill'
    };
    return icons[type] || 'bi-info-circle-fill';
  }

  /**
   * Actualiza la configuración del toast manager
   */
  configure(options = {}) {
    this.maxToasts = options.maxToasts || this.maxToasts;
    this.defaultDuration = options.defaultDuration || this.defaultDuration;
    this.zIndex = options.zIndex || this.zIndex;
  }
}

// Crear instancia global
const toastManager = new ToastManager();

// Exportar funciones de conveniencia
export function showToast(message, type = 'info', options = {}) {
  return toastManager.show(message, type, options);
}

export function showSuccess(message, options = {}) {
  return toastManager.success(message, options);
}

export function showError(message, options = {}) {
  return toastManager.error(message, options);
}

export function showWarning(message, options = {}) {
  return toastManager.warning(message, options);
}

export function showInfo(message, options = {}) {
  return toastManager.info(message, options);
}

export function hideToast(toastId) {
  return toastManager.hide(toastId);
}

export function hideAllToasts() {
  return toastManager.hideAll();
}

// Funciones de control de sonido
export function toggleNotificationSound() {
  return toastManager.toggleSound();
}

export function setNotificationSound(enabled) {
  toastManager.setSoundPreference(enabled);
}

export function isNotificationSoundEnabled() {
  return toastManager.soundEnabled;
}

// Hacer el manager disponible globalmente
window.toastManager = toastManager;
window.showToast = showToast;
window.showSuccess = showSuccess;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;
window.toggleNotificationSound = toggleNotificationSound;
window.setNotificationSound = setNotificationSound;
window.isNotificationSoundEnabled = isNotificationSoundEnabled;

export default toastManager;