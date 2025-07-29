// Utilidades de Compras
// Aquí irán funciones auxiliares para compras

import { formatCurrency, formatNumber } from './formatters.js';

export function filtrarCompras(compras, filtros) {
  const { texto, proveedor, fecha } = filtros;
  let comprasFiltradas = compras;

  // Filtro por fecha (por defecto mostrar solo las de hoy)
  if (!fecha) {
    const hoy = new Date().toISOString().split('T')[0];
    comprasFiltradas = comprasFiltradas.filter(c => {
      const fechaCompra = new Date(c.fecha).toISOString().split('T')[0];
      return fechaCompra === hoy;
    });
  } else {
    comprasFiltradas = comprasFiltradas.filter(c => {
      const fechaCompra = new Date(c.fecha).toISOString().split('T')[0];
      return fechaCompra === fecha;
    });
  }

  if (texto) {
    comprasFiltradas = comprasFiltradas.filter(c => 
      (c.producto && c.producto.toLowerCase().includes(texto.toLowerCase())) ||
      (c.proveedor && c.proveedor.toLowerCase().includes(texto.toLowerCase()))
    );
  }

  if (proveedor) {
    comprasFiltradas = comprasFiltradas.filter(c => c.proveedor === proveedor);
  }

  return comprasFiltradas;
}

export function calcularTotales(compras) {
  const totales = {
    cantidad: 0,
    valorTotal: 0,
    proveedoresUnicos: new Set(),
    productosUnicos: new Set()
  };

  compras.forEach(compra => {
    totales.cantidad += compra.cantidad || 0;
    totales.valorTotal += compra.valorTotal || 0;
    if (compra.proveedor) totales.proveedoresUnicos.add(compra.proveedor);
    if (compra.producto) totales.productosUnicos.add(compra.producto);
  });

  return {
    ...totales,
    proveedoresUnicos: totales.proveedoresUnicos.size,
    productosUnicos: totales.productosUnicos.size
  };
}

export function analizarCompra(compra, productosCache, comprasCache) {
  const producto = productosCache.find(p => p.nombre === compra.producto);
  
  // Buscar compras similares del mismo producto
  const comprasProducto = comprasCache.filter(c => 
    c.producto === compra.producto && c.id !== compra.id
  );
  
  let badge = '';
  let recomendacion = '';
  let rentabilidad = '';
  
  if (comprasProducto.length > 0) {
    const preciosProveedores = {};
    
    comprasProducto.forEach(c => {
      if (!preciosProveedores[c.proveedor] || 
          preciosProveedores[c.proveedor] > c.valorUnitario) {
        preciosProveedores[c.proveedor] = c.valorUnitario;
      }
    });
    
    const precioActual = compra.valorUnitario;
    const precios = Object.values(preciosProveedores);
    const precioMinimo = Math.min(...precios);
    const precioMaximo = Math.max(...precios);
    const precioPromedio = precios.reduce((a, b) => a + b, 0) / precios.length;
    
    // Determinar si el precio es bueno, regular o caro
    if (precioActual <= precioMinimo * 1.05) {
      badge = '<span class="price-badge excellent">💰 Excelente</span>';
    } else if (precioActual <= precioPromedio) {
      badge = '<span class="price-badge good">💵 Bueno</span>';
    } else if (precioActual <= precioMaximo * 1.1) {
      badge = '<span class="price-badge regular">💼 Regular</span>';
    } else {
      badge = '<span class="price-badge expensive">💲 Caro</span>';
    }
    
    // Recomendar mejor proveedor si existe
    const mejorProveedor = Object.keys(preciosProveedores).find(
      prov => preciosProveedores[prov] === precioMinimo
    );
    
    if (mejorProveedor && mejorProveedor !== compra.proveedor && precioActual > precioMinimo * 1.1) {
      const ahorroPotencial = precioActual - precioMinimo;
      recomendacion = `<div class="recommendation warning">
        <i class="bi bi-lightbulb"></i>
        <small>Mejor precio: ${mejorProveedor} (${formatCurrency(precioMinimo)})</small>
      </div>`;
    }
  }
  
  // Calcular rentabilidad si tenemos precio de venta
  if (producto && (producto.precioCliente || producto.precioDistribuidor)) {
    let rentabilidadHTML = '';
    if (producto.precioCliente) {
      const margenCliente = ((producto.precioCliente - compra.valorUnitario) / compra.valorUnitario) * 100;
      const margenClassCliente = margenCliente >= 30 ? 'success' : margenCliente >= 15 ? 'warning' : 'danger';
      rentabilidadHTML += `<div class="profitability ${margenClassCliente}"><i class="bi bi-graph-up"></i><small>Margen Cliente: ${margenCliente.toFixed(1)}%</small></div>`;
    }
    if (producto.precioDistribuidor) {
      const margenDist = ((producto.precioDistribuidor - compra.valorUnitario) / compra.valorUnitario) * 100;
      const margenClassDist = margenDist >= 30 ? 'success' : margenDist >= 15 ? 'warning' : 'danger';
      rentabilidadHTML += `<div class="profitability ${margenClassDist}"><i class="bi bi-graph-up-arrow"></i><small>Margen Dist: ${margenDist.toFixed(1)}%</small></div>`;
    }
    rentabilidad = rentabilidadHTML;
  }
  
  return {
    badge,
    recomendacion,
    rentabilidad,
    stockActualizado: true
  };
}

export function aplicarFiltros(comprasCache, filtroCompraInput, filtroProveedorSelect, filtroFechaInput) {
  const textoFiltro = filtroCompraInput.value.trim().toLowerCase();
  const proveedorFiltro = filtroProveedorSelect.value;
  const fechaFiltro = filtroFechaInput.value;
  
  let comprasFiltradas = comprasCache;

  // Filtro por fecha (por defecto mostrar solo las de hoy)
  if (!fechaFiltro) {
    const hoy = new Date().toISOString().split('T')[0];
    comprasFiltradas = comprasFiltradas.filter(c => {
      const fechaCompra = new Date(c.fecha).toISOString().split('T')[0];
      return fechaCompra === hoy;
    });
  } else {
    comprasFiltradas = comprasFiltradas.filter(c => {
      const fechaCompra = new Date(c.fecha).toISOString().split('T')[0];
      return fechaCompra === fechaFiltro;
    });
  }

  if (textoFiltro) {
    comprasFiltradas = comprasFiltradas.filter(c => 
      (c.producto && c.producto.toLowerCase().includes(textoFiltro)) ||
      (c.proveedor && c.proveedor.toLowerCase().includes(textoFiltro))
    );
  }

  if (proveedorFiltro) {
    comprasFiltradas = comprasFiltradas.filter(c => c.proveedor === proveedorFiltro);
  }
  
  return comprasFiltradas;
}

export function actualizarFiltroProveedores(comprasCache, filtroProveedorSelect) {
  const proveedores = [...new Set(comprasCache.map(c => c.proveedor))].filter(Boolean);
  
  filtroProveedorSelect.innerHTML = '<option value="">Todos los proveedores</option>';
  proveedores.forEach(proveedor => {
    const option = document.createElement('option');
    option.value = proveedor;
    option.textContent = proveedor;
    filtroProveedorSelect.appendChild(option);
  });
}

export function calcularEstadisticas(comprasCache, productosCache) {
  const hoy = new Date().toISOString().split('T')[0];
  const comprasHoy = comprasCache.filter(c => {
    const fechaCompra = new Date(c.fecha).toISOString().split('T')[0];
    return fechaCompra === hoy;
  });

  // Compras de hoy
  const comprasHoyCount = comprasHoy.length;
  
  // Gasto total de hoy
  const gastoHoy = comprasHoy.reduce((sum, c) => sum + (c.valorTotal || 0), 0);
  
  // Proveedores activos
  const proveedoresUnicos = [...new Set(comprasCache.map(c => c.proveedor))].filter(Boolean);
  const proveedoresActivosCount = proveedoresUnicos.length;
  
  // Mejor proveedor (más compras)
  let mejorProveedor = '—';
  if (proveedoresUnicos.length > 0) {
    const conteoProveedores = {};
    comprasCache.forEach(c => {
      conteoProveedores[c.proveedor] = (conteoProveedores[c.proveedor] || 0) + 1;
    });
    mejorProveedor = Object.keys(conteoProveedores).reduce((a, b) => 
      conteoProveedores[a] > conteoProveedores[b] ? a : b
    );
  }
  
  // Rentabilidad promedio
  const rentabilidadPromedio = calcularRentabilidadPromedio(comprasCache, productosCache);
  
  return {
    comprasHoy: comprasHoyCount,
    gastoHoy,
    proveedoresActivos: proveedoresActivosCount,
    mejorProveedor,
    rentabilidadPromedio
  };
}

export function calcularRentabilidadPromedio(comprasCache, productosCache) {
  let rentabilidades = [];
  
  comprasCache.forEach(compra => {
    const producto = productosCache.find(p => p.nombre === compra.producto);
    if (producto && producto.precioCliente && compra.valorUnitario) {
      const margen = ((producto.precioCliente - compra.valorUnitario) / compra.valorUnitario) * 100;
      rentabilidades.push(margen);
    }
  });
  
  if (rentabilidades.length > 0) {
    const promedioRentabilidad = rentabilidades.reduce((a, b) => a + b, 0) / rentabilidades.length;
    return {
      porcentaje: promedioRentabilidad.toFixed(1),
      trendClass: promedioRentabilidad >= 30 ? 'positive' : promedioRentabilidad >= 15 ? 'neutral' : 'negative',
      trendIcon: promedioRentabilidad >= 30 ? 'arrow-up' : promedioRentabilidad >= 15 ? 'dash' : 'arrow-down',
      trendText: promedioRentabilidad >= 30 ? 'Excelente' : promedioRentabilidad >= 15 ? 'Buena' : 'Baja'
    };
  } else {
    return {
      porcentaje: '0',
      trendClass: 'neutral',
      trendIcon: 'dash',
      trendText: 'Sin datos'
    };
  }
}

export function analizarProveedores(comprasCache) {
  const analisisProveedores = {};
  
  comprasCache.forEach(compra => {
    if (!analisisProveedores[compra.proveedor]) {
      analisisProveedores[compra.proveedor] = {
        nombre: compra.proveedor,
        compras: 0,
        gastoTotal: 0,
        productos: new Set(),
        precioPromedio: 0
      };
    }
    
    const prov = analisisProveedores[compra.proveedor];
    prov.compras++;
    prov.gastoTotal += compra.valorTotal || 0;
    prov.productos.add(compra.producto);
  });
  
  // Calcular precio promedio y convertir a array
  const proveedoresList = Object.values(analisisProveedores).map(prov => {
    prov.precioPromedio = prov.gastoTotal / prov.compras;
    prov.productosCount = prov.productos.size;
    return prov;
  }).sort((a, b) => b.compras - a.compras);
  
  return proveedoresList;
}

export function analizarPromociones(promocionesCache) {
  return promocionesCache.filter(p => p.activa === true);
}

export function exportarCompras(comprasCache) {
  if (comprasCache.length === 0) {
    throw new Error('No hay compras para exportar.');
  }

  const headers = ['Producto', 'Proveedor', 'Fecha', 'Cantidad', 'Valor Unitario', 'Valor Total', 'Fecha Registro'];
  
  const csvContent = [
    headers.join(','),
    ...comprasCache.map(compra => [
      `"${compra.producto || ''}"`,
      `"${compra.proveedor || ''}"`,
      `"${compra.fecha ? new Date(compra.fecha).toLocaleDateString() : ''}"`,
      compra.cantidad || 0,
      compra.valorUnitario || 0,
      compra.valorTotal || 0,
      `"${compra.fechaRegistro ? new Date(compra.fechaRegistro).toLocaleDateString() : ''}"`
    ].join(','))
  ].join('\n');

  return csvContent;
}

export function descargarCSV(content, filename) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function actualizarPaginacion(items, container, type, currentPage, itemsPerPage, renderCallback, actualizarPaginacionCallback) {
  if (!container) return;
  
  container.innerHTML = "";
  const totalPages = Math.ceil(items.length / itemsPerPage);

  if (totalPages <= 1) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'flex';

  const createPageItem = (text, page, isDisabled = false, isActive = false) => {
    const li = document.createElement("li");
    li.className = `pagination-btn ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
    
    const a = document.createElement('a');
    a.href = "#";
    a.textContent = text;
    a.dataset.page = page.toString();
    a.dataset.type = type;
    
    a.addEventListener('click', (e) => {
      e.preventDefault();
    });
    
    li.appendChild(a);
    return li;
  };

  container.appendChild(createPageItem('‹ Anterior', currentPage - 1, currentPage === 1));
  
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);
  
  if (currentPage <= 3) {
    endPage = Math.min(5, totalPages);
  }
  if (currentPage >= totalPages - 2) {
    startPage = Math.max(totalPages - 4, 1);
  }
  
  if (startPage > 1) {
    container.appendChild(createPageItem('1', 1, false, 1 === currentPage));
    if (startPage > 2) {
      const dots = document.createElement('li');
      dots.className = 'pagination-btn disabled';
      dots.innerHTML = '<span>...</span>';
      container.appendChild(dots);
    }
  }
  
  for (let i = startPage; i <= endPage; i++) {
    container.appendChild(createPageItem(i.toString(), i, false, i === currentPage));
  }
  
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('li');
      dots.className = 'pagination-btn disabled';
      dots.innerHTML = '<span>...</span>';
      container.appendChild(dots);
    }
    container.appendChild(createPageItem(totalPages.toString(), totalPages, false, totalPages === currentPage));
  }
  
  container.appendChild(createPageItem('Siguiente ›', currentPage + 1, currentPage === totalPages));
  
  container.addEventListener('click', (e) => handlePaginationClick(e, items, itemsPerPage, renderCallback, actualizarPaginacionCallback));
}

export function handlePaginationClick(e, items, itemsPerPage, renderCallback, actualizarPaginacionCallback) {
  e.preventDefault();
  
  const target = e.target.closest('a[data-page]');
  if (!target || target.parentElement.classList.contains('disabled')) {
    return;
  }
  
  const newPage = parseInt(target.dataset.page);
  const pageType = target.dataset.type;
  
  if (isNaN(newPage) || newPage < 1) {
    return;
  }
  
  if (pageType === 'compras') {
    const totalPages = Math.ceil(items.length / itemsPerPage);
    if (newPage > totalPages) {
      return;
    }
    
    renderCallback(items, newPage);
    actualizarPaginacionCallback(items, newPage);
  }
}

export function validarCompra(compraData) {
  const { producto, proveedor, fecha, cantidad, valorUnitario } = compraData;

  if (!producto || !proveedor || !fecha) {
    throw new Error('Todos los campos son obligatorios.');
  }

  if (cantidad <= 0) {
    throw new Error('La cantidad debe ser mayor a cero.');
  }

  if (valorUnitario <= 0) {
    throw new Error('El valor unitario debe ser mayor a cero.');
  }

  return true;
}

export function calcularValorTotal(cantidad, valorUnitario) {
  return cantidad * valorUnitario;
}

export function actualizarProductoPorCompra(producto, cantidadComprada, nuevoPrecio) {
  const stockActual = producto.stockCanastas || 0;
  const nuevoStock = stockActual + cantidadComprada;
  
  return {
    stockCanastas: nuevoStock,
    stock: nuevoStock * (producto.unidadesPorTipo || 30),
    precioCompra: nuevoPrecio,
    valorTotal: nuevoStock * nuevoPrecio,
    fechaActualizacion: new Date().toISOString(),
  };
}

export function revertirProductoPorEliminacion(producto, cantidadEliminada) {
  const stockActual = producto.stockCanastas || 0;
  const nuevoStock = stockActual - cantidadEliminada;
  
  return {
    stockCanastas: nuevoStock,
    stock: nuevoStock * (producto.unidadesPorTipo || 30),
    valorTotal: nuevoStock * (producto.precioCompra || 0),
    fechaActualizacion: new Date().toISOString(),
  };
} 