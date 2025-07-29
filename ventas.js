import { db } from "../config/firebase.js";
import {
  ref,
  push,
  onValue,
  remove,
  get,
  update,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

// Importar componentes iOS
// Al inicio de ventas.js, reemplaza la importación existente:
import { 
  formatCurrency, 
  formatDate, 
  formatDateCompact,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  formatPhone,
  formatNIT,
  capitalize 
} from '../utils/formatters.js';
import {
   confirmModal, 
   showModal,
   alertModal
} from '../components/modal.js';

// Importar control de sonido
import soundControl from '../components/soundControl.js';
import { getAssetPath } from '../utils/helpers.js';

// --- DOM Elements ---
const formVenta = document.getElementById("formVenta");
const clienteInput = document.getElementById("cliente");
const clienteSugerencias = document.getElementById("cliente-sugerencias");
const totalVentaElement = document.getElementById("totalVenta");
const productosContainer = document.getElementById("productos-container");
const paymentMethodsContainer = document.getElementById("payment-methods-container");
const promocionesContainer = document.getElementById("contenedorPromociones");
const fechaVentaInput = document.getElementById("fechaVenta");
const facturasContainer = document.getElementById("facturasContainer");

// Filtros
const filtroProducto = document.getElementById("filtroProducto");
const filtroCliente = document.getElementById("filtroCliente");
const filtroFecha = document.getElementById("filtroFecha");
const filtroFormaPago = document.getElementById("filtroFormaPago");
const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

// Tablas y Vistas
const tbodyVentas = document.querySelector("#tablaVentas tbody");
const ventasMobileContainer = document.getElementById("ventasMobileContainer");

// Resumen ventas
const elemDiarias = document.getElementById("ventasDiarias");
const elemSemanales = document.getElementById("ventasSemanales");
const elemMensuales = document.getElementById("ventasMensuales");
const elemTotalFacturas = document.getElementById("totalFacturas");

// Métodos de pago en estadísticas
const elemDiariosMetodos = document.getElementById("ventasDiariasMetodos");
const elemSemanalesMetodos = document.getElementById("ventasSemanalesMetodos");
const elemMensualesMetodos = document.getElementById("ventasMensualesMetodos");

// Paginación
const paginationContainer = document.getElementById("pagination");

// --- Estado de la Aplicación ---
let products = [];
let clientesCache = {};
let promocionesCache = {}; 
let ventasCache = [];
let facturasCache = [];
let idVentaAEliminar = null;
let contenidoAnterior = null; // Para restaurar el contenido anterior

// --- Sistema de Audio Optimizado ---
const audioCache = {
  venta: null,
  eliminacion: null
};

// Precargar audios al inicializar
function precargarAudios() {
  try {
    audioCache.venta = new Audio(getAssetPath('sounds/cash-register-purchase-87313.mp3'));
    audioCache.venta.preload = 'auto';
    audioCache.venta.volume = 0.7;
    
    audioCache.eliminacion = new Audio(getAssetPath('sounds/trash.mp3'));
    audioCache.eliminacion.preload = 'auto';
    audioCache.eliminacion.volume = 0.7;
  } catch (error) {
    console.warn('No se pudieron precargar los audios:', error);
  }
}

// Función optimizada para reproducir sonido de venta
function reproducirSonidoVenta() {
  try {
    if (audioCache.venta) {
      audioCache.venta.currentTime = 0;
      audioCache.venta.play().catch(err => {});
    } else {
      // Fallback si no está precargado
      const audio = new Audio(getAssetPath('sounds/cash-register-purchase-87313.mp3'));
      audio.volume = 0.7;
      audio.play().catch(err => {});
    }
  } catch (error) {
    console.warn('Error reproduciendo sonido de venta:', error);
  }
}

// Función optimizada para reproducir sonido de eliminación
function reproducirSonidoEliminacion() {
  try {
    if (audioCache.eliminacion) {
      audioCache.eliminacion.currentTime = 0;
      audioCache.eliminacion.play().catch(err => {});
    } else {
      // Fallback si no está precargado
      const audio = new Audio(getAssetPath('sounds/trash.mp3'));
      audio.volume = 0.7;
      audio.play().catch(err => {});
    }
  } catch (error) {
    console.warn('Error reproduciendo sonido de eliminación:', error);
  }
}

// --- Funciones Globales (Declaraciones Adelantadas) ---

// Función auxiliar para cargar imagen como base64
async function loadImageAsBase64(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = this.width;
      canvas.height = this.height;
      ctx.drawImage(this, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
}

// Función auxiliar para obtener productos de la factura
async function obtenerProductosFactura(fac, id) {
  let productos = [];
  
  if (fac.productos && Array.isArray(fac.productos)) {
    productos = fac.productos.map(p => ({
      producto: p.nombreProducto || p.producto || p.nombre || "Sin nombre",
      cantidad: p.cantidad || 1,
      precioUnitario: p.precioUnitario || p.precio || 0,
      total: p.total || (p.cantidad * p.precioUnitario) || 0
    }));
  } else {
    // Buscar venta asociada
    try {
      const ventaSnap = await get(ref(db, 'ventas'));
      if (ventaSnap.exists()) {
        const ventas = Object.entries(ventaSnap.val());
        const ventaAsociada = ventas.find(([key, venta]) => venta.facturaId === id);
        
        if (ventaAsociada && ventaAsociada[1].productos) {
          productos = ventaAsociada[1].productos.map(p => ({
            producto: p.nombreProducto || p.producto || p.nombre || "Sin nombre",
            cantidad: p.cantidad || 1,
            precioUnitario: p.precioUnitario || p.precio || 0,
            total: p.total || (p.cantidad * p.precioUnitario) || 0
          }));
        }
      }
    } catch (error) {
      console.warn("Error obteniendo productos de venta asociada:", error);
    }
  }

  if (productos.length === 0) {
    productos = [{ 
      producto: "Producto no especificado", 
      cantidad: 1, 
      precioUnitario: fac.total || 0, 
      total: fac.total || 0 
    }];
  }

  return productos;
}


// Función para descargar factura optimizada para impresora térmica de 80mm
async function descargarFactura(id) {
  const fac = facturasCache.find((x) => x.id === id);
  if (!fac) return;

  // Mostrar toast de loading
  showToast('📄 Generando factura térmica...', 'info', { duration: 0 });

  try {
    // Buscar cliente si falta ID
    if (!fac.clienteId && fac.cliente) {
      for (const [key, c] of Object.entries(clientesCache)) {
        if (c.nombre?.toLowerCase().trim() === fac.cliente.toLowerCase().trim()) {
          fac.clienteId = key;
          break;
        }
      }
    }

    // Datos del cliente
    let clienteData = { nombre: "N/A", nit: "N/A", telefono: "N/A", direccion: "N/A" };
    if (fac.clienteId) {
      try {
        const clienteSnap = await Promise.race([
          get(ref(db, `clientes/${fac.clienteId}`)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        if (clienteSnap.exists()) clienteData = clienteSnap.val();
      } catch (error) {
        console.error("Error obteniendo cliente:", error);
      }
    }

    // Productos
    let productos = await obtenerProductosFactura(fac, id);

    const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
    // Formato térmico: 80mm de ancho = ~227 puntos, altura variable
    const doc = new jsPDF({
      unit: 'pt',
      format: [227, 600], // 80mm x altura inicial
      orientation: 'portrait'
    });
    
    doc.setFont('helvetica');
    let yPosition = 45;
    const pageWidth = 227;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    // === ENCABEZADO DE LA EMPRESA ===
    // Nombre de la empresa centrado
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DISTRIBUCIONES ROCA', pageWidth/2, yPosition, { align: 'center' });
    yPosition += 18;

    // Información de contacto centrada
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('NIT: 1019002694-0', pageWidth/2, yPosition, { align: 'center' });
    yPosition += 12;
    doc.text('Tel: 301 197 5392', pageWidth/2, yPosition, { align: 'center' });
    yPosition += 12;
    doc.text('Cra 129A #139-31, Bogotá', pageWidth/2, yPosition, { align: 'center' });
    yPosition += 12;
    doc.text('distribucionesroca.contacto@gmail.com', pageWidth/2, yPosition, { align: 'center' });
    yPosition += 20;

    // === CÓDIGO QR ===
         try {
       const clienteId = fac.clienteId || 'general';
       const baseUrl = window.location.origin;
       const qrUrl = `${baseUrl}/pages/ventas.html?clienteId=${clienteId}`;
      const qrSize = 60;
      const qrX = (pageWidth - qrSize) / 2;

      // Generar QR con configuración optimizada para impresión térmica
      const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: qrSize * 4, // Mayor resolución para mejor calidad de impresión
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M' // Nivel medio de corrección de errores
      });

      // Agregar el QR al PDF
      doc.addImage(qrDataUrl, 'PNG', qrX, yPosition, qrSize, qrSize);
      yPosition += qrSize + 8;
      
      // Texto explicativo del QR
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Escanea para ver tu historial', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      doc.text('de compras completo', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
      
    } catch (error) {
      console.warn('No se pudo generar el código QR:', error);
      // Fallback: mostrar texto alternativo
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Consulta tu historial en:', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;
             const fallbackUrl = `${window.location.origin}/pages/ventas.html?clienteId=${fac.clienteId || 'general'}`;
      const urlLines = doc.splitTextToSize(fallbackUrl, contentWidth);
      doc.text(urlLines, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += urlLines.length * 8 + 10;
    }


    // === LÍNEA SEPARADORA ===
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

   // === INFORMACIÓN DE LA FACTURA ===
doc.setFontSize(10);
doc.setFont('helvetica', 'bold');
doc.text('FACTURA DE VENTA', pageWidth / 2, yPosition, { align: 'center' });
yPosition += 15;

doc.setFontSize(8);
doc.setFont('helvetica', 'normal');

// Centrar número de factura
doc.text(`No: ${fac.id?.slice(-8) || "N/A"}`, pageWidth / 2, yPosition, { align: 'center' });
yPosition += 12;

// Fecha y hora en una sola línea, centradas
const fechaFormateada = fac.fecha ? new Date(fac.fecha).toLocaleDateString('es-CO') : new Date().toLocaleDateString('es-CO');
const horaFormateada = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
doc.text(`${fechaFormateada} ${horaFormateada}`, pageWidth / 2, yPosition, { align: 'center' });
yPosition += 20;


    // === DATOS DEL CLIENTE ===
    doc.setFontSize(8);
    const labelX = margin;
    const dataX = margin + 60; // Posición X para los valores (datos)
    const dataWidth = contentWidth - 60; // Ancho disponible para los datos

    const nombreCliente = clienteData.nombre || fac.cliente || "Cliente General";
    const nitCliente = clienteData.nit || "N/A";
    const direccionCliente = clienteData.direccion || "N/A";
    const telefonoCliente = clienteData.telefono || "N/A";
    
    // Función auxiliar para agregar una línea de datos y manejar el salto de línea
    function addClientDataLine(label, value) {
      if (value && value !== "N/A") {
        doc.setFont('helvetica', 'bold');
        doc.text(label, labelX, yPosition);
        
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(value, dataWidth);
        doc.text(lines, dataX, yPosition);
        yPosition += lines.length * 10 + 4; // Incrementar Y según las líneas usadas
      }
    }

    addClientDataLine('CLIENTE:', nombreCliente);
    addClientDataLine('NIT/C.C:', nitCliente);
    addClientDataLine('DIRECCIÓN:', direccionCliente);
    addClientDataLine('TELÉFONO:', telefonoCliente);

    yPosition += 10;

    // === LÍNEA SEPARADORA ===
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // === PRODUCTOS ===
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    // Encabezado de la tabla con precio unitario
    doc.text('CANT', margin, yPosition);
    doc.text('PRODUCTO', margin + 25, yPosition);
    doc.text('P.UNIT', margin + 120, yPosition);
    doc.text('TOTAL', pageWidth - margin - 35, yPosition);
    yPosition += 10;
    
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    let subtotal = 0;
    doc.setFont('helvetica', 'normal');
    
    productos.forEach((p) => {
      const cantidad = p.cantidad || 1;
      const precioUnitario = p.precioUnitario || p.precio || 0;
      const precioTotal = p.total || (cantidad * precioUnitario);
      subtotal += precioTotal;
      
      // Formatear cantidad (manejar decimales como 0.5)
      const cantidadText = cantidad % 1 === 0 ? cantidad.toString() : cantidad.toString();
      
      // Producto name (máximo 14 caracteres para dar espacio al precio unitario)
      const nombreProducto = (p.producto || p.nombre || "Producto").substring(0, 14);
      
      // Precios formateados
      const precioUnitText = `$${precioUnitario.toLocaleString('es-CO')}`;
      const precioTotalText = `$${precioTotal.toLocaleString('es-CO')}`;
      
      // Línea de producto con todas las columnas
      doc.text(cantidadText, margin, yPosition);
      doc.text(nombreProducto, margin + 25, yPosition);
      doc.text(precioUnitText, margin + 120, yPosition);
      doc.text(precioTotalText, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 10;
      
      // Si el nombre del producto es muy largo, agregar una segunda línea
      if ((p.producto || p.nombre || "Producto").length > 14) {
        const nombreCompleto = (p.producto || p.nombre || "Producto");
        const segundaLinea = nombreCompleto.substring(14, 28);
        if (segundaLinea) {
          doc.text(segundaLinea, margin + 25, yPosition);
          yPosition += 8;
        }
      }
    });

    yPosition += 5;
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // === TOTALES ===
    const descuento = fac.totalDescuento || 0;
    const total = fac.total || subtotal;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    if (descuento > 0) {
      doc.text('Subtotal:', margin, yPosition);
      doc.text(`$${(total + descuento).toLocaleString('es-CO')}`, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 12;
      
      doc.text('Descuento:', margin, yPosition);
      doc.text(`-$${descuento.toLocaleString('es-CO')}`, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 12;
    }

    // Total final
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL A PAGAR:', margin, yPosition);
    doc.text(`$${total.toLocaleString('es-CO')}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 20;

    // === MÉTODOS DE PAGO ===
    if (fac.metodosPago && fac.metodosPago.length > 0) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('FORMA DE PAGO:', margin, yPosition);
      yPosition += 12;
      
      doc.setFont('helvetica', 'normal');
      fac.metodosPago.forEach(mp => {
        doc.text(`${mp.metodo}: $${mp.monto.toLocaleString('es-CO')}`, margin, yPosition);
        yPosition += 10;
      });
      yPosition += 10;
    }

    // === PROMOCIONES ===
    if (fac.promocionesAplicadas && fac.promocionesAplicadas.length > 0) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('PROMOCIONES APLICADAS:', margin, yPosition);
      yPosition += 12;
      
      doc.setFont('helvetica', 'normal');
      fac.promocionesAplicadas.forEach(promo => {
        const promoText = doc.splitTextToSize(promo.nombrePromocion, contentWidth);
        doc.text(promoText, margin, yPosition);
        yPosition += promoText.length * 10;
      });
      yPosition += 10;
    }

    // === LÍNEA SEPARADORA ===
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // === FOOTER ===
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('¡Gracias por su compra!', pageWidth/2, yPosition, { align: 'center' });
    yPosition += 10;
    doc.text('Vuelva pronto', pageWidth/2, yPosition, { align: 'center' });
    yPosition += 15;
    
    doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, pageWidth/2, yPosition, { align: 'center' });
    yPosition += 10;
    doc.text('Sistema ROCA v1.0', pageWidth/2, yPosition, { align: 'center' });

    // Ajustar altura del documento según el contenido
    const finalHeight = Math.max(yPosition + 30, 400);
    doc.internal.pageSize.height = finalHeight;

    // === GUARDAR Y/O IMPRIMIR ===
    const clienteNombre = (fac.cliente || 'Cliente').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const fecha = new Date().toISOString().split('T')[0];
    const filename = `Factura_Termica_${clienteNombre}_${fac.id?.slice(-6) || Date.now()}_${fecha}.pdf`;
    
    // Intentar imprimir automáticamente (solo funciona en algunos navegadores)
    try {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } catch (error) {
      console.warn('No se pudo imprimir automáticamente:', error);
      doc.save(filename);
    }
    
    showSuccess("✅ Factura térmica generada correctamente");

  } catch (err) {
    console.error(err);
    showError(`❌ Error al generar factura térmica: ${err.message}`);
  }
}
// Función para previsualizar factura
async function previewFactura(id) {
  const factura = facturasCache.find(f => f.id === id);
  if (!factura) {
    showError("Factura no encontrada.");
    return;
  }

  // Buscar datos del cliente
  let clienteData = { nombre: "N/A", nit: "N/A", telefono: "N/A", direccion: "N/A" };
  if (factura.clienteId) {
    try {
      const clienteSnap = await get(ref(db, `clientes/${factura.clienteId}`));
      if (clienteSnap.exists()) {
        clienteData = clienteSnap.val();
      }
    } catch (error) {
      console.error("Error obteniendo cliente:", error);
    }
  }

  const fechaFormateada = formatDateTime(factura.fecha);

  const productosHtml = (factura.productos || []).map(p => `
    <div class="factura-detalle-producto">
      <div class="producto-info">
        <div class="producto-nombre">${capitalize(p.nombreProducto || p.producto || p.nombre)}</div>
        <div class="producto-detalles">
          <span class="producto-cantidad">${formatNumber(p.cantidad)} unidades</span>
          <span class="producto-precio">${formatCurrency(p.precioUnitario || p.precio || 0)} c/u</span>
        </div>
      </div>
      <div class="producto-total">${formatCurrency(p.total || (p.cantidad * p.precioUnitario) || 0)}</div>
    </div>
  `).join("");

  const metodosPagoHtml = (factura.metodosPago || []).map(mp => `
    <div class="factura-detalle-pago">
      <div class="pago-metodo">
        <i class="bi ${mp.metodo === 'Efectivo' ? 'bi-cash' : mp.metodo === 'Nequi' ? 'bi-phone' : 'bi-bank'}"></i>
        <span>${mp.metodo}</span>
      </div>
      <div class="pago-monto">${formatCurrency(mp.monto)}</div>
    </div>
  `).join("");

  let promocionesHtml = "";
  if (factura.promocionesAplicadas && factura.promocionesAplicadas.length > 0) {
    const promosTexto = factura.promocionesAplicadas.map(p => p.nombrePromocion).join(', ');
    promocionesHtml = `
      <div class="factura-detalle-promociones">
        <div class="promociones-header">
          <i class="bi bi-stars"></i>
          <span>Promociones Aplicadas</span>
        </div>
        <div class="promociones-content">
          <div class="promociones-lista">${promosTexto}</div>
          <div class="promociones-descuento">
            <span>Descuento Total:</span>
            <span class="descuento-valor">${formatCurrency(factura.totalDescuento || 0)}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Obtener el nombre del cliente correctamente
  const nombreCliente = factura.cliente || clienteData.nombre || "Cliente no especificado";

  const modalContent = `
    <div class="factura-detalle-container">
      <!-- Header con información principal -->
      <div class="factura-detalle-header">
        <div class="factura-detalle-cliente">
          <div class="cliente-avatar">
            <i class="bi bi-person-circle"></i>
    </div>
          <div class="cliente-info">
            <h4>${capitalize(nombreCliente)}</h4>
            <span class="tipo-cliente-badge">${capitalize(factura.tipoCliente) || "N/A"}</span>
    </div>
    </div>
        <div class="factura-detalle-total">
          <span class="total-label">Total Factura</span>
          <span class="total-amount">${formatCurrency(factura.total)}</span>
        </div>
      </div>

      <!-- Información de fecha y NIT -->
      <div class="factura-detalle-fecha">
        <i class="bi bi-calendar3"></i>
        <span>${fechaFormateada}</span>
        ${clienteData.nit && clienteData.nit !== "N/A" ? `
          <span class="factura-nit">NIT: ${clienteData.nit}</span>
        ` : ''}
      </div>

      <!-- Productos -->
      <div class="factura-detalle-section">
        <div class="section-header">
          <i class="bi bi-box-seam"></i>
          <span>Productos</span>
        </div>
        <div class="section-content">
          ${productosHtml}
        </div>
      </div>

      <!-- Métodos de Pago -->
      <div class="factura-detalle-section">
        <div class="section-header">
          <i class="bi bi-credit-card"></i>
          <span>Métodos de Pago</span>
        </div>
        <div class="section-content">
          ${metodosPagoHtml}
        </div>
      </div>

      <!-- Promociones (si aplica) -->
      ${promocionesHtml}

      <!-- Acciones -->
      <div class="factura-detalle-actions">
        <button class="factura-detalle-btn factura-detalle-download" onclick="descargarFactura('${factura.id}')">
          <i class="bi bi-download"></i>
          <span>Descargar PDF</span>
      </button>
        <button class="factura-detalle-btn factura-detalle-delete" onclick="eliminarFactura('${factura.id}')">
          <i class="bi bi-trash"></i>
          <span>Eliminar</span>
        </button>
        <button class="factura-detalle-btn factura-detalle-close" onclick="closeModal()">
          <i class="bi bi-x-lg"></i>
          <span>Cerrar</span>
      </button>
      </div>
    </div>
  `;

  await showModal({
    title: `<i class="bi bi-receipt me-2"></i>Factura #${id?.slice(-6) || 'N/A'}`,
    content: modalContent,
    type: 'info',
    size: 'large',
    showCancel: false,
    confirmText: 'Cerrar'
  });
}

// Función para eliminar factura
async function eliminarFactura(id) {
  const factura = facturasCache.find(f => f.id === id);
  if (!factura) {
    showError("Factura no encontrada.");
    return;
  }

  const confirmed = await confirmModal({
    title: '⚠️ Eliminar Factura',
    content: `
      <div class="eliminar-factura-confirmacion">
        <div class="confirmacion-header">
          <i class="bi bi-exclamation-triangle"></i>
          <h4>¿Eliminar esta factura?</h4>
        </div>
        <div class="confirmacion-detalles">
          <div class="detalle-item">
            <span class="detalle-label">Cliente:</span>
            <span class="detalle-valor">${capitalize(factura.cliente)}</span>
          </div>
          <div class="detalle-item">
            <span class="detalle-label">Total:</span>
            <span class="detalle-valor">${formatCurrency(factura.total)}</span>
          </div>
          <div class="detalle-item">
            <span class="detalle-label">Fecha:</span>
            <span class="detalle-valor">${formatDateTime(factura.fecha)}</span>
          </div>
          <div class="detalle-item">
            <span class="detalle-label">ID Factura:</span>
            <span class="detalle-valor">#${factura.id?.slice(-6) || 'N/A'}</span>
          </div>
        </div>
        <div class="confirmacion-advertencia">
          <i class="bi bi-info-circle"></i>
          <p>Esta acción eliminará permanentemente la factura y no se puede deshacer. El PDF generado seguirá disponible si ya fue descargado.</p>
        </div>
      </div>
    `,
    type: 'danger',
    confirmText: 'Eliminar Factura',
    cancelText: 'Cancelar',
    confirmButtonClass: 'btn-danger',
    cancelButtonClass: 'btn-secondary'
  });

  if (!confirmed) return;

  // Mostrar loading
  showToast('🔄 Eliminando factura...', 'info', { duration: 0 });

  // Reproducir sonido de eliminación de inmediato
  reproducirSonidoEliminacion();

  try {
    await remove(ref(db, `facturas/${id}`));
    showSuccess("✅ Factura eliminada correctamente.");
  } catch (error) {
    console.error("Error al eliminar factura:", error);
    showError(`❌ Error al eliminar la factura: ${error.message || 'Error desconocido'}`);
  }
}

// Funciones para visualizar e imprimir ventas
async function visualizarVenta(id) {
  const venta = ventasCache.find(v => v.id === id);
  if (!venta) {
    showError("Venta no encontrada.");
    return;
  }
  
  // ✅ USAR formatDateTime del formatters.js
  const fechaFormateada = formatDateTime(venta.fecha);
  
  const productosHtml = (venta.productos || []).map(p => `
    <div class="venta-detalle-producto">
      <div class="producto-info">
        <div class="producto-nombre">${capitalize(p.nombreProducto)}</div>
        <div class="producto-detalles">
          <span class="producto-cantidad">${formatNumber(p.cantidad)} unidades</span>
          <span class="producto-precio">${formatCurrency(p.precioUnitario)} c/u</span>
        </div>
      </div>
      <div class="producto-total">${formatCurrency(p.total)}</div>
    </div>
  `).join("");
  
  const metodosPagoHtml = (venta.metodosPago || []).map(mp => `
    <div class="venta-detalle-pago">
      <div class="pago-metodo">
        <i class="bi ${mp.metodo === 'Efectivo' ? 'bi-cash' : mp.metodo === 'Nequi' ? 'bi-phone' : 'bi-bank'}"></i>
        <span>${mp.metodo}</span>
      </div>
      <div class="pago-monto">${formatCurrency(mp.monto)}</div>
    </div>
  `).join("");
  
  let promocionesHtml = "";
  if (venta.promocionesAplicadas && venta.promocionesAplicadas.length > 0) {
    const promosTexto = venta.promocionesAplicadas.map(p => p.nombrePromocion).join(', ');
    promocionesHtml = `
      <div class="venta-detalle-promociones">
        <div class="promociones-header">
          <i class="bi bi-stars"></i>
          <span>Promociones Aplicadas</span>
        </div>
        <div class="promociones-content">
          <div class="promociones-lista">${promosTexto}</div>
          <div class="promociones-descuento">
            <span>Descuento Total:</span>
            <span class="descuento-valor">${formatCurrency(venta.totalDescuento || 0)}</span>
          </div>
        </div>
      </div>
    `;
  }

  const modalContent = `
    <div class="venta-detalle-container">
      <!-- Header con información principal -->
      <div class="venta-detalle-header">
        <div class="venta-detalle-cliente">
          <div class="cliente-avatar">
            <i class="bi bi-person-circle"></i>
    </div>
          <div class="cliente-info">
            <h4>${capitalize(venta.cliente) || "N/A"}</h4>
            <span class="tipo-cliente-badge">${capitalize(venta.tipoCliente) || "N/A"}</span>
    </div>
    </div>
        <div class="venta-detalle-total">
          <span class="total-label">Total Venta</span>
          <span class="total-amount">${formatCurrency(venta.total)}</span>
        </div>
      </div>

      <!-- Información de fecha -->
      <div class="venta-detalle-fecha">
        <i class="bi bi-calendar3"></i>
        <span>${fechaFormateada}</span>
      </div>

      <!-- Productos -->
      <div class="venta-detalle-section">
        <div class="section-header">
          <i class="bi bi-box-seam"></i>
          <span>Productos</span>
        </div>
        <div class="section-content">
          ${productosHtml}
        </div>
      </div>

      <!-- Métodos de Pago -->
      <div class="venta-detalle-section">
        <div class="section-header">
          <i class="bi bi-credit-card"></i>
          <span>Métodos de Pago</span>
        </div>
        <div class="section-content">
          ${metodosPagoHtml}
        </div>
      </div>

      <!-- Promociones (si aplica) -->
      ${promocionesHtml}

      <!-- Acciones -->
      <div class="venta-detalle-actions">
        <button class="venta-detalle-btn venta-detalle-print" onclick="imprimirVenta('${venta.id}')">
          <i class="bi bi-printer"></i>
          <span>Imprimir</span>
        </button>
        <button class="venta-detalle-btn venta-detalle-close" onclick="closeModal()">
          <i class="bi bi-x-lg"></i>
          <span>Cerrar</span>
      </button>
      </div>
    </div>
  `;

  await showModal({
    title: `<i class="bi bi-receipt me-2"></i>Detalles de la Venta`,
    content: modalContent,
    type: 'info',
    size: 'large',
    showCancel: false,
    confirmText: 'Cerrar'
  });
}

function imprimirVenta(id) {
    const venta = ventasCache.find(v => v.id === id);
    if (!venta) {
      showError("Venta no encontrada para imprimir.");
      return;
    }
    generarReportePDF(`Recibo Venta - ${venta.cliente}`, [venta], new Date(venta.fecha).toLocaleDateString("es-CO"));
}

// Función para eliminar ventas
async function eliminarVenta(id) {
  const venta = ventasCache.find(v => v.id === id);
  if (!venta) {
    showError("Venta no encontrada.");
    return;
  }

  const confirmed = await confirmModal({
    title: '⚠️ Eliminar Venta',
    content: `
      <div class="eliminar-venta-confirmacion">
        <div class="confirmacion-header">
          <i class="bi bi-exclamation-triangle"></i>
          <h4>¿Eliminar esta venta?</h4>
        </div>
        <div class="confirmacion-detalles">
          <div class="detalle-item">
            <span class="detalle-label">Cliente:</span>
            <span class="detalle-valor">${capitalize(venta.cliente)}</span>
          </div>
          <div class="detalle-item">
            <span class="detalle-label">Total:</span>
            <span class="detalle-valor">${formatCurrency(venta.total)}</span>
          </div>
          <div class="detalle-item">
            <span class="detalle-label">Fecha:</span>
            <span class="detalle-valor">${formatDateTime(venta.fecha)}</span>
          </div>
        </div>
        <div class="confirmacion-advertencia">
          <i class="bi bi-info-circle"></i>
          <p>Esta acción eliminará permanentemente la venta y restaurará el stock de los productos.</p>
        </div>
      </div>
    `,
    type: 'danger',
    confirmText: 'Eliminar Venta',
    cancelText: 'Cancelar',
    confirmButtonClass: 'btn-danger',
    cancelButtonClass: 'btn-secondary'
  });

  if (!confirmed) return;

  // Mostrar loading
  showToast('🔄 Eliminando venta...', 'info', { duration: 0 });

  // Reproducir sonido de eliminación de inmediato
  reproducirSonidoEliminacion();

  try {
    const ventaRef = ref(db, `ventas/${id}`);
    const snapshot = await get(ventaRef);
    if (!snapshot.exists()) {
      showError("La venta ya no existe.");
      return;
    }
    const venta = snapshot.val();

    // Restaurar stock
    if (venta.productos && Array.isArray(venta.productos)) {
      await procesarActualizacionStock(venta.productos, true); 
      
    }

    // Eliminar venta y factura
    await remove(ventaRef);
    if (venta.facturaId) await remove(ref(db, `facturas/${venta.facturaId}`));

    // Eliminar la ganancia asociada a la venta (si existe)
    if (venta.productos && Array.isArray(venta.productos)) {
      try {
        for (const p of venta.productos) {
          const productoId = p.productoId;
          const cantidadVendida = p.cantidad;
          // Obtener el producto actual para el precio de compra
          const productoRef = ref(db, `productos/${productoId}`);
          const productoSnap = await get(productoRef);
          if (!productoSnap.exists()) continue;
          const producto = productoSnap.val();
          const precioCompra = producto.precioCompra || 0;
          let ganancia = 0;
          let campo = "";
          if (venta.tipoCliente === "distribuidor") {
            ganancia = ((producto.precioDistribuidor || 0) - precioCompra) * cantidadVendida;
            campo = "gananciaDistribuidor";
          } else {
            ganancia = ((producto.precioCliente || producto.precio || 0) - precioCompra) * cantidadVendida;
            campo = "gananciaCliente";
          }
          const gananciaRef = ref(db, `ganancias/${productoId}`);
          await runTransaction(gananciaRef, (data) => {
            if (data === null) {
              return null;
            }
            const nuevaGanancia = (data[campo] || 0) - ganancia;
            const otraGananciaCampo = campo === "gananciaCliente" ? "gananciaDistribuidor" : "gananciaCliente";
            const otraGanancia = data[otraGananciaCampo] || 0;
            // Si ambas ganancias quedan en 0 o menos, elimina el registro
            if (nuevaGanancia <= 0 && otraGanancia <= 0) {
              return null;
            }
            return {
              ...data,
              [campo]: Math.max(0, nuevaGanancia)
            };
          });
        }
      } catch (err) {
        console.warn('No se pudo restar la ganancia asociada a la venta:', err);
      }
    }
    
    showSuccess("✅ Venta eliminada correctamente y stock restaurado.");
    aplicarFiltros();
    if (window.recargarGananciasFinanzas) window.recargarGananciasFinanzas();
  } catch (err) {
    console.error("Error al eliminar la venta:", err);
    showError(`❌ Error al eliminar la venta: ${err.message || 'Error desconocido'}`);
  }
}

// Exponer funciones globalmente
window.visualizarVenta = visualizarVenta;
window.eliminarVenta = eliminarVenta;
window.imprimirVenta = imprimirVenta;
window.previewFactura = previewFactura;
window.descargarFactura = descargarFactura;
window.eliminarFactura = eliminarFactura;
window.mostrarHistorialVentas = mostrarHistorialVentas;
window.ocultarHistorialVentas = ocultarHistorialVentas;

// Paginación
let currentPage = 1;
const itemsPerPage = 5;

// Control de eventos
let eventosConfigurados = false;

// --- Funciones de Utilidad (Formateo) ---
// --- FUNCIONES DE FECHA MEJORADAS (después de las importaciones) ---

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD (zona horaria local)
 */
function getFechaHoy() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convierte una fecha a ISO manteniendo la zona horaria local
 */
function fechaLocalToISO(fechaInput) {
  if (!fechaInput) return new Date().toISOString();
  
  // Si ya es una cadena de fecha completa, usarla directamente
  if (fechaInput.includes('T')) {
    return fechaInput;
  }
  
  // Si es solo fecha (YYYY-MM-DD), crear fecha local a mediodía
  const [year, month, day] = fechaInput.split('-');
  const fechaLocal = new Date(year, month - 1, day, 12, 0, 0);
  
  return fechaLocal.toISOString();
}

/**
 * Formatea fecha para mostrar usando formatters.js
 */
function formatearFechaLegible(fechaISO) {
  if (!fechaISO) return 'Fecha inválida';
  return formatDateCompact(fechaISO); // Usa la función del formatters.js
}

/**
 * Obtiene la fecha actual para inputs de tipo date
 */
function getFechaActualParaInput() {
  return getFechaHoy(); // Usa nuestra función local
}

/**
 * Convierte fecha de input a timestamp local
 */
function inputDateToLocalTimestamp(fechaInput) {
  if (!fechaInput) return Date.now();
  
  const [year, month, day] = fechaInput.split('-');
  const fechaLocal = new Date(year, month - 1, day, 12, 0, 0);
  
  return fechaLocal.getTime();
}
// --- FUNCIONES PARA MANEJO DE STOCK ---
async function actualizarStockProducto(productoId, cantidad) {
  const productoRef = ref(db, `productos/${productoId}`);
  
  try {
    const result = await runTransaction(productoRef, (currentData) => {
      if (currentData === null) {
        console.error(`Producto ${productoId} no encontrado`);
        return null;
      }
      
      const stockActual = currentData.stockCanastas || 0;
      const nuevoStock = stockActual - cantidad;

      if (nuevoStock < 0) {
        throw new Error(`No se puede tener stock negativo. Producto: ${currentData.nombre}, Stock actual: ${stockActual}, Intento de restar: ${cantidad}`);
      }
      
      const precioCompra = currentData.precioCompra || 0;
      const nuevoValorTotal = precioCompra * nuevoStock;

      return {
        ...currentData,
        stockCanastas: nuevoStock,
        valorTotal: nuevoValorTotal
      };
    });
    
    if (result.committed) {
      
      return true;
    } else {
      console.error(`No se pudo actualizar el stock del producto ${productoId}`);
      return false;
    }
  } catch (error) {
    console.error(`Error al actualizar stock del producto ${productoId}:`, error);
    throw error;
  }
}

async function verificarStockDisponible(productosSeleccionados) {
  for (const producto of productosSeleccionados) {
    const productoRef = ref(db, `productos/${producto.productoId}`);
    const snapshot = await get(productoRef);
    
    if (!snapshot.exists()) {
      throw new Error(`Producto ${producto.nombreProducto} no encontrado en la base de datos`);
    }
    
    const datosProducto = snapshot.val();
    const stockDisponible = datosProducto.stockCanastas || 0;
    
    if (producto.cantidad > stockDisponible) {
      throw new Error(`Stock insuficiente para "${producto.nombreProducto}". Stock disponible: ${stockDisponible}, Cantidad solicitada: ${producto.cantidad}`);
    }
  }
  return true;
}

async function procesarActualizacionStock(productosSeleccionados, esEliminacion = false) {
  const errores = [];
  
  for (const producto of productosSeleccionados) {
    try {
      const cantidadParaActualizar = esEliminacion ? -producto.cantidad : producto.cantidad; 
      await actualizarStockProducto(producto.productoId, cantidadParaActualizar);
    } catch (error) {
      errores.push(`${producto.nombreProducto}: ${error.message}`);
    }
  }
  
  if (errores.length > 0) {
    throw new Error(`Errores al actualizar stock:\n${errores.join('\n')}`);
  }
}

// --- Carga de Datos (Firebase) ---
function cargarProductos() {
  onValue(ref(db, "productos"), (snap) => {
    products = [];
    snap.forEach((child) => {
      products.push({ id: child.key, ...child.val() });
    });
  }, (err) => console.error("Error al cargar productos:", err));
}

function cargarClientesCache() {
  onValue(ref(db, "clientes"), (snap) => {
    clientesCache = {};
    snap.forEach((child) => {
      clientesCache[child.key] = child.val();
    });
  }, (err) => console.error("Error al cargar clientes:", err));
}

function cargarFacturas() {
  onValue(ref(db, "facturas"), (snap) => {
    facturasCache = [];
    snap.forEach((child) => {
      facturasCache.push({ id: child.key, ...child.val() });
    });
    // Ordenar por fecha descendente
    facturasCache.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    window.facturasCache = facturasCache;
    renderFacturasYActualizarModal();
    actualizarContadorFacturas();
  }, (err) => console.error("Error al cargar facturas:", err));
}

function cargarPromociones() {
  const promoRef = ref(db, "promociones");
  onValue(promoRef, (snap) => {
    promocionesCache = {};
    if (promocionesContainer) promocionesContainer.innerHTML = "";

    if (!snap.exists()) {
      if (promocionesContainer) {
        promocionesContainer.innerHTML = `
          <div class="empty-state">
            <i class="bi bi-tag text-muted"></i>
            <p class="text-muted">No hay promociones activas</p>
          </div>
        `;
      }
      return;
    }

    // Obtener productos en el carrito para filtrar promociones
    const tipoCliente = document.querySelector('input[name="tipoCliente"]:checked')?.value;
    const productoItems = document.querySelectorAll(".producto-item");
    const productosEnCarro = [];
    productoItems.forEach(item => {
      const productoId = item.querySelector(".producto-id").value;
      let cantidadStr = item.querySelector(".cantidad-input").value.trim();
      let cantidad = 0;
      if (cantidadStr.toLowerCase() === 'mitad') {
        cantidad = 0.5;
      } else {
        cantidad = parseFloat(cantidadStr);
      }
      if (productoId && cantidad > 0) {
        const producto = products.find(p => p.id === productoId);
        if (producto) {
          productosEnCarro.push({ producto, cantidad });
        }
      }
    });

    let hayPromos = false;
    snap.forEach((child) => {
      const p = child.val();
      const id = child.key;
      promocionesCache[id] = { id, ...p };

      // Verificar si la promo aplica
      const principal = productosEnCarro.find(pc => pc.producto.nombre === p.productoPrincipal && pc.cantidad >= p.cantidadNecesaria);
      const descuento = productosEnCarro.find(pc => pc.producto.nombre === p.productoDescuento && pc.cantidad > 0);
      if (!principal || !descuento) return; // Solo mostrar si aplica
      hayPromos = true;

      // Diseño más bonito para la promo
      const div = document.createElement("div");
      div.className = "promo-card";
      div.innerHTML = `
        <input class="form-check-input promo-checkbox" type="checkbox" value="${id}" id="promo-${id}">
        <label class="form-check-label promo-label" for="promo-${id}">
          <div class="promo-header">
            <i class="bi bi-stars promo-icon"></i>
            <span class="promo-title">Promoción disponible</span>
          </div>
          <div class="promo-body">
            <span class="promo-main">${p.cantidadNecesaria} x <b>${p.productoPrincipal}</b></span>
            <span class="promo-arrow"><i class="bi bi-arrow-right"></i></span>
            <span class="promo-discount">${p.productoDescuento} a <span class="promo-price">${formatCurrency(p.precioPromocional)}</span></span>
          </div>
        </label>
      `;
      if (promocionesContainer) promocionesContainer.appendChild(div);
    });
    if (!hayPromos && promocionesContainer) {
      promocionesContainer.innerHTML = `<div class="empty-state"><i class="bi bi-emoji-frown text-muted"></i><p class="text-muted">No hay promociones aplicables a los productos seleccionados</p></div>`;
    }
  });
}

// --- Lógica Principal del Formulario de Venta ---
clienteInput.addEventListener("input", () => {
  const texto = clienteInput.value.trim().toLowerCase();
  clienteSugerencias.innerHTML = "";
  if (!texto) return;

  Object.values(clientesCache)
    .filter((c) => c.nombre.toLowerCase().includes(texto))
    .slice(0, 5)
    .forEach((c) => {
      const div = document.createElement("div");
      div.className = "cliente-sugerencia-item";
      div.innerHTML = `
        <i class="bi bi-person-circle"></i>
        <div class="sugerencia-info">
          <span class="sugerencia-nombre">${c.nombre}</span>
          <span class="sugerencia-nit">NIT: ${c.nit || "N/A"}</span>
        </div>
      `;
      div.addEventListener("click", (e) => {
        e.preventDefault();
        clienteInput.value = c.nombre;
        clienteSugerencias.innerHTML = "";
      });
      clienteSugerencias.appendChild(div);
    });
});

function calcularTotal() {
  const tipoCliente = document.querySelector('input[name="tipoCliente"]:checked')?.value;
  if (!tipoCliente) {
    totalVentaElement.textContent = "$0";
    return;
  }

  let totalOriginal = 0;
  let totalDescuento = 0;
  const productoItems = document.querySelectorAll(".producto-item");
  const productosEnCarro = [];

  productoItems.forEach(item => {
    const productoId = item.querySelector(".producto-id").value;
    let cantidadStr = item.querySelector(".cantidad-input").value.trim();
    let cantidad = 0;

    if (cantidadStr.toLowerCase() === 'mitad') {
      cantidad = 0.5;
    } else {
      cantidad = parseFloat(cantidadStr);
    }
    
    if (productoId && cantidad > 0) {
      const producto = products.find(p => p.id === productoId);
      if (producto) {
        let precioUnitario = tipoCliente === "distribuidor" 
          ? (producto.precioDistribuidor || 0)
          : (producto.precioCliente || producto.precio || 0);

        if (precioUnitario > 0) {
          totalOriginal += precioUnitario * cantidad;
          productosEnCarro.push({ producto, cantidad, precioUnitario });
        }
      }
    }
  });

  const promocionesSeleccionadas = document.querySelectorAll(".promo-checkbox:checked");
  promocionesSeleccionadas.forEach(checkbox => {
    const promoId = checkbox.value;
    const promo = promocionesCache[promoId];
    if (!promo) return;

    const productoPrincipalEnCarro = productosEnCarro.find(p => p.producto.nombre === promo.productoPrincipal);
    const productoDescuentoEnCarro = productosEnCarro.find(p => p.producto.nombre === promo.productoDescuento);

    if (productoPrincipalEnCarro && productoPrincipalEnCarro.cantidad >= promo.cantidadNecesaria && productoDescuentoEnCarro) {
        const precioOriginal = productoDescuentoEnCarro.precioUnitario;
        const precioPromocional = promo.precioPromocional;
        const maxUnidadesConDescuento = Math.floor(productoPrincipalEnCarro.cantidad / promo.cantidadNecesaria);
        const unidadesParaAplicarDescuento = Math.min(productoDescuentoEnCarro.cantidad, maxUnidadesConDescuento);

        if (precioOriginal > precioPromocional) {
            totalDescuento += (precioOriginal - precioPromocional) * unidadesParaAplicarDescuento;
        }
    }
  });

  const totalFinal = totalOriginal - totalDescuento;

  if (totalDescuento > 0) {
    totalVentaElement.innerHTML = `
      <del class="text-danger me-2">${formatCurrency(totalOriginal)}</del>
      <span class="fw-bold text-success">${formatCurrency(totalFinal)}</span>
    `;
  } else {
    totalVentaElement.textContent = formatCurrency(totalOriginal);
  }
}

// Evento submit del formulario de venta con manejo robusto de stock
formVenta.addEventListener("submit", async (e) => {
    e.preventDefault();

    const cliente = clienteInput.value.trim() || null;
    const tipoCliente = document.querySelector('input[name="tipoCliente"]:checked')?.value;
    const fechaVenta = fechaVentaInput.value;

    if (!cliente || !tipoCliente || !fechaVenta) {
        showWarning("Debe ingresar cliente, tipo de cliente y fecha de venta.");
        return;
    }

    const productoItems = document.querySelectorAll(".producto-item");
    const productosSeleccionados = [];
    let totalOriginal = 0;
    let totalDescuento = 0;

    // Mostrar loading
    document.getElementById('loadingOverlay')?.classList.add('show');

    try {
      // Validar y preparar productos seleccionados
      for (const item of productoItems) {
          const productoId = item.querySelector(".producto-id").value;
          let cantidadStr = item.querySelector(".cantidad-input").value.trim();
          let cantidad;

          if (cantidadStr.toLowerCase() === 'mitad') {
            cantidad = 0.5;
          } else {
            cantidad = parseFloat(cantidadStr);
          }

          if (!productoId || isNaN(cantidad) || cantidad <= 0) continue; 

          const producto = products.find((p) => p.id === productoId);
          if (!producto) {
            showWarning("Producto no encontrado.");
            return;
          }

          const precioUnitario = tipoCliente === "distribuidor" ? (producto.precioDistribuidor || 0) : (producto.precioCliente || producto.precio || 0);
          if (precioUnitario <= 0) {
            showWarning(`El producto "${producto.nombre}" no tiene un precio válido para ${tipoCliente}.`);
            return;
          }
          
          const calculatedPrice = precioUnitario * cantidad;

          totalOriginal += calculatedPrice;
          productosSeleccionados.push({
              productoId,
              nombreProducto: producto.nombre,
              cantidad,
              precioUnitario,
              total: calculatedPrice,
          });
      }

      if (productosSeleccionados.length === 0) {
        showWarning("Debe seleccionar al menos un producto.");
        return;
      }

      // Verificar stock antes de procesar la venta
      await verificarStockDisponible(productosSeleccionados);

      // Calcular promociones aplicadas
      const promocionesAplicadas = [];
      document.querySelectorAll(".promo-checkbox:checked").forEach(chk => {
          const promoId = chk.value;
          const promo = promocionesCache[promoId];
          if (!promo) return;

          const productoPrincipal = productosSeleccionados.find(p => p.nombreProducto === promo.productoPrincipal);
          const productoDescuento = productosSeleccionados.find(p => p.nombreProducto === promo.productoDescuento);

          if (productoPrincipal && productoPrincipal.cantidad >= promo.cantidadNecesaria && productoDescuento) {
              const maxUnidadesConDescuento = Math.floor(productoPrincipal.cantidad / promo.cantidadNecesaria);
              const unidadesParaAplicarDescuento = Math.min(productoDescuento.cantidad, maxUnidadesConDescuento);
              const descuentoUnitario = productoDescuento.precioUnitario - promo.precioPromocional;
              if (descuentoUnitario > 0) {
                  totalDescuento += descuentoUnitario * unidadesParaAplicarDescuento;
                  if (!promocionesAplicadas.find(p => p.promocionId === promoId)) {
                      promocionesAplicadas.push({
                          promocionId: promoId,
                          nombrePromocion: `Promo ${promo.productoPrincipal}`
                      });
                  }
              }
          }
      });

      const totalVentaFinal = totalOriginal - totalDescuento;

      // Validar métodos de pago
      const metodoItems = document.querySelectorAll(".payment-method-item");
      const metodosPago = [];
      let totalPagado = 0;

      for (const item of metodoItems) {
          const metodo = item.querySelector(".payment-method-select").value;
          const monto = parseFloat(item.querySelector(".payment-amount-input").value);
          if (!metodo || isNaN(monto) || monto <= 0) {
            showWarning("Complete correctamente los métodos de pago.");
            return;
          }
          totalPagado += monto;
          metodosPago.push({ metodo, monto });
      }

      if (Math.abs(totalPagado - totalVentaFinal) > 0.01) {
          showWarning(`La suma de los pagos (${formatCurrency(totalPagado)}) no coincide con el total final (${formatCurrency(totalVentaFinal)}).`);
          return;
      }

      // Reproducir sonido de venta de inmediato después de validar todo
      reproducirSonidoVenta();

      // Guardar la fecha y hora real del sistema para la venta
      const fechaActual = new Date();
      const fechaISO = fechaActual.toISOString();
      const fechaLegible = formatearFechaLegible(fechaISO);
      const timestamp = fechaActual.getTime();

      const factura = {
        productos: productosSeleccionados,
        total: totalVentaFinal,
        cliente,
        tipoCliente,
        metodosPago,
        fecha: fechaISO,
        fechaLegible,
        timestamp, // Para ordenamiento preciso
        promocionesAplicadas, 
        totalDescuento 
      };

      // 1. Crear la factura
      const nuevaFacturaRef = await push(ref(db, "facturas"), factura);


      // 2. Actualizar stock
      await procesarActualizacionStock(productosSeleccionados, false);
      

      // 2.1. Acumular ganancia por producto en la tabla 'ganancias'
      for (const p of productosSeleccionados) {
        const producto = products.find(prod => prod.id === p.productoId);
        if (!producto) continue;
        const productoId = producto.id;
        const nombreProducto = producto.nombre;
        const cantidadVendida = p.cantidad;
        const precioCompra = producto.precioCompra || 0;
        let ganancia = 0;
        let campo = "";
        if (tipoCliente === "distribuidor") {
          ganancia = ((producto.precioDistribuidor || 0) - precioCompra) * cantidadVendida;
          campo = "gananciaDistribuidor";
        } else {
          ganancia = ((producto.precioCliente || producto.precio || 0) - precioCompra) * cantidadVendida;
          campo = "gananciaCliente";
        }
        const gananciaRef = ref(db, `ganancias/${productoId}`);
        await runTransaction(gananciaRef, (data) => {
          if (data === null) {
            return {
              nombre: nombreProducto,
              gananciaCliente: campo === "gananciaCliente" ? ganancia : 0,
              gananciaDistribuidor: campo === "gananciaDistribuidor" ? ganancia : 0
            };
          } else {
            return {
              ...data,
              nombre: nombreProducto,
              gananciaCliente: (data.gananciaCliente || 0) + (campo === "gananciaCliente" ? ganancia : 0),
              gananciaDistribuidor: (data.gananciaDistribuidor || 0) + (campo === "gananciaDistribuidor" ? ganancia : 0)
            };
          }
        });
      }

      // 3. Crear la venta consolidada
      const ventaConsolidada = { ...factura, facturaId: nuevaFacturaRef.key };
      await push(ref(db, "ventas"), ventaConsolidada);


      // 4. Limpiar formulario y resetear wizard
      formVenta.reset();
      productosContainer.innerHTML = "";
      paymentMethodsContainer.innerHTML = "";
      totalVentaElement.textContent = "$0";
      fechaVentaInput.value = getFechaHoy(); 
      document.querySelectorAll(".promo-checkbox").forEach(chk => chk.checked = false);
      
      // Resetear wizard al primer paso
      resetWizard();
      
      showSuccess("Venta registrada con éxito y stock actualizado.");
      currentPage = 1;
      aplicarFiltros();

    } catch (err) {
        console.error("Error al registrar venta:", err);
        showError(`Error al registrar la venta: ${err.message || 'Error desconocido'}`);
    } finally {
        document.getElementById('loadingOverlay')?.classList.remove('show');
    }
});

// --- Gestión de Facturas ---

// --- Listar y Filtrar Ventas ---
function listarVentas() {
  onValue(ref(db, "ventas"), (snap) => {
    ventasCache = [];
    snap.forEach((child) => {
      ventasCache.push({ id: child.key, ...child.val() });
    });
    ventasCache.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    window.ventasCache = ventasCache;
    
    aplicarFiltros();
    actualizarResumenVentas(); 
  }, (err) => console.error("Error al cargar ventas:", err));
}

function aplicarFiltros() {
    let ventasFiltradas = [...ventasCache]; 
    const filtroProdVal = typeof filtroProducto !== 'undefined' && filtroProducto ? filtroProducto.value.trim().toLowerCase() : '';
    const filtroCliVal = typeof filtroCliente !== 'undefined' && filtroCliente ? filtroCliente.value.trim().toLowerCase() : '';
    const filtroFecVal = typeof filtroFecha !== 'undefined' && filtroFecha ? filtroFecha.value : '';
    const filtroFPagoVal = typeof filtroFormaPago !== 'undefined' && filtroFormaPago ? filtroFormaPago.value : '';

    const hayFiltrosActivos = filtroProdVal || filtroCliVal || filtroFecVal || filtroFPagoVal;

    if (filtroProdVal) {
        ventasFiltradas = ventasFiltradas.filter(v =>
            (v.productos || []).some(p => (p.nombreProducto || "").toLowerCase().includes(filtroProdVal))
        );
    }

    if (filtroCliVal) {
        ventasFiltradas = ventasFiltradas.filter(v => (v.cliente || "").toLowerCase().includes(filtroCliVal));
    }
    
    if (filtroFecVal) {
        ventasFiltradas = ventasFiltradas.filter(v => new Date(v.fecha).toISOString().slice(0, 10) === filtroFecVal);
    }

    if (filtroFPagoVal) {
        ventasFiltradas = ventasFiltradas.filter(v => 
            (v.metodosPago || []).some(mp => mp.metodo === filtroFPagoVal)
        );
    }

    // Si no hay filtros activos, mostrar del día por defecto
    if (!hayFiltrosActivos) {
        const fechaHoy = getFechaHoy();
        ventasFiltradas = ventasCache.filter(v => new Date(v.fecha).toISOString().slice(0, 10) === fechaHoy);
    }
    
    currentPage = 1;
    mostrarVentasEnTabla(ventasFiltradas);
    actualizarPaginacion(ventasFiltradas);
    actualizarContadorVentas(ventasFiltradas.length);
}

function mostrarVentasEnTabla(ventas) {
  if (tbodyVentas) tbodyVentas.innerHTML = "";
  if (ventasMobileContainer) ventasMobileContainer.innerHTML = "";

  if (ventas.length === 0) {
    const noDataHtml = `<td colspan="7" class="text-center" style="padding: 20px;">No hay ventas para mostrar.</td>`;
    if (tbodyVentas) tbodyVentas.innerHTML = `<tr>${noDataHtml}</tr>`;
    if (ventasMobileContainer) {
      ventasMobileContainer.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-graph-up text-muted"></i>
          <p class="text-muted">No hay ventas para mostrar</p>
        </div>
      `;
    }
    return;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const ventasPagina = ventas.slice(startIndex, startIndex + itemsPerPage);

  ventasPagina.forEach((v) => {
     const fechaFormateada = v.fecha 
        ? formatDateTime(v.fecha) // Usa la función del formatters.js
        : 'Fecha Desconocida';
    
    const productosTexto = (v.productos || []).map(p => `${p.nombreProducto} (${p.cantidad})`).join(", ") || "N/A";
    const metodosPagoTexto = (v.metodosPago || []).map(mp => `${mp.metodo}: ${formatCurrency(mp.monto)}`).join(", ") || "N/A";
    const promocionTexto = (v.promocionesAplicadas && v.promocionesAplicadas.length > 0)
      ? v.promocionesAplicadas.map(p => p.nombrePromocion || 'Promo aplicada').join(', ')
      : "-";

    if (tbodyVentas) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${capitalize(v.cliente) || "-"}</td>
        <td>${productosTexto}</td>
        <td>${formatCurrency(v.total)}</td>
        <td>${metodosPagoTexto}</td>
        <td>${fechaFormateada}</td>
        <td><span class="table-badge info">${promocionTexto}</span></td>
        <td class="text-center">
          <div class="table-actions">
            <button class="table-action-btn primary" onclick="visualizarVenta('${v.id}')" title="Ver detalles">
              <i class="bi bi-eye"></i>
            </button>
            <button class="table-action-btn danger" onclick="eliminarVenta('${v.id}')" title="Eliminar venta">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbodyVentas.appendChild(tr);
    }

    if (ventasMobileContainer) {
      const mobileCard = document.createElement('div');
      mobileCard.className = 'venta-mobile-card';
      mobileCard.innerHTML = `
        <!-- Header con cliente y total -->
        <div class="venta-card-header">
          <div class="venta-cliente-info">
            <div class="venta-cliente-avatar">
              <i class="bi bi-person-circle"></i>
          </div>
            <div class="venta-cliente-details">
              <h4 class="venta-cliente-nombre">${capitalize(v.cliente) || "Cliente"}</h4>
              <span class="venta-tipo-cliente">${capitalize(v.tipoCliente) || "Tipo no especificado"}</span>
        </div>
          </div>
          <div class="venta-total-display">
            <span class="venta-total-amount">${formatCurrency(v.total)}</span>
          </div>
          </div>

        <!-- Información principal -->
        <div class="venta-card-content">
          <!-- Productos -->
          <div class="venta-info-section">
            <div class="venta-section-header">
              <i class="bi bi-box-seam"></i>
              <span>Productos</span>
          </div>
            <div class="venta-section-content">
              <p class="venta-productos-text">${productosTexto}</p>
          </div>
          </div>

          <!-- Métodos de pago -->
          <div class="venta-info-section">
            <div class="venta-section-header">
              <i class="bi bi-credit-card"></i>
              <span>Pago</span>
            </div>
            <div class="venta-section-content">
              <p class="venta-pago-text">${metodosPagoTexto}</p>
            </div>
          </div>

          <!-- Fecha y promociones -->
          <div class="venta-info-section">
            <div class="venta-section-header">
              <i class="bi bi-calendar3"></i>
              <span>Fecha</span>
            </div>
            <div class="venta-section-content">
              <p class="venta-fecha-text">${fechaFormateada}</p>
              ${v.promocionesAplicadas && v.promocionesAplicadas.length > 0 ? `
                <div class="venta-promociones">
                  <span class="venta-promo-badge">
                    <i class="bi bi-stars"></i>
                    ${promocionTexto}
                  </span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Acciones -->
        <div class="venta-card-actions">
          <button class="venta-action-btn venta-action-view" onclick="visualizarVenta('${v.id}')">
            <i class="bi bi-eye"></i>
            <span>Ver Detalles</span>
          </button>
          <button class="venta-action-btn venta-action-delete" onclick="eliminarVenta('${v.id}')">
            <i class="bi bi-trash"></i>
            <span>Eliminar</span>
          </button>
        </div>
      `;
      ventasMobileContainer.appendChild(mobileCard);
    }
  });
}

// --- Paginación ---
function actualizarPaginacion(ventasFiltradas) {
  if (!paginationContainer) return;
  const totalPages = Math.ceil(ventasFiltradas.length / itemsPerPage);
  paginationContainer.innerHTML = "";
  if (totalPages <= 1) return;

  const createPageItem = (text, page, isDisabled = false, isActive = false) => {
    const li = document.createElement("li");
    li.className = `pagination-btn ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
    li.innerHTML = `<a href="#" data-page="${page}">${text}</a>`;
    return li;
  };

  paginationContainer.appendChild(createPageItem('Anterior', currentPage - 1, currentPage === 1));
  for (let i = 1; i <= totalPages; i++) {
    paginationContainer.appendChild(createPageItem(i, i, false, i === currentPage));
  }
  paginationContainer.appendChild(createPageItem('Siguiente', currentPage + 1, currentPage === totalPages));

  paginationContainer.addEventListener("click", (e) => {
    e.preventDefault();
    const pageLink = e.target.closest('a');
    if (pageLink && !pageLink.closest('.disabled')) {
      currentPage = parseInt(pageLink.dataset.page);
      aplicarFiltros();
    }
  });
}

// --- Lógica de Componentes Dinámicos ---
function agregarProductoInput() {
  const div = document.createElement("div");
  div.className = "producto-item";
  div.innerHTML = `
    <div class="form-group flex-1">
      <input type="text" class="form-control producto-input" placeholder="Buscar producto..." autocomplete="off" required>
      <div class="producto-sugerencias list-group position-absolute w-100" style="z-index:1050; max-height:150px; overflow-y:auto;"></div>
      <input type="hidden" class="producto-id">
    </div>
    <div class="form-group">
      <input type="text" class="form-control cantidad-input" placeholder="Cantidad (ej. 1, 0.5, mitad)" required />
    </div>
    <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.producto-item').remove(); calcularTotal();">
      <i class="bi bi-x"></i>
    </button>
  `;
  productosContainer.appendChild(div);
  setTimeout(validateStockRealtime, 0); // Validación en tiempo real
}

function agregarMetodoPagoInput() {
  const div = document.createElement("div");
  div.className = "payment-method-item";
  div.innerHTML = `
    <div class="form-group">
      <div class="metodo-pago-chips"></div>
    </div>
    <div class="form-group">
      <input type="number" class="form-control payment-amount-input" placeholder="Monto" min="0.01" step="0.01" required>
    </div>
    <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.payment-method-item').remove();">
      <i class="bi bi-x"></i>
    </button>
  `;
  paymentMethodsContainer.appendChild(div);
  crearChipsMetodoPago(div.querySelector('.metodo-pago-chips'));
  setTimeout(actualizarFaltantePago, 0); // Feedback en tiempo real
}

const metodosPagoChips = [
  { value: 'Efectivo', icon: 'bi-cash' },
  { value: 'Nequi', icon: 'bi-phone' },
  { value: 'Daviplata', icon: 'bi-bank' }
];

function crearChipsMetodoPago(container, valorActual) {
  container.innerHTML = '';
  metodosPagoChips.forEach(metodo => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip' + ((valorActual || metodosPagoChips[0].value) === metodo.value ? ' selected' : '');
    btn.innerHTML = `<i class="bi ${metodo.icon}"></i> ${metodo.value}`;
    btn.onclick = () => {
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      btn.classList.add('selected');
      // Actualiza el input oculto
      container.querySelector('input.metodo-pago-hidden').value = metodo.value;
    };
    container.appendChild(btn);
  });
  // Input oculto para el valor real
  const input = document.createElement('input');
  input.type = 'hidden';
  input.className = 'metodo-pago-hidden payment-method-select';
  input.value = valorActual || metodosPagoChips[0].value;
  container.appendChild(input);
}

// --- Event Listeners Globales ---
document.addEventListener("input", function(e) {
  if (e.target.classList.contains("producto-input")) {
    const input = e.target;
    const container = input.closest(".producto-item");
    const sugerenciasDiv = container.querySelector(".producto-sugerencias");
    const hiddenId = container.querySelector(".producto-id");
    const texto = input.value.trim().toLowerCase();
    
    sugerenciasDiv.innerHTML = "";
    hiddenId.value = "";
    if (!texto) { calcularTotal(); return; }

    const sugerencias = products
      .filter(p => (p.nombre || "").toLowerCase().includes(texto))
      .slice(0, 5);

    if (sugerencias.length === 0) {
        sugerenciasDiv.innerHTML = `<div class="producto-sugerencia-item text-muted">No se encontraron productos</div>`;
        return;
    }

    sugerencias.forEach(p => {
      const div = document.createElement("div");
      div.className = "producto-sugerencia-item";

      const precioCliente = parseFloat(p.precioCliente || p.precio) || 0;
      const precioDistribuidor = parseFloat(p.precioDistribuidor) || 0;
      const stockDisponible = p.stockCanastas || 0;

      let stockTexto = `Stock: ${stockDisponible}`;
      let stockClase = "sugerencia-prod-stock";
      let stockIcon = "";

      if (stockDisponible <= 0) {
        stockTexto = "SIN STOCK";
        stockClase = "sugerencia-prod-stock sugerencia-prod-stock-sin";
        stockIcon = '<i class="bi bi-x-circle"></i>';
      } else if (stockDisponible <= 5) {
        stockTexto = `Stock: ${stockDisponible} <span class='sugerencia-prod-stock-bajo'>(⚠️ Bajo)</span>`;
        stockClase = "sugerencia-prod-stock sugerencia-prod-stock-bajo";
        stockIcon = '<i class="bi bi-exclamation-triangle"></i>';
      } else {
        stockIcon = '<i class="bi bi-box-seam"></i>';
      }

      div.innerHTML = `
        ${stockIcon}
        <div class="sugerencia-prod-info">
          <span class="sugerencia-prod-nombre">${p.nombre}</span>
          <span class="${stockClase}">${stockTexto}</span>
          <span class="sugerencia-prod-precios">
            <strong>Cliente:</strong> ${formatCurrency(precioCliente)} /
            <strong>Dist:</strong> ${formatCurrency(precioDistribuidor)}
          </span>
        </div>
      `;

      if (stockDisponible <= 0) div.classList.add("disabled");

      div.onclick = () => {
        if (stockDisponible > 0 && precioCliente > 0 && precioDistribuidor > 0) {
          input.value = p.nombre;
          hiddenId.value = p.id;
          sugerenciasDiv.innerHTML = "";
          calcularTotal();
        }
      };
      sugerenciasDiv.appendChild(div);
    });
  }

  if (e.target.classList.contains("cantidad-input") || e.target.classList.contains("payment-amount-input")) {
    calcularTotal();
  }
});

document.addEventListener("change", function(e) {
    if (e.target.name === "tipoCliente" || e.target.classList.contains("promo-checkbox") || 
        e.target.id === "fechaVenta" || e.target.classList.contains("payment-method-select")) {
        calcularTotal();
    }
});

// --- Funciones para renderizar facturas ---
function renderFacturas() {
  if (!facturasContainer) return;
  
  facturasContainer.innerHTML = "";
  
  if (facturasCache.length === 0) {
    facturasContainer.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-receipt"></i>
        <p>No hay facturas disponibles</p>
      </div>
    `;
    return;
  }
  
  // Detectar si es móvil para mostrar menos facturas
  const isMobile = window.innerWidth <= 768;
  const maxFacturas = isMobile ? 2 : 10;
  
  // Mostrar solo las primeras facturas según el dispositivo
  const facturasAMostrar = facturasCache.slice(0, maxFacturas);
  
  facturasAMostrar.forEach(factura => {
    const fechaFormateada = factura.fecha 
      ? formatDateTime(factura.fecha) // Usar formatters.js
      : 'Fecha Desconocida';
      
    // Crear tarjeta de factura mejorada
    const facturaCard = document.createElement('div');
    facturaCard.className = 'factura-mobile-card';
    facturaCard.innerHTML = `
      <!-- Header con información principal -->
      <div class="factura-card-header">
        <div class="factura-info-principal">
          <div class="factura-id-badge">
            <i class="bi bi-receipt"></i>
            <span>#${factura.id?.slice(-6) || 'N/A'}</span>
          </div>
          <div class="factura-cliente-info">
            <h4 class="factura-cliente-nombre">${capitalize(factura.cliente) || "Cliente"}</h4>
            <span class="factura-tipo-cliente">${capitalize(factura.tipoCliente) || "Tipo no especificado"}</span>
        </div>
          </div>
        <div class="factura-total-display">
          <span class="factura-total-amount">${formatCurrency(factura.total)}</span>
          </div>
          </div>

      <!-- Información detallada -->
      <div class="factura-card-content">
        <!-- Fecha -->
        <div class="factura-info-section">
          <div class="factura-section-header">
            <i class="bi bi-calendar3"></i>
            <span>Fecha</span>
          </div>
          <div class="factura-section-content">
            <p class="factura-fecha-text">${fechaFormateada}</p>
        </div>
        </div>

        <!-- Productos -->
        <div class="factura-info-section">
          <div class="factura-section-header">
            <i class="bi bi-box-seam"></i>
            <span>Productos</span>
          </div>
          <div class="factura-section-content">
            <p class="factura-productos-text">${(factura.productos || []).map(p => `${p.nombreProducto || p.producto || p.nombre} (${p.cantidad})`).join(", ") || "N/A"}</p>
          </div>
        </div>

        <!-- Métodos de Pago -->
        <div class="factura-info-section">
          <div class="factura-section-header">
            <i class="bi bi-credit-card"></i>
            <span>Pago</span>
          </div>
          <div class="factura-section-content">
            <p class="factura-pago-text">${(factura.metodosPago || []).map(mp => `${mp.metodo}: ${formatCurrency(mp.monto)}`).join(", ") || "N/A"}</p>
          </div>
        </div>

        <!-- Promociones (si aplica) -->
        ${factura.promocionesAplicadas && factura.promocionesAplicadas.length > 0 ? `
          <div class="factura-info-section">
            <div class="factura-section-header">
              <i class="bi bi-stars"></i>
              <span>Promociones</span>
            </div>
            <div class="factura-section-content">
              <div class="factura-promociones">
                <span class="factura-promo-badge">
                  <i class="bi bi-tag"></i>
              ${factura.promocionesAplicadas.map(p => p.nombrePromocion).join(', ')}
            </span>
                ${factura.totalDescuento ? `
                  <div class="factura-descuento">
                    <span>Descuento:</span>
                    <span class="descuento-valor">${formatCurrency(factura.totalDescuento)}</span>
          </div>
        ` : ''}
              </div>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Acciones -->
      <div class="factura-card-actions">
        <button class="factura-action-btn factura-action-view" onclick="previewFactura('${factura.id}')">
          <i class="bi bi-eye"></i>
          <span>Ver Detalles</span>
        </button>
        <button class="factura-action-btn factura-action-download" onclick="descargarFactura('${factura.id}')">
          <i class="bi bi-download"></i>
          <span>Descargar</span>
        </button>
        <button class="factura-action-btn factura-action-delete" onclick="eliminarFactura('${factura.id}')">
          <i class="bi bi-trash"></i>
          <span>Eliminar</span>
        </button>
      </div>
    `;
    
    facturasContainer.appendChild(facturaCard);
  });
  
  // Si hay más facturas, mostrar un botón para ver todas
  if (facturasCache.length > maxFacturas) {
    const verMasCard = document.createElement('div');
    verMasCard.className = 'factura-ver-mas-card';
    verMasCard.innerHTML = `
      <div class="ver-mas-content">
        <i class="bi bi-list-ul"></i>
        <p>Y ${facturasCache.length - maxFacturas} facturas más...</p>
        <button class="btn btn-primary" onclick="mostrarTodasLasFacturas()">
          <i class="bi bi-eye"></i>
          Ver todas las facturas
        </button>
      </div>
    `;
    facturasContainer.appendChild(verMasCard);
  }
}

function actualizarContadorFacturas() {
  const contadorElement = document.getElementById('contadorFacturas');
  if (contadorElement) {
    const total = facturasCache.length;
    contadorElement.textContent = `${total} factura${total !== 1 ? 's' : ''}`;
  }
  
  // Actualizar elemento de total de facturas en estadísticas
  if (elemTotalFacturas) {
    elemTotalFacturas.textContent = facturasCache.length.toString();
  }
  
  // Actualizar estadísticas detalladas de facturas
  actualizarEstadisticasFacturas();
}

function actualizarEstadisticasFacturas() {
  const hoy = new Date();
  const fechaISOhoy = hoy.toISOString().slice(0, 10);
  hoy.setHours(0,0,0,0);
  const hace7dias = new Date(new Date().setDate(hoy.getDate() - 6));
  hace7dias.setHours(0,0,0,0);
  const hace30dias = new Date(new Date().setDate(hoy.getDate() - 29));
  hace30dias.setHours(0,0,0,0);

  let facturasHoy = 0, facturasSemana = 0, facturasMes = 0, totalValor = 0;

  facturasCache.forEach(factura => {
    const fechaFactura = new Date(factura.fecha);
    fechaFactura.setHours(0,0,0,0);
    const valorFactura = factura.total || 0;
    
    if (fechaFactura.toISOString().slice(0, 10) === fechaISOhoy) {
      facturasHoy++;
    }
    if (fechaFactura >= hace7dias) {
      facturasSemana++;
    }
    if (fechaFactura >= hace30dias) {
      facturasMes++;
    }
    totalValor += valorFactura;
  });

  // Actualizar elementos en el DOM
  const elemFacturasHoy = document.getElementById('facturasHoy');
  const elemFacturasSemana = document.getElementById('facturasSemana');
  const elemFacturasMes = document.getElementById('facturasMes');
  const elemTotalFacturasValor = document.getElementById('totalFacturasValor');

  if (elemFacturasHoy) elemFacturasHoy.textContent = facturasHoy;
  if (elemFacturasSemana) elemFacturasSemana.textContent = facturasSemana;
  if (elemFacturasMes) elemFacturasMes.textContent = facturasMes;
  if (elemTotalFacturasValor) elemTotalFacturasValor.textContent = formatCurrency(totalValor);
}

let modalFacturasAbierto = false;

function mostrarTodasLasFacturas() {
  // Si aún no se han cargado las facturas, mostrar mensaje de carga y esperar
  if (!facturasCache || facturasCache.length === 0) {
    showModal({
      title: `<i class="bi bi-list me-2"></i>Todas las Facturas`,
      content: `<div style='padding:2rem;text-align:center;'><div class='spinner-border text-primary' role='status'></div><p class='mt-3'>Cargando facturas...</p></div>`,
      type: 'info',
      size: 'extra-large',
      showCancel: false,
      confirmText: 'Cerrar'
    });
    modalFacturasAbierto = true;
    return;
  }
  modalFacturasAbierto = false;

  const facturasHtml = facturasCache.map(factura => {
    const fechaFormateada = factura.fecha 
      ? formatDateTime(factura.fecha)
      : 'Fecha Desconocida';
    const cliente = factura.cliente ? capitalize(factura.cliente) : 'Cliente';
    const tipoCliente = factura.tipoCliente ? capitalize(factura.tipoCliente) : 'Tipo no especificado';
    const total = typeof factura.total === 'number' ? formatCurrency(factura.total) : '$0';
    const productos = (factura.productos || []).map(p => `${p.nombreProducto || p.producto || p.nombre || 'Producto'} (${p.cantidad || 1})`).join(", ") || "N/A";
    const metodosPago = (factura.metodosPago || []).map(mp => `${mp.metodo || 'Pago'}: ${formatCurrency(mp.monto || 0)}`).join(", ") || "N/A";
    const promociones = (factura.promocionesAplicadas && factura.promocionesAplicadas.length > 0)
      ? factura.promocionesAplicadas.map(p => p.nombrePromocion || 'Promo').join(', ')
      : '';
    const totalDescuento = factura.totalDescuento ? formatCurrency(factura.totalDescuento) : '';

    return `
      <div class="factura-lista-item">
        <div class="factura-lista-header">
          <div class="factura-lista-info">
            <div class="factura-lista-id">
              <i class="bi bi-receipt"></i>
              <span>#${factura.id?.slice(-6) || 'N/A'}</span>
            </div>
            <div class="factura-lista-cliente">
              <h5>${cliente}</h5>
              <span class="factura-lista-tipo">${tipoCliente}</span>
            </div>
          </div>
          <div class="factura-lista-total">
            <span class="total-amount">${total}</span>
          </div>
        </div>
        <div class="factura-lista-content">
          <div class="factura-lista-fecha">
            <i class="bi bi-calendar3"></i>
            <span>${fechaFormateada}</span>
          </div>
          <div class="factura-lista-productos">
            <i class="bi bi-box-seam"></i>
            <span>${productos}</span>
          </div>
          ${promociones ? `
            <div class="factura-lista-promociones">
              <i class="bi bi-stars"></i>
              <span>${promociones}</span>
            </div>
          ` : ''}
          ${totalDescuento ? `
            <div class="factura-lista-promociones">
              <i class="bi bi-tag"></i>
              <span>Descuento: ${totalDescuento}</span>
            </div>
          ` : ''}
        </div>
        <div class="factura-lista-actions">
          <button class="factura-lista-btn factura-lista-view" onclick="previewFactura('${factura.id}')">
            <i class="bi bi-eye"></i>
            <span>Ver</span>
          </button>
          <button class="factura-lista-btn factura-lista-download" onclick="descargarFactura('${factura.id}')">
            <i class="bi bi-download"></i>
            <span>PDF</span>
          </button>
          <button class="factura-lista-btn factura-lista-delete" onclick="eliminarFactura('${factura.id}')">
            <i class="bi bi-trash"></i>
            <span>Eliminar</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // LOG AUTOMÁTICO PARA DEPURACIÓN
  console.log('Facturas para mostrar:', facturasCache);
  console.log('HTML generado:', facturasHtml);

  const modalContent = `
    <div class="facturas-lista-container">
      <div class="facturas-lista-header">
        <div class="facturas-lista-stats">
          <div class="stat-item">
            <i class="bi bi-receipt"></i>
            <span>${facturasCache.length} facturas</span>
          </div>
          <div class="stat-item">
            <i class="bi bi-currency-dollar"></i>
            <span>${formatCurrency(facturasCache.reduce((sum, f) => sum + (f.total || 0), 0))}</span>
          </div>
        </div>
      </div>
      <div class="facturas-lista-content">
        ${facturasHtml}
      </div>
    </div>
  `;

  showModal({
    title: `<i class="bi bi-list me-2"></i>Todas las Facturas (${facturasCache.length})`,
    content: modalContent,
    type: 'info',
    size: 'extra-large',
    showCancel: false,
    confirmText: 'Cerrar'
  });
}

// Hook para actualizar el modal cuando se carguen las facturas
function renderFacturasYActualizarModal() {
  renderFacturas();
  if (modalFacturasAbierto && facturasCache && facturasCache.length > 0) {
    mostrarTodasLasFacturas();
  }
}

// En cargarFacturas, cambiar renderFacturas() por renderFacturasYActualizarModal()
// ...
// renderFacturas();
// ...

// Exponer función globalmente
window.mostrarTodasLasFacturas = mostrarTodasLasFacturas;





// --- Estadísticas y Reportes ---
function actualizarResumenVentas() {
    const todasLasVentas = ventasCache;
    const ahora = new Date();

    // --- Día actual (24h de hoy) ---
    const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0, 0);
    const finDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);

    // --- Semana actual (domingo a domingo) ---
    // getDay(): 0=domingo, 1=lunes, ..., 6=sábado
    const diaSemana = ahora.getDay();
    const inicioSemana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - diaSemana, 0, 0, 0, 0);
    const finSemana = new Date(inicioSemana.getFullYear(), inicioSemana.getMonth(), inicioSemana.getDate() + 6, 23, 59, 59, 999);

    // --- Mes actual (1 al último día del mes) ---
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999);

    let totalDiario = 0, totalSemanal = 0, totalMensual = 0;
    let metodosDiarios = {}, metodosSemanales = {}, metodosMensuales = {};

    todasLasVentas.forEach(v => {
        const fechaVenta = new Date(v.fecha);
        const metodosPago = v.metodosPago || [];
        if (metodosPago.length === 0 && v.formaPago && v.total) {
          metodosPago.push({ metodo: v.formaPago, monto: v.total });
        }
        metodosPago.forEach(mp => {
            if (!mp.metodo || !mp.monto) return;
            // Diaria
            if (fechaVenta >= inicioDia && fechaVenta <= finDia) {
                totalDiario += mp.monto;
                metodosDiarios[mp.metodo] = (metodosDiarios[mp.metodo] || 0) + mp.monto;
            }
            // Semanal
            if (fechaVenta >= inicioSemana && fechaVenta <= finSemana) {
                totalSemanal += mp.monto;
                metodosSemanales[mp.metodo] = (metodosSemanales[mp.metodo] || 0) + mp.monto;
            }
            // Mensual
            if (fechaVenta >= inicioMes && fechaVenta <= finMes) {
                totalMensual += mp.monto;
                metodosMensuales[mp.metodo] = (metodosMensuales[mp.metodo] || 0) + mp.monto;
            }
        });
    });

    if (elemDiarias) elemDiarias.textContent = formatCurrency(totalDiario);
    if (elemSemanales) elemSemanales.textContent = formatCurrency(totalSemanal);
    if (elemMensuales) elemMensuales.textContent = formatCurrency(totalMensual);

    const renderMetodos = (obj) => Object.entries(obj).map(([m, v]) => `${m}: ${formatCurrency(v)}`).join('<br>') || 'Sin ventas';
    if (elemDiariosMetodos) elemDiariosMetodos.innerHTML = renderMetodos(metodosDiarios);
    if (elemSemanalesMetodos) elemSemanalesMetodos.innerHTML = renderMetodos(metodosSemanales);
    if (elemMensualesMetodos) elemMensualesMetodos.innerHTML = renderMetodos(metodosMensuales);
}

function generarReportePDF(titulo, ventas, periodoStr) {
  if (ventas.length === 0) {
    showWarning("No hay ventas para generar el reporte.");
    return;
  }
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  const doc = new jsPDF();
  let totalGeneral = 0;

  doc.setFontSize(16).text('Distribuciones ROCA', 105, 20, { align: 'center' });
  doc.setFontSize(14).text(titulo, 105, 30, { align: 'center' });
  doc.setFontSize(10).text(`Período: ${periodoStr}`, 105, 38, { align: 'center' });
  
  const datosTabla = ventas.map(v => {
      totalGeneral += v.total;
      const productsDisplay = (v.productos || []).map(p => `${p.nombreProducto}(${p.cantidad})`).join(", ");
      const productsText = productsDisplay.length > 50 ? productsDisplay.substring(0, 47) + '...' : productsDisplay;

      return [
        new Date(v.fecha).toLocaleDateString("es-CO"),
        v.cliente || "-",
        productsText,
        formatCurrency(v.total)
      ];
  });
  
  datosTabla.push([ 
    { content: 'TOTAL:', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } }, 
    { content: formatCurrency(totalGeneral), styles: { fontStyle: 'bold' } } 
  ]);

  doc.autoTable({
      head: [['Fecha', 'Cliente', 'Productos', 'Total']],
      body: datosTabla,
      startY: 50,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [20, 100, 200] },
      columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 70 },
          3: { cellWidth: 25, halign: 'right' }
      }
  });
  
  doc.save(`${titulo.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  showSuccess("Reporte generado.");
}

// Manejadores para botones de reporte
document.getElementById('btnReporteDiario')?.addEventListener('click', () => {
    const hoy = getFechaHoy();
    const ventasDelDia = ventasCache.filter(v => new Date(v.fecha).toISOString().slice(0, 10) === hoy);
    generarReportePDF('Reporte de Ventas Diario', ventasDelDia, `Día: ${formatearFechaLegible(hoy)}`);
});

document.getElementById('btnReporteMensual')?.addEventListener('click', () => {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    
    const ventasDelMes = ventasCache.filter(v => {
        const fechaVenta = new Date(v.fecha);
        return fechaVenta >= primerDiaMes && fechaVenta <= ultimoDiaMes;
    });
    generarReportePDF('Reporte de Ventas Mensual', ventasDelMes, `Mes: ${hoy.toLocaleString('es-CO', { month: 'long', year: 'numeric' })}`);
});

document.getElementById('btnReporteAnual')?.addEventListener('click', () => {
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const ventasDelAnio = ventasCache.filter(v => new Date(v.fecha).getFullYear() === anioActual);
    generarReportePDF('Reporte de Ventas Anual', ventasDelAnio, `Año: ${anioActual}`);
});

document.getElementById('btnReporteCliente')?.addEventListener('click', async () => {
    const clienteParaReporte = await showModal({
        title: 'Reporte por Cliente',
        content: `
            <div class="form-group">
                <label class="form-label">Nombre del Cliente</label>
                <input type="text" id="clienteReporteInput" class="form-control" placeholder="Ingrese el nombre del cliente" />
            </div>
        `,
        type: 'info',
        confirmText: 'Generar Reporte',
        cancelText: 'Cancelar'
    });
    
    if (!clienteParaReporte) return;
    
    const clienteInput = document.getElementById('clienteReporteInput');
    const clienteNombre = clienteInput?.value?.trim();
    
    if (!clienteNombre) {
        showWarning("Debe ingresar un nombre de cliente.");
        return;
    }
    
    const ventasPorCliente = ventasCache.filter(v => (v.cliente || "").toLowerCase().includes(clienteNombre.toLowerCase()));
    if (ventasPorCliente.length === 0) {
        showWarning(`No se encontraron ventas para el cliente "${clienteNombre}".`);
        return;
    }
    generarReportePDF(`Reporte de Ventas por Cliente: ${clienteNombre}`, ventasPorCliente, `Cliente: ${clienteNombre}`);
});

// --- Inicialización ---
function configurarEventosFiltros() {
  if (eventosConfigurados) return;
  
  [filtroProducto, filtroCliente, filtroFecha, filtroFormaPago].forEach(el => {
    if (el) {
        el.addEventListener("input", aplicarFiltros);
        el.addEventListener("change", aplicarFiltros);
    }
  });

  if (btnLimpiarFiltros) {
      btnLimpiarFiltros.addEventListener('click', () => {
          filtroProducto.value = '';
          filtroCliente.value = '';
          filtroFecha.value = '';
          filtroFormaPago.value = '';
          currentPage = 1;
          aplicarFiltros();
      });
  }
  
  eventosConfigurados = true;
}

function actualizarContadorVentas(count) {
    const contador = document.getElementById('contadorVentas');
    if (contador) {
        contador.textContent = `${count} venta${count !== 1 ? 's' : ''}`;
    }
}

// --- Funciones para manejar el historial de ventas ---
function mostrarHistorialVentas() {
  // Guardar el contenido actual antes de ocultarlo
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    contenidoAnterior = mainContent.innerHTML;
  }
  
  // Ocultar todo el contenido actual
  const mainContentElement = document.querySelector('.main-content');
  if (mainContentElement) {
    mainContentElement.style.display = 'none';
  }
  
  // Mostrar el historial
  const historialContainer = document.getElementById('historialVentasContainer');
  if (historialContainer) {
    historialContainer.style.display = 'block';
    
    // Aplicar filtros para cargar los datos
    aplicarFiltros();
    
    // Scroll suave al historial
    historialContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Mostrar botón flotante de volver al inicio
    mostrarBotonVolverInicio();
  }
  
  // Cambiar el texto del botón
  const btnVerHistorial = document.getElementById('btnVerHistorial');
  if (btnVerHistorial) {
    btnVerHistorial.innerHTML = '<i class="bi bi-arrow-left me-1"></i>Volver';
    btnVerHistorial.onclick = ocultarHistorialVentas;
  }
}

function ocultarHistorialVentas() {
  // Ocultar el historial
  const historialContainer = document.getElementById('historialVentasContainer');
  if (historialContainer) {
    historialContainer.style.display = 'none';
  }
  
  // Restaurar el contenido anterior
  const mainContentElement = document.querySelector('.main-content');
  if (mainContentElement && contenidoAnterior) {
    mainContentElement.style.display = 'block';
    mainContentElement.innerHTML = contenidoAnterior;
    
    // Reconfigurar eventos después de restaurar el contenido
    configurarEventosHistorial();
  }
  
  // Restaurar el botón original
  const btnVerHistorial = document.getElementById('btnVerHistorial');
  if (btnVerHistorial) {
    btnVerHistorial.innerHTML = '<i class="bi bi-clock-history me-1"></i>Ver Historial';
    btnVerHistorial.onclick = mostrarHistorialVentas;
  }
  
  // Ocultar botón flotante de volver al inicio
  ocultarBotonVolverInicio();
  
  // Scroll al inicio de la página
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function mostrarBotonVolverInicio() {
  // Crear botón flotante si no existe
  let btnVolverInicio = document.getElementById('btnVolverInicio');
  if (!btnVolverInicio) {
    btnVolverInicio = document.createElement('button');
    btnVolverInicio.id = 'btnVolverInicio';
    btnVolverInicio.className = 'btn-volver-inicio';
    btnVolverInicio.innerHTML = '<i class="bi bi-house"></i>';
    btnVolverInicio.title = 'Volver al inicio';
    btnVolverInicio.onclick = ocultarHistorialVentas;
    document.body.appendChild(btnVolverInicio);
  }
  
  // Mostrar con animación
  setTimeout(() => {
    btnVolverInicio.style.display = 'flex';
    btnVolverInicio.style.opacity = '1';
    btnVolverInicio.style.transform = 'translateY(0)';
  }, 300);
}

function ocultarBotonVolverInicio() {
  const btnVolverInicio = document.getElementById('btnVolverInicio');
  if (btnVolverInicio) {
    btnVolverInicio.style.opacity = '0';
    btnVolverInicio.style.transform = 'translateY(20px)';
    setTimeout(() => {
      btnVolverInicio.style.display = 'none';
    }, 300);
  }
}

function configurarEventosHistorial() {
  // Reconfigurar eventos de filtros
  configurarEventosFiltros();
  
  // Reconfigurar eventos de botones
  const btnVerHistorial = document.getElementById('btnVerHistorial');
  if (btnVerHistorial) {
    btnVerHistorial.onclick = mostrarHistorialVentas;
  }
  
  const btnCerrarHistorial = document.getElementById('btnCerrarHistorial');
  if (btnCerrarHistorial) {
    btnCerrarHistorial.onclick = ocultarHistorialVentas;
  }
}

function inicializar() {
  cargarProductos();
  cargarClientesCache();
  cargarFacturas();
  cargarPromociones();
  listarVentas();

  configurarEventosFiltros();
  
  // ✅ USAR LA NUEVA FUNCIÓN
  if (fechaVentaInput) {
    fechaVentaInput.value = getFechaActualParaInput();
  }

  // Inicializar wizard - solo agregar productos y métodos de pago cuando se llegue a esos pasos
  // Los contenedores se inicializarán dinámicamente

  document.getElementById("btnAnadirProducto")?.addEventListener("click", agregarProductoInput);
  document.getElementById("btnAnadirPago")?.addEventListener("click", agregarMetodoPagoInput);
  document.getElementById("viewFacturas")?.addEventListener("click", () => {
    document.querySelector('.facturas-grid')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById("btnActualizarFacturas")?.addEventListener("click", renderFacturas);

  // Configurar eventos del historial de ventas
  document.getElementById("btnVerHistorial")?.addEventListener("click", mostrarHistorialVentas);
  document.getElementById("btnCerrarHistorial")?.addEventListener("click", ocultarHistorialVentas);

  // Listener para resize de ventana para actualizar facturas en móvil
  window.addEventListener('resize', () => {
    // Debounce para evitar demasiadas actualizaciones
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(() => {
      renderFacturas();
    }, 250);
  });

  // Precargar audios
  precargarAudios();
  
  // Inicializar control de sonido
  if (soundControl) {
  
  }
  
  // Inicializar wizard
  initializeWizard();
}
document.addEventListener('DOMContentLoaded', inicializar);

// --- Wizard Navigation Functions ---
let currentWizardStep = 1;
const totalWizardSteps = 4;

function showStep2Productos() {
  if (productosContainer && productosContainer.children.length === 0) {
    agregarProductoInput();
  }
}



// Modifica nextStep para llamar a showStep2Productos y showStep3Pagos
function nextStep(step) {
  if (step > totalWizardSteps) return;
  
  // Validar el paso actual antes de continuar
  if (!validateCurrentStep()) {
    return;
  }
  
  // Marcar paso actual como completado
  markStepAsCompleted(currentWizardStep);
  
  // Ocultar paso actual
  const currentStepElement = document.querySelector(`.wizard-step[data-step="${currentWizardStep}"]`);
  if (currentStepElement) {
    currentStepElement.classList.remove('active');
  }
  
  // Mostrar siguiente paso
  const nextStepElement = document.querySelector(`.wizard-step[data-step="${step}"]`);
  if (nextStepElement) {
    nextStepElement.classList.add('active');
  }
  
  // Si es el paso 2, asegurarse de que haya solo un campo de producto si está vacío
  if (step === 2) {
    showStep2Productos();
  }
  // Si es el paso 3, asegurarse de que haya solo un campo de método de pago si está vacío
  if (step === 3) {
    showStep3Pagos();
  }
  
  // Actualizar progress bar
  updateProgressBar(step);
  
  currentWizardStep = step;
  
  // Actualizar resumen en el paso 4
  if (step === 4) {
    updateConfirmationSummary();
  }
  
  // Scroll suave al paso
  nextStepElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  // Mostrar/ocultar botón flotante de volver paso
  updateFloatingButtons();
}

function prevStep(step) {
  if (step < 1) return;
  
  // Ocultar paso actual
  const currentStepElement = document.querySelector(`.wizard-step[data-step="${currentWizardStep}"]`);
  if (currentStepElement) {
    currentStepElement.classList.remove('active');
  }
  
  // Mostrar paso anterior
  const prevStepElement = document.querySelector(`.wizard-step[data-step="${step}"]`);
  if (prevStepElement) {
    prevStepElement.classList.add('active');
  }
  
  // Actualizar progress bar
  updateProgressBar(step);
  
  currentWizardStep = step;
  
  // Scroll suave al paso
  prevStepElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  // Mostrar/ocultar botón flotante de volver paso
  updateFloatingButtons();
}

function validateCurrentStep() {
  switch (currentWizardStep) {
    case 1:
      const cliente = document.getElementById('cliente')?.value?.trim();
      const tipoCliente = document.querySelector('input[name="tipoCliente"]:checked')?.value;
      const fechaVenta = document.getElementById('fechaVenta')?.value;
      
      if (!cliente) {
        showWarning("Debe seleccionar un cliente.");
        return false;
      }
      if (!tipoCliente) {
        showWarning("Debe seleccionar el tipo de cliente.");
        return false;
      }
      if (!fechaVenta) {
        showWarning("Debe seleccionar la fecha de venta.");
        return false;
      }
      break;
      
    case 2:
      const productos = document.querySelectorAll('.producto-item');
      let hayProductos = false;
      
      productos.forEach(item => {
        const productoId = item.querySelector('.producto-id')?.value;
        const cantidad = item.querySelector('.cantidad-input')?.value?.trim();
        
        if (productoId && cantidad && parseFloat(cantidad) > 0) {
          hayProductos = true;
        }
      });
      
      if (!hayProductos) {
        showWarning("Debe agregar al menos un producto a la venta.");
        return false;
      }
      break;
      
    case 3:
      const metodosPago = document.querySelectorAll('.payment-method-item');
      let totalPagado = 0;
      let hayMetodos = false;
      
      metodosPago.forEach(item => {
        const metodo = item.querySelector('.payment-method-select')?.value;
        const monto = parseFloat(item.querySelector('.payment-amount-input')?.value) || 0;
        
        if (metodo && monto > 0) {
          totalPagado += monto;
          hayMetodos = true;
        }
      });
      
      if (!hayMetodos) {
        showWarning("Debe agregar al menos un método de pago.");
        return false;
      }
      
      // Calcular total actual para comparar
      const totalActual = calcularTotalNumerico();
      if (Math.abs(totalPagado - totalActual) > 0.01) {
        showWarning(`La suma de los pagos (${formatCurrency(totalPagado)}) no coincide con el total (${formatCurrency(totalActual)}).`);
        return false;
      }
      break;
  }
  
  return true;
}

function markStepAsCompleted(step) {
  const progressStep = document.querySelector(`.progress-step[data-step="${step}"]`);
  if (progressStep) {
    progressStep.classList.remove('active');
    progressStep.classList.add('completed');
  }
}

function updateProgressBar(step) {
  // Limpiar todos los estados
  document.querySelectorAll('.progress-step').forEach(el => {
    el.classList.remove('active', 'completed');
  });
  
  // Marcar pasos completados
  for (let i = 1; i < step; i++) {
    const progressStep = document.querySelector(`.progress-step[data-step="${i}"]`);
    if (progressStep) {
      progressStep.classList.add('completed');
    }
  }
  
  // Marcar paso actual como activo
  const currentProgressStep = document.querySelector(`.progress-step[data-step="${step}"]`);
  if (currentProgressStep) {
    currentProgressStep.classList.add('active');
  }
}

function updateConfirmationSummary() {
  // Cliente
  const cliente = document.getElementById('cliente')?.value?.trim() || 'No especificado';
  const tipoCliente = document.querySelector('input[name="tipoCliente"]:checked')?.value || 'No especificado';
  const fechaVenta = document.getElementById('fechaVenta')?.value || 'No especificada';
  
  document.getElementById('summaryCliente').innerHTML = `
    <strong>${cliente}</strong><br>
    <small>Tipo: ${tipoCliente === 'final' ? 'Cliente Final' : 'Distribuidor'}</small><br>
    <small>Fecha: ${fechaVenta}</small>
  `;
  
  // Productos
  const productos = [];
  document.querySelectorAll('.producto-item').forEach(item => {
    const productoId = item.querySelector('.producto-id')?.value;
    const cantidad = item.querySelector('.cantidad-input')?.value?.trim();
    
    if (productoId && cantidad && parseFloat(cantidad) > 0) {
      const producto = products.find(p => p.id === productoId);
      if (producto) {
        productos.push(`${producto.nombre} (${cantidad})`);
      }
    }
  });
  
  document.getElementById('summaryProductos').innerHTML = 
    productos.length > 0 
      ? productos.join('<br>')
      : 'No hay productos seleccionados';
  
  // Métodos de Pago
  const metodosPago = [];
  document.querySelectorAll('.payment-method-item').forEach(item => {
    const metodo = item.querySelector('.payment-method-select')?.value;
    const monto = parseFloat(item.querySelector('.payment-amount-input')?.value) || 0;
    
    if (metodo && monto > 0) {
      metodosPago.push(`${metodo}: ${formatCurrency(monto)}`);
    }
  });
  
  document.getElementById('summaryPago').innerHTML = 
    metodosPago.length > 0 
      ? metodosPago.join('<br>')
      : 'No hay métodos de pago configurados';
  
  // Total
  const total = calcularTotalNumerico();
  document.getElementById('summaryTotal').textContent = formatCurrency(total);
}

function calcularTotalNumerico() {
  const tipoCliente = document.querySelector('input[name="tipoCliente"]:checked')?.value;
  if (!tipoCliente) return 0;

  let totalOriginal = 0;
  let totalDescuento = 0;
  const productoItems = document.querySelectorAll(".producto-item");
  const productosEnCarro = [];

  productoItems.forEach(item => {
    const productoId = item.querySelector(".producto-id").value;
    let cantidadStr = item.querySelector(".cantidad-input").value.trim();
    let cantidad = 0;

    if (cantidadStr.toLowerCase() === 'mitad') {
      cantidad = 0.5;
    } else {
      cantidad = parseFloat(cantidadStr);
    }
    
    if (productoId && cantidad > 0) {
      const producto = products.find(p => p.id === productoId);
      if (producto) {
        let precioUnitario = tipoCliente === "distribuidor" 
          ? (producto.precioDistribuidor || 0)
          : (producto.precioCliente || producto.precio || 0);

        if (precioUnitario > 0) {
          totalOriginal += precioUnitario * cantidad;
          productosEnCarro.push({ producto, cantidad, precioUnitario });
        }
      }
    }
  });

  const promocionesSeleccionadas = document.querySelectorAll(".promo-checkbox:checked");
  promocionesSeleccionadas.forEach(checkbox => {
    const promoId = checkbox.value;
    const promo = promocionesCache[promoId];
    if (!promo) return;

    const productoPrincipalEnCarro = productosEnCarro.find(p => p.producto.nombre === promo.productoPrincipal);
    const productoDescuentoEnCarro = productosEnCarro.find(p => p.producto.nombre === promo.productoDescuento);

    if (productoPrincipalEnCarro && productoPrincipalEnCarro.cantidad >= promo.cantidadNecesaria && productoDescuentoEnCarro) {
        const precioOriginal = productoDescuentoEnCarro.precioUnitario;
        const precioPromocional = promo.precioPromocional;
        const maxUnidadesConDescuento = Math.floor(productoPrincipalEnCarro.cantidad / promo.cantidadNecesaria);
        const unidadesParaAplicarDescuento = Math.min(productoDescuentoEnCarro.cantidad, maxUnidadesConDescuento);

        if (precioOriginal > precioPromocional) {
            totalDescuento += (precioOriginal - precioPromocional) * unidadesParaAplicarDescuento;
        }
    }
  });

  return totalOriginal - totalDescuento;
}

// Exponer funciones globalmente
window.nextStep = nextStep;
window.prevStep = prevStep;

function initializeWizard() {
  // Asegurar que el primer paso esté activo
  currentWizardStep = 1;
  updateProgressBar(1);
  updateFloatingButtons();
  
  // Agregar listeners para los radio buttons de tipo de cliente
  document.querySelectorAll('input[name="tipoCliente"]').forEach(radio => {
    radio.addEventListener('change', () => {
      calcularTotal();
    });
  });
  
  // Listener para el botón de agregar producto
  const btnProducto = document.getElementById("btnAnadirProducto");
  if (btnProducto) {
    btnProducto.onclick = agregarProductoInput;
  }
  // Listener para el botón de agregar método de pago
  const btnPago = document.getElementById("btnAnadirPago");
  if (btnPago) {
    btnPago.onclick = agregarMetodoPagoInput;
  }
}

function resetWizard() {
  // Ocultar todos los pasos
  document.querySelectorAll('.wizard-step').forEach(step => {
    step.classList.remove('active');
  });
  
  // Mostrar solo el primer paso
  const firstStep = document.querySelector('.wizard-step[data-step="1"]');
  if (firstStep) {
    firstStep.classList.add('active');
  }
  
  // Resetear progress bar
  currentWizardStep = 1;
  updateProgressBar(1);
  
  // Limpiar radio buttons
  document.querySelectorAll('input[name="tipoCliente"]').forEach(radio => {
    radio.checked = false;
  });
  
  // Scroll al inicio
  firstStep?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  // Actualizar botones flotantes
  updateFloatingButtons();
}

function updateFloatingButtons() {
  const btnVolverPaso = document.getElementById('btnFabVolverPaso');
  if (btnVolverPaso) {
    // Mostrar botón solo si no estamos en el primer paso
    if (currentWizardStep > 1) {
      btnVolverPaso.style.display = 'flex';
    } else {
      btnVolverPaso.style.display = 'none';
    }
  }
}

// --- Inicialización ---

// Validación en tiempo real de stock
function validateStockRealtime() {
  let error = false;
  const productoItems = document.querySelectorAll('.producto-item');
  productoItems.forEach(item => {
    const productoId = item.querySelector('.producto-id').value;
    const cantidadInput = item.querySelector('.cantidad-input');
    const cantidadStr = cantidadInput.value.trim();
    let cantidad = 0;
    if (cantidadStr.toLowerCase() === 'mitad') {
      cantidad = 0.5;
    } else {
      cantidad = parseFloat(cantidadStr);
    }
    // Quitar mensaje previo
    let errorMsg = item.querySelector('.stock-error-msg');
    if (errorMsg) errorMsg.remove();
    cantidadInput.classList.remove('is-invalid');
    if (productoId && cantidad > 0) {
      const producto = products.find(p => p.id === productoId);
      if (producto) {
        const stockDisponible = producto.stockCanastas || 0;
        if (cantidad > stockDisponible) {
          error = true;
          cantidadInput.classList.add('is-invalid');
          errorMsg = document.createElement('div');
          errorMsg.className = 'stock-error-msg';
          errorMsg.style.color = '#ff3b30';
          errorMsg.style.fontSize = '0.95em';
          errorMsg.style.marginTop = '4px';
          errorMsg.textContent = `Stock insuficiente. Disponible: ${stockDisponible}`;
          cantidadInput.parentNode.appendChild(errorMsg);
        }
      }
    }
  });
  // Deshabilitar o habilitar el botón de continuar
  const btnNext = document.querySelector('.wizard-step[data-step="2"] .step-actions .btn-primary');
  if (btnNext) btnNext.disabled = error;
}

// Llama a validateStockRealtime en los eventos de cantidad y selección de producto

document.addEventListener("input", function(e) {
  if (e.target.classList.contains("cantidad-input")) {
    validateStockRealtime();
    calcularTotal();
  }
});

document.addEventListener("change", function(e) {
  if (e.target.classList.contains("producto-id")) {
    validateStockRealtime();
  }
});

// También llama a validateStockRealtime al agregar un producto nuevo
const originalAgregarProductoInput = agregarProductoInput;
agregarProductoInput = function() {
  originalAgregarProductoInput();
  setTimeout(validateStockRealtime, 0);
};

// Feedback en tiempo real de cuánto falta por pagar
function actualizarFaltantePago() {
  const totalVenta = calcularTotalNumerico();
  let totalPagado = 0;
  document.querySelectorAll('.payment-method-item .payment-amount-input').forEach(input => {
    const val = parseFloat(input.value);
    if (!isNaN(val)) totalPagado += val;
  });
  const faltante = totalVenta - totalPagado;
  let mensaje = '';
  let color = '';
  if (faltante > 0.01) {
    mensaje = `Falta por pagar: ${formatCurrency(faltante)}`;
    color = '#ff3b30'; // rojo
  } else if (faltante < -0.01) {
    mensaje = `Sobra: ${formatCurrency(Math.abs(faltante))}`;
    color = '#ff9500'; // naranja
  } else {
    mensaje = '¡Monto exacto!';
    color = '#34c759'; // verde
  }
  let feedback = document.getElementById('faltantePagoFeedback');
  if (!feedback) {
    feedback = document.createElement('div');
    feedback.id = 'faltantePagoFeedback';
    feedback.style.marginTop = '10px';
    feedback.style.fontWeight = 'bold';
    feedback.style.fontSize = '1.1em';
    const container = document.querySelector('.payment-section');
    if (container) container.appendChild(feedback);
  }
  feedback.textContent = mensaje;
  feedback.style.color = color;
}

// Llama a actualizarFaltantePago en los eventos relevantes
document.addEventListener('input', function(e) {
  if (e.target.classList.contains('payment-amount-input')) {
    actualizarFaltantePago();
  }
});
document.addEventListener('change', function(e) {
  if (e.target.classList.contains('payment-amount-input')) {
    actualizarFaltantePago();
  }
});
// Al agregar o eliminar métodos de pago
const originalAgregarMetodoPagoInput = agregarMetodoPagoInput;
agregarMetodoPagoInput = function() {
  originalAgregarMetodoPagoInput();
  setTimeout(actualizarFaltantePago, 0);
};
document.addEventListener('click', function(e) {
  if (e.target.closest('.payment-method-item .btn-outline-danger')) {
    setTimeout(actualizarFaltantePago, 0);
  }
});
// Llama también al cambiar de paso
function showStep3Pagos() {
  if (paymentMethodsContainer && paymentMethodsContainer.children.length === 0) {
    agregarMetodoPagoInput();
  }
  setTimeout(actualizarFaltantePago, 0);
}

// ... existing code ...
window.calcularTotal = calcularTotal;
// ... existing code ...

// --- MODAL DE REPORTES ---

// Función para mostrar el modal de reportes
function mostrarModalReportes() {
  const modal = document.getElementById('modalReportes');
  if (window.bootstrap && window.bootstrap.Modal) {
    const bsModal = new window.bootstrap.Modal(modal);
    bsModal.show();
  } else {
    modal.style.display = 'block';
    modal.classList.add('show');
  }
}

// Listener para abrir el modal desde cualquier botón de reportes

document.addEventListener('DOMContentLoaded', () => {
  configurarBotonReportes();
  const tipoReporte = document.getElementById('tipoReporte');
  if (tipoReporte) {
    tipoReporte.addEventListener('change', actualizarFiltrosReportes);
    actualizarFiltrosReportes();
  }
});

// --- LÓGICA DE FILTRADO Y TABLA DE REPORTES ---

function filtrarVentasParaReporte() {
  const tipo = document.getElementById('tipoReporte').value;
  const fecha = document.getElementById('filtroFecha')?.value;
  const fechaInicio = document.getElementById('filtroFechaInicio')?.value;
  const fechaFin = document.getElementById('filtroFechaFin')?.value;
  const cliente = document.getElementById('filtroClienteReporte')?.value.trim().toLowerCase();
  const producto = document.getElementById('filtroProductoReporte')?.value.trim().toLowerCase();
  const metodoPago = document.getElementById('filtroMetodoPago')?.value;
  const mes = document.getElementById('filtroMes')?.value;
  const anio = document.getElementById('filtroAnio')?.value;
  const semana = document.getElementById('filtroSemana')?.value;

  let ventasFiltradas = [...ventasCache];

  if (tipo === 'dia' && fecha) {
    ventasFiltradas = ventasFiltradas.filter(v => new Date(v.fecha).toISOString().slice(0,10) === fecha);
  } else if (tipo === 'semana' && semana) {
    // Buscar semana del año (domingo a sábado)
    const fechaBase = new Date(semana);
    const primerDiaSemana = new Date(fechaBase);
    primerDiaSemana.setDate(fechaBase.getDate() - fechaBase.getDay());
    const ultimoDiaSemana = new Date(primerDiaSemana);
    ultimoDiaSemana.setDate(primerDiaSemana.getDate() + 6);
    ventasFiltradas = ventasFiltradas.filter(v => {
      const f = new Date(v.fecha);
      return f >= primerDiaSemana && f <= ultimoDiaSemana;
    });
  } else if (tipo === 'mes' && mes && anio) {
    ventasFiltradas = ventasFiltradas.filter(v => {
      const f = new Date(v.fecha);
      return f.getFullYear() == anio && (f.getMonth()+1) == parseInt(mes);
    });
  } else if (tipo === 'anio' && anio) {
    ventasFiltradas = ventasFiltradas.filter(v => {
      const f = new Date(v.fecha);
      return f.getFullYear() == anio;
    });
  } else if (tipo === 'rango' && fechaInicio && fechaFin) {
    const fIni = new Date(fechaInicio);
    const fFin = new Date(fechaFin);
    fFin.setHours(23,59,59,999);
    ventasFiltradas = ventasFiltradas.filter(v => {
      const f = new Date(v.fecha);
      return f >= fIni && f <= fFin;
    });
  } else if (tipo === 'cliente' && cliente) {
    ventasFiltradas = ventasFiltradas.filter(v => (v.cliente || '').toLowerCase().includes(cliente));
  } else if (tipo === 'producto' && producto) {
    ventasFiltradas = ventasFiltradas.filter(v => (v.productos || []).some(p => (p.nombreProducto || p.producto || '').toLowerCase().includes(producto)));
  } else if (tipo === 'metodo' && metodoPago) {
    ventasFiltradas = ventasFiltradas.filter(v => (v.metodosPago || []).some(mp => mp.metodo === metodoPago));
  }

  return ventasFiltradas;
}

function renderTablaReportes() {
  const ventas = filtrarVentasParaReporte();
  const cont = document.getElementById('tablaReportesContainer');
  if (!cont) return;
  if (ventas.length === 0) {
    cont.innerHTML = '<div class="empty-state"><i class="bi bi-graph-up"></i><p>No hay ventas para este reporte.</p></div>';
    document.getElementById('graficaComparacionContainer').style.display = 'none';
    return;
  }
  let totalGeneral = 0;
  const tipo = document.getElementById('tipoReporte').value;
  const productoBuscado = document.getElementById('filtroProductoReporte')?.value.trim().toLowerCase();
  let html = `<table class="table table-striped table-bordered">
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Cliente</th>
        <th>Productos</th>
        <th>Total</th>
        <th>Métodos de Pago</th>
        <th>Promociones</th>
      </tr>
    </thead>
    <tbody>`;
  ventas.forEach(v => {
    let productos, subtotalProducto = 0, cantidadProducto = 0;
    if (tipo === 'producto' && productoBuscado) {
      // Solo mostrar el producto buscado
      const encontrados = (v.productos || []).filter(p => (p.nombreProducto || p.producto || '').toLowerCase().includes(productoBuscado));
      productos = encontrados.map(p => `${p.nombreProducto || p.producto || ''} (${p.cantidad})`).join(', ');
      cantidadProducto = encontrados.reduce((sum, p) => sum + (p.cantidad || 0), 0);
      subtotalProducto = encontrados.reduce((sum, p) => sum + (p.total || ((p.cantidad||0)*(p.precioUnitario||p.precio||0))), 0);
      totalGeneral += subtotalProducto;
    } else {
      productos = (v.productos || []).map(p => `${p.nombreProducto || p.producto || ''} (${p.cantidad})`).join(', ');
      totalGeneral += v.total || 0;
    }
    const metodos = (v.metodosPago || []).map(mp => `${mp.metodo}: ${formatCurrency(mp.monto)}`).join(', ');
    const promos = (v.promocionesAplicadas || []).map(p => p.nombrePromocion).join(', ');
    html += `<tr>
      <td>${formatDateTime(v.fecha)}</td>
      <td>${capitalize(v.cliente) || '-'}</td>
      <td>${productos}</td>
      <td>${tipo === 'producto' && productoBuscado ? formatCurrency(subtotalProducto) : formatCurrency(v.total)}</td>
      <td>${metodos}</td>
      <td>${promos || '-'}</td>
    </tr>`;
  });
  // Fila de total general
  html += `<tr style="font-weight:bold;background:#f8f9fa;">
    <td colspan="3" class="text-end">TOTAL</td>
    <td>${formatCurrency(totalGeneral)}</td>
    <td colspan="2"></td>
  </tr>`;
  html += '</tbody></table>';
  cont.innerHTML = html;

  // Si es comparación, renderizar gráfica
  if (tipo === 'comparar') {
    renderGraficaComparacion();
  } else {
    document.getElementById('graficaComparacionContainer').style.display = 'none';
  }
}

// --- LÓGICA DE COMPARACIÓN VISUAL (GRÁFICA) ---
let graficaComparacion = null;
function renderGraficaComparacion() {
  const tipoComparacion = document.getElementById('tipoComparacion')?.value;
  const valores = Array.from(document.querySelectorAll('#compararValoresContainer input, #compararValoresContainer select')).map(el => el.value).filter(Boolean);
  const ventas = [...ventasCache];
  let labels = [], data = [];

  if (!tipoComparacion || valores.length === 0) {
    document.getElementById('graficaComparacionContainer').style.display = 'none';
    return;
  }

  if (tipoComparacion === 'dias') {
    labels = valores;
    data = valores.map(dia => {
      const total = ventas.filter(v => new Date(v.fecha).toISOString().slice(0,10) === dia)
        .reduce((sum, v) => sum + (v.total || 0), 0);
      return total;
    });
  } else if (tipoComparacion === 'meses') {
    labels = valores.map(mesAnio => {
      const [anio, mes] = mesAnio.split('-');
      return `${mes}/${anio}`;
    });
    data = valores.map(mesAnio => {
      const [anio, mes] = mesAnio.split('-');
      return ventas.filter(v => {
        const f = new Date(v.fecha);
        return f.getFullYear() == anio && (f.getMonth()+1) == parseInt(mes);
      }).reduce((sum, v) => sum + (v.total || 0), 0);
    });
  } else if (tipoComparacion === 'anios') {
    labels = valores;
    data = valores.map(anio => {
      return ventas.filter(v => new Date(v.fecha).getFullYear() == anio)
        .reduce((sum, v) => sum + (v.total || 0), 0);
    });
  } else if (tipoComparacion === 'productos') {
    labels = valores;
    data = valores.map(prod => {
      return ventas.filter(v => (v.productos || []).some(p => (p.nombreProducto || p.producto || '').toLowerCase() === prod.toLowerCase()))
        .reduce((sum, v) => sum + (v.total || 0), 0);
    });
  } else if (tipoComparacion === 'clientes') {
    labels = valores;
    data = valores.map(cli => {
      return ventas.filter(v => (v.cliente || '').toLowerCase() === cli.toLowerCase())
        .reduce((sum, v) => sum + (v.total || 0), 0);
    });
  }

  // Mostrar gráfica
  document.getElementById('graficaComparacionContainer').style.display = '';
  const ctx = document.getElementById('graficaComparacion').getContext('2d');
  if (graficaComparacion) graficaComparacion.destroy();
  graficaComparacion = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total de Ventas',
        data,
        backgroundColor: 'rgba(41,128,185,0.7)',
        borderColor: 'rgba(41,128,185,1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// --- Mostrar/ocultar filtros según tipo de reporte ---
function actualizarFiltrosReportes() {
  const tipo = document.getElementById('tipoReporte').value;
  // Oculta todos los contenedores primero
  document.getElementById('filtroFechaContainer').style.display = 'none';
  document.getElementById('filtroRangoContainer').style.display = 'none';
  document.getElementById('filtroClienteContainer').style.display = 'none';
  document.getElementById('filtroProductoContainer').style.display = 'none';
  document.getElementById('filtroMetodoPagoContainer').style.display = 'none';
  document.getElementById('filtroMesContainer').style.display = 'none';
  document.getElementById('filtroAnioContainer').style.display = 'none';
  document.getElementById('filtroSemanaContainer').style.display = 'none';
  document.getElementById('filtroCompararContainer').style.display = 'none';

  // Muestra solo el campo relevante
  if (tipo === 'dia') {
    document.getElementById('filtroFechaContainer').style.display = '';
  } else if (tipo === 'semana') {
    document.getElementById('filtroSemanaContainer').style.display = '';
  } else if (tipo === 'mes') {
    document.getElementById('filtroMesContainer').style.display = '';
    document.getElementById('filtroAnioContainer').style.display = '';
  } else if (tipo === 'anio') {
    document.getElementById('filtroAnioContainer').style.display = '';
  } else if (tipo === 'rango') {
    document.getElementById('filtroRangoContainer').style.display = '';
  } else if (tipo === 'cliente') {
    document.getElementById('filtroClienteContainer').style.display = '';
  } else if (tipo === 'producto') {
    document.getElementById('filtroProductoContainer').style.display = '';
  } else if (tipo === 'metodo') {
    document.getElementById('filtroMetodoPagoContainer').style.display = '';
  } else if (tipo === 'comparar') {
    document.getElementById('filtroCompararContainer').style.display = '';
    renderCompararValoresInputs();
  }
  renderTablaReportes();
}

// --- Renderizar inputs dinámicos para comparación ---
function renderCompararValoresInputs() {
  const tipoComparacion = document.getElementById('tipoComparacion').value;
  const cont = document.getElementById('compararValoresContainer');
  cont.innerHTML = '';
  if (tipoComparacion === 'dias') {
    // Permitir seleccionar varios días
    for (let i = 0; i < 3; i++) {
      const input = document.createElement('input');
      input.type = 'date';
      input.className = 'form-control mb-2';
      input.placeholder = 'Selecciona un día';
      cont.appendChild(input);
    }
  } else if (tipoComparacion === 'meses') {
    for (let i = 0; i < 3; i++) {
      const sel = document.createElement('select');
      sel.className = 'form-control mb-2';
      sel.innerHTML = `<option value="">Mes/Año</option>`;
      for (let y = 2022; y <= new Date().getFullYear(); y++) {
        for (let m = 1; m <= 12; m++) {
          sel.innerHTML += `<option value="${y}-${m}">${m}/${y}</option>`;
        }
      }
      cont.appendChild(sel);
    }
  } else if (tipoComparacion === 'anios') {
    for (let i = 0; i < 3; i++) {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'form-control mb-2';
      input.placeholder = 'Año';
      input.min = 2000;
      input.max = 2100;
      cont.appendChild(input);
    }
  } else if (tipoComparacion === 'productos') {
    for (let i = 0; i < 3; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control mb-2';
      input.placeholder = 'Nombre del producto';
      cont.appendChild(input);
    }
  } else if (tipoComparacion === 'clientes') {
    for (let i = 0; i < 3; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control mb-2';
      input.placeholder = 'Nombre del cliente';
      cont.appendChild(input);
    }
  }
  // Listeners para actualizar la gráfica al cambiar inputs
  Array.from(cont.querySelectorAll('input,select')).forEach(el => {
    el.addEventListener('input', renderGraficaComparacion);
  });
}

// Listeners para actualizar la tabla y gráfica al cambiar filtros
['tipoReporte','filtroFecha','filtroFechaInicio','filtroFechaFin','filtroClienteReporte','filtroProductoReporte','filtroMetodoPago','filtroMes','filtroAnio','filtroSemana','tipoComparacion'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', actualizarFiltrosReportes);
});

document.getElementById('btnLimpiarFiltrosReportes')?.addEventListener('click', () => {
  document.querySelectorAll('.filters-section .form-control').forEach(el => {
    if (el.type === 'select-one' || el.type === 'text' || el.type === 'number' || el.type === 'date') el.value = '';
  });
  actualizarFiltrosReportes();
});

// Inicializar comparación visual al cambiar tipo de comparación
if (document.getElementById('tipoComparacion')) {
  document.getElementById('tipoComparacion').addEventListener('change', renderCompararValoresInputs);
}

// --- SUBMÓDULO DE REPORTES EN ESPACIO FIJO ---

// Mostrar/ocultar filtros según tipo de reporte (sin cambios)


// Mostrar el submódulo de reportes
function mostrarSubmoduloReportes() {
  document.querySelectorAll('.ventas-submodulo').forEach(div => div.style.display = 'none');
  const submodulo = document.getElementById('submodulo-reportes');
  if (submodulo) {
    submodulo.style.display = 'block';
    actualizarFiltrosReportes();
    renderTablaReportes();
  }
}

// Listener para abrir el submódulo desde cualquier botón de reportes
function configurarBotonReportes() {
  document.querySelectorAll('[data-submodulo="reportes"]').forEach(btn => {
    btn.addEventListener('click', mostrarSubmoduloReportes);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  configurarBotonReportes();
  const tipoReporte = document.getElementById('tipoReporte');
  if (tipoReporte) {
    tipoReporte.addEventListener('change', actualizarFiltrosReportes);
    actualizarFiltrosReportes();
  }
  // Listeners para actualizar la tabla al cambiar filtros
  ['tipoReporte','filtroFecha','filtroFechaInicio','filtroFechaFin','filtroClienteReporte','filtroProductoReporte'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderTablaReportes);
  });
});

// Eliminar lógica del modal de reportes (ya no se usa)
// ... existing code ...

// ... existing code ...
document.getElementById('btnExportarSheets')?.addEventListener('click', function(e) {
  e.preventDefault();
  const ventas = filtrarVentasParaReporte();
  if (!ventas || ventas.length === 0) {
    showWarning('No hay datos para exportar.');
    return;
  }
  let csv = 'Fecha,Cliente,Productos,Total,Metodos de Pago,Promociones\n';
  let totalGeneral = 0;
  ventas.forEach(v => {
    const productos = (v.productos || []).map(p => `${p.nombreProducto || p.producto || ''} (${p.cantidad})`).join(' | ');
    const metodos = (v.metodosPago || []).map(mp => `${mp.metodo}: ${mp.monto}`).join(' | ');
    const promos = (v.promocionesAplicadas || []).map(p => p.nombrePromocion).join(' | ');
    totalGeneral += v.total || 0;
    csv += `"${formatDateTime(v.fecha)}","${(v.cliente || '').replace(/"/g,'')}","${productos.replace(/"/g,'')}","${v.total}","${metodos.replace(/"/g,'')}","${promos.replace(/"/g,'')}"\n`;
  });
  // Fila de total general
  csv += `,,,${totalGeneral},,\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'Reporte_Ventas.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showSuccess('CSV generado correctamente. Puedes importarlo en Google Sheets.');
});
// ... existing code ...

// === FUNCIONES PARA HISTORIAL DE COMPRAS DEL CLIENTE (QR CODE) ===

// Verificar si se está accediendo al historial desde QR
function verificarAccesoHistorialQR() {
  const urlParams = new URLSearchParams(window.location.search);
  const clienteId = urlParams.get('clienteId');
  
  if (clienteId) {
    mostrarHistorialCliente(clienteId);
  }
}

// Mostrar historial completo del cliente
async function mostrarHistorialCliente(clienteId) {
  try {
    // Crear modal para mostrar historial
    const modalHistorial = document.createElement('div');
    modalHistorial.className = 'modal fade';
    modalHistorial.id = 'modalHistorialCliente';
    modalHistorial.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-clock-history"></i>
              Historial de Compras
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div id="historialClienteContent">
              <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Cargando...</span>
                </div>
                <p class="mt-2">Cargando historial de compras...</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modalHistorial);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(modalHistorial);
    modal.show();
    
    // Cargar datos del cliente y sus facturas
    const [clienteInfo, facturas] = await Promise.all([
      obtenerInfoClienteHistorial(clienteId),
      obtenerFacturasClienteHistorial(clienteId)
    ]);
    
    // Renderizar contenido del historial
    renderizarHistorialCliente(clienteInfo, facturas, clienteId);
    
    // Limpiar modal al cerrar
    modalHistorial.addEventListener('hidden.bs.modal', () => {
      document.body.removeChild(modalHistorial);
      // Limpiar URL si se accedió por QR
      if (window.location.search.includes('clienteId')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });
    
  } catch (error) {
    console.error('Error al mostrar historial del cliente:', error);
    showError('Error al cargar el historial del cliente');
  }
}

// Obtener información del cliente para historial
async function obtenerInfoClienteHistorial(clienteId) {
  try {
    const clienteSnap = await get(ref(db, `clientes/${clienteId}`));
    
    if (clienteSnap.exists()) {
      return {
        id: clienteId,
        ...clienteSnap.val()
      };
    } else {
      // Si no existe en clientes, buscar en facturas
      const facturas = facturasCache.filter(f => f.clienteId === clienteId);
      if (facturas.length > 0) {
        const primeraFactura = facturas[0];
        return {
          id: clienteId,
          nombre: primeraFactura.cliente || 'Cliente General',
          telefono: primeraFactura.clienteTelefono || 'N/A',
          direccion: primeraFactura.clienteDireccion || 'N/A'
        };
      }
      
      return {
        id: clienteId,
        nombre: 'Cliente General',
        telefono: 'N/A',
        direccion: 'N/A'
      };
    }
  } catch (error) {
    console.error('Error al obtener info del cliente:', error);
    return {
      id: clienteId,
      nombre: 'Cliente General',
      telefono: 'N/A',
      direccion: 'N/A'
    };
  }
}

// Obtener facturas del cliente para historial
async function obtenerFacturasClienteHistorial(clienteId) {
  try {
    // Filtrar facturas del cliente desde el cache
    const facturas = facturasCache
      .filter(f => f.clienteId === clienteId)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    // Si no hay facturas en cache, buscar en Firebase
    if (facturas.length === 0) {
      const facturasSnap = await get(ref(db, 'facturas'));
      if (facturasSnap.exists()) {
        const todasFacturas = Object.entries(facturasSnap.val()).map(([id, data]) => ({
          id,
          ...data
        }));
        
        return todasFacturas
          .filter(f => f.clienteId === clienteId)
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      }
    }
    
    return facturas;
  } catch (error) {
    console.error('Error al obtener facturas del cliente:', error);
    return [];
  }
}

// Renderizar historial del cliente
function renderizarHistorialCliente(clienteInfo, facturas, clienteId) {
  const container = document.getElementById('historialClienteContent');
  
  if (facturas.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4">
        <i class="bi bi-inbox display-1 text-muted"></i>
        <h4 class="mt-3 text-muted">Sin historial de compras</h4>
        <p class="text-muted">Este cliente aún no tiene compras registradas.</p>
      </div>
    `;
    return;
  }
  
  // Calcular estadísticas
  const totalFacturas = facturas.length;
  const totalGastado = facturas.reduce((sum, f) => sum + (f.total || 0), 0);
  const promedioCompra = totalGastado / totalFacturas;
  const ultimaCompra = facturas[0]?.fecha;
  
  container.innerHTML = `
    <!-- Información del Cliente -->
    <div class="card mb-4">
      <div class="card-body">
        <div class="row">
          <div class="col-md-8">
            <h5 class="card-title mb-1">
              <i class="bi bi-person-circle text-primary"></i>
              ${clienteInfo.nombre}
            </h5>
            <p class="text-muted mb-1">ID: ${clienteInfo.id}</p>
            ${clienteInfo.telefono !== 'N/A' ? `<p class="text-muted mb-1"><i class="bi bi-telephone"></i> ${clienteInfo.telefono}</p>` : ''}
            ${clienteInfo.direccion !== 'N/A' ? `<p class="text-muted mb-0"><i class="bi bi-geo-alt"></i> ${clienteInfo.direccion}</p>` : ''}
          </div>
          <div class="col-md-4 text-end">
            <div class="badge bg-primary fs-6 px-3 py-2">
              ${totalFacturas} Compra${totalFacturas !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Estadísticas -->
    <div class="row mb-4">
      <div class="col-md-3 col-6 mb-3">
        <div class="card bg-light">
          <div class="card-body text-center">
            <h6 class="card-title text-muted mb-1">Total Gastado</h6>
            <h4 class="text-success mb-0">${formatCurrency(totalGastado)}</h4>
          </div>
        </div>
      </div>
      <div class="col-md-3 col-6 mb-3">
        <div class="card bg-light">
          <div class="card-body text-center">
            <h6 class="card-title text-muted mb-1">Promedio</h6>
            <h4 class="text-info mb-0">${formatCurrency(promedioCompra)}</h4>
          </div>
        </div>
      </div>
      <div class="col-md-3 col-6 mb-3">
        <div class="card bg-light">
          <div class="card-body text-center">
            <h6 class="card-title text-muted mb-1">Facturas</h6>
            <h4 class="text-primary mb-0">${totalFacturas}</h4>
          </div>
        </div>
      </div>
      <div class="col-md-3 col-6 mb-3">
        <div class="card bg-light">
          <div class="card-body text-center">
            <h6 class="card-title text-muted mb-1">Última Compra</h6>
            <small class="text-muted">${ultimaCompra ? formatDate(ultimaCompra) : 'N/A'}</small>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Lista de Facturas -->
    <div class="card">
      <div class="card-header">
        <h6 class="mb-0">
          <i class="bi bi-receipt"></i>
          Historial de Facturas
        </h6>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Factura</th>
                <th>Fecha</th>
                <th>Productos</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${facturas.map(factura => `
                <tr>
                  <td>
                    <strong>#${factura.id?.slice(-8) || 'N/A'}</strong>
                  </td>
                  <td>
                    <small>${formatDateTime(factura.fecha)}</small>
                  </td>
                  <td>
                    <small>${(factura.productos || []).length} item${(factura.productos || []).length !== 1 ? 's' : ''}</small>
                  </td>
                  <td>
                    <strong class="text-success">${formatCurrency(factura.total || 0)}</strong>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="previewFactura('${factura.id}')">
                      <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success" onclick="descargarFactura('${factura.id}')">
                      <i class="bi bi-download"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Productos más comprados -->
    ${renderProductosMasComprados(facturas)}
  `;
}

// Renderizar productos más comprados
function renderProductosMasComprados(facturas) {
  const productosCount = {};
  
  facturas.forEach(factura => {
    if (factura.productos) {
      factura.productos.forEach(producto => {
        const nombre = producto.producto || producto.nombre || 'Producto';
        const cantidad = producto.cantidad || 1;
        
        if (productosCount[nombre]) {
          productosCount[nombre] += cantidad;
        } else {
          productosCount[nombre] = cantidad;
        }
      });
    }
  });
  
  const productosOrdenados = Object.entries(productosCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  if (productosOrdenados.length === 0) {
    return '';
  }
  
  return `
    <div class="card mt-4">
      <div class="card-header">
        <h6 class="mb-0">
          <i class="bi bi-star"></i>
          Productos Más Comprados
        </h6>
      </div>
      <div class="card-body">
        <div class="row">
          ${productosOrdenados.map(([producto, cantidad], index) => `
            <div class="col-md-6 col-12 mb-2">
              <div class="d-flex align-items-center">
                <span class="badge bg-secondary me-2">${index + 1}</span>
                <div class="flex-grow-1">
                  <small class="fw-bold">${producto}</small>
                  <br>
                  <small class="text-muted">${cantidad} unidad${cantidad !== 1 ? 'es' : ''}</small>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Inicializar verificación de QR al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  // Verificar si se accede por QR después de que se carguen los datos
  setTimeout(() => {
    verificarAccesoHistorialQR();
  }, 1000);
});

// === FIN FUNCIONES HISTORIAL QR ===