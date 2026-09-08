// Servicio de Conexión Cloud Firestore (Firebase)
// Facultad de Medicina - Universidad de Antioquia
// Soporta sincronización multi-dispositivo en tiempo real con fallback automático a almacenamiento local.

import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDYFLei8xJPwrMHQegMS6FF2P3SYBPbx00",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "udea-medicina-eventos.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "udea-medicina-eventos",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "udea-medicina-eventos.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "983460169904",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:983460169904:web:68ed632f1bc487df3ed375"
};

// Determinar si las credenciales de Firebase fueron provistas en variables de entorno
export const isFirebaseConfigured = () => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId !== 'undefined' &&
    firebaseConfig.projectId !== ''
  );
};

let app = null;
let db = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.info('✓ Firebase Firestore inicializado exitosamente para Facultad de Medicina UdeA');
  } catch (err) {
    console.warn('Advertencia: No se pudo conectar a Firebase Firestore, operando en modo local seguro.', err);
    db = null;
  }
} else {
  // Modo local seguro por defecto mientras el usuario enlaza su proyecto de Firebase
  // console.info('Modo Local Seguro activo (configuración de Firebase pendiente en .env.local o Vercel)');
}

export {
  app,
  db,
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp
};
