/**
 * 🎭 Modal Component - Distribuciones ROCA
 * Sistema de modales iOS-style sin duplicaciones
 */

// Contador para IDs únicos
let modalCounter = 0;

/**
 * Configuración por defecto para modales
 */
const defaultModalConfig = {
  title: '',
  content: '',
  type: 'info', // info, success, warning, danger
  size: 'medium', // small, medium, large
  backdrop: true,
  keyboard: true,
  showCancel: true,
  showConfirm: true,
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  animation: 'scale' // scale, slide, fade
};

/**
 * Muestra un modal de información
 * @param {Object} config - Configuración del modal
 * @returns {Promise<boolean>} - Resolución del modal
 */
export async function showModal(config) {
  const modalConfig = { ...defaultModalConfig, ...config };
  
  return new Promise((resolve) => {
    const modalId = `modal-${++modalCounter}`;
    const modal = createModalElement(modalId, modalConfig);
    
    // Añadir al DOM
    document.body.appendChild(modal);
    
    // Mostrar modal
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });
    
    // Event listeners
    setupModalEventListeners(modal, modalConfig, resolve);
    
    // Auto-focus en el primer elemento focuseable
    setTimeout(() => {
      const firstFocusable = modal.querySelector('button, input, select, textarea');
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }, 100);
  });
}

/**
 * Muestra un modal de confirmación
 * @param {Object} config - Configuración del modal
 * @returns {Promise<boolean>} - true si confirma, false si cancela
 */
export async function confirmModal(config) {
  const modalConfig = {
    ...defaultModalConfig,
    ...config,
    type: config.type || 'warning',
    showCancel: true,
    showConfirm: true
  };
  
  return showModal(modalConfig);
}

/**
 * Muestra un modal de alerta (solo OK)
 * @param {Object} config - Configuración del modal
 * @returns {Promise<boolean>}
 */
export async function alertModal(config) {
  const modalConfig = {
    ...defaultModalConfig,
    ...config,
    showCancel: false,
    confirmText: 'OK'
  };
  
  return showModal(modalConfig);
}

/**
 * Crea el elemento modal en el DOM
 * @param {string} modalId - ID único del modal
 * @param {Object} config - Configuración del modal
 * @returns {HTMLElement} - Elemento modal
 */
function createModalElement(modalId, config) {
  const modalHTML = `
    <div class="modal-overlay" id="${modalId}" data-backdrop="${config.backdrop}">
      <div class="modal modal-${config.size} modal-${config.type} modal-${config.animation}">
        <div class="modal-header">
          ${getModalIcon(config.type)}
          <div class="modal-header-content">
            <h3 class="modal-title">${config.title}</h3>
            ${config.subtitle ? `<p class="modal-subtitle">${config.subtitle}</p>` : ''}
          </div>
          ${config.showCloseButton !== false ? '<button class="modal-close" data-action="close"><i class="bi bi-x"></i></button>' : ''}
        </div>
        <div class="modal-body">
          ${typeof config.content === 'string' ? config.content : ''}
        </div>
        <div class="modal-footer">
          ${config.showCancel ? `<button class="btn btn-ios secondary" data-action="cancel">${config.cancelText}</button>` : ''}
          ${config.showConfirm ? `<button class="btn btn-ios primary" data-action="confirm">${config.confirmText}</button>` : ''}
        </div>
      </div>
    </div>
  `;
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = modalHTML.trim();
  const modal = tempDiv.firstElementChild;
  
  // Añadir estilos si no existen
  ensureModalStyles();
  
  return modal;
}

/**
 * Configura event listeners del modal
 * @param {HTMLElement} modal - Elemento modal
 * @param {Object} config - Configuración del modal
 * @param {Function} resolve - Función de resolución de la promesa
 */
function setupModalEventListeners(modal, config, resolve) {
  let resolved = false;
  
  // Función para resolver una sola vez
  const resolveOnce = (value) => {
    if (!resolved) {
      resolved = true;
      closeModal(modal);
      resolve(value);
    }
  };
  
  // Click en botones
  modal.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    
    switch (action) {
      case 'confirm':
        resolveOnce(true);
        break;
      case 'cancel':
      case 'close':
        resolveOnce(false);
        break;
    }
  });
  
  // Click en backdrop
  if (config.backdrop) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        resolveOnce(false);
      }
    });
  }
  
  // Tecla Escape
  if (config.keyboard) {
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resolveOnce(false);
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    
    document.addEventListener('keydown', handleKeydown);
  }
  
  // Auto-close timeout si se especifica
  if (config.timeout) {
    setTimeout(() => {
      resolveOnce(false);
    }, config.timeout);
  }
}

/**
 * Cierra y remueve el modal del DOM
 * @param {HTMLElement} modal - Elemento modal
 */
export function closeModal(modal) {
  if (!modal) return;
  modal.classList.add('closing');
  modal.classList.remove('show');
  
  modal.addEventListener('animationend', () => {
    modal.remove();
  }, { once: true });
}

/**
 * Obtiene el ícono apropiado para el tipo de modal
 * @param {string} type - Tipo de modal
 * @returns {string} - HTML del ícono
 */
function getModalIcon(type) {
  const icons = {
    success: '<i class="bi bi-check-circle-fill modal-icon success"></i>',
    warning: '<i class="bi bi-exclamation-triangle-fill modal-icon warning"></i>',
    danger: '<i class="bi bi-x-circle-fill modal-icon danger"></i>',
    info: '<i class="bi bi-info-circle-fill modal-icon info"></i>',
    question: '<i class="bi bi-question-circle-fill modal-icon question"></i>'
  };
  
  return icons[type] || icons.info;
}

/**
 * Asegura que los estilos del modal estén presentes
 */
function ensureModalStyles() {
  if (document.getElementById('modal-component-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'modal-component-styles';
  style.textContent = `
    /* Modal Overlay */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-lg, 20px);
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s var(--ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1));
      backdrop-filter: blur(8px);
    }
    
    .modal-overlay.show {
      opacity: 1;
      visibility: visible;
    }
    
    .modal-overlay.closing {
      opacity: 0;
      visibility: hidden;
    }
    
    /* Modal Container */
    .modal {
      background: var(--ios-bg-elevated, white);
      border-radius: var(--radius-xl, 16px);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: scale(0.8) translateY(50px);
      transition: all 0.3s var(--ease-out-back, cubic-bezier(0.34, 1.56, 0.64, 1));
    }
    
    .modal-overlay.show .modal {
      transform: scale(1) translateY(0);
    }
    
    .modal-overlay.closing .modal {
      transform: scale(0.8) translateY(50px);
    }
    
    /* Modal Sizes */
    .modal-small { width: 400px; }
    .modal-medium { width: 500px; }
    .modal-large { width: 700px; }
    
    /* Modal Header */
    .modal-header {
      display: flex;
      align-items: flex-start;
      gap: var(--space-md, 12px);
      padding: var(--space-xl, 24px);
      border-bottom: 1px solid var(--ios-separator, #e5e5e7);
      background: var(--ios-bg-secondary, #f2f2f7);
    }
    
    .modal-header-content {
      flex: 1;
      min-width: 0;
    }
    
    .modal-title {
      font-size: var(--font-size-lg, 18px);
      font-weight: var(--font-weight-semibold, 600);
      color: var(--ios-text-primary, #000);
      margin: 0;
      line-height: 1.3;
    }
    
    .modal-subtitle {
      font-size: var(--font-size-sm, 14px);
      color: var(--ios-text-secondary, #8e8e93);
      margin: var(--space-xs, 4px) 0 0;
      line-height: 1.4;
    }
    
    .modal-icon {
      font-size: 24px;
      margin-top: 2px;
    }
    
    .modal-icon.success { color: var(--ios-green, #34c759); }
    .modal-icon.warning { color: var(--ios-orange, #ff9500); }
    .modal-icon.danger { color: var(--ios-red, #ff3b30); }
    .modal-icon.info { color: var(--ios-blue, #007aff); }
    .modal-icon.question { color: var(--ios-purple, #af52de); }
    
    .modal-close {
      background: var(--ios-fill-tertiary, #f2f2f7);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--ios-text-secondary, #8e8e93);
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }
    
    .modal-close:hover {
      background: var(--ios-fill-secondary, #e5e5e7);
      color: var(--ios-text-primary, #000);
      transform: scale(1.1);
    }
    
    /* Modal Body */
    .modal-body {
      padding: var(--space-xl, 24px);
      overflow-y: auto;
      flex: 1;
      font-size: var(--font-size-base, 16px);
      line-height: 1.5;
      color: var(--ios-text-primary, #000);
    }
    
    /* Modal Footer */
    .modal-footer {
      padding: var(--space-lg, 16px) var(--space-xl, 24px) var(--space-xl, 24px);
      border-top: 1px solid var(--ios-separator, #e5e5e7);
      background: var(--ios-bg-secondary, #f2f2f7);
      display: flex;
      gap: var(--space-md, 12px);
      justify-content: flex-end;
    }
    
    /* Button Styles */
    .btn-ios {
      padding: var(--space-md, 12px) var(--space-xl, 24px);
      border: none;
      border-radius: var(--radius-lg, 12px);
      font-size: var(--font-size-base, 16px);
      font-weight: var(--font-weight-medium, 500);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-sm, 8px);
      min-width: 100px;
    }
    
    .btn-ios.primary {
      background: var(--ios-blue, #007aff);
      color: white;
    }
    
    .btn-ios.secondary {
      background: var(--ios-fill-quaternary, #f2f2f7);
      color: var(--ios-text-primary, #000);
      border: 1px solid var(--ios-separator, #e5e5e7);
    }
    
    .btn-ios:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .btn-ios:active {
      transform: scale(0.98);
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .modal {
        width: 95vw !important;
        margin: var(--space-lg, 20px);
      }
      
      .modal-footer {
        flex-direction: column-reverse;
      }
      
      .btn-ios {
        width: 100%;
      }
    }
    
    /* Animation Variants */
    .modal-fade {
      transform: none;
      opacity: 0;
    }
    
    .modal-overlay.show .modal-fade {
      opacity: 1;
    }
    
    .modal-slide {
      transform: translateY(100px);
    }
    
    .modal-overlay.show .modal-slide {
      transform: translateY(0);
    }
    
    /* Accessibility */
    .modal:focus {
      outline: none;
    }
    
    @media (prefers-reduced-motion: reduce) {
      .modal-overlay,
      .modal,
      .btn-ios {
        transition: none;
      }
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Utilidades para tipos de modal comunes
 */
export const ModalUtils = {
  /**
   * Modal de éxito
   */
  success(message, title = 'Éxito') {
    return alertModal({
      title,
      content: message,
      type: 'success'
    });
  },
  
  /**
   * Modal de error
   */
  error(message, title = 'Error') {
    return alertModal({
      title,
      content: message,
      type: 'danger'
    });
  },
  
  /**
   * Modal de advertencia
   */
  warning(message, title = 'Advertencia') {
    return alertModal({
      title,
      content: message,
      type: 'warning'
    });
  },
  
  /**
   * Modal de información
   */
  info(message, title = 'Información') {
    return alertModal({
      title,
      content: message,
      type: 'info'
    });
  },
  
  /**
   * Modal de confirmación de eliminación
   */
  confirmDelete(itemName = 'este elemento') {
    return confirmModal({
      title: '¿Eliminar elemento?',
      content: `¿Estás seguro de eliminar ${itemName}? Esta acción no se puede deshacer.`,
      type: 'danger',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    });
  },
  
  /**
   * Muestra un modal existente
   */
  show: function(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      modalElement.classList.add('show');
    }
  },
  
  /**
   * Oculta un modal existente
   */
  hide: function(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      modalElement.classList.remove('show');
    }
  }
};

// Exportación por defecto para compatibilidad
export default {
  showModal,
  confirmModal,
  alertModal,
  ModalUtils
};