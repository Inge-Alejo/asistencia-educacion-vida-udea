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
  let str = String(rawDoc).trim();
  // Expansión segura si el número viene en notación científica de Excel (ej: 1.037667076E+09)
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) {
    const num = Number(str);
    if (!isNaN(num) && isFinite(num)) {
      str = num.toLocaleString('fullwide', { useGrouping: false });
    }
  }
  return str
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
    .replace(/[\._\-]/g, ' ')
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

  // EXCLUIR explícitamente columnas que son sólo el tipo de documento, estado o apellidos
  if (
    clean === 'tipo de documento' ||
    clean === 'tipo documento' ||
    clean === 'tipo doc' ||
    clean.startsWith('tipo de doc') ||
    clean.startsWith('tipo doc') ||
    clean.includes('tipo de identificacion') ||
    clean.includes('tipo identificacion') ||
    clean.includes('apellido') ||
    clean.includes('apellidos') ||
    clean.includes('estado')
  ) {
    return false;
  }

  // Coincidencias exactas de identificador
  if (
    clean === 'id' ||
    clean === 'documento' ||
    clean === 'document' ||
    clean === 'cedula' ||
    clean === 'cédula' ||
    clean === 'identificacion' ||
    clean === 'dni' ||
    clean === 'cc' ||
    clean === 'c c' ||
    clean === 'rut' ||
    clean === 'pasaporte' ||
    clean === 'idnumber' ||
    clean === 'codigo' ||
    clean === 'matricula'
  ) {
    return true;
  }

  // Patrones específicos compuestos de NÚMERO / ID
  const specificPatterns = [
    'numero de id',
    'nro de id',
    'no de id',
    'numero id',
    'num id',
    'id number',
    'id usuario',
    'numero de documento',
    'no documento',
    'num documento',
    'nro documento',
    'doc numero',
    'cedula de ciudadania',
    'cedula ciudadania',
    'documento de identidad',
    'doc identidad',
    'numero de identificacion'
  ];

  for (const pat of specificPatterns) {
    if (clean === pat || clean.includes(pat)) {
      return true;
    }
  }

  // Si la celda contiene la palabra separada "id" (ej: "id asistente", pero no "apellido")
  if (/(^|\s)id(\s|$)/.test(clean) && !clean.includes('apellido')) {
    return true;
  }

  return false;
}

function isNameHeader(headerText) {
  const clean = cleanHeaderCell(headerText);
  if (!clean) return false;
  return (
    clean === 'nombre completo' ||
    clean === 'nombres y apellidos' ||
    clean === 'apellidos y nombres' ||
    clean === 'nombre' ||
    clean === 'nombres' ||
    clean === 'participante' ||
    clean === 'asistente' ||
    clean.includes('nombre completo') ||
    clean.includes('nombres y apellidos') ||
    clean.startsWith('nombre')
  );
}

function isEmailHeader(headerText) {
  const clean = cleanHeaderCell(headerText);
  if (!clean) return false;
  return (
    clean === 'correo electronico' ||
    clean === 'correo' ||
    clean === 'email' ||
    clean === 'e-mail' ||
    clean === 'correo udea' ||
    clean.includes('correo electronico') ||
    clean.includes('correo') ||
    clean.includes('email')
  );
}

function isPhoneHeader(headerText) {
  const clean = cleanHeaderCell(headerText);
  if (!clean) return false;
  return (
    clean === 'telefono' ||
    clean === 'celular' ||
    clean === 'movil' ||
    clean === 'tel' ||
    clean === 'numero de celular' ||
    clean.includes('celular') ||
    clean.includes('telefono') ||
    clean.includes('movil')
  );
}

function isVinculacionHeader(headerText) {
  const clean = cleanHeaderCell(headerText);
  if (!clean) return false;
  return (
    clean === 'vinculacion' ||
    clean === 'rol' ||
    clean === 'estamento' ||
    clean === 'tipo de vinculacion' ||
    clean === 'dependencia' ||
    clean.includes('vinculacion') ||
    clean.includes('estamento') ||
    clean.includes('rol')
  );
}

function isTipoDocHeader(headerText) {
  const clean = cleanHeaderCell(headerText);
  if (!clean) return false;
  return (
    clean === 'tipo de documento' ||
    clean === 'tipo documento' ||
    clean === 'tipo doc' ||
    clean.includes('tipo de doc') ||
    clean.includes('tipo doc')
  );
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
 * Analiza un archivo de Excel (.xlsx, .xls) o CSV (.csv) y extrae los participantes e inscritos.
 * Detecta dinámicamente columnas de documento, nombre, correo, teléfono y vinculación.
 * @param {File | ArrayBuffer | string} fileData
 * @param {string} fileName
 * @returns {Promise<{ success: boolean, count: number, documents: string[], participants: object, fileName: string, detectedColumn: string, sample: string[], message?: string }>}
 */
export async function parseEnrollmentFile(fileData, fileName = 'Inscritos.xlsx') {
  try {
    const isCSV = fileName.toLowerCase().endsWith('.csv') || typeof fileData === 'string';
    const sheetDataList = [];

    if (isCSV) {
      // Decodificación de texto para archivos CSV con soporte UTF-8 / Latin1
      let text = '';
      if (typeof fileData === 'string') {
        text = fileData;
      } else if (fileData instanceof File || fileData instanceof Blob) {
        text = await fileData.text();
      } else if (fileData instanceof ArrayBuffer) {
        text = new TextDecoder('utf-8').decode(fileData);
      } else if (fileData && typeof fileData === 'object' && ('buffer' in fileData || 'byteLength' in fileData)) {
        text = new TextDecoder('utf-8').decode(fileData);
      }
      const csvRows = parseCSVMatrix(text);
      if (csvRows && csvRows.length > 0) {
        sheetDataList.push({ name: 'CSV', rows: csvRows });
      }
    } else {
      // Lectura binaria universal para hojas de cálculo Excel (.xlsx, .xls)
      let buffer;
      if (fileData instanceof ArrayBuffer) {
        buffer = fileData;
      } else if (fileData instanceof File || fileData instanceof Blob) {
        buffer = await fileData.arrayBuffer();
      } else if (fileData && typeof fileData === 'object' && ('buffer' in fileData || 'byteLength' in fileData)) {
        buffer = fileData.buffer ? fileData.buffer.slice(fileData.byteOffset || 0, (fileData.byteOffset || 0) + fileData.byteLength) : fileData;
      } else {
        throw new Error('Formato de archivo binario no soportado.');
      }

      const workbook = XLSX.read(buffer, { type: 'array' });
      if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('El archivo no contiene hojas de cálculo válidas.');
      }

      // Procesar todas las hojas de cálculo del libro de Excel para no perder inscritos
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const sRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (sRows && sRows.length > 0) {
          sheetDataList.push({ name: sheetName, rows: sRows });
        }
      }
    }

    if (sheetDataList.length === 0) {
      throw new Error('El archivo cargado está vacío o no contiene datos legibles.');
    }

    const documentsSet = new Set();
    const participants = {};
    const originalSample = [];
    const duplicates = [];
    const emptyOrInvalidRows = [];
    let primaryDetectedColumn = '';
    let totalDataRowsScanned = 0;

    for (const { rows } of sheetDataList) {
      // 1. Buscar la fila donde se encuentran los encabezados
      let headerRowIndex = -1;
      let docColIndex = -1;
      let nameColIndex = -1;
      let emailColIndex = -1;
      let phoneColIndex = -1;
      let vinculacionColIndex = -1;
      let tipoDocColIndex = -1;

      for (let r = 0; r < Math.min(rows.length, 50); r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;

        for (let c = 0; c < row.length; c++) {
          const cellValue = row[c];
          if (isDocumentNumberHeader(cellValue)) {
            headerRowIndex = r;
            docColIndex = c;
            if (!primaryDetectedColumn) primaryDetectedColumn = String(cellValue).trim();
            break;
          }
        }
        if (docColIndex !== -1) break;
      }

      // Si no se encontró encabezado de texto, auto-detectar columna con números de identificación
      if (docColIndex === -1 && rows.length > 0) {
        const colScores = {};
        for (let r = 0; r < Math.min(rows.length, 15); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          for (let c = 0; c < row.length; c++) {
            const clean = String(row[c] || '').replace(/[^a-zA-Z0-9]/g, '');
            if (/^\d{5,12}$/.test(clean)) {
              colScores[c] = (colScores[c] || 0) + 1;
            }
          }
        }
        let bestCol = -1;
        let maxScore = 0;
        for (const [col, score] of Object.entries(colScores)) {
          if (score > maxScore) {
            maxScore = score;
            bestCol = parseInt(col, 10);
          }
        }
        if (bestCol !== -1 && maxScore >= 2) {
          docColIndex = bestCol;
          headerRowIndex = -1; // Comienza desde la primera fila sin encabezados
          if (!primaryDetectedColumn) primaryDetectedColumn = `Columna ${bestCol + 1}`;
        }
      }

      if (docColIndex === -1) continue;

      // Detectar columnas auxiliares en la fila de encabezado
      if (headerRowIndex !== -1) {
        const headerRow = rows[headerRowIndex];
        for (let c = 0; c < headerRow.length; c++) {
          if (c === docColIndex) continue;
          const val = headerRow[c];
          if (nameColIndex === -1 && isNameHeader(val)) nameColIndex = c;
          else if (emailColIndex === -1 && isEmailHeader(val)) emailColIndex = c;
          else if (phoneColIndex === -1 && isPhoneHeader(val)) phoneColIndex = c;
          else if (vinculacionColIndex === -1 && isVinculacionHeader(val)) vinculacionColIndex = c;
          else if (tipoDocColIndex === -1 && isTipoDocHeader(val)) tipoDocColIndex = c;
        }
      }

      // 2. Extraer todos los documentos y participantes de las filas de datos
      for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;

        let rawValue = row.length > docColIndex ? row[docColIndex] : '';
        let normalizedDoc = normalizeDocumentId(rawValue);

        // Fallback: Si en esta fila la columna principal de documento está vacía, revisar columnas adyacentes
        if (!normalizedDoc) {
          for (let c = 0; c < Math.min(row.length, 6); c++) {
            if (c !== docColIndex) {
              const candidate = normalizeDocumentId(row[c]);
              if (/^\d{6,12}$/.test(candidate)) {
                normalizedDoc = candidate;
                rawValue = row[c];
                break;
              }
            }
          }
        }

        // Aceptar cualquier documento con al menos 2 caracteres alfanuméricos
        if (normalizedDoc && normalizedDoc.length >= 2) {
          totalDataRowsScanned++;
          if (!documentsSet.has(normalizedDoc)) {
            documentsSet.add(normalizedDoc);

            const nombreCompleto = nameColIndex !== -1 && row[nameColIndex] ? String(row[nameColIndex]).trim() : '';
            const correo = emailColIndex !== -1 && row[emailColIndex] ? String(row[emailColIndex]).trim().toLowerCase() : '';
            const telefono = phoneColIndex !== -1 && row[phoneColIndex] ? String(row[phoneColIndex]).trim() : '';
            const vinculacion = vinculacionColIndex !== -1 && row[vinculacionColIndex] ? String(row[vinculacionColIndex]).trim() : 'Asistente';
            const tipoDocRaw = tipoDocColIndex !== -1 && row[tipoDocColIndex] ? String(row[tipoDocColIndex]).trim().toUpperCase() : 'CC';
            const tipoDocumento = ['CC', 'TI', 'CE', 'PASAPORTE', 'PEP', 'PPT'].includes(tipoDocRaw) ? tipoDocRaw : 'CC';

            participants[normalizedDoc] = {
              documento: normalizedDoc,
              documentoOriginal: String(rawValue).trim(),
              tipoDocumento,
              nombreCompleto,
              correo,
              telefono,
              vinculacion
            };

            if (originalSample.length < 8) {
              originalSample.push(normalizedDoc);
            }
          } else {
            duplicates.push({
              fila: r + 1,
              documento: normalizedDoc
            });
          }
        } else {
          const hasAnyContent = row.some(cell => String(cell || '').trim() !== '');
          if (hasAnyContent) {
            emptyOrInvalidRows.push({
              fila: r + 1,
              valor: rawValue
            });
          }
        }
      }
    }

    const documents = Array.from(documentsSet);

    if (documents.length === 0) {
      throw new Error(
        'No se encontraron registros de documentos válidos en el archivo. Verifique que contenga una columna con números de identificación o cédula.'
      );
    }

    return {
      success: true,
      count: documents.length,
      documents,
      participants,
      fileName,
      detectedColumn: primaryDetectedColumn,
      sample: originalSample,
      totalRowsScanned: totalDataRowsScanned,
      duplicatesCount: duplicates.length,
      duplicates,
      emptyOrInvalidRowsCount: emptyOrInvalidRows.length
    };
  } catch (err) {
    console.error('Error al analizar archivo de inscritos:', err);
    return {
      success: false,
      count: 0,
      documents: [],
      participants: {},
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

