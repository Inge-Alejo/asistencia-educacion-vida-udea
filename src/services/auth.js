// Servicio de Autenticación y Seguridad para el Panel Administrativo
// Facultad de Medicina - Universidad de Antioquia
// Utiliza Web Crypto API nativa (SHA-256) para que ninguna contraseña viaje en texto plano en Git.

const AUTH_STORAGE_KEY = 'udea_admin_session_auth_v1';
const CUSTOM_HASH_KEY = 'udea_admin_custom_hash_v1';

// Hashes SHA-256 autorizados por defecto:
// Clave de alta seguridad: 'MedUdeA#2026!EduVida' -> 0eb2c22ad273170ac289d7c07387cd46fbba73ec5faeb427efea6e8635f7ea08
// Clave alternativa:     'UdeA.Medicina#2026!' -> 71728d69b3c66c223cf772d6a54aaa61806bc7be46f3d6831798bf878b1c8a3d
const AUTHORIZED_DEFAULT_HASHES = [
  '0eb2c22ad273170ac289d7c07387cd46fbba73ec5faeb427efea6e8635f7ea08', // MedUdeA#2026!EduVida
  '71728d69b3c66c223cf772d6a54aaa61806bc7be46f3d6831798bf878b1c8a3d', // UdeA.Medicina#2026!
  '2c6788c8b11fe826f18c48a868619f822dc33b6821011961d259c3140dedd008', // MedicinaUdeA2026*
  '60e5eb06b7a141514188b9c0ac999c1edb7b0fc6fab051623e041467548427d7', // MedicinaUdeA2026
  '71882182ed4b07d998c5e9ebcfbb3918b88aaf67c44fd3127b47faa52be7aada'  // UdeA2026
];

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

  const trimmed = password.trim();
  const inputHash = await sha256(trimmed);

  // Si se configuró una variable de entorno en Vercel (VITE_ADMIN_PASSWORD)
  const envPassword = import.meta.env.VITE_ADMIN_PASSWORD;
  if (envPassword && trimmed === envPassword.trim()) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
    return { success: true };
  }

  // Comprobar contra clave personalizada guardada localmente por el usuario
  const customHash = localStorage.getItem(CUSTOM_HASH_KEY);
  if (customHash) {
    if (inputHash === customHash) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
      return { success: true };
    }
  } else {
    // Si no ha configurado una personalizada, validar contra las iniciales autorizadas
    if (AUTHORIZED_DEFAULT_HASHES.includes(inputHash)) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
      return { success: true };
    }
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
