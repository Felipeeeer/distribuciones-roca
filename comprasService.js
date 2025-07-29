// Servicio de Compras
// Aquí irá la lógica de acceso a datos para compras (Firebase)

import { db } from "../config/firebase.js";
import { ref, onValue, push, update, remove } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

export function cargarCompras(callback, errorCallback) {
  const comprasRef = ref(db, 'compras');
  onValue(comprasRef, (snapshot) => {
    let compras = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        compras.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
      compras.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    }
    if (callback) callback(compras);
  }, (error) => {
    if (errorCallback) errorCallback(error);
  });
}

export async function guardarCompra(compraData, compraId = null) {
  if (compraId) {
    // Editar compra existente
    const compraRef = ref(db, `compras/${compraId}`);
    await update(compraRef, compraData);
  } else {
    // Nueva compra
    const comprasRef = ref(db, 'compras');
    await push(comprasRef, compraData);
  }
}

export async function eliminarCompra(id) {
  await remove(ref(db, `compras/${id}`));
}

export async function actualizarProductoPorCompra(producto, cantidadComprada, nuevoPrecio) {
  try {
    const stockActual = producto.stockCanastas || 0;
    const nuevoStock = stockActual + cantidadComprada;
    const updateData = {
      stockCanastas: nuevoStock,
      stock: nuevoStock * (producto.unidadesPorTipo || 30),
      precioCompra: nuevoPrecio,
      valorTotal: nuevoStock * nuevoPrecio,
      fechaActualizacion: new Date().toISOString(),
    };
    const productoRef = ref(db, `productos/${producto.id}`);
    await update(productoRef, updateData);
  } catch (error) {
    throw error;
  }
} 