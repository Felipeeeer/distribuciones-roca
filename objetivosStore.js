// Fase 1: Store de Objetivos - Placeholder
// Aquí irá el estado global y cacheo de objetivos

// Fase 2: Visualización y Seguimiento
// Fase 3: Notificaciones Inteligentes
// Fase 4: Creación Inteligente de Objetivos 

const CACHE_KEY = 'objetivos_cache';

export function guardarObjetivosEnCache(objetivos) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(objetivos));
  } catch {}
}

export function obtenerObjetivosDeCache() {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
} 