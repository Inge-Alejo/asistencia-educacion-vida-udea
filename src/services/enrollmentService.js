// Servicio de Carga, Detección y Normalización de Listas de Inscritos (Excel / CSV)
// Diseñado para la Facultad de Medicina - Universidad de Antioquia
import * as XLSX from 'xlsx';

/**
 * Normaliza un número de documento para comparación infalible:
 * - Elimina puntos, comas, guiones, espacios en blanco, barras y caracteres especiales.
 * - Tolera documentos alfanuméricos con letras y números (ej: A77610967, pasaportes o identificaciones extranjeras).
 * - Convierte a mayúsculas para unificar comparaciones.
 * - Limpia espacios iniciales/finales (ej: " 1017255152 " -> "1017255152").
 */
export function normalizeDocumentId(rawDoc) {
  if (rawDoc === null || rawDoc === undefined) return '';
  return String(rawDoc)
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

/**
 * Limpia un texto de celda para comparación flexible
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
 * Determina con precisión si una columna corresponde al NÚMERO de documento y no al TIPO de documento.
 * Evita falsos positivos como "Tipo de documento" o "Tipo Documento".
 */
function isDocumentNumberHeader(headerText) {
  const clean = cleanHeaderCell(headerText);
  if (!clean) return false;

  // EXCLUIR explícitamente columnas que son sólo el tipo de documento o estado
  if (
    clean === 'tipo de documento' ||
    clean === 'tipo documento' ||
    clean === 'tipo doc' ||
    clean.startsWith('tipo de doc') ||
    clean.startsWith('tipo doc') ||
    clean.includes('tipo de identificacion') ||
    clean.includes('tipo identificacion') ||
    clean.includes('estado')
  ) {
    return false;
  }

  // Patrones específicos de NÚMERO de documento
  const specificNumberPatterns = [
    'numero de documento',
    'no. documento',
    'no.documento',
    'no documento',
    'num documento',
    'num. documento',
    'nro documento',
    'nro. documento',
    'numero documento',
    'doc. numero',
    'cedula de ciudadania',
    'cedula ciudadania',
    'cedula',
    'identificacion'
  ];

  for (const pat of specificNumberPatterns) {
    if (clean === pat || clean.includes(pat)) {
      return true;
    }
  }

  // Coincidencia exacta con "documento" o "document"
  if (clean === 'documento' || clean === 'document') {
    return true;
  }

  return false;
}

/**
 * Parser robusto de texto CSV que tolera delimitadores (; , \t),
 * campos entre comillas con saltos de línea y caracteres especiales.
 */
function parseCSVMatrix(text) {
  const sample = text.slice(0, 3000);
  const semiCount = (sample.match(/;/g) || []).length;
  const commaCount = (sample.match(/,/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  let delimiter = ';';
  if (tabCount > semiCount && tabCount > commaCount) delimiter = '\t';
  else if (commaCount > semiCount) delimiter = ',';

  const rows = [];
  let row = [''];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push('');
    } else if (char === '\r') {
      // Ignorar retornos de carro
    } else if (char === '\n' && !inQuotes) {
      rows.push(row);
      row = [''];
    } else {
      row[row.length - 1] += char;
    }
  }

  if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) {
    rows.push(row);
  }

  return rows;
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
    let rows = [];
    const isCSV = fileName.toLowerCase().endsWith('.csv') || typeof fileData === 'string';

    if (isCSV) {
      // Decodificación de texto para archivos CSV con soporte UTF-8 / Latin1
      let text = '';
      if (typeof fileData === 'string') {
        text = fileData;
      } else if (fileData instanceof File || fileData instanceof Blob) {
        text = await fileData.text();
      } else if (fileData instanceof ArrayBuffer) {
        text = new TextDecoder('utf-8').decode(fileData);
      }
      rows = parseCSVMatrix(text);
    } else {
      // Lectura binaria para hojas de cálculo Excel (.xlsx, .xls)
      let buffer;
      if (fileData instanceof ArrayBuffer) {
        buffer = fileData;
      } else if (fileData instanceof File || fileData instanceof Blob) {
        buffer = await fileData.arrayBuffer();
      } else {
        throw new Error('Formato de archivo binario no soportado.');
      }

      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('El archivo no contiene hojas de cálculo válidas.');
      }

      const sheet = workbook.Sheets[firstSheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    }

    if (!rows || rows.length === 0) {
      throw new Error('El archivo cargado está vacío o no contiene datos legibles.');
    }

    // 1. Buscar la fila donde se encuentran los encabezados y la columna del documento
    let headerRowIndex = -1;
    let docColIndex = -1;
    let detectedColumnName = '';

    for (let r = 0; r < Math.min(rows.length, 20); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;

      for (let c = 0; c < row.length; c++) {
        const cellValue = row[c];
        if (isDocumentNumberHeader(cellValue)) {
          headerRowIndex = r;
          docColIndex = c;
          detectedColumnName = String(cellValue).trim();
          break;
        }
      }
      if (docColIndex !== -1) break;
    }

    if (docColIndex === -1) {
      throw new Error(
        'No se encontró la columna de documento de identidad. Verifique que el archivo contenga una columna titulada "Número de documento", "No. Documento" o "Documento".'
      );
    }

    // 2. Extraer todos los documentos de las filas siguientes (alfanuméricos con letras y números)
    const documentsSet = new Set();
    const originalSample = [];

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length <= docColIndex) continue;

      const rawValue = row[docColIndex];
      const normalizedDoc = normalizeDocumentId(rawValue);

      // Descartar celdas vacías o cadenas de menos de 4 caracteres
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
  const isSet = inscritosList instanceof Set;
  const isArr = Array.isArray(inscritosList);

  if ((!isSet && !isArr) || (isArr && inscritosList.length === 0) || (isSet && inscritosList.size === 0)) {
    // Si no hay lista cargada para este evento, el registro es libre
    return { isEnrolled: true, hasWhitelist: false };
  }

  const normalizedInput = normalizeDocumentId(inputDoc);
  if (!normalizedInput) {
    return { isEnrolled: false, hasWhitelist: true };
  }

  const found = isSet ? inscritosList.has(normalizedInput) : inscritosList.includes(normalizedInput);
  return { isEnrolled: found, hasWhitelist: true };
}

