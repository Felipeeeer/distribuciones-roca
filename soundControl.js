/**
 * 🔊 Control de Sonido para Notificaciones
 * Componente para controlar los sonidos del sistema
 */

import { toggleNotificationSound, isNotificationSoundEnabled } from './toast.js';

class SoundControl {
  constructor() {
    this.sidebarElement = null;
    this.desktopElement = null;
    this.init();
  }

  init() {
    this.injectStyles();
    this.createSidebarElement();
    this.createDesktopElement();
    this.updateElementStates();
  }

  createSidebarElement() {
    // Crear elemento para el sidebar móvil
    this.sidebarElement = document.createElement('div');
    this.sidebarElement.id = 'soundControlSidebar';
    this.sidebarElement.className = 'sidebar-sound-control';
    this.sidebarElement.innerHTML = `
      <div class="sound-control-content">
        <div class="sound-control-info">
          <i class="bi bi-volume-up-fill sound-icon"></i>
          <span class="sound-text">Sonidos de Notificación</span>
        </div>
        <button class="sound-toggle-btn" id="soundToggleBtnSidebar" title="Alternar sonidos">
          <i class="bi bi-toggle-on"></i>
        </button>
      </div>
    `;
    
    // Agregar evento click
    const toggleBtn = this.sidebarElement.querySelector('#soundToggleBtnSidebar');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggleSound();
      });
    }
    
    // Insertar en el sidebar
    this.insertInSidebar();
  }

  createDesktopElement() {
    // Crear elemento para la barra de navegación de escritorio
    this.desktopElement = document.createElement('div');
    this.desktopElement.id = 'soundControlDesktop';
    this.desktopElement.className = 'desktop-sound-control';
    this.desktopElement.innerHTML = `
      <button class="nav-sound-toggle" id="soundToggleBtnDesktop" title="Sonidos de notificación">
        <i class="bi bi-volume-up-fill"></i>
      </button>
    `;
    
    // Agregar evento click
    const toggleBtn = this.desktopElement.querySelector('#soundToggleBtnDesktop');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggleSound();
      });
    }
    
    // Insertar en la barra de navegación
    this.insertInDesktopNav();
  }

  injectStyles() {
    const styleId = 'sound-control-styles';
    
    if (document.getElementById(styleId)) {
      return; // Ya están inyectados
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Estilos para el sidebar móvil */
      .sidebar-sound-control {
        margin: 1rem;
        padding: 0.75rem;
        background: var(--ios-fill-quaternary, #f2f2f7);
        border-radius: 12px;
        border: 1px solid var(--ios-separator, #c6c6c8);
      }

      .sound-control-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .sound-control-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
      }

      .sound-icon {
        font-size: 1.1em;
        color: var(--ios-blue, #007AFF);
        width: 20px;
        text-align: center;
      }

      .sound-text {
        font-size: 0.9em;
        font-weight: 500;
        color: var(--ios-text-secondary, #3c3c43);
        line-height: 1.2;
      }

      .sound-toggle-btn {
        background: none;
        border: none;
        padding: 0.25rem;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        height: 32px;
      }

      .sound-toggle-btn:hover {
        background: var(--ios-fill-tertiary, #e5e5ea);
      }

      .sound-toggle-btn:active {
        transform: scale(0.95);
      }

      .sound-toggle-btn i {
        font-size: 1.2em;
        transition: all 0.2s ease;
      }

      .sound-toggle-btn.enabled i {
        color: var(--ios-green, #34c759);
      }

      .sound-toggle-btn.disabled i {
        color: var(--ios-red, #ff3b30);
      }

      .sound-toggle-btn.enabled .bi-toggle-on {
        display: inline;
      }

      .sound-toggle-btn.enabled .bi-toggle-off {
        display: none;
      }

      .sound-toggle-btn.disabled .bi-toggle-on {
        display: none;
      }

      .sound-toggle-btn.disabled .bi-toggle-off {
        display: inline;
      }

      /* Estilos para la barra de navegación de escritorio */
      .desktop-sound-control {
        display: flex;
        align-items: center;
      }

      .nav-sound-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: none;
        border: none;
        border-radius: var(--radius-lg, 8px);
        color: var(--ios-text-secondary, #3c3c43);
        font-size: 1.1em;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      }

      .nav-sound-toggle:hover {
        background-color: var(--ios-fill-quaternary, #f2f2f7);
        color: var(--ios-text-primary, #000000);
        transform: translateY(-1px);
      }

      .nav-sound-toggle.enabled {
        color: var(--ios-green, #34c759);
      }

      .nav-sound-toggle.disabled {
        color: var(--ios-red, #ff3b30);
      }

      .nav-sound-toggle.changing {
        animation: pulse 0.3s ease;
      }

      /* Animación de cambio de estado */
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }

      /* Responsive */
      @media (max-width: 768px) {
        .sidebar-sound-control {
          margin: 0.75rem;
          padding: 0.5rem;
        }

        .sound-text {
          font-size: 0.85em;
        }

        .sound-icon {
          font-size: 1em;
        }

        .desktop-sound-control {
          display: none;
        }
      }

      @media (min-width: 769px) {
        .sidebar-sound-control {
          display: none;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  insertInSidebar() {
    // Buscar el sidebar móvil
    const mobileSidebar = document.getElementById('mobileSidebar');
    if (mobileSidebar) {
      const sidebarMenu = mobileSidebar.querySelector('.sidebar-menu');
      if (sidebarMenu) {
        // Insertar al final del menú
        sidebarMenu.appendChild(this.sidebarElement);
      }
    }
  }

  insertInDesktopNav() {
    // Buscar la barra de navegación de escritorio
    const navbarMenu = document.querySelector('.navbar-menu');
    if (navbarMenu) {
      // Insertar antes del último elemento (si existe)
      navbarMenu.appendChild(this.desktopElement);
    }
  }

  toggleSound() {
    const wasEnabled = isNotificationSoundEnabled();
    const isNowEnabled = toggleNotificationSound();
    
    // Actualizar estado de ambos elementos
    this.updateElementStates();
    
    // Mostrar feedback
    this.showFeedback(wasEnabled, isNowEnabled);
    
    // Agregar animación
    this.animateToggle();
  }

  updateElementStates() {
    const sidebarToggleBtn = this.sidebarElement?.querySelector('#soundToggleBtnSidebar');
    const desktopToggleBtn = this.desktopElement?.querySelector('#soundToggleBtnDesktop');
    
    const isEnabled = isNotificationSoundEnabled();
    
    // Actualizar botón del sidebar
    if (sidebarToggleBtn) {
      if (isEnabled) {
        sidebarToggleBtn.classList.remove('disabled');
        sidebarToggleBtn.classList.add('enabled');
        sidebarToggleBtn.innerHTML = '<i class="bi bi-toggle-on"></i>';
        sidebarToggleBtn.title = 'Desactivar sonidos de notificación';
      } else {
        sidebarToggleBtn.classList.remove('enabled');
        sidebarToggleBtn.classList.add('disabled');
        sidebarToggleBtn.innerHTML = '<i class="bi bi-toggle-off"></i>';
        sidebarToggleBtn.title = 'Activar sonidos de notificación';
      }
    }
    
    // Actualizar botón de escritorio
    if (desktopToggleBtn) {
      if (isEnabled) {
        desktopToggleBtn.classList.remove('disabled');
        desktopToggleBtn.classList.add('enabled');
        desktopToggleBtn.innerHTML = '<i class="bi bi-volume-up-fill"></i>';
        desktopToggleBtn.title = 'Desactivar sonidos de notificación';
      } else {
        desktopToggleBtn.classList.remove('enabled');
        desktopToggleBtn.classList.add('disabled');
        desktopToggleBtn.innerHTML = '<i class="bi bi-volume-mute-fill"></i>';
        desktopToggleBtn.title = 'Activar sonidos de notificación';
      }
    }
  }

  showFeedback(wasEnabled, isNowEnabled) {
    const message = isNowEnabled 
      ? 'Sonidos de notificación activados' 
      : 'Sonidos de notificación desactivados';
    
    const type = isNowEnabled ? 'success' : 'info';
    
    if (window.showToast) {
      window.showToast(message, type, { duration: 2000 });
    }
  }

  animateToggle() {
    const sidebarToggleBtn = this.sidebarElement?.querySelector('#soundToggleBtnSidebar');
    const desktopToggleBtn = this.desktopElement?.querySelector('#soundToggleBtnDesktop');
    
    // Animar botón del sidebar
    if (sidebarToggleBtn) {
      sidebarToggleBtn.classList.add('changing');
      setTimeout(() => {
        sidebarToggleBtn.classList.remove('changing');
      }, 300);
    }
    
    // Animar botón de escritorio
    if (desktopToggleBtn) {
      desktopToggleBtn.classList.add('changing');
      setTimeout(() => {
        desktopToggleBtn.classList.remove('changing');
      }, 300);
    }
  }

  // Método para mostrar/ocultar los elementos
  show() {
    if (this.sidebarElement) {
      this.sidebarElement.style.display = 'block';
    }
    if (this.desktopElement) {
      this.desktopElement.style.display = 'flex';
    }
  }

  hide() {
    if (this.sidebarElement) {
      this.sidebarElement.style.display = 'none';
    }
    if (this.desktopElement) {
      this.desktopElement.style.display = 'none';
    }
  }

  // Método para destruir el componente
  destroy() {
    if (this.sidebarElement && this.sidebarElement.parentNode) {
      this.sidebarElement.parentNode.removeChild(this.sidebarElement);
    }
    if (this.desktopElement && this.desktopElement.parentNode) {
      this.desktopElement.parentNode.removeChild(this.desktopElement);
    }
  }

  // Método para refrescar el estado
  refresh() {
    this.updateElementStates();
  }
}

// Crear instancia global
const soundControl = new SoundControl();

// Exponer funciones globalmente
window.soundControl = soundControl;

export default soundControl; 