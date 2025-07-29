/**
 * ✅ Validators - Distribuciones ROCA
 * Sistema completo de validaciones para formularios
 */

/**
 * Clase principal para manejar validaciones
 */
class ValidationManager {
  constructor() {
    this.rules = new Map();
    this.customValidators = new Map();
    this.errorMessages = new Map();
    this.setupDefaultMessages();
  }

  /**
   * Configura mensajes de error por defecto
   */
  setupDefaultMessages() {
    this.errorMessages.set('required', 'Este campo es obligatorio');
    this.errorMessages.set('email', 'Ingrese un email válido');
    this.errorMessages.set('phone', 'Ingrese un teléfono válido');
    this.errorMessages.set('nit', 'Ingrese un NIT válido');
    this.errorMessages.set('number', 'Ingrese un número válido');
    this.errorMessages.set('min', 'El valor debe ser mayor a {min}');
    this.errorMessages.set('max', 'El valor debe ser menor a {max}');
    this.errorMessages.set('minLength', 'Debe tener al menos {min} caracteres');
    this.errorMessages.set('maxLength', 'No puede tener más de {max} caracteres');
    this.errorMessages.set('pattern', 'El formato no es válido');
    this.errorMessages.set('currency', 'Ingrese un valor monetario válido');
    this.errorMessages.set('positiveNumber', 'El valor debe ser positivo');
    this.errorMessages.set('integer', 'Debe ser un número entero');
    this.errorMessages.set('url', 'Ingrese una URL válida');
    this.errorMessages.set('date', 'Ingrese una fecha válida');
    this.errorMessages.set('time', 'Ingrese una hora válida');
    this.errorMessages.set('strongPassword', 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número');
  }

  /**
   * Añade reglas de validación para un formulario
   */
  addRules(formId, rules) {
    this.rules.set(formId, rules);
  }

  /**
   * Valida un formulario completo
   */
  validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) {
      console.error(`Formulario ${formId} no encontrado`);
      return false;
    }

    const rules = this.rules.get(formId);
    if (!rules) {
      console.warn(`No hay reglas definidas para el formulario ${formId}`);
      return true;
    }

    let isValid = true;
    const errors = {};

    // Limpiar errores anteriores
    this.clearFormErrors(form);

    // Validar cada campo
    Object.entries(rules).forEach(([fieldName, fieldRules]) => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        const fieldResult = this.validateField(field, fieldRules);
        if (!fieldResult.isValid) {
          isValid = false;
          errors[fieldName] = fieldResult.errors;
          this.showFieldError(field, fieldResult.errors[0]);
        }
      }
    });

    // Disparar evento de validación
    const event = new CustomEvent('formValidated', {
      detail: { isValid, errors, formId }
    });
    form.dispatchEvent(event);

    return isValid;
  }

  /**
   * Valida un campo individual
   */
  validateField(field, rules) {
    const value = this.getFieldValue(field);
    const errors = [];

    rules.forEach(rule => {
      if (typeof rule === 'string') {
        // Regla simple
        const validator = this.getValidator(rule);
        if (validator && !validator.test(value, field)) {
          errors.push(this.getMessage(rule));
        }
      } else if (typeof rule === 'object') {
        // Regla con parámetros
        const { type, ...params } = rule;
        const validator = this.getValidator(type);
        if (validator && !validator.test(value, field, params)) {
          errors.push(this.getMessage(type, params));
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Obtiene el valor de un campo
   */
  getFieldValue(field) {
    if (field.type === 'checkbox') {
      return field.checked;
    } else if (field.type === 'radio') {
      const form = field.closest('form');
      const checked = form.querySelector(`input[name="${field.name}"]:checked`);
      return checked ? checked.value : '';
    } else {
      return field.value.trim();
    }
  }

  /**
   * Obtiene un validador
   */
  getValidator(type) {
    return this.customValidators.get(type) || defaultValidators[type];
  }

  /**
   * Obtiene un mensaje de error
   */
  getMessage(type, params = {}) {
    const template = this.errorMessages.get(type) || 'Valor inválido';
    return template.replace(/\{(\w+)\}/g, (match, key) => params[key] || match);
  }

  /**
   * Muestra error en un campo
   */
  showFieldError(field, message) {
    const formGroup = field.closest('.form-group');
    if (formGroup) {
      formGroup.classList.add('has-error');
      
      // Crear o actualizar mensaje de error
      let errorElement = formGroup.querySelector('.form-help.error');
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'form-help error';
        formGroup.appendChild(errorElement);
      }
      errorElement.textContent = message;
    }
  }

  /**
   * Limpia errores de un formulario
   */
  clearFormErrors(form) {
    const errorGroups = form.querySelectorAll('.form-group.has-error');
    errorGroups.forEach(group => {
      group.classList.remove('has-error');
      const errorMessage = group.querySelector('.form-help.error');
      if (errorMessage) {
        errorMessage.remove();
      }
    });
  }

  /**
   * Limpia error de un campo específico
   */
  clearFieldError(field) {
    const formGroup = field.closest('.form-group');
    if (formGroup) {
      formGroup.classList.remove('has-error');
      const errorMessage = formGroup.querySelector('.form-help.error');
      if (errorMessage) {
        errorMessage.remove();
      }
    }
  }

  /**
   * Añade validador personalizado
   */
  addCustomValidator(name, validator) {
    this.customValidators.set(name, validator);
  }

  /**
   * Configura mensaje personalizado
   */
  setMessage(type, message) {
    this.errorMessages.set(type, message);
  }

  /**
   * Valida en tiempo real
   */
  enableRealTimeValidation(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    const rules = this.rules.get(formId);
    if (!rules) return;

    Object.keys(rules).forEach(fieldName => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        // Validar al perder el foco
        field.addEventListener('blur', () => {
          const result = this.validateField(field, rules[fieldName]);
          if (!result.isValid) {
            this.showFieldError(field, result.errors[0]);
          } else {
            this.clearFieldError(field);
          }
        });

        // Limpiar error al empezar a escribir
        field.addEventListener('input', () => {
          this.clearFieldError(field);
        });
      }
    });
  }
}

/**
 * Validadores por defecto
 */
const defaultValidators = {
  /**
   * Campo obligatorio
   */
  required: {
    test: (value, field) => {
      if (field.type === 'checkbox') {
        return field.checked;
      }
      return value !== '';
    }
  },

  /**
   * Email válido
   */
  email: {
    test: (value) => {
      if (value === '') return true; // Solo validar si hay valor
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    }
  },

  /**
   * Teléfono colombiano
   */
  phone: {
    test: (value) => {
      if (value === '') return true;
      // Acepta formatos: 3001234567, +573001234567, (300) 123-4567, etc.
      const phoneRegex = /^(\+57|57)?[\s\-\(\)]?[0-9][\s\-\(\)]?[0-9]{2}[\s\-\(\)]?[0-9]{3}[\s\-\(\)]?[0-9]{4}$/;
      const cleanPhone = value.replace(/[\s\-\(\)]/g, '');
      return phoneRegex.test(cleanPhone) && cleanPhone.length >= 10;
    }
  },

  /**
   * NIT colombiano
   */
  nit: {
    test: (value) => {
      if (value === '') return true;
      const cleanNIT = value.replace(/[\.\-\s]/g, '');
      
      // Verificar que tenga entre 8 y 10 dígitos
      if (!/^\d{8,10}$/.test(cleanNIT)) return false;
      
      // Algoritmo de verificación del dígito de verificación
      const digits = cleanNIT.split('').map(Number);
      const checkDigit = digits.pop();
      const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
      
      let sum = 0;
      for (let i = 0; i < digits.length; i++) {
        sum += digits[digits.length - 1 - i] * weights[i];
      }
      
      const remainder = sum % 11;
      const calculatedDigit = remainder < 2 ? remainder : 11 - remainder;
      
      return calculatedDigit === checkDigit;
    }
  },

  /**
   * Número válido
   */
  number: {
    test: (value) => {
      if (value === '') return true;
      return !isNaN(value) && !isNaN(parseFloat(value));
    }
  },

  /**
   * Número entero
   */
  integer: {
    test: (value) => {
      if (value === '') return true;
      return Number.isInteger(Number(value));
    }
  },

  /**
   * Número positivo
   */
  positiveNumber: {
    test: (value) => {
      if (value === '') return true;
      const num = parseFloat(value);
      return !isNaN(num) && num > 0;
    }
  },

  /**
   * Valor mínimo
   */
  min: {
    test: (value, field, params) => {
      if (value === '') return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= params.min;
    }
  },

  /**
   * Valor máximo
   */
  max: {
    test: (value, field, params) => {
      if (value === '') return true;
      const num = parseFloat(value);
      return !isNaN(num) && num <= params.max;
    }
  },

  /**
   * Longitud mínima
   */
  minLength: {
    test: (value, field, params) => {
      return value.length >= params.min;
    }
  },

  /**
   * Longitud máxima
   */
  maxLength: {
    test: (value, field, params) => {
      return value.length <= params.max;
    }
  },

  /**
   * Patrón personalizado
   */
  pattern: {
    test: (value, field, params) => {
      if (value === '') return true;
      const regex = new RegExp(params.pattern);
      return regex.test(value);
    }
  },

  /**
   * Moneda colombiana
   */
  currency: {
    test: (value) => {
      if (value === '') return true;
      // Acepta formatos: $1,000.00, 1000, 1.000,00, etc.
      const currencyRegex = /^\$?[\d,]+\.?\d{0,2}$/;
      const cleanValue = value.replace(/[\$,]/g, '');
      return currencyRegex.test(value) && !isNaN(parseFloat(cleanValue));
    }
  },

  /**
   * URL válida
   */
  url: {
    test: (value) => {
      if (value === '') return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }
  },

  /**
   * Fecha válida
   */
  date: {
    test: (value) => {
      if (value === '') return true;
      const date = new Date(value);
      return !isNaN(date.getTime());
    }
  },

  /**
   * Hora válida
   */
  time: {
    test: (value) => {
      if (value === '') return true;
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      return timeRegex.test(value);
    }
  },

  /**
   * Contraseña fuerte
   */
  strongPassword: {
    test: (value) => {
      if (value === '') return true;
      // Al menos 8 caracteres, una mayúscula, una minúscula, un número
      const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
      return strongRegex.test(value);
    }
  },

  /**
   * Comparar con otro campo
   */
  match: {
    test: (value, field, params) => {
      const form = field.closest('form');
      const matchField = form.querySelector(`[name="${params.field}"]`);
      return matchField ? value === matchField.value : false;
    }
  }
};

/**
 * Funciones de utilidad para validaciones específicas del negocio
 */
export const BusinessValidators = {
  /**
   * Valida código de producto único
   */
  async uniqueProductCode(code, excludeId = null) {
    // Implementar validación con Firebase
    // Esta es una función de ejemplo que debería conectarse a la base de datos
    try {
      // const products = await getProductsByCode(code);
      // return products.length === 0 || (excludeId && products[0].id === excludeId);
      return true; // Placeholder
    } catch (error) {
      console.error('Error validando código de producto:', error);
      return false;
    }
  },

  /**
   * Valida cliente existente
   */
  async validateExistingClient(clientId) {
    try {
      // const client = await getClientById(clientId);
      // return client !== null;
      return true; // Placeholder
    } catch (error) {
      console.error('Error validando cliente:', error);
      return false;
    }
  },

  /**
   * Valida stock disponible
   */
  validateStock(requestedQuantity, availableStock) {
    const requested = parseFloat(requestedQuantity);
    const available = parseFloat(availableStock);
    
    if (isNaN(requested) || isNaN(available)) return false;
    if (requested <= 0) return false;
    
    return requested <= available;
  },

  /**
   * Valida precio válido
   */
  validatePrice(price) {
    const numPrice = parseFloat(price);
    return !isNaN(numPrice) && numPrice > 0 && numPrice < 1000000; // Max 1 millón
  },

  /**
   * Valida descuento
   */
  validateDiscount(discount, maxPercent = 50) {
    const numDiscount = parseFloat(discount);
    return !isNaN(numDiscount) && numDiscount >= 0 && numDiscount <= maxPercent;
  }
};

/**
 * Utilidades para formateo durante validación
 */
export const ValidationUtils = {
  /**
   * Formatea número de teléfono
   */
  formatPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
    }
    return phone;
  },

  /**
   * Formatea NIT
   */
  formatNIT(nit) {
    const cleaned = nit.replace(/\D/g, '');
    if (cleaned.length >= 8) {
      const digits = cleaned.slice(0, -1);
      const checkDigit = cleaned.slice(-1);
      return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + checkDigit;
    }
    return nit;
  },

  /**
   * Formatea moneda
   */
  formatCurrency(amount) {
    const num = parseFloat(amount.replace(/[^\d.]/g, ''));
    if (isNaN(num)) return amount;
    return num.toLocaleString('es-CO', { 
      style: 'currency', 
      currency: 'COP',
      minimumFractionDigits: 0 
    });
  },

  /**
   * Limpia valor para validación
   */
  sanitizeValue(value, type) {
    switch (type) {
      case 'phone':
        return value.replace(/\D/g, '');
      case 'nit':
        return value.replace(/[\.\-\s]/g, '');
      case 'currency':
        return value.replace(/[^\d.]/g, '');
      case 'number':
        return value.replace(/[^\d.-]/g, '');
      default:
        return value.trim();
    }
  }
};

// Crear instancia global del validador
const validationManager = new ValidationManager();

// Funciones de conveniencia para usar globalmente
export function validateForm(formId) {
  return validationManager.validateForm(formId);
}

export function addValidationRules(formId, rules) {
  validationManager.addRules(formId, rules);
}

export function enableRealTimeValidation(formId) {
  validationManager.enableRealTimeValidation(formId);
}

export function addCustomValidator(name, validator) {
  validationManager.addCustomValidator(name, validator);
}

export function setValidationMessage(type, message) {
  validationManager.setMessage(type, message);
}

// Hacer disponible globalmente
window.validationManager = validationManager;
window.validateForm = validateForm;
window.addValidationRules = addValidationRules;
window.enableRealTimeValidation = enableRealTimeValidation;
window.BusinessValidators = BusinessValidators;
window.ValidationUtils = ValidationUtils;

export default validationManager;