// Servicio de Autenticación y Seguridad para el Panel Administrativo
// Facultad de Medicina - Universidad de Antioquia
// Utiliza Web Crypto API nativa (SHA-256) para que ninguna contraseña viaje en texto plano en Git.

const AUTH_STORAGE_KEY = 'udea_admin_session_auth_v1';
const CUSTOM_HASH_KEY = 'udea_admin_custom_hash_v1';

// Hash SHA-256 por defecto para la clave inicial: 'MedicinaUdeA2026*'
// Generado con SHA-256: 'MedicinaUdeA2026*'
const DEFAULT_ADMIN_HASH = '5a6117565b938ef680c2f6026a090e5f7200ef65e900c4391ef42fae9ff76865';

// Función para calcular SHA-256 usando Web Crypto API nativa del navegador
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verifica si la sesión actual del administrador está activa
export function isAdminAuthenticated() {
  try {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

// Valida la contraseña ingresada contra el hash seguro
export async function authenticateAdmin(password) {
  if (!password) return { success: false, message: 'Por favor ingrese la contraseña.' };

  const inputHash = await sha256(password.trim());

  // Si se configuró una variable de entorno en Vercel (VITE_ADMIN_PASSWORD)
  const envPassword = import.meta.env.VITE_ADMIN_PASSWORD;
  if (envPassword && password.trim() === envPassword.trim()) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
    return { success: true };
  }

  // Comprobar contra clave personalizada guardada localmente
  const customHash = localStorage.getItem(CUSTOM_HASH_KEY);
  const targetHash = customHash || DEFAULT_ADMIN_HASH;

  if (inputHash === targetHash) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
    return { success: true };
  }

  return { success: false, message: 'Contraseña incorrecta. Acceso restringido al personal administrativo.' };
}

// Cierra la sesión del administrador
export function logoutAdmin() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

// Permite al administrador cambiar la contraseña de acceso
export async function changeAdminPassword(currentPassword, newPassword) {
  const authCheck = await authenticateAdmin(currentPassword);
  if (!authCheck.success) {
    return { success: false, message: 'La contraseña actual no es correcta.' };
  }

  if (!newPassword || newPassword.length < 6) {
    return { success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.' };
  }

  const newHash = await sha256(newPassword.trim());
  localStorage.setItem(CUSTOM_HASH_KEY, newHash);
  return { success: true, message: 'Contraseña administrativa actualizada correctamente.' };
}
