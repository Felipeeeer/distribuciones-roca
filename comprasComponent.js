// Componente de Compras
// Aquí irá el renderizado de tablas, tarjetas, formularios y modales de compras

import { formatCurrency, formatNumber } from '../utils/formatters.js';
import { analizarCompra } from '../utils/comprasUtils.js';

export function renderCompras(compras, tablaComprasBody, comprasMobileContainer, resultadosInfoElem, currentPage, itemsPerPage, productosCache, comprasCache) {
  if (!tablaComprasBody || !comprasMobileContainer) return;
  
  tablaComprasBody.innerHTML = "";
  comprasMobileContainer.innerHTML = "";

  if (compras.length === 0) {
    const emptyHtml = '<td colspan="8" class="text-center p-4">No se encontraron compras.</td>';
    tablaComprasBody.innerHTML = `<tr>${emptyHtml}</tr>`;
    comprasMobileContainer.innerHTML = '<div class="empty-state"><i class="bi bi-bag-plus"></i><p>No hay compras para mostrar</p></div>';
    return;
  }
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCompras = compras.slice(startIndex, endIndex);

  paginatedCompras.forEach(compra => {
    const fechaDisplay = new Date(compra.fecha).toLocaleDateString();
    const analisis = analizarCompra(compra, productosCache, comprasCache);
    
    // Para la tabla de escritorio
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="product-cell">
          <span class="product-name">${compra.producto}</span>
          ${analisis.stockActualizado ? '<span class="badge success">Stock ↑</span>' : ''}
        </div>
      </td>
      <td>
        <div class="supplier-cell">
          <span class="supplier-name">${compra.proveedor}</span>
          ${analisis.badge}
        </div>
      </td>
      <td>${formatNumber(compra.cantidad || 0)}</td>
      <td>${formatCurrency(compra.valorUnitario || 0)}</td>
      <td>
        <strong>${formatCurrency(compra.valorTotal || 0)}</strong>
      </td>
      <td>
        <div class="analysis-cell">
          ${analisis.recomendacion}
          ${analisis.rentabilidad}
        </div>
      </td>
      <td>${fechaDisplay}</td>
      <td class="text-center">
        <div class="table-actions">
          <button class="table-action-btn primary btn-editar-compra" data-id="${compra.id}" title="Editar">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button class="table-action-btn danger btn-eliminar-compra" data-id="${compra.id}" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    tablaComprasBody.appendChild(tr);

    // Para las tarjetas móviles
    const card = document.createElement('div');
    card.className = 'table-card';
    card.innerHTML = `
      <div class="table-card-header">
        <span class="table-card-title">${compra.producto}</span>
        <div class="table-actions">
          <button class="table-action-btn primary btn-editar-compra" data-id="${compra.id}" title="Editar">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button class="table-action-btn danger btn-eliminar-compra" data-id="${compra.id}" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <div class="table-card-body">
        <div class="table-card-row">
          <strong>Proveedor:</strong> ${compra.proveedor} ${analisis.badge}
        </div>
        <div class="table-card-row">
          <strong>Cantidad:</strong> ${formatNumber(compra.cantidad || 0)}
        </div>
        <div class="table-card-row">
          <strong>Valor Unitario:</strong> ${formatCurrency(compra.valorUnitario || 0)}
        </div>
        <div class="table-card-row">
          <strong>Valor Total:</strong> ${formatCurrency(compra.valorTotal || 0)}
        </div>
        <div class="table-card-row">
          <strong>Análisis:</strong> ${analisis.recomendacion} ${analisis.rentabilidad}
        </div>
        <div class="table-card-row">
          <strong>Fecha:</strong> ${fechaDisplay}
        </div>
      </div>
    `;
    comprasMobileContainer.appendChild(card);
  });

  // Actualizar información de resultados
  if (resultadosInfoElem) {
    resultadosInfoElem.textContent = `Mostrando ${startIndex + 1}-${Math.min(endIndex, compras.length)} de ${compras.length} compras`;
  }
}

export function createCompraFormHTML(compra = null) {
  const fechaValue = compra?.fecha ? compra.fecha.split('T')[0] : new Date().toISOString().split('T')[0];
  const productoValue = compra?.producto ? compra.producto.replace(/"/g, '&quot;') : '';
  const proveedorValue = compra?.proveedor ? compra.proveedor.replace(/"/g, '&quot;') : '';
  const cantidadValue = compra?.cantidad !== undefined ? compra.cantidad : 1;
  const valorUnitarioValue = compra?.valorUnitario !== undefined ? compra.valorUnitario : 0;
  
  return `
    <form id="formCompraModal" class="compra-form">
      <div class="form-row">
        <div class="form-group col-6">
          <label for="productoModal" class="form-label">Producto</label>
          <input type="text" class="form-control" id="productoModal" required value="${productoValue}" 
                 placeholder="Escribe para buscar productos..." autocomplete="off">
          <div class="autocomplete-dropdown" id="productoDropdown"></div>
          <small class="form-text">Selecciona un producto existente</small>
        </div>
        <div class="form-group col-6">
          <label for="proveedorModal" class="form-label">Proveedor</label>
          <input type="text" class="form-control" id="proveedorModal" required value="${proveedorValue}">
          <small class="form-text">Nombre del proveedor</small>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group col-4">
          <label for="fechaModal" class="form-label">Fecha</label>
          <input type="date" class="form-control" id="fechaModal" required value="${fechaValue}">
        </div>
        <div class="form-group col-4">
          <label for="cantidadModal" class="form-label">Cantidad</label>
          <input type="number" class="form-control" id="cantidadModal" required min="1" step="1" value="${cantidadValue}">
        </div>
        <div class="form-group col-4">
          <label for="valorUnitarioModal" class="form-label">Valor Unitario</label>
          <div class="input-group">
            <span class="input-group-text">$</span>
            <input type="number" class="form-control" id="valorUnitarioModal" required min="0" step="0.01" value="${valorUnitarioValue}">
          </div>
        </div>
      </div>

      <div class="valor-total-display">
        <i class="bi bi-calculator"></i>
        <span>Valor Total: <strong id="valorTotalCalculadoModal">$0</strong></span>
      </div>

      <div class="purchase-analysis" id="analisisCompraModal">
        <!-- Se llenará dinámicamente -->
      </div>
    </form>
  `;
}

export function setupCompraFormListeners(productosCache, comprasCache) {
  const productoInput = document.getElementById('productoModal');
  const cantidadInput = document.getElementById('cantidadModal');
  const valorUnitarioInput = document.getElementById('valorUnitarioModal');
  const dropdown = document.getElementById('productoDropdown');
  
  // Autocompletado de productos
  if (productoInput) {
    productoInput.addEventListener('input', (e) => {
      const valor = e.target.value.toLowerCase();
      actualizarValorCalculadoModal();
      actualizarAnalisisCompra(productosCache, comprasCache);
      
      if (valor.length > 0) {
        const productosFiltrados = productosCache.filter(p => 
          p.nombre.toLowerCase().includes(valor)
        ).slice(0, 5);
        
        if (productosFiltrados.length > 0) {
          dropdown.innerHTML = productosFiltrados.map(p => 
            `<div class="autocomplete-item" data-nombre="${p.nombre}">
              <span class="product-name">${p.nombre}</span>
              <span class="product-info">Stock: ${p.stockCanastas || 0} | Precio: ${formatCurrency(p.precioCompra || 0)}</span>
            </div>`
          ).join('');
          dropdown.style.display = 'block';
        } else {
          dropdown.style.display = 'none';
        }
      } else {
        dropdown.style.display = 'none';
      }
    });
    
    // Selección de producto del dropdown
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (item) {
        const nombreProducto = item.dataset.nombre;
        const producto = productosCache.find(p => p.nombre === nombreProducto);
        
        if (productoInput) { // Verifica que exista antes de asignar
          productoInput.value = nombreProducto;
        }
        dropdown.style.display = 'none';
        
        // Auto-rellenar precio si existe
        if (producto && producto.precioCompra && valorUnitarioInput) {
          valorUnitarioInput.value = producto.precioCompra;
        }
        
        actualizarValorCalculadoModal();
        actualizarAnalisisCompra(productosCache, comprasCache);
      }
    });
    
    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!productoInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }
  
  if (cantidadInput) cantidadInput.addEventListener('input', () => {
    actualizarValorCalculadoModal();
    actualizarAnalisisCompra(productosCache, comprasCache);
  });
  
  if (valorUnitarioInput) valorUnitarioInput.addEventListener('input', () => {
    actualizarValorCalculadoModal();
    actualizarAnalisisCompra(productosCache, comprasCache);
  });
  
  actualizarValorCalculadoModal();
  actualizarAnalisisCompra(productosCache, comprasCache);
}

export function actualizarValorCalculadoModal() {
  const cantidad = parseFloat(document.getElementById('cantidadModal')?.value) || 0;
  const valorUnitario = parseFloat(document.getElementById('valorUnitarioModal')?.value) || 0;
  const valorTotalElem = document.getElementById('valorTotalCalculadoModal');
  
  if (valorTotalElem) {
    valorTotalElem.textContent = formatCurrency(cantidad * valorUnitario);
  }
}

export function actualizarAnalisisCompra(productosCache, comprasCache) {
  const productoNombre = document.getElementById('productoModal')?.value;
  const valorUnitario = parseFloat(document.getElementById('valorUnitarioModal')?.value) || 0;
  const analisisContainer = document.getElementById('analisisCompraModal');
  
  if (!analisisContainer || !productoNombre || valorUnitario === 0) {
    if (analisisContainer) analisisContainer.innerHTML = '';
    return;
  }
  
  const producto = productosCache.find(p => p.nombre === productoNombre);
  const comprasProducto = comprasCache.filter(c => c.producto === productoNombre);
  
  let analisisHTML = '';
  
  if (producto) {
    // Mostrar información actual del producto
    analisisHTML += `
      <div class="analysis-section">
        <h4><i class="bi bi-info-circle"></i> Información del Producto</h4>
        <div class="product-info-grid">
          <div class="info-item">
            <span class="info-label">Stock Actual:</span>
            <span class="info-value">${formatNumber(producto.stockCanastas || 0)} canastas</span>
          </div>
          <div class="info-item">
            <span class="info-label">Precio Actual:</span>
            <span class="info-value">${formatCurrency(producto.precioCompra || 0)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Precio Cliente:</span>
            <span class="info-value">${formatCurrency(producto.precioCliente || 0)}</span>
          </div>
        </div>
      </div>
    `;
    
    // Análisis de rentabilidad
    if (producto.precioCliente || producto.precioDistribuidor) {
      let rentabilidadModalHTML = '';
      if (producto.precioCliente) {
        const margen = ((producto.precioCliente - valorUnitario) / valorUnitario) * 100;
        const margenClass = margen >= 30 ? 'excellent' : margen >= 15 ? 'good' : 'poor';
        const margenIcon = margen >= 30 ? 'graph-up' : margen >= 15 ? 'graph-down-arrow' : 'graph-down';
        rentabilidadModalHTML += `
          <div class="profitability-analysis ${margenClass}">
            <div class="margin-display">
              <i class="bi bi-${margenIcon}"></i>
              <span class="margin-value">${margen.toFixed(1)}%</span>
              <span class="margin-label">Margen Cliente</span>
            </div>
            <div class="profit-details">
              <div>Costo: ${formatCurrency(valorUnitario)}</div>
              <div>Venta Cliente: ${formatCurrency(producto.precioCliente)}</div>
              <div>Ganancia: ${formatCurrency(producto.precioCliente - valorUnitario)}</div>
            </div>
          </div>
        `;
      }
      if (producto.precioDistribuidor) {
        const margen = ((producto.precioDistribuidor - valorUnitario) / valorUnitario) * 100;
        const margenClass = margen >= 30 ? 'excellent' : margen >= 15 ? 'good' : 'poor';
        const margenIcon = margen >= 30 ? 'graph-up' : margen >= 15 ? 'graph-down-arrow' : 'graph-down';
        rentabilidadModalHTML += `
          <div class="profitability-analysis ${margenClass}">
            <div class="margin-display">
              <i class="bi bi-${margenIcon}"></i>
              <span class="margin-value">${margen.toFixed(1)}%</span>
              <span class="margin-label">Margen Distribuidor</span>
            </div>
            <div class="profit-details">
              <div>Costo: ${formatCurrency(valorUnitario)}</div>
              <div>Venta Dist: ${formatCurrency(producto.precioDistribuidor)}</div>
              <div>Ganancia: ${formatCurrency(producto.precioDistribuidor - valorUnitario)}</div>
            </div>
          </div>
        `;
      }
      analisisHTML += `
        <div class="analysis-section">
          <h4><i class="bi bi-graph-up-arrow"></i> Análisis de Rentabilidad</h4>
          ${rentabilidadModalHTML}
        </div>
      `;
    }
  }
  
  // Análisis de precios de proveedores
  if (comprasProducto.length > 0) {
    const preciosProveedores = {};
    comprasProducto.forEach(c => {
      if (!preciosProveedores[c.proveedor] || 
          preciosProveedores[c.proveedor] > c.valorUnitario) {
        preciosProveedores[c.proveedor] = c.valorUnitario;
      }
    });
    
    const precios = Object.values(preciosProveedores);
    const precioMinimo = Math.min(...precios);
    const precioMaximo = Math.max(...precios);
    
    let recomendacionHTML = '';
    if (valorUnitario <= precioMinimo * 1.05) {
      recomendacionHTML = '<div class="recommendation excellent"><i class="bi bi-check-circle"></i> ¡Excelente precio!</div>';
    } else if (valorUnitario <= precioMaximo * 1.1) {
      recomendacionHTML = '<div class="recommendation warning"><i class="bi bi-exclamation-triangle"></i> Precio competitivo</div>';
    } else {
      const mejorProveedor = Object.keys(preciosProveedores).find(
        prov => preciosProveedores[prov] === precioMinimo
      );
      recomendacionHTML = `
        <div class="recommendation danger">
          <i class="bi bi-exclamation-circle"></i> 
          Precio alto. Mejor opción: ${mejorProveedor} (${formatCurrency(precioMinimo)})
        </div>
      `;
    }
    
    analisisHTML += `
      <div class="analysis-section">
        <h4><i class="bi bi-graph-up"></i> Comparación de Proveedores</h4>
        ${recomendacionHTML}
        <div class="suppliers-comparison">
          ${Object.entries(preciosProveedores).map(([proveedor, precio]) => `
            <div class="supplier-price ${precio === precioMinimo ? 'best' : precio === precioMaximo ? 'worst' : ''}">
              <span class="supplier-name">${proveedor}</span>
              <span class="supplier-price-value">${formatCurrency(precio)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  analisisContainer.innerHTML = analisisHTML;
}

export function mostrarModalCompra(compra = null, productosCache, comprasCache, onGuardar) {
  // Estado multistep
  let step = 1;
  const totalSteps = 3;
  const isEditing = !!compra;
  let formData = {
    producto: compra?.producto || '',
    proveedor: compra?.proveedor || '',
    fecha: compra?.fecha ? compra.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
    cantidad: compra?.cantidad !== undefined ? compra.cantidad : 1,
    valorUnitario: compra?.valorUnitario !== undefined ? compra.valorUnitario : 0
  };
  let resolveFn; // <-- Aquí guardamos la referencia
  function renderStep() {
    const modalOverlay = document.querySelector('.modal-overlay') || document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = `
      <div class="modal modal-large modal-info modal-scale">
        <div class="modal-header">
          <i class="bi bi-${isEditing ? 'pencil-square' : 'plus-circle'} modal-icon info"></i>
          <div class="modal-header-content">
            <h3 class="modal-title">${isEditing ? `Editar Compra: ${compra?.producto || ''}` : 'Registrar Nueva Compra'}</h3>
          </div>
          <button class="modal-close" data-action="close"><i class="bi bi-x"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-stepper">
            ${[1,2,3].map(n => `<div class="form-step${step===n? ' active' : step>n? ' completed':''}">${n}</div>`).join('')}
          </div>
          <form id="formCompraMultistep" class="compra-form">
            ${step === 1 ? `
              <div class="form-group">
                <label for="productoModal" class="form-label">Producto</label>
                <input type="text" class="form-control" id="productoModal" name="producto" required value="${formData.producto}" placeholder="Escribe para buscar productos..." autocomplete="off">
                <div class="autocomplete-dropdown" id="productoDropdown"></div>
                <small class="form-text">Selecciona un producto existente</small>
              </div>
              <div class="form-group">
                <label for="proveedorModal" class="form-label">Proveedor</label>
                <input type="text" class="form-control" id="proveedorModal" name="proveedor" required value="${formData.proveedor}">
                <small class="form-text">Nombre del proveedor</small>
              </div>
            ` : ''}
            ${step === 2 ? `
              <div class="form-group">
                <label for="fechaModal" class="form-label">Fecha</label>
                <input type="date" class="form-control" id="fechaModal" name="fecha" required value="${formData.fecha}">
              </div>
              <div class="form-group">
                <label for="cantidadModal" class="form-label">Cantidad</label>
                <input type="number" class="form-control" id="cantidadModal" name="cantidad" required min="1" step="1" value="${formData.cantidad}">
              </div>
              <div class="form-group">
                <label for="valorUnitarioModal" class="form-label">Valor Unitario</label>
                <div class="input-group">
                  <span class="input-group-text">$</span>
                  <input type="number" class="form-control" id="valorUnitarioModal" name="valorUnitario" required min="0" step="0.01" value="${formData.valorUnitario}">
                </div>
              </div>
              <div class="valor-total-display">
                <i class="bi bi-calculator"></i>
                <span>Valor Total: <strong id="valorTotalCalculadoModal">$0</strong></span>
              </div>
            ` : ''}
            ${step === 3 ? `
              <div class="form-group">
                <b>Confirma los datos:</b>
                <ul style="margin-top:0.7em;">
                  <li><b>Producto:</b> ${formData.producto}</li>
                  <li><b>Proveedor:</b> ${formData.proveedor}</li>
                  <li><b>Fecha:</b> ${formData.fecha}</li>
                  <li><b>Cantidad:</b> ${formData.cantidad}</li>
                  <li><b>Valor Unitario:</b> ${formData.valorUnitario}</li>
                  <li><b>Valor Total:</b> ${formData.cantidad * formData.valorUnitario}</li>
                </ul>
              </div>
            ` : ''}
          </form>
          <div class="purchase-analysis" id="analisisCompraModal"></div>
        </div>
        <div class="modal-footer" style="display:flex;gap:1em;justify-content:${step>1?'space-between':'flex-end'};">
          ${step > 1 ? `<button class="btn btn-ios secondary" id="btnAnteriorStepCompra" title="Anterior"><i class="bi bi-arrow-left"></i></button>` : ''}
          ${step < totalSteps ? `<button class="btn btn-ios primary" id="btnSiguienteStepCompra" title="Siguiente"><i class="bi bi-arrow-right"></i></button>` : `<button class="btn btn-ios primary" id="btnFinalizarStepCompra"><i class="bi bi-check-circle"></i></button>`}
        </div>
      </div>
    `;
    if (!document.body.contains(modalOverlay)) document.body.appendChild(modalOverlay);
    requestAnimationFrame(() => {
      modalOverlay.classList.add('show');
    });
    setTimeout(() => {
      if (step === 1 || step === 2) {
        setupCompraFormListeners(productosCache, comprasCache);
      }
      if (step === 2) {
        actualizarValorCalculadoModal();
        actualizarAnalisisCompra(productosCache, comprasCache);
      }
    }, 100);
    document.querySelector('.modal-close').onclick = () => closeModal();
    if (step > 1) document.getElementById('btnAnteriorStepCompra').onclick = () => { step--; renderStep(); };
    if (step < totalSteps) {
      document.getElementById('btnSiguienteStepCompra').onclick = e => {
        e.preventDefault();
        const form = document.getElementById('formCompraMultistep');
        if (step === 1) {
          const producto = form.producto.value.trim();
          const proveedor = form.proveedor.value.trim();
          if (!producto || !proveedor) {
            form.producto.classList.add('error');
            form.proveedor.classList.add('error');
            return;
          }
          formData.producto = producto;
          formData.proveedor = proveedor;
        }
        if (step === 2) {
          const fecha = form.fecha.value;
          const cantidad = form.cantidad.value;
          const valorUnitario = form.valorUnitario.value;
          if (!fecha || !cantidad || isNaN(cantidad) || cantidad < 1 || !valorUnitario || isNaN(valorUnitario) || valorUnitario < 0) {
            form.fecha.classList.add('error');
            form.cantidad.classList.add('error');
            form.valorUnitario.classList.add('error');
            return;
          }
          formData.fecha = fecha;
          formData.cantidad = parseInt(cantidad);
          formData.valorUnitario = parseFloat(valorUnitario);
        }
        step++;
        renderStep();
      };
    }
    if (step === totalSteps) {
      document.getElementById('btnFinalizarStepCompra').onclick = async e => {
        e.preventDefault();
        // Guardar compra
        const guardado = await onGuardar(formData);
        if (guardado) {
          closeModal();
          if (resolveFn) resolveFn(true); // Usar la variable aquí
        }
      };
    }
    function closeModal() {
      modalOverlay.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(modalOverlay)) document.body.removeChild(modalOverlay);
      }, 300);
    }
    // Cerrar con click fuera
    modalOverlay.onclick = (e) => {
      if (e.target === modalOverlay) closeModal();
    };
    // Cerrar con escape
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  }
  return new Promise((resolve) => {
    resolveFn = resolve; // Guardar la referencia aquí
    renderStep();
  });
}

export function renderMejoresProveedores(proveedoresList, container) {
  if (proveedoresList.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-truck"></i>
        <p>No hay datos de proveedores</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = proveedoresList.slice(0, 5).map((prov, index) => {
    const rankIcon = index === 0 ? 'trophy-fill' : index === 1 ? 'award' : 'star';
    const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze';
    
    return `
      <div class="supplier-item">
        <div class="supplier-rank ${rankClass}">
          <i class="bi bi-${rankIcon}"></i>
        </div>
        <div class="supplier-info">
          <h4>${prov.nombre}</h4>
          <div class="supplier-stats">
            <span>${prov.compras} compras</span>
            <span>${prov.productosCount} productos</span>
            <span>${formatCurrency(prov.gastoTotal)} total</span>
          </div>
        </div>
        <div class="supplier-score">
          ${formatCurrency(prov.precioPromedio)}
          <small>precio promedio</small>
        </div>
      </div>
    `;
  }).join('');
}

export function renderPromocionesActivas(promocionesActivas, container) {
  if (promocionesActivas.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-tag"></i>
        <p>No hay promociones activas</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = promocionesActivas.slice(0, 5).map(promo => {
    const ahorro = (promo.precioDescuento || 0) - (promo.precioPromocional || 0);
    const porcentajeAhorro = promo.precioDescuento > 0 ? 
      ((ahorro / promo.precioDescuento) * 100).toFixed(0) : 0;
    
    return `
      <div class="promotion-item">
        <div class="promotion-header">
          <div class="promotion-badge active">
            <i class="bi bi-check-circle"></i>
            Activa
          </div>
          <span class="discount-badge">-${porcentajeAhorro}%</span>
        </div>
        <div class="promotion-content">
          <h4>${promo.productoPrincipal} → ${promo.productoDescuento}</h4>
          <div class="promotion-details">
            <span class="quantity-rule">Compra ${promo.cantidadPrincipal}, lleva ${promo.cantidadNecesaria}</span>
            <div class="price-info">
              <span class="original-price">${formatCurrency(promo.precioDescuento)}</span>
              <span class="promo-price">${formatCurrency(promo.precioPromocional)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
} 