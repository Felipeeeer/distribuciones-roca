/**
 * 🔊 Sound Control Global - Distribuciones ROCA
 * Script global para el control de sonido en todas las páginas
 */

// Importar funciones del toast manager
import { toggleNotificationSound, isNotificationSoundEnabled } from './toast.js';

class SoundControlGlobal {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateAllControls();
  }

  setupEventListeners() {
    // Buscar todos los botones de control de sonido en el sidebar
    const sidebarButtons = document.querySelectorAll('#soundToggleBtnSidebar');
    
    sidebarButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.toggleSound();
      });
    });

    // Buscar botones en la barra de navegación de escritorio
    const desktopButtons = document.querySelectorAll('#soundToggleBtnDesktop');
    
    desktopButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.toggleSound();
      });
    });
  }

  toggleSound() {
    const wasEnabled = isNotificationSoundEnabled();
    const isNowEnabled = toggleNotificationSound();
    
    // Actualizar todos los controles
    this.updateAllControls();
    
    // Mostrar feedback
    this.showFeedback(wasEnabled, isNowEnabled);
    
    // Agregar animación
    this.animateAllControls();
  }

  updateAllControls() {
    const isEnabled = isNotificationSoundEnabled();
    
    // Actualizar botones del sidebar
    const sidebarButtons = document.querySelectorAll('#soundToggleBtnSidebar');
    sidebarButtons.forEach(button => {
      if (isEnabled) {
        button.classList.remove('disabled');
        button.classList.add('enabled');
        button.innerHTML = '<i class="bi bi-toggle-on"></i>';
        button.title = 'Desactivar sonidos de notificación';
      } else {
        button.classList.remove('enabled');
        button.classList.add('disabled');
        button.innerHTML = '<i class="bi bi-toggle-off"></i>';
        button.title = 'Activar sonidos de notificación';
      }
    });
    
    // Actualizar botones de escritorio
    const desktopButtons = document.querySelectorAll('#soundToggleBtnDesktop');
    desktopButtons.forEach(button => {
      if (isEnabled) {
        button.classList.remove('disabled');
        button.classList.add('enabled');
        button.innerHTML = '<i class="bi bi-volume-up-fill"></i>';
        button.title = 'Desactivar sonidos de notificación';
      } else {
        button.classList.remove('enabled');
        button.classList.add('disabled');
        button.innerHTML = '<i class="bi bi-volume-mute-fill"></i>';
        button.title = 'Activar sonidos de notificación';
      }
    });
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

  animateAllControls() {
    // Animar botones del sidebar
    const sidebarButtons = document.querySelectorAll('#soundToggleBtnSidebar');
    sidebarButtons.forEach(button => {
      button.classList.add('changing');
      setTimeout(() => {
        button.classList.remove('changing');
      }, 300);
    });
    
    // Animar botones de escritorio
    const desktopButtons = document.querySelectorAll('#soundToggleBtnDesktop');
    desktopButtons.forEach(button => {
      button.classList.add('changing');
      setTimeout(() => {
        button.classList.remove('changing');
      }, 300);
    });
  }

  // Método para refrescar el estado
  refresh() {
    this.updateAllControls();
  }
}

// Crear instancia global cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.soundControlGlobal = new SoundControlGlobal();
});

// Exportar para uso en módulos
export default SoundControlGlobal; 