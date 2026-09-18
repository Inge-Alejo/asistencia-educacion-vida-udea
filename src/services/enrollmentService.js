// Servicio de Carga, Detección y Normalización de Listas de Inscritos (Excel / CSV)
// Diseñado para la Facultad de Medicina - Universidad de Antioquia
import * as XLSX from 'xlsx';

/**
 * Normaliza un número de documento para comparación infalible:
 * - Elimina puntos, comas, guiones, espacios en blanco, barras y caracteres especiales.
 * - Convierte a mayúsculas para tolerar pasaportes o identificaciones extranjeras (ej: A77610967).
 * - Elimina espacios internos y externos.
 * Ejemplo: " 1.053.873.161 " -> "1053873161"
 */
export function normalizeDocumentId(rawDoc) {
  if (rawDoc === null || rawDoc === undefined) return '';
  return String(rawDoc)
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

/**
 * Patrones de nombres de columna para identificar la columna del documento de identidad
 */
const DOCUMENT_HEADER_PATTERNS = [
  'numero de documento',
  'número de documento',
  'no. documento',
  'no.documento',
  'no documento',
  'num documento',
  'documento',
  'nro documento',
  'cédula',
  'cedula',
  'identificación',
  'identificacion'
];

/**
 * Limpia un texto de cabecera para búsqueda flexible
 */
function cleanHeaderCell(cellValue) {
  if (!cellValue) return '';
  return String(cellValue)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Analiza un archivo de Excel (.xlsx, .xls) o CSV (.csv) y extrae los números de documento normalizados.
 * Detecta dinámicamente en qué fila se encuentran los encabezados sin importar metadatos previos.
 * @param {File | ArrayBuffer | string} fileData
 * @param {string} fileName
 * @returns {Promise<{ success: boolean, count: number, documents: string[], fileName: string, detectedColumn: string, sample: string[], message?: string }>}
 */
export async function parseEnrollmentFile(fileData, fileName = 'Inscritos.xlsx') {
  try {
    let workbook;

    if (typeof fileData === 'string') {
      // Texto plano (por ejemplo CSV separado por ; o ,)
      workbook = XLSX.read(fileData, { type: 'string' });
    } else if (fileData instanceof ArrayBuffer) {
      workbook = XLSX.read(fileData, { type: 'array' });
    } else if (fileData instanceof File || fileData instanceof Blob) {
      const buffer = await fileData.arrayBuffer();
      workbook = XLSX.read(buffer, { type: 'array' });
    } else {
      throw new Error('Formato de archivo no soportado para lectura.');
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('El archivo no contiene hojas de cálculo válidas.');
    }

    const sheet = workbook.Sheets[firstSheetName];
    // Convertir a matriz bidimensional de celdas
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!rows || rows.length === 0) {
      throw new Error('La hoja de cálculo está vacía.');
    }

    // 1. Buscar la fila donde se encuentran los encabezados y la columna del documento
    let headerRowIndex = -1;
    let docColIndex = -1;
    let detectedColumnName = '';

    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;

      for (let c = 0; c < row.length; c++) {
        const cellText = cleanHeaderCell(row[c]);
        if (!cellText) continue;

        const isMatch = DOCUMENT_HEADER_PATTERNS.some(pattern => {
          const cleanPat = cleanHeaderCell(pattern);
          return cellText === cleanPat || cellText.includes(cleanPat);
        });

        if (isMatch) {
          headerRowIndex = r;
          docColIndex = c;
          detectedColumnName = String(row[c]).trim();
          break;
        }
      }
      if (docColIndex !== -1) break;
    }

    if (docColIndex === -1) {
      throw new Error(
        'No se encontró la columna de documento de identidad. Asegúrese de que el archivo contenga una columna llamada "Número de documento", "No. Documento" o "Documento".'
      );
    }

    // 2. Extraer todos los documentos de las filas siguientes
    const documentsSet = new Set();
    const originalSample = [];

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length <= docColIndex) continue;

      const rawValue = row[docColIndex];
      const normalizedDoc = normalizeDocumentId(rawValue);

      // Descartar celdas vacías, encabezados repetidos o cadenas de menos de 4 caracteres
      if (normalizedDoc && normalizedDoc.length >= 4) {
        if (!documentsSet.has(normalizedDoc)) {
          documentsSet.add(normalizedDoc);
          if (originalSample.length < 8) {
            originalSample.push(normalizedDoc);
          }
        }
      }
    }

    const documents = Array.from(documentsSet);

    if (documents.length === 0) {
      throw new Error('No se encontraron registros válidos de documentos en la columna detectada.');
    }

    return {
      success: true,
      count: documents.length,
      documents,
      fileName,
      detectedColumn: detectedColumnName,
      sample: originalSample
    };
  } catch (err) {
    console.error('Error al analizar archivo de inscritos:', err);
    return {
      success: false,
      count: 0,
      documents: [],
      fileName,
      detectedColumn: '',
      sample: [],
      message: err?.message || 'Error desconocido al procesar el archivo.'
    };
  }
}

/**
 * Valida si un documento de identidad se encuentra en la lista oficial de inscritos.
 * @param {string[] | null | undefined} inscritosList Array de documentos normalizados
 * @param {string} inputDoc Documento ingresado por el usuario
 * @returns {{ isEnrolled: boolean, hasWhitelist: boolean }}
 */
export function isDocumentEnrolled(inscritosList, inputDoc) {
  if (!Array.isArray(inscritosList) || inscritosList.length === 0) {
    // Si no hay lista cargada para este evento, el registro es libre
    return { isEnrolled: true, hasWhitelist: false };
  }

  const normalizedInput = normalizeDocumentId(inputDoc);
  if (!normalizedInput) {
    return { isEnrolled: false, hasWhitelist: true };
  }

  const found = inscritosList.includes(normalizedInput);
  return { isEnrolled: found, hasWhitelist: true };
}
