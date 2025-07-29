// js/historial-cliente.js
import { db } from './config/firebase.js';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

class HistorialCliente {
    constructor() {
        this.clienteId = null;
        this.facturas = [];
        this.clienteInfo = null;
        this.init();
    }

    init() {
        // Obtener el clienteId de los query parameters
        const urlParams = new URLSearchParams(window.location.search);
        this.clienteId = urlParams.get('clienteId');

        if (!this.clienteId) {
            this.mostrarError('No se especificó un ID de cliente válido.');
            return;
        }

        console.log('Cargando historial para cliente:', this.clienteId);
        this.cargarHistorial();
    }

    async cargarHistorial() {
        try {
            // Mostrar loading
            this.mostrarLoading(true);

            // Cargar información del cliente y sus facturas en paralelo
            const [clienteInfo, facturas] = await Promise.all([
                this.obtenerInfoCliente(),
                this.obtenerFacturasCliente()
            ]);

            this.clienteInfo = clienteInfo;
            this.facturas = facturas;

            // Ocultar loading
            this.mostrarLoading(false);

            // Mostrar información del cliente
            this.mostrarInfoCliente();

            // Verificar si tiene facturas
            if (this.facturas.length === 0) {
                this.mostrarSinHistorial();
                return;
            }

            // Mostrar estadísticas y historial
            this.mostrarEstadisticas();
            this.mostrarHistorial();

        } catch (error) {
            console.error('Error al cargar historial:', error);
            this.mostrarLoading(false);
            this.mostrarError('Error al cargar el historial del cliente.');
        }
    }

    async obtenerInfoCliente() {
        try {
            const clienteDoc = await getDoc(doc(db, 'clientes', this.clienteId));
            
            if (clienteDoc.exists()) {
                return {
                    id: clienteDoc.id,
                    ...clienteDoc.data()
                };
            } else {
                // Si no existe en la colección clientes, buscar en las facturas
                const facturasQuery = query(
                    collection(db, 'facturas'),
                    where('clienteId', '==', this.clienteId),
                    orderBy('fecha', 'desc')
                );
                
                const facturasSnapshot = await getDocs(facturasQuery);
                
                if (!facturasSnapshot.empty) {
                    const primeraFactura = facturasSnapshot.docs[0].data();
                    return {
                        id: this.clienteId,
                        nombre: primeraFactura.clienteNombre || 'Cliente General',
                        telefono: primeraFactura.clienteTelefono || 'N/A',
                        direccion: primeraFactura.clienteDireccion || 'N/A'
                    };
                }
                
                return {
                    id: this.clienteId,
                    nombre: 'Cliente General',
                    telefono: 'N/A',
                    direccion: 'N/A'
                };
            }
        } catch (error) {
            console.error('Error al obtener info del cliente:', error);
            return {
                id: this.clienteId,
                nombre: 'Cliente General',
                telefono: 'N/A',
                direccion: 'N/A'
            };
        }
    }

    async obtenerFacturasCliente() {
        try {
            const facturasQuery = query(
                collection(db, 'facturas'),
                where('clienteId', '==', this.clienteId),
                orderBy('fecha', 'desc')
            );

            const snapshot = await getDocs(facturasQuery);
            const facturas = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                facturas.push({
                    id: doc.id,
                    ...data,
                    fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
                });
            });

            return facturas;
        } catch (error) {
            console.error('Error al obtener facturas:', error);
            throw error;
        }
    }

    mostrarInfoCliente() {
        const clienteInfoElement = document.getElementById('clienteInfo');
        
        if (this.clienteInfo) {
            clienteInfoElement.innerHTML = `
                <strong>${this.clienteInfo.nombre}</strong><br>
                <small>ID: ${this.clienteInfo.id}</small>
                ${this.clienteInfo.telefono !== 'N/A' ? `<br><small>Tel: ${this.clienteInfo.telefono}</small>` : ''}
            `;
        } else {
            clienteInfoElement.textContent = `Cliente ID: ${this.clienteId}`;
        }
    }

    mostrarEstadisticas() {
        const estadisticasElement = document.getElementById('estadisticas');
        
        if (this.facturas.length === 0) {
            estadisticasElement.style.display = 'none';
            return;
        }

        // Calcular estadísticas
        const totalFacturas = this.facturas.length;
        const totalGastado = this.facturas.reduce((sum, factura) => sum + (factura.total || 0), 0);
        const promedioCompra = totalGastado / totalFacturas;
        const ultimaCompra = this.facturas[0]?.fecha;

        // Mostrar estadísticas
        document.getElementById('totalFacturas').textContent = totalFacturas;
        document.getElementById('totalGastado').textContent = this.formatearPrecio(totalGastado);
        document.getElementById('promedioCompra').textContent = this.formatearPrecio(promedioCompra);
        document.getElementById('ultimaCompra').textContent = ultimaCompra ? 
            this.formatearFecha(ultimaCompra) : 'N/A';

        estadisticasElement.style.display = 'block';
    }

    mostrarHistorial() {
        const historialElement = document.getElementById('historial');
        historialElement.innerHTML = '';

        this.facturas.forEach(factura => {
            const facturaElement = this.crearElementoFactura(factura);
            historialElement.appendChild(facturaElement);
        });
    }

    crearElementoFactura(factura) {
        const facturaDiv = document.createElement('div');
        facturaDiv.className = 'factura';

        const fecha = this.formatearFecha(factura.fecha);
        const total = this.formatearPrecio(factura.total || 0);

        facturaDiv.innerHTML = `
            <div class="factura-header">
                <div>
                    <div class="factura-numero">Factura #${factura.numeroFactura || factura.id}</div>
                    <div class="factura-fecha">${fecha}</div>
                </div>
                <div class="factura-total">${total}</div>
            </div>
            
            <div class="productos-lista">
                ${this.crearListaProductos(factura.productos || [])}
            </div>
        `;

        return facturaDiv;
    }

    crearListaProductos(productos) {
        if (!productos || productos.length === 0) {
            return '<div class="producto-item"><span>No hay productos registrados</span></div>';
        }

        return productos.map(producto => `
            <div class="producto-item">
                <span class="producto-nombre">${producto.nombre || 'Producto'}</span>
                <span class="producto-cantidad">x${producto.cantidad || 1}</span>
                <span class="producto-precio">${this.formatearPrecio(producto.precio || 0)}</span>
            </div>
        `).join('');
    }

    mostrarLoading(mostrar) {
        const loadingElement = document.getElementById('loading');
        loadingElement.style.display = mostrar ? 'block' : 'none';
    }

    mostrarError(mensaje) {
        const errorElement = document.getElementById('error');
        const errorMessageElement = document.getElementById('errorMessage');
        
        errorMessageElement.textContent = mensaje;
        errorElement.style.display = 'block';
        
        // Ocultar otros elementos
        this.mostrarLoading(false);
        document.getElementById('estadisticas').style.display = 'none';
        document.getElementById('noHistorial').style.display = 'none';
    }

    mostrarSinHistorial() {
        const noHistorialElement = document.getElementById('noHistorial');
        noHistorialElement.style.display = 'block';
        
        // Ocultar otros elementos
        document.getElementById('estadisticas').style.display = 'none';
        document.getElementById('error').style.display = 'none';
    }

    formatearPrecio(precio) {
        if (typeof precio !== 'number' || isNaN(precio)) {
            precio = 0;
        }
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(precio);
    }

    formatearFecha(fecha) {
        if (!fecha) return 'Fecha no disponible';
        
        try {
            const fechaObj = fecha instanceof Date ? fecha : new Date(fecha);
            return fechaObj.toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            console.error('Error al formatear fecha:', error);
            return 'Fecha inválida';
        }
    }
}

// Inicializar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    new HistorialCliente();
});

// Exportar para uso en otros módulos si es necesario
export default HistorialCliente;