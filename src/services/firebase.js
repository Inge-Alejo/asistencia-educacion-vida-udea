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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
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
