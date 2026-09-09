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
