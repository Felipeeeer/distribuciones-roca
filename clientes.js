/**
 * 👥 Clientes Module - Distribuciones ROCA
 * Gestión completa de clientes con componentes iOS
 */

import { db } from '../config/firebase.js';
import { ref, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";
import { showToast, showSuccess, showError, showWarning } from '../components/toast.js';
import { ModalUtils, confirmModal } from '../components/modal.js';
import { DOMUtils, DataUtils } from '../utils/helpers.js';
import { addValidationRules, enableRealTimeValidation, validateForm } from '../utils/validators.js';

// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

class ClientesManager {
  constructor() {
    this.clientesData = [];
    this.filteredClientes = [];
    this.modoEdicion = false;
    this.clienteEditId = null;
    this.isLoading = false;

    // Referencias DOM
    this.elements = {
      clienteForm: document.getElementById('clienteForm'),
      clientesBody: document.getElementById('clientesBody'),
      clientesMobileContainer: document.getElementById('clientesMobileContainer'),
      btnGuardar: document.getElementById('btnGuardar'),
      btnCancelar: document.getElementById('cancelarEdicion'),
      formTitle: document.getElementById('formTitle'),
      totalClientesHeader: document.getElementById('totalClientesHeader'),
      searchClientes: document.getElementById('searchClientes'),
      searchClientesMobile: document.getElementById('searchClientesMobile'),
      loadingOverlay: document.getElementById('loadingOverlay')
    };

    this.init();
  }

  /**
   * Inicializa el gestor de clientes
   */
  async init() {
    try {
      this.showLoading(true);
      this.setupValidation();
      this.setupEventListeners();
      this.startRealTimeUpdates();
      showSuccess('Módulo de clientes cargado correctamente');
    } catch (error) {
      console.error('Error inicializando clientes:', error);
      showError('Error al cargar el módulo de clientes');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Configura la validación del formulario
   */
  setupValidation() {
    const validationRules = {
      nombre: [
        'required',
        { type: 'minLength', min: 2 },
        { type: 'maxLength', max: 100 }
      ],
      nit: [
        'required',
        'nit'
      ],
      direccion: [
        'required',
        { type: 'minLength', min: 5 },
        { type: 'maxLength', max: 200 }
      ],
      telefono: [
        'required',
        'phone'
      ]
    };

    addValidationRules('clienteForm', validationRules);
    enableRealTimeValidation('clienteForm');
  }

  /**
   * Configura los event listeners
   */
  setupEventListeners() {
    // Formulario de cliente
    if (this.elements.clienteForm) {
      this.elements.clienteForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    // Botón cancelar
    if (this.elements.btnCancelar) {
      this.elements.btnCancelar.addEventListener('click', () => this.resetForm());
    }

    // Búsqueda - usando debounce local
    if (this.elements.searchClientes) {
      this.elements.searchClientes.addEventListener('input', 
        debounce((e) => this.handleSearch(e.target.value), 300)
      );
    }

    if (this.elements.searchClientesMobile) {
      this.elements.searchClientesMobile.addEventListener('input', 
        debounce((e) => this.handleSearch(e.target.value), 300)
      );
    }
  }

  /**
   * Maneja el envío del formulario
   */
  async handleFormSubmit(e) {
    e.preventDefault();

    if (!validateForm('clienteForm')) {
      showWarning('Por favor corrige los errores en el formulario');
      return;
    }

    const cliente = this.getFormData();
    
    try {
      this.showLoading(true);

      if (!this.modoEdicion) {
        await this.createCliente(cliente);
        showSuccess(`Cliente "${cliente.nombre}" creado exitosamente`);
      } else {
        await this.updateCliente(this.clienteEditId, cliente);
        showSuccess(`Cliente "${cliente.nombre}" actualizado exitosamente`);
      }

      this.resetForm();
    } catch (error) {
      console.error('Error guardando cliente:', error);
      showError('Error al guardar el cliente. Inténtalo nuevamente.');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Obtiene los datos del formulario
   */
  getFormData() {
    // Helper function to sanitize values if ValidationUtils is not available
    const sanitizeValue = (value, type) => {
      if (typeof window.ValidationUtils !== 'undefined' && window.ValidationUtils.sanitizeValue) {
        return window.ValidationUtils.sanitizeValue(value, type);
      }
      // Fallback sanitization
      return value?.toString().trim() || '';
    };

    return {
      nombre: sanitizeValue(document.getElementById('nombre').value, 'text'),
      nit: sanitizeValue(document.getElementById('nit').value, 'nit'),
      direccion: sanitizeValue(document.getElementById('direccion').value, 'text'),
      telefono: sanitizeValue(document.getElementById('telefono').value, 'phone'),
      fechaCreacion: this.modoEdicion ? undefined : new Date().toISOString(),
      fechaActualizacion: new Date().toISOString()
    };
  }

  /**
   * Crea un nuevo cliente
   */
  async createCliente(cliente) {
    const clientesRef = ref(db, 'clientes');
    return push(clientesRef, cliente);
  }

  /**
   * Actualiza un cliente existente
   */
 async updateCliente(id, cliente) {
  const clienteRef = ref(db, `clientes/${id}`);

  // Elimina propiedades undefined antes de hacer update
  const cleanCliente = Object.fromEntries(
    Object.entries(cliente).filter(([_, v]) => v !== undefined)
  );

  return update(clienteRef, cleanCliente);
}


  /**
   * Elimina un cliente
   */
  async deleteCliente(id) {
    try {
      const cliente = this.clientesData.find(c => c.id === id);
      if (!cliente) {
        showError('Cliente no encontrado');
        return;
      }

      const confirmed = await ModalUtils.confirmDelete(`el cliente "${cliente.nombre}"`);
      if (!confirmed) return;

      this.showLoading(true);
      const clienteRef = ref(db, `clientes/${id}`);
      await remove(clienteRef);

      // Si estaba editando este cliente, cancelar edición
      if (this.modoEdicion && this.clienteEditId === id) {
        this.resetForm();
      }

      showSuccess(`Cliente "${cliente.nombre}" eliminado exitosamente`);
    } catch (error) {
      console.error('Error eliminando cliente:', error);
      showError('Error al eliminar el cliente. Inténtalo nuevamente.');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Edita un cliente
   */
  editCliente(id) {
    const cliente = this.clientesData.find(c => c.id === id);
    if (!cliente) {
      showError('Cliente no encontrado');
      return;
    }

    // Llenar formulario
    document.getElementById('nombre').value = cliente.nombre || '';
    document.getElementById('nit').value = cliente.nit || '';
    document.getElementById('direccion').value = cliente.direccion || '';
    document.getElementById('telefono').value = cliente.telefono || '';

    // Cambiar a modo edición
    this.modoEdicion = true;
    this.clienteEditId = id;
    
    // Actualizar UI
    this.elements.formTitle.textContent = 'Editar Cliente';
    this.elements.btnGuardar.innerHTML = '<i class="bi bi-save"></i> Actualizar Cliente';
    this.elements.btnCancelar.classList.remove('d-none');

    // Scroll hacia arriba en móvil
    window.scrollTo({ top: 0, behavior: 'smooth' });

    showToast(`Editando cliente: ${cliente.nombre}`, 'info');
  }

  /**
   * Resetea el formulario y modo edición
   */
  resetForm() {
    this.elements.clienteForm.reset();
    this.modoEdicion = false;
    this.clienteEditId = null;
    
    // Restaurar UI
    this.elements.formTitle.textContent = 'Agregar Cliente';
    this.elements.btnGuardar.innerHTML = '<i class="bi bi-save"></i> Guardar Cliente';
    this.elements.btnCancelar.classList.add('d-none');
  }

  /**
   * Maneja la búsqueda de clientes
   */
  handleSearch(searchTerm) {
    if (!searchTerm.trim()) {
      this.filteredClientes = [...this.clientesData];
    } else {
      // Fallback search if DataUtils is not available
      if (typeof DataUtils !== 'undefined' && DataUtils.searchInArray) {
        this.filteredClientes = DataUtils.searchInArray(
          this.clientesData, 
          searchTerm, 
          ['nombre', 'nit', 'direccion', 'telefono']
        );
      } else {
        // Simple search implementation
        const term = searchTerm.toLowerCase();
        this.filteredClientes = this.clientesData.filter(cliente => 
          cliente.nombre?.toLowerCase().includes(term) ||
          cliente.nit?.toLowerCase().includes(term) ||
          cliente.direccion?.toLowerCase().includes(term) ||
          cliente.telefono?.toLowerCase().includes(term)
        );
      }
    }
    
    this.renderClientes();
  }

  /**
   * Inicia actualizaciones en tiempo real
   */
  startRealTimeUpdates() {
    const clientesRef = ref(db, 'clientes');
    onValue(clientesRef, (snapshot) => {
      this.clientesData = [];
      this.filteredClientes = [];

      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const cliente = {
            id: childSnapshot.key,
            ...childSnapshot.val()
          };
          this.clientesData.push(cliente);
        });
      }

      // Ordenar por nombre
      this.clientesData.sort((a, b) => a.nombre.localeCompare(b.nombre));
      this.filteredClientes = [...this.clientesData];
      
      this.renderClientes();
      this.updateHeader();
    }, (error) => {
      console.error('Error en tiempo real:', error);
      showError('Error al sincronizar datos en tiempo real');
    });
  }

  /**
   * Renderiza la lista de clientes
   */
  renderClientes() {
    this.renderDesktopTable();
    this.renderMobileCards();
  }

  /**
   * Renderiza la tabla para desktop
   */
  renderDesktopTable() {
    if (!this.elements.clientesBody) return;

    this.elements.clientesBody.innerHTML = '';

    if (this.filteredClientes.length === 0) {
      const row = this.elements.clientesBody.insertRow();
      row.innerHTML = `
        <td colspan="5" class="text-center" style="padding: var(--space-3xl); color: var(--ios-text-tertiary);">
          <i class="bi bi-people" style="font-size: var(--font-size-3xl); display: block; margin-bottom: var(--space-md);"></i>
          ${this.clientesData.length === 0 ? 'No hay clientes registrados' : 'No se encontraron clientes'}
        </td>
      `;
      return;
    }

    this.filteredClientes.forEach((cliente, index) => {
      const row = this.elements.clientesBody.insertRow();
      row.className = 'table-row-enter';
      row.style.animationDelay = `${index * 50}ms`;
      
      row.innerHTML = `
        <td>${cliente.nombre}</td>
        <td>${cliente.nit}</td>
        <td class="table-cell-text">${cliente.direccion}</td>
        <td>${this.formatPhone(cliente.telefono)}</td>
        <td class="table-cell-actions">
          <div class="table-actions">
            <button class="table-action-btn primary" onclick="clientesManager.editCliente('${cliente.id}')" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="table-action-btn danger" onclick="clientesManager.deleteCliente('${cliente.id}')" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      `;
    });
  }

  /**
   * Renderiza las tarjetas para móvil
   */
  renderMobileCards() {
    if (!this.elements.clientesMobileContainer) return;

    this.elements.clientesMobileContainer.innerHTML = '';

    if (this.filteredClientes.length === 0) {
      this.elements.clientesMobileContainer.innerHTML = `
        <div class="cliente-card text-center">
          <i class="bi bi-people" style="font-size: var(--font-size-3xl); color: var(--ios-text-tertiary); display: block; margin-bottom: var(--space-md);"></i>
          <p style="color: var(--ios-text-tertiary); margin: 0;">
            ${this.clientesData.length === 0 ? 'No hay clientes registrados' : 'No se encontraron clientes'}
          </p>
        </div>
      `;
      return;
    }

    this.filteredClientes.forEach((cliente, index) => {
      const cardElement = document.createElement('div');
      cardElement.className = 'cliente-card animate-fade-in-up';
      cardElement.style.animationDelay = `${index * 100}ms`;
      
      cardElement.innerHTML = `
        <div class="cliente-card-header">
          <h4 class="cliente-card-title">${cliente.nombre}</h4>
          <div class="cliente-card-actions">
            <button class="table-action-btn primary" onclick="clientesManager.editCliente('${cliente.id}')" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="table-action-btn danger" onclick="clientesManager.deleteCliente('${cliente.id}')" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
        <div class="cliente-card-body">
          <div class="cliente-card-row">
            <span class="cliente-card-label">NIT:</span>
            <span class="cliente-card-value">${cliente.nit}</span>
          </div>
          <div class="cliente-card-row">
            <span class="cliente-card-label">Dirección:</span>
            <span class="cliente-card-value" title="${cliente.direccion}">${cliente.direccion}</span>
          </div>
          <div class="cliente-card-row">
            <span class="cliente-card-label">Teléfono:</span>
            <span class="cliente-card-value">${this.formatPhone(cliente.telefono)}</span>
          </div>
        </div>
      `;

      this.elements.clientesMobileContainer.appendChild(cardElement);
    });
  }

  /**
   * Formatea un número de teléfono
   */
  formatPhone(phone) {
    if (typeof window.ValidationUtils !== 'undefined' && window.ValidationUtils.formatPhone) {
      return window.ValidationUtils.formatPhone(phone);
    }
    // Fallback phone formatting
    return phone || '';
  }

  /**
   * Actualiza el encabezado con estadísticas
   */
  updateHeader() {
    if (this.elements.totalClientesHeader) {
      const count = this.clientesData.length;
      this.elements.totalClientesHeader.textContent = `${count} ${count === 1 ? 'cliente' : 'clientes'}`;
    }
  }

  /**
   * Muestra/oculta loading
   */
  showLoading(show) {
    if (this.elements.loadingOverlay) {
      if (show) {
        this.elements.loadingOverlay.classList.add('show');
      } else {
        this.elements.loadingOverlay.classList.remove('show');
      }
    }
    this.isLoading = show;
  }

  /**
   * Obtiene estadísticas de clientes
   */
  getStats() {
    return {
      total: this.clientesData.length,
      filtered: this.filteredClientes.length,
      recent: this.clientesData.filter(c => {
        if (!c.fechaCreacion) return false;
        const fecha = new Date(c.fechaCreacion);
        const semanaAtras = new Date();
        semanaAtras.setDate(semanaAtras.getDate() - 7);
        return fecha >= semanaAtras;
      }).length
    };
  }

  /**
   * Exporta clientes a CSV
   */
  exportToCSV() {
    try {
      const headers = ['Nombre', 'NIT', 'Dirección', 'Teléfono', 'Fecha Creación'];
      const csvData = this.filteredClientes.map(cliente => [
        cliente.nombre,
        cliente.nit,
        cliente.direccion,
        cliente.telefono,
        cliente.fechaCreacion ? new Date(cliente.fechaCreacion).toLocaleDateString('es-ES') : ''
      ]);

      // Fallback CSV export if DataUtils is not available
      if (typeof DataUtils !== 'undefined' && DataUtils.arrayToCSV && DataUtils.downloadFile) {
        const csv = DataUtils.arrayToCSV(csvData, headers);
        DataUtils.downloadFile(csv, 'clientes.csv', 'text/csv');
      } else {
        // Simple CSV export
        const csvContent = [headers, ...csvData]
          .map(row => row.map(cell => `"${cell}"`).join(','))
          .join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'clientes.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      }
      
      showSuccess('Clientes exportados exitosamente');
    } catch (error) {
      console.error('Error exportando:', error);
      showError('Error al exportar clientes');
    }
  }
}

// Crear instancia global
const clientesManager = new ClientesManager();

// Hacer disponible globalmente para onclick handlers
window.clientesManager = clientesManager;

// Funciones globales para mantener compatibilidad
window.editarCliente = (id) => clientesManager.editCliente(id);
window.confirmarEliminar = (id) => clientesManager.deleteCliente(id);

export default clientesManager;