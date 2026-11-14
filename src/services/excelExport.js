// Servicio de Exportación a Microsoft Excel (.xlsx) y compatibilidad con Microsoft Forms
// Facultad de Medicina - Universidad de Antioquia
// Implementación 100% Modular: genera hojas según los módulos activos del evento.
// Cruce relacional por documento con la lista oficial de inscritos (3_Inscritos_Oficiales) para enriquecer datos oficiales.
// Incluye blindaje contra Inyección de Fórmulas CSV/Excel (CWE-1236).

import * as XLSX from 'xlsx';
import { sanitizeExcelFormula } from './sanitizer.js';
import { getEventConfig, getEventInscritosData, getEventPolls } from './storage.js';
import { analyzeEventDaysAndAttendance, extractRecordDate } from './attendanceAnalytics.js';
import { normalizeDocumentId } from './enrollmentService.js';

export function exportEventDataToExcel({
  evento = {},
  asistencias = [],
  entregasComidas = [],
  preguntas = [],
  evaluaciones = [],
  satisfaccion = []
} = {}) {
  const wb = XLSX.utils.book_new();

  const safeEvento = evento || {};
  const safeAsistencias = Array.isArray(asistencias) ? asistencias : [];
  const safeEntregas = Array.isArray(entregasComidas) ? entregasComidas : [];
  const safePreguntas = Array.isArray(preguntas) ? preguntas : [];
  const safeEvaluaciones = Array.isArray(evaluaciones) ? evaluaciones : [];
  const safeSatisfaccion = Array.isArray(satisfaccion) ? satisfaccion : [];

  const config = getEventConfig(safeEvento);
  const modulos = config.modulos || {};

  // Analítica por jornadas y consolidación de personas únicas con cruce relacional de inscritos
  const {
    eventDays,
    totalEventDays,
    uniquePersons,
    totalUniquePersons,
    isMultidia,
    enrollmentStats
  } = analyzeEventDaysAndAttendance(safeEvento, safeAsistencias);

  const {
    hasInscritos,
    totalInscritos,
    inscritosQueAsistieron,
    inscritosAusentes,
    noInscritosQueAsistieron,
    tasaAsistenciaInscritos,
    participantsDict,
    inscritosDataObj
  } = enrollmentStats;

  // -------------------------------------------------------------
  // HOJA 0: FICHA TÉCNICA Y RESUMEN EJECUTIVO DEL EVENTO
  // -------------------------------------------------------------
  const desgloseDiasTexto = eventDays
    .map(d => `${d.label} (${d.fecha}): ${d.totalAsistentes} asistentes`)
    .join(' | ');

  const modulosActivosTexto = Object.entries(modulos)
    .filter(([_, activo]) => Boolean(activo))
    .map(([nombre]) => {
      const labels = {
        asistencia: 'Asistencia Oficial',
        validacionInscritos: 'Validación de Inscritos',
        escarapelaDigital: 'Escarapela Digital',
        codigoQR: 'Código QR y Proyección',
        placaVehiculo: 'Registro de Placa Vehicular',
        preguntasPonentes: 'Preguntas a Ponentes (Live Q&A)',
        evaluacionPonentes: 'Evaluación de Ponentes',
        encuestaSatisfaccion: 'Encuesta de Satisfacción y NPS',
        encuestasEnVivo: 'Votaciones en Vivo'
      };
      return labels[nombre] || nombre;
    })
    .join(', ');

  const resumenEvento = [
    { 'Parámetro': 'Evento Académico', 'Detalle': sanitizeExcelFormula(safeEvento.titulo || 'Evento Académico UdeA') },
    { 'Parámetro': 'Código Oficial', 'Detalle': sanitizeExcelFormula(safeEvento.id || 'N/A') },
    { 'Parámetro': 'Organizador', 'Detalle': 'Educación a lo Largo de la Vida - Facultad de Medicina UdeA' },
    { 'Parámetro': 'Modalidad de Duración', 'Detalle': isMultidia ? `Evento Multidía (${totalEventDays} días programados)` : 'Jornada de 1 Solo Día' },
    { 'Parámetro': 'Fechas del Evento', 'Detalle': isMultidia ? `${safeEvento.fechaInicio || safeEvento.fecha} al ${safeEvento.fechaFin || safeEvento.fecha}` : (safeEvento.fecha || 'N/A') },
    { 'Parámetro': 'Horario Oficial', 'Detalle': `${safeEvento.horaInicio || 'N/A'} - ${safeEvento.horaFin || 'N/A'}` },
    { 'Parámetro': 'Lugar / Auditorio', 'Detalle': sanitizeExcelFormula(safeEvento.lugar || 'Facultad de Medicina') },
    { 'Parámetro': 'Configuración de Ubicación GPS', 'Detalle': config.gpsObligatorio ? 'GPS Obligatorio en Sede' : 'GPS Desactivado / No Obligatorio' },
    { 'Parámetro': 'Total Personas Únicas Asistentes', 'Detalle': totalUniquePersons },
    { 'Parámetro': 'Total Registros de Asistencia', 'Detalle': safeAsistencias.length },
    { 'Parámetro': 'Desglose de Asistencia por Jornadas', 'Detalle': desgloseDiasTexto || 'Sin registros' },
    { 'Parámetro': 'Módulos Activos en este Evento', 'Detalle': modulosActivosTexto || 'Asistencia básica' },
    { 'Parámetro': 'Control de Refrigerios / Alimentación', 'Detalle': safeEvento.habilitarAlimentacion ? `Habilitado (${safeEntregas.length} entregas realizadas)` : 'Desactivado' },
    { 'Parámetro': 'Fecha de Generación del Reporte', 'Detalle': new Date().toLocaleString('es-CO') },
    { 'Parámetro': 'Enlace Microsoft Forms Institucional', 'Detalle': sanitizeExcelFormula(safeEvento.microsoftFormsUrl || 'No configurado') }
  ];

  if (hasInscritos) {
    resumenEvento.push(
      { 'Parámetro': 'Lista Oficial de Inscritos', 'Detalle': `Cargada (${totalInscritos} participantes en archivo)` },
      { 'Parámetro': 'Inscritos Oficiales que Asistieron', 'Detalle': `${inscritosQueAsistieron} de ${totalInscritos} (${tasaAsistenciaInscritos}%)` },
      { 'Parámetro': 'Inscritos Oficiales Ausentes', 'Detalle': `${inscritosAusentes}` },
      { 'Parámetro': 'Asistentes Extraordinarios en Sitio (No Inscritos Previamente)', 'Detalle': `${noInscritosQueAsistieron}` },
      { 'Parámetro': 'Efectividad de Asistencia sobre Convocatoria', 'Detalle': `${tasaAsistenciaInscritos}%` },
      { 'Parámetro': 'Cruce Relacional con Inscritos', 'Detalle': 'Datos demográficos enriquecidos automáticamente desde la lista oficial por cédula' }
    );
  }

  const wsResumen = XLSX.utils.json_to_sheet(resumenEvento);
  XLSX.utils.book_append_sheet(wb, wsResumen, '0_Ficha_Tecnica');

  // -------------------------------------------------------------
  // HOJA 1: CONSOLIDADO DE ASISTENTES ÚNICOS (SIN REPETIDOS)
  // Enriquecido automáticamente desde la lista oficial de inscritos (3_Inscritos_Oficiales)
  // -------------------------------------------------------------
  const consolidadoData = uniquePersons.map((p, index) => {
    const row = {
      'N°': index + 1
    };

    if (hasInscritos) {
      row['Inscrito Oficial'] = p.esInscritoOficial ? 'SÍ (Acreditado)' : 'NO (Registro en sitio)';
    }

    row['Tipo Doc.'] = sanitizeExcelFormula(p.tipoDocumento || 'CC');
    row['Documento'] = sanitizeExcelFormula(p.documento);
    row['Nombre Completo'] = sanitizeExcelFormula(p.nombreCompleto);
    row['Correo Electrónico'] = sanitizeExcelFormula(p.correo);
    row['Teléfono / Celular'] = sanitizeExcelFormula(p.telefono);
    row['Vinculación / Rol'] = sanitizeExcelFormula(p.vinculacion);

    if (modulos.placaVehiculo !== false) {
      row['Placa Vehículo'] = sanitizeExcelFormula(p.placaVehiculo || 'No registrada');
    }

    row['Total Días Asistidos'] = p.totalDiasAsistidos;
    row['Total Días Evento'] = totalEventDays;
    row['Porcentaje de Asistencia'] = `${p.porcentajeAsistencia}%`;

    // Si el evento tiene varios días, desglosar la presencia por cada fecha
    if (isMultidia) {
      eventDays.forEach(d => {
        row[`${d.label} (${d.fecha})`] = p.asistenciaPorDia[d.fecha] ? 'SÍ' : 'NO';
      });
    }

    row['Presencial en Sede'] = p.esPresencialAlgunaVez ? 'SÍ (Confirmado)' : 'Remoto';
    row['Primer Registro'] = p.primerRegistro || '';
    row['Último Registro'] = p.ultimoRegistro || '';
    row['Habeas Data (Ley 1581/2012)'] = p.habeasDataAceptado !== false ? 'AUTORIZADO Y FIRMADO' : 'PENDIENTE';

    return row;
  });

  const wsConsolidado = XLSX.utils.json_to_sheet(consolidadoData.length > 0 ? consolidadoData : [
    { 'Mensaje': 'No se registran participantes para este evento académico aún.' }
  ]);
  XLSX.utils.book_append_sheet(wb, wsConsolidado, '1_Consolidado_Asistentes');

  // -------------------------------------------------------------
  // HOJA 2: HISTORIAL DETALLADO DE ASISTENCIAS (LOG CRONOLÓGICO)
  // Cruce por cédula con lista oficial para normalizar nombres y roles
  // -------------------------------------------------------------
  const asistenciasDetalleData = safeAsistencias.map((a, index) => {
    const recDate = extractRecordDate(a);
    const dayObj = eventDays.find(d => d.fecha === recDate);
    const dayLabel = dayObj ? dayObj.label : (a.diaNumero ? `Día ${a.diaNumero}` : 'Jornada Única');
    const docClean = normalizeDocumentId(a?.documento) || String(a?.documento || '').trim();
    const inscrito = participantsDict[docClean] || null;

    // Enriquecimiento de datos oficiales si figura en la lista de inscritos
    const nombreFinal = (inscrito?.nombreCompleto && String(inscrito.nombreCompleto).trim().length > 0)
      ? String(inscrito.nombreCompleto).trim()
      : (a.nombreCompleto || 'Sin nombre');

    const correoFinal = (inscrito?.correo && String(inscrito.correo).trim().length > 0)
      ? String(inscrito.correo).trim()
      : (a.correo || '');

    const telefonoFinal = (inscrito?.telefono && String(inscrito.telefono).trim().length > 0)
      ? String(inscrito.telefono).trim()
      : (a.telefono || '');

    const vinculacionFinal = (inscrito?.vinculacion && String(inscrito.vinculacion).trim().length > 0)
      ? String(inscrito.vinculacion).trim()
      : (a.vinculacion || 'Asistente');

    const row = {
      'N°': index + 1,
      'Código Registro': sanitizeExcelFormula(a.id),
      'Jornada': dayLabel,
      'Fecha Sesión': recDate,
      'Hora Registro': a.horaRegistro || ''
    };

    if (hasInscritos) {
      row['Inscrito Oficial'] = inscrito ? 'SÍ (Acreditado)' : 'NO (En sitio)';
    }

    row['Tipo Doc.'] = sanitizeExcelFormula(a.tipoDocumento || 'CC');
    row['Documento'] = sanitizeExcelFormula(a.documento);
    row['Nombre Completo'] = sanitizeExcelFormula(nombreFinal);
    row['Correo Electrónico'] = sanitizeExcelFormula(correoFinal);
    row['Teléfono / Celular'] = sanitizeExcelFormula(telefonoFinal);
    row['Vinculación / Rol'] = sanitizeExcelFormula(vinculacionFinal);

    if (modulos.placaVehiculo !== false) {
      row['Placa Vehículo'] = sanitizeExcelFormula(a.placaVehiculo || 'No registrada');
    }

    row['Ubicación GPS'] = a.geolocalizacion?.esPresencial ? 'EN SEDE' : 'REMOTO';
    row['Distancia a Sede (m)'] = a.geolocalizacion?.distanciaSedeMetros ?? 'N/A';
    row['Precisión GPS (m)'] = a.geolocalizacion?.precisionMetros ?? 'N/A';
    row['GPS Obligatorio en Evento'] = config.gpsObligatorio ? 'SÍ' : 'NO';
    row['Fecha y Hora Completa'] = a.fechaRegistro;
    row['Habeas Data (Ley 1581/2012)'] = a.habeasDataAceptado !== false ? 'AUTORIZADO Y FIRMADO' : 'PENDIENTE';

    return row;
  });

  const wsDetalle = XLSX.utils.json_to_sheet(asistenciasDetalleData.length > 0 ? asistenciasDetalleData : [
    { 'Mensaje': 'No se registran asistencias para este evento aún.' }
  ]);
  XLSX.utils.book_append_sheet(wb, wsDetalle, '2_Historial_Asistencias');

  // -------------------------------------------------------------
  // HOJA MODULAR 3: VALIDACIÓN DE LISTA DE INSCRITOS OFICIALES
  // (Solo si el módulo está habilitado y hay lista de inscritos cargada)
  // Cruce total: lista de matriculados vs asistencia real, deserción y cumplimiento
  // -------------------------------------------------------------
  if (modulos.validacionInscritos !== false && hasInscritos) {
    const inscritosRows = inscritosDataObj.documents.map((docNum, index) => {
      const pInfo = participantsDict[docNum] || {};
      const personMatch = uniquePersons.find(p => p.documentoNormalizado === docNum);
      const asistio = Boolean(personMatch);

      const row = {
        'N°': index + 1,
        'Documento': sanitizeExcelFormula(pInfo.documentoOriginal || docNum),
        'Nombre Completo': sanitizeExcelFormula(pInfo.nombreCompleto || 'Sin nombre en archivo'),
        'Correo': sanitizeExcelFormula(pInfo.correo || ''),
        'Teléfono': sanitizeExcelFormula(pInfo.telefono || ''),
        'Vinculación': sanitizeExcelFormula(pInfo.vinculacion || 'Inscrito'),
        'Estado Asistencia': asistio ? 'ASISTIÓ' : 'NO ASISTIÓ',
        'Total Días Asistidos': personMatch ? personMatch.totalDiasAsistidos : 0,
        'Total Días Evento': totalEventDays,
        'Porcentaje Asistencia': personMatch ? `${personMatch.porcentajeAsistencia}%` : '0%'
      };

      if (isMultidia) {
        eventDays.forEach(d => {
          row[`${d.label} (${d.fecha})`] = personMatch?.asistenciaPorDia[d.fecha] ? 'SÍ' : 'NO';
        });
      }

      row['Primer Registro'] = personMatch ? (personMatch.primerRegistro || 'Confirmado') : 'Sin asistencia';
      row['Último Registro'] = personMatch ? (personMatch.ultimoRegistro || 'Confirmado') : 'Sin asistencia';
      row['Cumple Requisito Asistencia (>=80%)'] = (personMatch?.porcentajeAsistencia >= 80) ? 'SÍ' : 'NO';

      return row;
    });

    const wsInscritos = XLSX.utils.json_to_sheet(inscritosRows);
    XLSX.utils.book_append_sheet(wb, wsInscritos, '3_Inscritos_Oficiales');
  }

  // -------------------------------------------------------------
  // HOJA MODULAR 4: CONTROL DE REFRIGERIOS Y ALIMENTACIÓN
  // (Solo si el módulo de alimentación está activo)
  // -------------------------------------------------------------
  if (safeEvento.habilitarAlimentacion) {
    const comidasRows = safeEntregas.map((entrega, index) => ({
      'N°': index + 1,
      'Código Entrega': sanitizeExcelFormula(entrega.id),
      'Comida / Refrigerio': sanitizeExcelFormula(entrega.comidaNombre || entrega.comidaId),
      'Documento Asistente': sanitizeExcelFormula(entrega.documento),
      'Nombre Completo Asistente': sanitizeExcelFormula(entrega.nombreCompleto),
      'Vinculación': sanitizeExcelFormula(entrega.vinculacion || 'Asistente'),
      'Fecha y Hora Entrega': entrega.fechaRegistro || entrega.fechaHora || '',
      'Comprobante Asistencia': sanitizeExcelFormula(entrega.comprobanteId || '')
    }));

    const wsComidas = XLSX.utils.json_to_sheet(comidasRows.length > 0 ? comidasRows : [
      { 'Mensaje': 'No se registran entregas de refrigerios ni alimentación para este evento todavía.' }
    ]);
    XLSX.utils.book_append_sheet(wb, wsComidas, '4_Alimentacion_Refrigerios');
  }

  // -------------------------------------------------------------
  // HOJA MODULAR 5: PREGUNTAS A LOS PONENTES (LIVE Q&A)
  // (Solo si el módulo de preguntas está habilitado)
  // -------------------------------------------------------------
  if (modulos.preguntasPonentes) {
    const preguntasData = safePreguntas.map((q, index) => {
      const ponente = (safeEvento.ponentes || []).find(p => p.id === q.ponenteId);
      return {
        'N°': index + 1,
        'Código Pregunta': sanitizeExcelFormula(q.id),
        'Ponente Destino': sanitizeExcelFormula(ponente ? ponente.nombre : (q.ponenteNombre || q.ponenteId)),
        'Tema Ponencia': sanitizeExcelFormula(ponente ? ponente.temaPonencia : 'N/A'),
        'Autor': sanitizeExcelFormula(q.autor),
        'Hora Envío': q.hora,
        'Pregunta': sanitizeExcelFormula(q.pregunta),
        'Respondida': q.respondida ? 'SÍ' : 'NO',
        'Destacada': q.destacada ? 'SÍ' : 'NO'
      };
    });

    const wsPreguntas = XLSX.utils.json_to_sheet(preguntasData.length > 0 ? preguntasData : [
      { 'Mensaje': 'No se registran preguntas formuladas a los ponentes.' }
    ]);
    XLSX.utils.book_append_sheet(wb, wsPreguntas, '5_Preguntas_Ponentes');
  }

  // -------------------------------------------------------------
  // HOJA MODULAR 6: EVALUACIONES DE PONENTES
  // (Solo si el módulo de evaluación está habilitado)
  // -------------------------------------------------------------
  if (modulos.evaluacionPonentes) {
    const evaluacionesData = safeEvaluaciones.map((ev, index) => {
      const ponente = (safeEvento.ponentes || []).find(p => p.id === ev.ponenteId);
      const prom = (((ev.dominio || 0) + (ev.claridad || 0) + (ev.aplicabilidad || 0)) / 3).toFixed(1);
      return {
        'N°': index + 1,
        'Código Evaluación': sanitizeExcelFormula(ev.id),
        'Ponente Evaluado': sanitizeExcelFormula(ponente ? ponente.nombre : ev.ponenteId),
        'Dominio del Tema (1-5)': ev.dominio ?? 5,
        'Claridad Pedagógica (1-5)': ev.claridad ?? 5,
        'Aplicabilidad Médica (1-5)': ev.aplicabilidad ?? 5,
        'Promedio Ponente': Number(prom),
        'Comentarios y Observaciones': sanitizeExcelFormula(ev.comentario || 'Sin comentarios'),
        'Fecha': ev.fecha || ''
      };
    });

    const wsEvaluaciones = XLSX.utils.json_to_sheet(evaluacionesData.length > 0 ? evaluacionesData : [
      { 'Mensaje': 'No se registran evaluaciones a los ponentes todavía.' }
    ]);
    XLSX.utils.book_append_sheet(wb, wsEvaluaciones, '6_Evaluacion_Ponentes');
  }

  // -------------------------------------------------------------
  // HOJA MODULAR 7: ENCUESTA DE SATISFACCIÓN GENERAL Y NPS
  // (Solo si el módulo de satisfacción está habilitado)
  // -------------------------------------------------------------
  if (modulos.encuestaSatisfaccion) {
    const satisfaccionData = safeSatisfaccion.map((sat, index) => ({
      'N°': index + 1,
      'Código Encuesta': sanitizeExcelFormula(sat.id),
      'Cumplimiento de Expectativas (1-5)': sat.cumplimientoObjetivos ?? 5,
      'Organización y Logística (1-5)': sat.organizacionLogistica ?? 5,
      'Net Promoter Score (NPS 0-10)': sat.npsRecomendacion ?? 10,
      'Sugerencias Futuros Cursos UdeA': sanitizeExcelFormula(sat.sugerencias || 'Sin sugerencias'),
      'Fecha Envío': sat.fecha || ''
    }));

    const wsSatisfaccion = XLSX.utils.json_to_sheet(satisfaccionData.length > 0 ? satisfaccionData : [
      { 'Mensaje': 'No se registran encuestas de satisfacción completadas.' }
    ]);
    XLSX.utils.book_append_sheet(wb, wsSatisfaccion, '7_Satisfaccion_General');
  }

  // -------------------------------------------------------------
  // HOJA MODULAR 8: VOTACIONES Y CASOS CLÍNICOS EN VIVO
  // (Solo si el módulo de encuestas en vivo está habilitado)
  // -------------------------------------------------------------
  if (modulos.encuestasEnVivo) {
    const polls = getEventPolls(safeEvento.id) || [];
    if (polls.length > 0) {
      const votacionesRows = [];
      polls.forEach((poll, pIdx) => {
        const totalVotos = (poll.opciones || []).reduce((acc, opt) => acc + (opt.votos || 0), 0);
        (poll.opciones || []).forEach((opt, oIdx) => {
          const pct = totalVotos > 0 ? Math.round((opt.votos / totalVotos) * 100) : 0;
          votacionesRows.push({
            'N° Pregunta': pIdx + 1,
            'Pregunta / Caso Clínico': sanitizeExcelFormula(poll.pregunta),
            'Estado': poll.estado || 'FINALIZADA',
            'Opción N°': oIdx + 1,
            'Texto de Opción': sanitizeExcelFormula(opt.texto),
            'Votos Recibidos': opt.votos || 0,
            'Porcentaje Votación': `${pct}%`,
            'Total Votos Pregunta': totalVotos
          });
        });
      });

      const wsVotaciones = XLSX.utils.json_to_sheet(votacionesRows);
      XLSX.utils.book_append_sheet(wb, wsVotaciones, '8_Votaciones_En_Vivo');
    }
  }

  // -------------------------------------------------------------
  // GENERAR Y DISPARAR DESCARGA DEL ARCHIVO .XLSX
  // -------------------------------------------------------------
  const eventId = safeEvento.id || 'Evento_UdeA';
  const fileName = `Reporte_${eventId}_UdeA_Medicina_${new Date().toISOString().slice(0, 10)}.xlsx`;

  try {
    XLSX.writeFile(wb, fileName);
  } catch (err) {
    console.warn('XLSX.writeFile falló, recurriendo a descarga por Blob:', err);
    triggerBlobDownload(wb, fileName);
  }

  return fileName;
}

// Exportación con el esquema exacto que produce Microsoft Forms (compatible con Power Automate)
export function exportMicrosoftFormsFormat({ evento = {}, asistencias = [], satisfaccion = [] } = {}) {
  const wb = XLSX.utils.book_new();

  const safeAsistencias = Array.isArray(asistencias) ? asistencias : [];
  const safeSatisfaccion = Array.isArray(satisfaccion) ? satisfaccion : [];
  const safeEvento = evento || {};

  const inscritosDataObj = safeEvento.inscritosData || getEventInscritosData(safeEvento.id);
  const participantsDict = (inscritosDataObj && typeof inscritosDataObj.participants === 'object' && inscritosDataObj.participants !== null)
    ? inscritosDataObj.participants
    : {};

  const msFormsData = safeAsistencias.map((a, index) => {
    const sat = safeSatisfaccion[index] || {};
    const docClean = normalizeDocumentId(a?.documento) || String(a?.documento || '').trim();
    const inscrito = participantsDict[docClean] || null;

    const nombreFinal = (inscrito?.nombreCompleto && String(inscrito.nombreCompleto).trim().length > 0)
      ? String(inscrito.nombreCompleto).trim()
      : (a.nombreCompleto || 'Sin nombre');

    const correoFinal = (inscrito?.correo && String(inscrito.correo).trim().length > 0)
      ? String(inscrito.correo).trim()
      : (a.correo || '');

    const telefonoFinal = (inscrito?.telefono && String(inscrito.telefono).trim().length > 0)
      ? String(inscrito.telefono).trim()
      : (a.telefono || '');

    const vinculacionFinal = (inscrito?.vinculacion && String(inscrito.vinculacion).trim().length > 0)
      ? String(inscrito.vinculacion).trim()
      : (a.vinculacion || 'Asistente');

    return {
      'Id.': index + 1,
      'Hora de inicio': a.fechaRegistro || '',
      'Hora de finalización': a.fechaRegistro || '',
      'Correo electrónico': sanitizeExcelFormula(correoFinal),
      'Nombre': sanitizeExcelFormula(nombreFinal),
      'Documento de Identidad': sanitizeExcelFormula(a.documento),
      'Tipo de Vinculación': sanitizeExcelFormula(vinculacionFinal),
      'Teléfono': sanitizeExcelFormula(telefonoFinal),
      'Placa Vehículo': sanitizeExcelFormula(a.placaVehiculo || 'N/A'),
      'Calificación General Evento (1-5)': sat.cumplimientoObjetivos || 'Sin respuesta',
      'Recomendación NPS (0-10)': sat.npsRecomendacion ?? 'Sin respuesta',
      'Comentarios y Sugerencias': sanitizeExcelFormula(sat.sugerencias || 'Sin respuesta')
    };
  });

  const ws = XLSX.utils.json_to_sheet(msFormsData.length > 0 ? msFormsData : [
    { 'Mensaje': 'No hay datos para exportar en formato Microsoft Forms.' }
  ]);

  XLSX.utils.book_append_sheet(wb, ws, 'Microsoft_Forms_Export');
  const eventId = safeEvento.id || 'Evento_UdeA';
  const fileName = `MicrosoftForms_Formato_${eventId}_UdeA.xlsx`;

  try {
    XLSX.writeFile(wb, fileName);
  } catch (err) {
    console.warn('XLSX.writeFile falló, recurriendo a descarga por Blob:', err);
    triggerBlobDownload(wb, fileName);
  }

  return fileName;
}

// Función auxiliar para forzar descarga mediante Blob (compatible con móviles, Safari e iOS)
function triggerBlobDownload(wb, fileName) {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
