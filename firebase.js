/**
 * 🔥 Firebase Configuration - Distribuciones ROCA
 * Configuración simplificada y estable sin duplicaciones
 */

// Import Firebase SDK modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging.js";

// 🔧 Configuración de Firebase - USAR TUS CREDENCIALES REALES
const firebaseConfig = {
  apiKey: "AIzaSyCsJ7UaZdEJJ_akmYbxvBv_7QVP2slU-0Y",
  authDomain: "distribuciones-roca.firebaseapp.com",
  projectId: "distribuciones-roca",
  storageBucket: "distribuciones-roca.appspot.com",
  messagingSenderId: "788736919409",
  appId: "1:788736919409:web:667e55aab9ac195d3798d0",
  measurementId: "G-XCY6HZLCC0",
  databaseURL: "https://distribuciones-roca-default-rtdb.firebaseio.com"
};

// Environment detection
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.port !== '';

const isProduction = !isDevelopment;

// Initialize Firebase
let app, db, analytics;

try {
  // Initialize Firebase App
  app = initializeApp(firebaseConfig);


  // Initialize Realtime Database
  db = getDatabase(app);


  // Initialize Analytics (only in production and if supported)
  if (isProduction) {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
    
      }
    }).catch(error => {
      console.warn('Firebase Analytics not supported:', error);
    });
  }

} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  
  // Show user-friendly error message
  if (typeof window !== 'undefined' && window.showToast) {
    window.showToast('Error de configuración Firebase', 'error');
  }
  
  // Create fallback objects to prevent app crashes
  db = {
    ref: () => ({ 
      on: () => {}, 
      off: () => {}, 
      once: () => Promise.resolve({ val: () => null }),
      set: () => Promise.reject(new Error('Firebase not available')),
      update: () => Promise.reject(new Error('Firebase not available')),
      remove: () => Promise.reject(new Error('Firebase not available'))
    })
  };
}

// --- INTEGRACIÓN FCM ---
let messaging = null;
export async function inicializarFCM() {
  try {
    messaging = getMessaging();
    // Solicitar permiso al usuario
    const permiso = await Notification.requestPermission();
    if (permiso === 'granted') {
      // Obtener token
      const token = await getToken(messaging, {
        vapidKey: 'BI58P2mYzV6Z-YjzVAsvX9IlsgcNAZAlsPvYcRcMJoVb15wjp94aRoRR6q3TLI5ItTa8wqSJkjDob-wuXGbIlho'
      });
      if (token) {
        console.log('[FCM] Token de notificaciones:', token);
        // Aquí puedes guardar el token en tu backend o en Firestore si lo necesitas
      } else {
        console.warn('[FCM] No se pudo obtener el token');
      }
    } else {
      console.warn('[FCM] Permiso de notificaciones denegado');
    }
  } catch (err) {
    console.error('[FCM] Error al inicializar FCM:', err);
  }
}

// Escuchar mensajes cuando la app está en primer plano
if (typeof window !== 'undefined') {
  try {
    messaging = getMessaging();
    onMessage(messaging, (payload) => {
      console.log('[FCM] Notificación recibida en foreground:', payload);
      // Aquí puedes mostrar una notificación visual personalizada si lo deseas
    });
  } catch (err) {
    // Puede fallar si FCM no está inicializado aún
  }
}

// --- REGISTRO DEL SERVICE WORKER PARA FCM ---
export async function registrarServiceWorkerYFCM() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('[FCM] Service Worker registrado:', registration);
      // Inicializar FCM solo después de registrar el SW
      await inicializarFCM();
    } catch (err) {
      console.error('[FCM] Error al registrar el Service Worker:', err);
    }
  } else {
    console.warn('[FCM] Este navegador no soporta notificaciones push.');
  }
}

// Connection state management
class ConnectionManager {
  constructor() {
    this.isConnected = false;
    this.listeners = [];
    this.retryCount = 0;
    this.maxRetries = 3;
    this.init();
  }

  init() {
    if (db && typeof db === 'object') {
      this.setupConnectionMonitoring();
    }
  }

  setupConnectionMonitoring() {
    try {
      // Monitor Firebase connection status
      const connectedRef = ref(db, '.info/connected');
      
      onValue(connectedRef, (snapshot) => {
        const connected = snapshot.val() === true;
        this.updateConnectionStatus(connected);
      }, (error) => {
        console.warn('Connection monitoring error:', error);
        this.updateConnectionStatus(false);
      });

    } catch (error) {
      console.warn('Failed to setup connection monitoring:', error);
      this.updateConnectionStatus(true);
    }
  }

  updateConnectionStatus(isConnected) {
    const wasConnected = this.isConnected;
    this.isConnected = isConnected;

    // Update UI indicator if present
    this.updateUIStatus(isConnected);

    // Show toast on status change
    if (wasConnected !== isConnected && typeof window !== 'undefined') {
      if (isConnected) {
    
        if (window.showToast && this.retryCount > 0) {
          window.showToast('Conexión restablecida', 'success');
          this.retryCount = 0;
        }
      } else {

        if (window.showToast) {
          window.showToast('Verificando conexión...', 'warning');
        }
        this.handleDisconnection();
      }
    }

    // Notify listeners
    this.listeners.forEach(callback => {
      try {
        callback(isConnected);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  updateUIStatus(isConnected) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
      statusElement.className = `connection-status ${isConnected ? 'connected' : 'disconnected'}`;
      statusElement.textContent = isConnected ? 'Conectado' : 'Sin conexión';
      statusElement.style.color = isConnected ? '#34c759' : '#ff3b30';
    }
  }

  handleDisconnection() {
    this.retryCount++;
    
    if (this.retryCount <= this.maxRetries) {
      setTimeout(() => {
    
      }, 1000 * this.retryCount);
    } else if (typeof window !== 'undefined' && window.showToast) {
      window.showToast('Error de conexión - Verifica tu internet', 'error');
    }
  }

  onConnectionChange(callback) {
    this.listeners.push(callback);
    callback(this.isConnected);
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

// Database helper functions for safe operations
const DatabaseHelpers = {
  /**
   * Safely write data to Firebase with error handling
   */
  async safeWrite(reference, data) {
    try {
      const { set } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js");
      await set(reference, data);
      return { success: true };
    } catch (error) {
      console.error('Database write error:', error);
      
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('Error al guardar datos', 'error');
      }
      
      return { success: false, error: error.message };
    }
  },

  /**
   * Safely read data from Firebase with error handling
   */
  async safeRead(reference) {
    try {
      const { get } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js");
      const snapshot = await get(reference);
      return { success: true, data: snapshot.val(), exists: snapshot.exists() };
    } catch (error) {
      console.error('Database read error:', error);
      
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('Error al cargar datos', 'error');
      }
      
      return { success: false, error: error.message, data: null };
    }
  },

  /**
   * Safely update data in Firebase with error handling
   */
  async safeUpdate(reference, updates) {
    try {
      const { update } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js");
      await update(reference, updates);
      return { success: true };
    } catch (error) {
      console.error('Database update error:', error);
      
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('Error al actualizar datos', 'error');
      }
      
      return { success: false, error: error.message };
    }
  },

  /**
   * Safely delete data from Firebase with error handling
   */
  async safeDelete(reference) {
    try {
      const { remove } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js");
      await remove(reference);
      return { success: true };
    } catch (error) {
      console.error('Database delete error:', error);
      
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('Error al eliminar datos', 'error');
      }
      
      return { success: false, error: error.message };
    }
  }
};

// Simple cache for frequently accessed data
const DataCache = {
  cache: new Map(),
  
  set(key, data, ttl = 300000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  },
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  },
  
  clear() {
    this.cache.clear();
  }
};

// Initialize connection manager
const connectionManager = new ConnectionManager();

// Network status monitoring
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {

    connectionManager.updateConnectionStatus(true);
  });

  window.addEventListener('offline', () => {

    connectionManager.updateConnectionStatus(false);
  });
}

// Global error handler for Firebase-related errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.code && event.reason.code.startsWith('firebase/')) {
      console.error('Unhandled Firebase error:', event.reason);
      event.preventDefault();
      
      if (window.showToast) {
        window.showToast('Error temporal - Reintentando...', 'warning');
      }
    }
  });
}

// Make available globally for legacy code compatibility
if (typeof window !== 'undefined') {
  window.firebase = {
    app,
    db,
    analytics,
    connectionManager,
    DatabaseHelpers,
    DataCache
  };
}

// Development helpers
if (isDevelopment && typeof window !== 'undefined') {
  window.firebaseDebug = {
    connectionManager,
    DatabaseHelpers,
    DataCache,
    testConnection: () => connectionManager.getConnectionStatus(),
    clearCache: () => DataCache.clear(),
    async testWrite() {
      const testRef = ref(db, 'test/connection');
      const result = await DatabaseHelpers.safeWrite(testRef, {
        timestamp: new Date().toISOString(),
        test: true
      });
  
      return result;
    }
  };
  
  
}

// Success message


// Single export statement - NO DUPLICATIONS
export { 
  app, 
  db, 
  analytics,
  connectionManager,
  DatabaseHelpers,
  DataCache,
  isDevelopment,
  isProduction
};