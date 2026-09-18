// Servicio de Conexión Cloud Firestore (Firebase)
// Facultad de Medicina - Universidad de Antioquia
// Soporta sincronización multi-dispositivo en tiempo real con fallback automático a almacenamiento local seguro.

import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';

// Configuración de conexión Cloud Firestore (Firebase) para sincronización en vivo
const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyDYFLei8xJPwrMHQegMS6FF2P3SYBPbx00",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "udea-medicina-eventos.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "udea-medicina-eventos",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "udea-medicina-eventos.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "983460169904",
  appId: env.VITE_FIREBASE_APP_ID || "1:983460169904:web:68ed632f1bc487df3ed375"
};

// Determinar si las credenciales de Firebase están activas
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

try {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.info('✓ Firebase Cloud Firestore en vivo conectado para Facultad de Medicina UdeA');
} catch (err) {
  console.error('Error al inicializar Firebase Firestore:', err);
  db = null;
}

export {
  app,
  db,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp
};
