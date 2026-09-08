// Servicio de Exportación a Microsoft Excel (.xlsx) y compatibilidad con Microsoft Forms
// Facultad de Medicina - Universidad de Antioquia

import * as XLSX from 'xlsx';

export function exportEventDataToExcel({ evento, asistencias, preguntas, evaluaciones, satisfaccion }) {
  const wb = XLSX.utils.book_new();

  // 1. Hoja de Asistencias y Geolocalización
  const asistenciasData = asistencias.map((a, index) => ({
    'N°': index + 1,
    'Código Asistencia': a.id,
    'Tipo Doc.': a.tipoDocumento || 'CC',
    'Documento': a.documento,
    'Nombre Completo': a.nombreCompleto,
    'Correo Electrónico': a.correo,
    'Teléfono / Celular': a.telefono,
    'Vinculación UdeA': a.vinculacion,
    'Placa Vehículo': a.placaVehiculo || (evento.habilitarPlacaVehiculo ? 'No registrada' : 'No requería'),
    'Fecha y Hora': a.fechaRegistro,
    'Estado Presencial': a.geolocalizacion?.esPresencial ? 'EN SEDE / PRESENCIAL' : 'FUERA DE RANGO / REMOTO',
    'Distancia a Facultad (m)': a.geolocalizacion?.distanciaSedeMetros ?? 'N/A',
    'Latitud': a.geolocalizacion?.latitud ?? 'N/A',
    'Longitud': a.geolocalizacion?.longitud ?? 'N/A',
    'Precisión GPS (m)': a.geolocalizacion?.precisionMetros ?? 'N/A'
  }));

  const wsAsistencias = XLSX.utils.json_to_sheet(asistenciasData.length > 0 ? asistenciasData : [
    { 'Mensaje': 'No se registran asistencias para este evento aún.' }
  ]);
  XLSX.utils.book_append_sheet(wb, wsAsistencias, '1_Asistencias_y_GPS');

  // 2. Hoja de Preguntas a Ponentes (Q&A en Vivo)
  const preguntasData = preguntas.map((q, index) => {
    const ponente = evento.ponentes?.find(p => p.id === q.ponenteId);
    return {
      'N°': index + 1,
      'Código Pregunta': q.id,
      'Ponente Destino': ponente ? ponente.nombre : q.ponenteId,
      'Tema Ponencia': ponente ? ponente.temaPonencia : 'N/A',
      'Autor': q.autor,
      'Hora Envío': q.hora,
      'Pregunta': q.pregunta,
      'Respondida': q.respondida ? 'SÍ' : 'NO',
      'Destacada': q.destacada ? 'SÍ' : 'NO'
    };
  });

  const wsPreguntas = XLSX.utils.json_to_sheet(preguntasData.length > 0 ? preguntasData : [
    { 'Mensaje': 'No se registran preguntas formuladas a los ponentes.' }
  ]);
  XLSX.utils.book_append_sheet(wb, wsPreguntas, '2_Preguntas_Ponentes');

  // 3. Hoja de Evaluaciones de Ponentes
  const evaluacionesData = evaluaciones.map((ev, index) => {
    const ponente = evento.ponentes?.find(p => p.id === ev.ponenteId);
    const prom = ((ev.dominio + ev.claridad + ev.aplicabilidad) / 3).toFixed(1);
    return {
      'N°': index + 1,
      'Código Evaluación': ev.id,
      'Ponente Evaluado': ponente ? ponente.nombre : ev.ponenteId,
      'Dominio del Tema (1-5)': ev.dominio,
      'Claridad Pedagógica (1-5)': ev.claridad,
      'Aplicabilidad Médica (1-5)': ev.aplicabilidad,
      'Promedio Ponente': Number(prom),
      'Comentarios y Observaciones': ev.comentario || 'Sin comentarios',
      'Fecha': ev.fecha
    };
  });

  const wsEvaluaciones = XLSX.utils.json_to_sheet(evaluacionesData.length > 0 ? evaluacionesData : [
    { 'Mensaje': 'No se registran evaluaciones a los ponentes todavía.' }
  ]);
  XLSX.utils.book_append_sheet(wb, wsEvaluaciones, '3_Evaluacion_Ponentes');

  // 4. Hoja de Satisfacción General del Evento
  const satisfaccionData = satisfaccion.map((sat, index) => ({
    'N°': index + 1,
    'Código Encuesta': sat.id,
    'Cumplimiento de Expectativas (1-5)': sat.cumplimientoObjetivos,
    'Organización y Logística (1-5)': sat.organizacionLogistica,
    'Net Promoter Score (NPS 0-10)': sat.npsRecomendacion,
    'Sugerencias Futuros Cursos UdeA': sat.sugerencias || 'Sin sugerencias',
    'Fecha Envío': sat.fecha
  }));

  const wsSatisfaccion = XLSX.utils.json_to_sheet(satisfaccionData.length > 0 ? satisfaccionData : [
    { 'Mensaje': 'No se registran encuestas de satisfacción completadas.' }
  ]);
  XLSX.utils.book_append_sheet(wb, wsSatisfaccion, '4_Satisfaccion_General');

  // 5. Hoja Resumen Ejecutivo / Metadatos del Evento
  const resumenEvento = [
    { 'Parámetro': 'Evento Académico', 'Detalle': evento.titulo },
    { 'Parámetro': 'Organizador', 'Detalle': 'Educación a lo Largo de la Vida - Facultad de Medicina UdeA' },
    { 'Parámetro': 'Fecha del Evento', 'Detalle': `${evento.fecha} (${evento.horaInicio} - ${evento.horaFin})` },
    { 'Parámetro': 'Lugar / Auditorio', 'Detalle': evento.lugar },
    { 'Parámetro': 'Registro Vehicular Habilitado', 'Detalle': evento.habilitarPlacaVehiculo ? 'SÍ (Parqueadero Activo)' : 'NO' },
    { 'Parámetro': 'Total Asistentes Registrados', 'Detalle': asistencias.length },
    { 'Parámetro': 'Asistencias Validadas Presenciales GPS', 'Detalle': asistencias.filter(a => a.geolocalizacion?.esPresencial).length },
    { 'Parámetro': 'Total Preguntas a Ponentes', 'Detalle': preguntas.length },
    { 'Parámetro': 'Total Evaluaciones de Ponentes', 'Detalle': evaluaciones.length },
    { 'Parámetro': 'Total Encuestas de Satisfacción', 'Detalle': satisfaccion.length },
    { 'Parámetro': 'Fecha de Generación del Reporte', 'Detalle': new Date().toLocaleString('es-CO') },
    { 'Parámetro': 'Enlace Microsoft Forms Institucional', 'Detalle': evento.microsoftFormsUrl || 'No configurado' }
  ];
  const wsResumen = XLSX.utils.json_to_sheet(resumenEvento);
  XLSX.utils.book_append_sheet(wb, wsResumen, '0_Ficha_Tecnica');

  // Ajuste de ancho de columnas automático
  const wscols = [{ wch: 6 }, { wch: 18 }, { wch: 25 }, { wch: 30 }, { wch: 25 }, { wch: 20 }, { wch: 22 }];
  wsAsistencias['!cols'] = wscols;

  // Generar y disparar descarga
  const fileName = `Reporte_${evento.id}_UdeA_Medicina_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}

// Exportación con el esquema exacto que produce Microsoft Forms (compatible con Power Automate)
export function exportMicrosoftFormsFormat({ evento, asistencias, satisfaccion }) {
  const wb = XLSX.utils.book_new();

  const msFormsData = asistencias.map((a, index) => {
    const sat = satisfaccion[index] || {};
    return {
      'Id.': index + 1,
      'Hora de inicio': a.fechaRegistro,
      'Hora de finalización': a.fechaRegistro,
      'Correo electrónico': a.correo,
      'Nombre': a.nombreCompleto,
      'Documento de Identidad': a.documento,
      'Tipo de Vinculación': a.vinculacion,
      'Teléfono': a.telefono,
      'Placa Vehículo': a.placaVehiculo || 'N/A',
      'Validación Presencial GPS': a.geolocalizacion?.esPresencial ? 'En Sede' : 'Remoto',
      'Distancia a la Sede (Metros)': a.geolocalizacion?.distanciaSedeMetros || 'N/A',
      'Calificación General Evento (1-5)': sat.cumplimientoObjetivos || 'Sin respuesta',
      'Recomendación NPS (0-10)': sat.npsRecomendacion || 'Sin respuesta',
      'Comentarios y Sugerencias': sat.sugerencias || 'Sin respuesta'
    };
  });

  const ws = XLSX.utils.json_to_sheet(msFormsData.length > 0 ? msFormsData : [
    { 'Mensaje': 'No hay datos para exportar en formato Microsoft Forms.' }
  ]);

  XLSX.utils.book_append_sheet(wb, ws, 'Microsoft_Forms_Export');
  const fileName = `MicrosoftForms_Formato_${evento.id}_UdeA.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}
