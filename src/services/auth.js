// Servicio de Autenticación y Seguridad para el Panel Administrativo
// Facultad de Medicina - Universidad de Antioquia
// Utiliza Web Crypto API nativa (SHA-256) y protección contra ataques de fuerza bruta.

const AUTH_STORAGE_KEY = 'udea_admin_session_auth_v1';
const CUSTOM_HASH_KEY = 'udea_admin_custom_hash_v1';
const ATTEMPTS_STORAGE_KEY = 'udea_auth_failed_attempts_v1';
const LOCKOUT_STORAGE_KEY = 'udea_auth_lockout_until_v1';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 segundos de bloqueo tras 5 intentos erróneos

// Hashes criptográficos SHA-256 de contraseñas institucionales pre-autorizadas.
// Las claves no se almacenan ni viajan en texto plano.
const AUTHORIZED_DEFAULT_HASHES = [
  '0eb2c22ad273170ac289d7c07387cd46fbba73ec5faeb427efea6e8635f7ea08',
  '71728d69b3c66c223cf772d6a54aaa61806bc7be46f3d6831798bf878b1c8a3d',
  '2c6788c8b11fe826f18c48a868619f822dc33b6821011961d259c3140dedd008',
  '60e5eb06b7a141514188b9c0ac999c1edb7b0fc6fab051623e041467548427d7',
  '71882182ed4b07d998c5e9ebcfbb3918b88aaf67c44fd3127b47faa52be7aada'
];

// Función para calcular SHA-256 usando Web Crypto API nativa del navegador
export async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verifica si el acceso está temporalmente bloqueado por exceso de intentos
export function getLockoutRemainingSeconds() {
  try {
    const lockoutUntil = parseInt(sessionStorage.getItem(LOCKOUT_STORAGE_KEY) || '0', 10);
    const now = Date.now();
    if (lockoutUntil > now) {
      return Math.ceil((lockoutUntil - now) / 1000);
    }
    return 0;
  } catch (e) {
    return 0;
  }
}

// Registra un intento fallido y activa bloqueo si se supera el umbral
function registerFailedAttempt() {
  try {
    const current = parseInt(sessionStorage.getItem(ATTEMPTS_STORAGE_KEY) || '0', 10) + 1;
    sessionStorage.setItem(ATTEMPTS_STORAGE_KEY, String(current));

    if (current >= MAX_FAILED_ATTEMPTS) {
      const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      sessionStorage.setItem(LOCKOUT_STORAGE_KEY, String(lockoutUntil));
      return LOCKOUT_DURATION_MS / 1000;
    }
    return 0;
  } catch (e) {
    return 0;
  }
}

// Limpia los intentos fallidos tras un acceso exitoso
function resetFailedAttempts() {
  try {
    sessionStorage.removeItem(ATTEMPTS_STORAGE_KEY);
    sessionStorage.removeItem(LOCKOUT_STORAGE_KEY);
  } catch (e) {}
}

// Verifica si la sesión actual del administrador está activa
export function isAdminAuthenticated() {
  try {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

// Valida la contraseña ingresada contra los hashes seguros con rate limiting
export async function authenticateAdmin(password) {
  const remainingLockout = getLockoutRemainingSeconds();
  if (remainingLockout > 0) {
    return {
      success: false,
      message: `Acceso bloqueado por seguridad tras múltiples intentos errados. Espere ${remainingLockout} segundos.`,
      lockoutSeconds: remainingLockout
    };
  }

  if (!password) {
    return { success: false, message: 'Por favor ingrese la contraseña de administración.' };
  }

  const trimmed = password.trim();
  const inputHash = await sha256(trimmed);

  // Comprobar contra hash seguro opcional en variable de entorno (VITE_ADMIN_HASH)
  const envHash = import.meta.env.VITE_ADMIN_HASH;
  if (envHash && inputHash === envHash.trim()) {
    resetFailedAttempts();
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
    return { success: true };
  }

  // Comprobar contra clave personalizada guardada localmente por el usuario
  const customHash = localStorage.getItem(CUSTOM_HASH_KEY);
  if (customHash) {
    if (inputHash === customHash) {
      resetFailedAttempts();
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
      return { success: true };
    }
  } else {
    // Si no ha configurado una personalizada, validar contra las iniciales autorizadas
    if (AUTHORIZED_DEFAULT_HASHES.includes(inputHash)) {
      resetFailedAttempts();
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
      return { success: true };
    }
  }

  // Registrar intento fallido
  const lockoutSeconds = registerFailedAttempt();
  const attempts = parseInt(sessionStorage.getItem(ATTEMPTS_STORAGE_KEY) || '1', 10);
  const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - attempts);

  if (lockoutSeconds > 0) {
    return {
      success: false,
      message: `Límite de intentos alcanzado. El acceso ha sido bloqueado temporalmente por ${lockoutSeconds} segundos.`,
      lockoutSeconds
    };
  }

  return {
    success: false,
    message: `Contraseña incorrecta. Acceso restringido (${remainingAttempts} intento(s) restante(s)).`
  };
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

  if (!newPassword || newPassword.length < 8) {
    return { success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres.' };
  }

  const newHash = await sha256(newPassword.trim());
  localStorage.setItem(CUSTOM_HASH_KEY, newHash);
  return { success: true, message: 'Contraseña administrativa actualizada correctamente.' };
}
