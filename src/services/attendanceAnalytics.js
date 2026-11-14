// Servicio de Analítica de Asistencia por Días y Consolidación de Asistentes Únicos
// Facultad de Medicina - Universidad de Antioquia
// Soporta eventos de 1 solo día, multidía (2, 3, 5, ... N días) y detección dinámica de fechas.
// Cruce relacional inteligente con el listado oficial de inscritos (3_Inscritos_Oficiales) por documento.

import { normalizeDocumentId } from './enrollmentService.js';
import { getEventInscritosData } from './storage.js';

/**
 * Extrae la fecha en formato ISO YYYY-MM-DD de un registro de asistencia,
 * tolerando cualquier formato previo (ISO, local es-CO 'D/M/YYYY, H:MM:SS', etc.)
 * @param {object} record Registro de asistencia
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export function extractRecordDate(record) {
  if (!record) return '';
  if (record.fechaDia && typeof record.fechaDia === 'string') {
    return record.fechaDia.slice(0, 10);
  }

  const reg = record.fechaRegistro;
  if (!reg) return '';
  const str = String(reg).trim();

  // Caso 1: Formato ISO YYYY-MM-DD...
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }

  // Caso 2: Formato local latinoamericano D/M/YYYY o DD/MM/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Caso 3: Fallback usando objeto Date nativo
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return str.slice(0, 10);
}

/**
 * Analiza un evento y sus registros de asistencia para desglosar la participación por días,
 * enriquecer los datos de los asistentes desde la lista oficial de inscritos (cruzando por cédula)
 * y generar la lista consolidada de personas únicas sin duplicados.
 *
 * @param {object} evento Objeto del evento académico
 * @param {Array} asistencias Lista de registros de asistencia del evento
 * @param {object|null} customInscritosData Objeto opcional con datos de inscritos precargados
 * @returns {{
 *   eventDays: Array<{ fecha: string, label: string, numero: number, totalAsistentes: number }>,
 *   totalEventDays: number,
 *   uniquePersons: Array<object>,
 *   totalUniquePersons: number,
 *   countsByDay: Record<string, number>,
 *   isMultidia: boolean,
 *   enrollmentStats: {
 *     hasInscritos: boolean,
 *     totalInscritos: number,
 *     inscritosQueAsistieron: number,
 *     inscritosAusentes: number,
 *     noInscritosQueAsistieron: number,
 *     tasaAsistenciaInscritos: number,
 *     participantsDict: Record<string, object>,
 *     inscritosDataObj: object|null
 *   }
 * }}
 */
export function analyzeEventDaysAndAttendance(evento = {}, asistencias = [], customInscritosData = null) {
  const safeEvento = evento || {};
  const safeAsistencias = Array.isArray(asistencias) ? asistencias : [];
  const daysMap = new Map(); // fecha -> { fecha, label, numero }

  // 1. Obtener y preparar datos de la lista oficial de inscritos (fuente de verdad oficial)
  const inscritosDataObj = customInscritosData || safeEvento?.inscritosData || (safeEvento?.id ? getEventInscritosData(safeEvento.id) : null);
  const participantsDict = (inscritosDataObj && typeof inscritosDataObj.participants === 'object' && inscritosDataObj.participants !== null)
    ? inscritosDataObj.participants
    : {};
  const hasInscritos = Boolean(inscritosDataObj && Array.isArray(inscritosDataObj.documents) && inscritosDataObj.documents.length > 0);
  const totalInscritos = hasInscritos ? inscritosDataObj.documents.length : 0;

  // 2. Extraer los días planificados en la configuración del evento
  if (safeEvento?.esMultidia && Array.isArray(safeEvento.diasEvento) && safeEvento.diasEvento.length > 0) {
    safeEvento.diasEvento.forEach((dStr, idx) => {
      const cleanDate = String(dStr).slice(0, 10);
      daysMap.set(cleanDate, {
        fecha: cleanDate,
        label: `Día ${idx + 1}`,
        numero: idx + 1
      });
    });
  } else if (safeEvento?.esMultidia && safeEvento?.fechaInicio && safeEvento?.fechaFin) {
    const start = new Date(safeEvento.fechaInicio + 'T12:00:00');
    const end = new Date(safeEvento.fechaFin + 'T12:00:00');
    let cur = new Date(start);
    let dayNum = 1;
    while (cur <= end) {
      const dStr = cur.toISOString().slice(0, 10);
      daysMap.set(dStr, {
        fecha: dStr,
        label: `Día ${dayNum}`,
        numero: dayNum
      });
      cur.setDate(cur.getDate() + 1);
      dayNum++;
    }
  } else if (safeEvento?.fecha) {
    const cleanDate = String(safeEvento.fecha).slice(0, 10);
    daysMap.set(cleanDate, {
      fecha: cleanDate,
      label: 'Día 1',
      numero: 1
    });
  }

  // 3. Extraer fechas registradas en las asistencias para no omitir registros en fechas atípicas
  safeAsistencias.forEach(a => {
    const recDate = extractRecordDate(a);
    if (recDate && !daysMap.has(recDate)) {
      daysMap.set(recDate, {
        fecha: recDate,
        label: `Día ${daysMap.size + 1}`,
        numero: daysMap.size + 1
      });
    }
  });

  // Si no se pudo determinar ninguna fecha, usar fecha del día de hoy como base
  if (daysMap.size === 0) {
    const fallbackDate = new Date().toISOString().slice(0, 10);
    daysMap.set(fallbackDate, { fecha: fallbackDate, label: 'Día 1', numero: 1 });
  }

  // Ordenar días cronológicamente y asignar numeración definitiva
  const sortedDays = Array.from(daysMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  sortedDays.forEach((d, idx) => {
    d.numero = idx + 1;
    d.label = sortedDays.length > 1 ? `Día ${idx + 1}` : 'Jornada Única';
  });

  // 4. Conteo de asistencias por día
  const countsByDay = {};
  sortedDays.forEach(d => {
    countsByDay[d.fecha] = 0;
  });

  // 5. Consolidar por persona única (agrupada por documento normalizado)
  const uniquePersonsMap = new Map();

  safeAsistencias.forEach(a => {
    const docClean = normalizeDocumentId(a?.documento) || String(a?.documento || '').trim();
    if (!docClean) return;

    const recDate = extractRecordDate(a);
    if (recDate && countsByDay[recDate] !== undefined) {
      countsByDay[recDate]++;
    }

    if (!uniquePersonsMap.has(docClean)) {
      uniquePersonsMap.set(docClean, {
        documento: a.documento,
        documentoNormalizado: docClean,
        tipoDocumento: a.tipoDocumento || 'CC',
        nombreCompleto: a.nombreCompleto || 'Sin nombre',
        correo: a.correo || '',
        telefono: a.telefono || '',
        vinculacion: a.vinculacion || 'Asistente',
        placaVehiculo: a.placaVehiculo || '',
        registros: [a],
        diasAsistidosMap: recDate ? { [recDate]: a } : {},
        primerRegistro: a.fechaRegistro,
        ultimoRegistro: a.fechaRegistro,
        esPresencialAlgunaVez: Boolean(a.geolocalizacion?.esPresencial),
        habeasDataAceptado: a.habeasDataAceptado !== false
      });
    } else {
      const person = uniquePersonsMap.get(docClean);
      person.registros.push(a);
      if (recDate) {
        person.diasAsistidosMap[recDate] = a;
      }
      person.ultimoRegistro = a.fechaRegistro || person.ultimoRegistro;
      if (a.geolocalizacion?.esPresencial) {
        person.esPresencialAlgunaVez = true;
      }
      // Actualizar campos si en este registro vienen con información más completa
      if ((!person.correo || person.correo === '') && a.correo) person.correo = a.correo;
      if ((!person.telefono || person.telefono === '') && a.telefono) person.telefono = a.telefono;
      if ((!person.placaVehiculo || person.placaVehiculo === '') && a.placaVehiculo) person.placaVehiculo = a.placaVehiculo;
    }
  });

  const totalEventDays = sortedDays.length || 1;

  // 6. Generar lista procesada de personas únicas con estadísticas de asistencia
  // y enriquecimiento relacional desde la lista de inscritos oficiales
  const uniquePersons = Array.from(uniquePersonsMap.values()).map(person => {
    const distinctDaysAttended = Object.keys(person.diasAsistidosMap);
    const totalDiasAsistidos = distinctDaysAttended.length;
    const porcentajeAsistencia = Math.min(100, Math.round((totalDiasAsistidos / totalEventDays) * 100));

    // Mapeo booleano de asistencia por cada día del evento
    const asistenciaPorDia = {};
    sortedDays.forEach(d => {
      asistenciaPorDia[d.fecha] = Boolean(person.diasAsistidosMap[d.fecha]);
    });

    // Cruce inteligente por documento con la lista oficial de inscritos (3_Inscritos_Oficiales)
    const normDoc = person.documentoNormalizado;
    const inscrito = participantsDict[normDoc] || null;
    const esInscritoOficial = Boolean(inscrito);

    // Si el participante está en la lista oficial de inscritos, enriquecer sus datos oficiales
    // Priorizando la información acreditada de la universidad (evita erratas o tipografía informal en el celular)
    const nombreOficial = (inscrito?.nombreCompleto && String(inscrito.nombreCompleto).trim().length > 0)
      ? String(inscrito.nombreCompleto).trim()
      : person.nombreCompleto;

    const correoOficial = (inscrito?.correo && String(inscrito.correo).trim().length > 0)
      ? String(inscrito.correo).trim()
      : person.correo;

    const telefonoOficial = (inscrito?.telefono && String(inscrito.telefono).trim().length > 0)
      ? String(inscrito.telefono).trim()
      : person.telefono;

    const vinculacionOficial = (inscrito?.vinculacion && String(inscrito.vinculacion).trim().length > 0)
      ? String(inscrito.vinculacion).trim()
      : person.vinculacion;

    return {
      ...person,
      nombreCompleto: nombreOficial,
      correo: correoOficial,
      telefono: telefonoOficial,
      vinculacion: vinculacionOficial,
      nombreCapturadoEnAsistencia: person.nombreCompleto,
      correoCapturadoEnAsistencia: person.correo,
      esInscritoOficial,
      datosInscrito: inscrito,
      distinctDaysAttended,
      totalDiasAsistidos,
      porcentajeAsistencia,
      asistenciaPorDia
    };
  });

  // 7. Incorporar conteo final a cada día
  const eventDays = sortedDays.map(d => ({
    ...d,
    totalAsistentes: countsByDay[d.fecha] || 0
  }));

  const isMultidia = eventDays.length > 1;

  // 8. Métricas globales de convocatoria y asistencia sobre la lista oficial de inscritos
  const inscritosQueAsistieron = hasInscritos
    ? uniquePersons.filter(p => p.esInscritoOficial).length
    : 0;
  const inscritosAusentes = hasInscritos
    ? Math.max(0, totalInscritos - inscritosQueAsistieron)
    : 0;
  const noInscritosQueAsistieron = hasInscritos
    ? uniquePersons.filter(p => !p.esInscritoOficial).length
    : uniquePersons.length;
  const tasaAsistenciaInscritos = totalInscritos > 0
    ? Math.round((inscritosQueAsistieron / totalInscritos) * 100)
    : 0;

  return {
    eventDays,
    totalEventDays,
    uniquePersons,
    totalUniquePersons: uniquePersons.length,
    countsByDay,
    isMultidia,
    enrollmentStats: {
      hasInscritos,
      totalInscritos,
      inscritosQueAsistieron,
      inscritosAusentes,
      noInscritosQueAsistieron,
      tasaAsistenciaInscritos,
      participantsDict,
      inscritosDataObj
    }
  };
}
