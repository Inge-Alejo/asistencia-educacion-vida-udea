// Utilidades de Sanitización y Protección de Datos
// Facultad de Medicina - Universidad de Antioquia

/**
 * Enmascara un nombre completo para protección de datos personales (Habeas Data - Ley 1581/2012)
 * Ejemplo: "Laura Sofía Gómez Arango" -> "L**** S**** G**** A*****"
 */
export function maskFullName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.trim().split(/\s+/);
  return parts
    .map(word => {
      if (word.length <= 1) return word;
      return word[0] + '*'.repeat(Math.min(word.length - 1, 4));
    })
    .join(' ');
}

/**
 * Enmascara un correo electrónico para protección de datos (Habeas Data)
 * Ejemplo: "alejandro.perez@udea.edu.co" -> "a*********z@udea.edu.co"
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '***@***';
  const [user, domain] = parts;
  if (user.length <= 2) {
    return `${user[0] || '*'}***@${domain}`;
  }
  const maskedUser = user[0] + '*'.repeat(Math.min(user.length - 2, 6)) + user.slice(-1);
  return `${maskedUser}@${domain}`;
}

/**
 * Valida si dos nombres corresponden a la misma persona (coincidencia de nombres/apellidos)
 * Tolera diferencias en tildes, mayúsculas y omisión de segundo nombre.
 */
export function areNamesMatching(nameA, nameB) {
  if (!nameA || !nameB) return false;
  const clean = (str) =>
    String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const cA = clean(nameA);
  const cB = clean(nameB);
  if (cA === cB) return true;

  const wordsA = cA.split(' ').filter((w) => w.length >= 3);
  const wordsB = cB.split(' ').filter((w) => w.length >= 3);

  const common = wordsA.filter((w) => wordsB.includes(w));
  if (wordsA.length >= 2 && wordsB.length >= 2) {
    return common.length >= 2 || (common.length >= 1 && (cA.includes(cB) || cB.includes(cA)));
  }
  return common.length >= 1;
}

/**
 * Sanitiza una cadena de texto para evitar inyección de código HTML / XSS.
 * Remueve etiquetas potencialmente peligrosas y caracteres de escape.
 */
export function sanitizeText(input, maxLength = 500) {
  if (typeof input !== 'string') return '';
  
  // Limitar longitud
  let cleaned = input.slice(0, maxLength).trim();

  // Reemplazar caracteres peligrosos
  cleaned = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return cleaned;
}

/**
 * Sanitiza campos de texto para evitar Inyección de Fórmulas en Excel / CSV (CWE-1236)
 * Si el texto inicia con '=', '+', '-', '@', tabulaciones o retornos, prefija con comilla simple.
 */
export function sanitizeExcelFormula(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';

  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousPrefixes.some(prefix => str.startsWith(prefix))) {
    return `'${str}`;
  }
  return str;
}
