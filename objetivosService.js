import { db } from '../config/firebase.js';
import { ref, push, update, remove, onValue, get } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';

const OBJETIVOS_PATH = 'objetivos';

export async function crearObjetivo(data) {
  const refObj = ref(db, OBJETIVOS_PATH);
  await push(refObj, data);
}

export async function obtenerObjetivos() {
  const refObj = ref(db, OBJETIVOS_PATH);
  const snap = await get(refObj);
  if (!snap.exists()) return [];
  const arr = [];
  snap.forEach(child => {
    arr.push({ id: child.key, ...child.val() });
  });
  // Ordenar por fecha objetivo ascendente
  arr.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  return arr;
}

export async function actualizarObjetivo(id, data) {
  const refObj = ref(db, `${OBJETIVOS_PATH}/${id}`);
  await update(refObj, data);
}

export async function eliminarObjetivo(id) {
  const refObj = ref(db, `${OBJETIVOS_PATH}/${id}`);
  await remove(refObj);
} 