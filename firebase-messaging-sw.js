// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

// Configuración de Firebase (usa tus credenciales reales)
firebase.initializeApp({
    apiKey: "AIzaSyCsJ7UaZdEJJ_akmYbxvBv_7QVP2slU-0Y",
    authDomain: "distribuciones-roca.firebaseapp.com",
    projectId: "distribuciones-roca",
    storageBucket: "distribuciones-roca.appspot.com",
    messagingSenderId: "788736919409",
    appId: "1:788736919409:web:667e55aab9ac195d3798d0"
});

const messaging = firebase.messaging();

// Mostrar notificación cuando llegue en background
messaging.onBackgroundMessage(function(payload) {
  console.log('[FCM SW] Mensaje recibido en background:', payload);
  const notificationTitle = payload.notification.title || 'Notificación';
  const notificationOptions = {
    body: payload.notification.body || '',
    icon: '/assets/images/logo-192x192.png',
    data: payload.data || {}
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
}); 