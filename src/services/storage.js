// Servicio de Almacenamiento Local y Estado Persistente
// Diseñado para la Facultad de Medicina - Universidad de Antioquia
// Soporte híbrido: Cloud Firestore (en tiempo real) + LocalStorage (fallback de contingencia)

import {
  isFirebaseConfigured,
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc
} from './firebase.js';
import { normalizeDocumentId } from './enrollmentService.js';
import { getColombiaLocalDateStr } from './networkTime.js';

export { isFirebaseConfigured, normalizeDocumentId, getColombiaLocalDateStr };

const STORAGE_KEY_EVENTS = 'udea_med_events_v1';
const STORAGE_KEY_ATTENDANCE = 'udea_med_attendance_v1';
const STORAGE_KEY_QUESTIONS = 'udea_med_questions_v1';
const STORAGE_KEY_EVALUATIONS = 'udea_med_evaluations_v1';
const STORAGE_KEY_SATISFACTION = 'udea_med_satisfaction_v1';
const STORAGE_KEY_VERIFICATIONS = 'udea_med_verifications_v1';
const STORAGE_KEY_MEALS = 'udea_med_meals_deliveries_v1';

const VERIFICATION_SALT = 'udea_medicina_escarapela_2026_salt_seguridad';

// Generar firma criptográfica para la escarapela digital (anti-falsificación)
export async function generateVerificationToken(recordId, eventoId, documento) {
  try {
    const raw = `${recordId}::${eventoId}::${documento}::${VERIFICATION_SALT}`;
    const subtle = (typeof window !== 'undefined' && window.crypto?.subtle) ||
                   (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle);
    if (subtle) {
      const msgBuffer = new TextEncoder().encode(raw);
      const hashBuffer = await subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 24);
    }
    return Math.abs(`${recordId}${eventoId}${documento}`.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0)).toString(16).padStart(16, '0');
  } catch {
    return Math.abs(`${recordId}${eventoId}${documento}`.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0)).toString(16).padStart(16, '0');
  }
}

// Enmascaramiento de documento para protección de datos personales (Habeas Data Ley 1581)
export function maskDocumento(doc) {
  if (!doc) return '******';
  const str = String(doc).trim();
  if (str.length <= 4) return '•••' + str.slice(-1);
  if (str.length <= 7) return str.substring(0, 2) + '••••' + str.slice(-2);
  return str.substring(0, 3) + '••••' + str.slice(-3);
}

// Coordenadas oficiales de la Facultad de Medicina UdeA (Cra. 51D # 62-29, Medellín - Área de la Salud)
// Verificado con enlace oficial Google Maps: https://maps.app.goo.gl/968rjfJ1vFJtpDbn7
export const UDEA_MEDICINA_COORDS = {
  latitude: 6.261341,
  longitude: -75.566464,
  name: 'Facultad de Medicina UdeA (Cra. 51D # 62-29, Medellín)',
  radioMaximoMetros: 350 // Radio permitido para considerar asistencia estrictamente presencial en sede
};

// Datos semilla iniciales si no existen en localStorage
const SEED_EVENTS = [
  {
    id: 'EVT-MED-01',
    titulo: 'Simposio de Actualización en Medicina Interna y Urgencias',
    fecha: '2026-09-15',
    horaInicio: '08:00',
    horaFin: '17:00',
    lugar: 'Auditorio Manuel Uribe Ángel - Facultad de Medicina UdeA',
    coordenadas: { lat: 6.261341, lng: -75.566464 },
    habilitarPlacaVehiculo: true, // Placa habilitada
    descripcion: 'Jornada académica de actualización clínica dirigida a especialistas, médicos generales, residentes y estudiantes de la Universidad de Antioquia.',
    microsoftFormsUrl: 'https://forms.office.com/r/ejemploUdeAMedicina2026',
    ponentes: [
      {
        id: 'PON-01',
        nombre: 'Dra. Catalina Restrepo Morales',
        titulo: 'Médica Internista - Neumóloga UdeA',
        temaPonencia: 'Manejo Contemporáneo de la EPOC y Nuevas Guías GOLD'
      },
      {
        id: 'PON-02',
        nombre: 'Dr. Alejandro Gaviria Gómez',
        titulo: 'Especialista en Medicina Crítica y Terapia Intensiva',
        temaPonencia: 'Reanimación Guiada por Metas en Sepsis y Choque Séptico'
      },
      {
        id: 'PON-03',
        nombre: 'Dra. Marcela Tobón Vélez',
        titulo: 'Médica Cardióloga - Docente Departamento de Medicina Interna',
        temaPonencia: 'Estratificación Rápida del Dolor Torácico en Urgencias'
      }
    ]
  },
  {
    id: 'EVT-MED-02',
    titulo: 'Curso Taller: Habilidades en Soporte Vital Avanzado y Reanimación',
    fecha: '2026-09-22',
    horaInicio: '14:00',
    horaFin: '18:30',
    lugar: 'Laboratorio de Simulación Médica - Piso 3',
    coordenadas: { lat: 6.261341, lng: -75.566464 },
    habilitarPlacaVehiculo: false, // Placa NO habilitada en este evento
    descripcion: 'Taller práctico con simuladores de alta fidelidad para el manejo integral de paro cardiorrespiratorio.',
    microsoftFormsUrl: '',
    ponentes: [
      {
        id: 'PON-04',
        nombre: 'Dr. Julián Zapata Cano',
        titulo: 'Urgenciólogo - Coordinador de Simulación Clínica',
        temaPonencia: 'Protocolos de Resucitación Cardiopulmonar Avanzada ACLS'
      }
    ]
  }
];

const SEED_ATTENDANCE = [
  {
    id: 'ATT-001',
    eventoId: 'EVT-MED-01',
    documento: '1037654321',
    tipoDocumento: 'CC',
    nombreCompleto: 'Laura Sofía Gómez Arango',
    correo: 'laura.gomeza@udea.edu.co',
    telefono: '3124567890',
    vinculacion: 'Residente / Posgrado UdeA',
    placaVehiculo: 'KMW-452',
    fechaRegistro: '2026-09-15 08:12:30',
    geolocalizacion: {
      latitud: 6.261315,
      longitud: -75.566450,
      precisionMetros: 10,
      distanciaSedeMetros: 5,
      esPresencial: true
    }
  },
  {
    id: 'ATT-002',
    eventoId: 'EVT-MED-01',
    documento: '71987654',
    tipoDocumento: 'CC',
    nombreCompleto: 'Carlos Alberto Henao Muñoz',
    correo: 'carlos.henao@hospitalmed.org',
    telefono: '3009876543',
    vinculacion: 'Médico Especialista Externo',
    placaVehiculo: 'UDA-890',
    fechaRegistro: '2026-09-15 08:15:10',
    geolocalizacion: {
      latitud: 6.261420,
      longitud: -75.566390,
      precisionMetros: 14,
      distanciaSedeMetros: 18,
      esPresencial: true
    }
  },
  {
    id: 'ATT-003',
    eventoId: 'EVT-MED-01',
    documento: '1152439876',
    tipoDocumento: 'CC',
    nombreCompleto: 'Valentina Puerta Quintero',
    correo: 'valentina.puerta@udea.edu.co',
    telefono: '3156789012',
    vinculacion: 'Estudiante Pregrado Medicina UdeA',
    placaVehiculo: '',
    fechaRegistro: '2026-09-15 08:20:45',
    geolocalizacion: {
      latitud: 6.261220,
      longitud: -75.566530,
      precisionMetros: 12,
      distanciaSedeMetros: 21,
      esPresencial: true
    }
  }
];

const SEED_QUESTIONS = [
  {
    id: 'Q-001',
    eventoId: 'EVT-MED-01',
    ponenteId: 'PON-01',
    autor: 'Dr. Carlos Henao',
    pregunta: '¿Cuál es el criterio para retirar el corticoide inhalado en pacientes EPOC con antecedentes de neumonías a repetición?',
    hora: '09:42 AM',
    respondida: false,
    destacada: true
  },
  {
    id: 'Q-002',
    eventoId: 'EVT-MED-01',
    ponenteId: 'PON-02',
    autor: 'Anónimo',
    pregunta: 'En caso de no contar con ecografía a pie de cama (POCUS), ¿cuál parámetro clínico considera más confiable para guiar la respuesta a fluidos?',
    hora: '11:15 AM',
    respondida: true,
    destacada: false
  }
];

const SEED_EVALUATIONS = [
  {
    id: 'EVAL-001',
    eventoId: 'EVT-MED-01',
    ponenteId: 'PON-01',
    dominio: 5,
    claridad: 5,
    aplicabilidad: 5,
    comentario: 'Excelente revisión de las guías GOLD, muy aplicable al servicio de hospitalización.',
    fecha: '2026-09-15 10:15'
  },
  {
    id: 'EVAL-002',
    eventoId: 'EVT-MED-01',
    ponenteId: 'PON-02',
    dominio: 5,
    claridad: 4,
    aplicabilidad: 5,
    comentario: 'Muy buena exposición y manejo de las dudas sobre vasopresores tempranos.',
    fecha: '2026-09-15 12:05'
  }
];

const SEED_SATISFACTION = [
  {
    id: 'SAT-001',
    eventoId: 'EVT-MED-01',
    cumplimientoObjetivos: 5,
    organizacionLogistica: 5,
    npsRecomendacion: 10,
    sugerencias: 'Excelente nivel académico de la Facultad. Sugiero un próximo curso sobre ventilación mecánica no invasiva.',
    fecha: '2026-09-15 17:05'
  }
];

// Inicializador de LocalStorage con migración automática de coordenadas
export function initStorage() {
  if (!localStorage.getItem(STORAGE_KEY_EVENTS)) {
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(SEED_EVENTS));
  } else {
    // Migración automática en dispositivos que visitaron la app previamente:
    // Asegura que los eventos semilla tengan las coordenadas exactas de la Facultad de Medicina
    try {
      const storedEvents = JSON.parse(localStorage.getItem(STORAGE_KEY_EVENTS) || '[]');
      let updated = false;
      storedEvents.forEach(evt => {
        if (evt.id === 'EVT-MED-01' || evt.id === 'EVT-MED-02') {
          if (!evt.coordenadas || Math.abs(evt.coordenadas.lat - UDEA_MEDICINA_COORDS.latitude) > 0.0001) {
            evt.coordenadas = { lat: UDEA_MEDICINA_COORDS.latitude, lng: UDEA_MEDICINA_COORDS.longitude };
            updated = true;
          }
        }
      });
      if (updated) {
        localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(storedEvents));
      }
    } catch (err) {
      console.warn('Error al verificar migración de eventos:', err);
    }
  }

  if (!localStorage.getItem(STORAGE_KEY_ATTENDANCE)) {
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(SEED_ATTENDANCE));
  }
  if (!localStorage.getItem(STORAGE_KEY_QUESTIONS)) {
    localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(SEED_QUESTIONS));
  }
  if (!localStorage.getItem(STORAGE_KEY_EVALUATIONS)) {
    localStorage.setItem(STORAGE_KEY_EVALUATIONS, JSON.stringify(SEED_EVALUATIONS));
  }
  if (!localStorage.getItem(STORAGE_KEY_SATISFACTION)) {
    localStorage.setItem(STORAGE_KEY_SATISFACTION, JSON.stringify(SEED_SATISFACTION));
  }
}

// Métodos de Eventos
export function getEvents() {
  initStorage();
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_EVENTS) || '[]');
  } catch {
    return SEED_EVENTS;
  }
}

export async function saveEvent(eventData) {
  const events = getEvents();
  const index = events.findIndex(e => e.id === eventData.id);
  if (index >= 0) {
    events[index] = eventData;
  } else {
    events.unshift(eventData);
  }
  localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));

  // Sincronizar inmediatamente con Cloud Firestore en la colección 'eventos'
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, 'eventos', eventData.id), eventData);
      console.info('✓ Evento sincronizado en Cloud Firestore en vivo:', eventData.id);
    } catch (err) {
      console.error('Error al guardar evento en Firestore:', err);
    }
  }

  // Notificar cambios para reactividad en todas las pestañas y componentes
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY_EVENTS }));
  return eventData;
}

export async function deleteEvent(eventId) {
  // 1. Eliminar evento de la lista local
  const events = getEvents().filter(e => e.id !== eventId);
  localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));

  // Eliminar de Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await deleteDoc(doc(db, 'eventos', eventId));
      console.info('✓ Evento eliminado de Cloud Firestore:', eventId);
    } catch (err) {
      console.error('Error eliminando evento de Firestore:', err);
    }
  }

  // 2. Purgar asistencias del evento
  const remainingAtt = getAttendance().filter(a => a.eventoId !== eventId);
  localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(remainingAtt));

  // 3. Purgar preguntas del evento
  const remainingQ = getQuestions().filter(q => q.eventoId !== eventId);
  localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(remainingQ));

  // 4. Purgar evaluaciones de ponentes del evento
  const remainingEval = getEvaluations().filter(ev => ev.eventoId !== eventId);
  localStorage.setItem(STORAGE_KEY_EVALUATIONS, JSON.stringify(remainingEval));

  // 5. Purgar satisfacción del evento
  const remainingSat = getSatisfaction().filter(s => s.eventoId !== eventId);
  localStorage.setItem(STORAGE_KEY_SATISFACTION, JSON.stringify(remainingSat));

  // 6. Limpiar sesión en caché del asistente para este evento
  try {
    localStorage.removeItem(`udea_session_attendee_${eventId}`);
  } catch {}

  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY_EVENTS }));
  return events;
}

// Suscripción reactiva a eventos en tiempo real multi-dispositivo
export function subscribeToEvents(onUpdate) {
  const unsubs = [];

  const storageHandler = (e) => {
    if (e.key === STORAGE_KEY_EVENTS) {
      if (onUpdate) onUpdate(getEvents());
    }
  };
  window.addEventListener('storage', storageHandler);
  unsubs.push(() => window.removeEventListener('storage', storageHandler));

  if (isFirebaseConfigured() && db) {
    try {
      const unsubFirestore = onSnapshot(collection(db, 'eventos'), (snapshot) => {
        const cloudEvents = [];
        snapshot.forEach(docSnap => cloudEvents.push(docSnap.data()));

        if (cloudEvents.length > 0) {
          const localEvents = getEvents();
          const map = new Map();
          localEvents.forEach(ev => map.set(ev.id, ev));
          cloudEvents.forEach(ev => {
            map.set(ev.id, ev);
            if (ev?.inscritosData) {
              try {
                localStorage.setItem(STORAGE_KEY_INSCRITOS_PREFIX + ev.id, JSON.stringify(ev.inscritosData));
              } catch {}
            }
          });

          const merged = Array.from(map.values());
          localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(merged));
          if (onUpdate) onUpdate(merged);
        }
      }, (err) => {
        console.warn('Aviso sincronización Firestore eventos:', err?.message);
      });
      unsubs.push(unsubFirestore);
    } catch (err) {
      console.warn('Error al suscribir eventos en Firestore:', err);
    }
  }

  return () => {
    unsubs.forEach(fn => {
      try { fn(); } catch {}
    });
  };
}

// Métodos de Asistencia
export function getAttendance(eventId = null) {
  initStorage();
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_ATTENDANCE) || '[]');
    return eventId ? list.filter(a => a.eventoId === eventId) : list;
  } catch {
    return [];
  }
}

export async function recordAttendance(record) {
  const list = getAttendance();

  // Fecha de la sesión (formato ISO YYYY-MM-DD)
  const fechaDia = record.fechaDia || (record.fechaRegistro ? String(record.fechaRegistro).slice(0, 10) : new Date().toISOString().slice(0, 10));

  // Evitar duplicados por cédula, evento y día específico (soporta multidía)
  const existe = list.find(a =>
    a.eventoId === record.eventoId &&
    String(a.documento).trim() === String(record.documento).trim() &&
    (a.fechaDia ? a.fechaDia === fechaDia : (record.diaNumero ? a.diaNumero === record.diaNumero : true))
  );

  if (existe) {
    const diaDesc = record.diaNumero ? `Día ${record.diaNumero} (${fechaDia})` : fechaDia;
    return {
      success: false,
      message: `Ya se encuentra registrada la asistencia con el documento ${record.documento} para la sesión del ${diaDesc}.`
    };
  }

  const newId = `ATT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const tokenSeguridad = await generateVerificationToken(newId, record.eventoId, record.documento);

  const newRecord = {
    ...record,
    id: newId,
    fechaDia,
    diaNumero: record.diaNumero || 1,
    tokenSeguridad,
    fechaRegistro: record.fechaRegistro || new Date().toLocaleString('es-CO'),
    horaRegistro: record.horaRegistro || new Date().toLocaleTimeString('es-CO'),
    fechaVerificadaInternet: Boolean(record.fechaVerificadaInternet),
    fuenteTiempo: record.fuenteTiempo || 'Local'
  };

  const publicVerification = {
    id: newRecord.id,
    token: tokenSeguridad,
    eventoId: newRecord.eventoId,
    nombreCompleto: newRecord.nombreCompleto,
    tipoDocumento: newRecord.tipoDocumento || 'CC',
    documentoMasked: maskDocumento(newRecord.documento),
    vinculacion: newRecord.vinculacion || 'Asistente',
    placaVehiculo: newRecord.placaVehiculo || '',
    fechaRegistro: newRecord.fechaRegistro,
    fechaDia: newRecord.fechaDia,
    diaNumero: newRecord.diaNumero,
    esPresencial: Boolean(newRecord.geolocalizacion?.esPresencial),
    distanciaSedeMetros: newRecord.geolocalizacion?.distanciaSedeMetros ?? null,
    estado: 'VALIDO',
    creadoEn: new Date().toISOString()
  };

  // Guardar primero en Cloud Firestore para sincronización multi-dispositivo en vivo
  if (db) {
    try {
      await setDoc(doc(db, 'asistencias', newRecord.id), newRecord);
      // Guardar también en la colección pública de verificación segura
      await setDoc(doc(db, 'verificaciones', newRecord.id), publicVerification);
      console.info('✓ Asistencia y verificación registradas en Firebase Firestore en vivo:', newRecord.id);
    } catch (err) {
      console.error('Error guardando en Firestore:', err);
    }
  }

  list.unshift(newRecord);
  localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(list));

  // Guardar en caché local de verificaciones
  try {
    const localVerifs = JSON.parse(localStorage.getItem(STORAGE_KEY_VERIFICATIONS) || '{}');
    localVerifs[newRecord.id] = publicVerification;
    localStorage.setItem(STORAGE_KEY_VERIFICATIONS, JSON.stringify(localVerifs));
  } catch (e) {
    console.warn('Error guardando verificación en localStorage:', e);
  }

  return { success: true, record: newRecord };
}

export async function deleteAttendance(attId) {
  const list = getAttendance().filter(a => a.id !== attId);
  localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(list));

  try {
    const localVerifs = JSON.parse(localStorage.getItem(STORAGE_KEY_VERIFICATIONS) || '{}');
    delete localVerifs[attId];
    localStorage.setItem(STORAGE_KEY_VERIFICATIONS, JSON.stringify(localVerifs));
  } catch {}

  if (isFirebaseConfigured() && db) {
    try {
      await deleteDoc(doc(db, 'asistencias', attId));
      await deleteDoc(doc(db, 'verificaciones', attId));
    } catch {
      // Firestore sync notice
    }
  }

  return list;
}

// Elimina todos los registros de asistencia de un evento (o generales)
export async function deleteAllAttendance(eventId = null) {
  const all = getAttendance();
  const toDelete = eventId ? all.filter(a => a.eventoId === eventId) : all;
  const remaining = eventId ? all.filter(a => a.eventoId !== eventId) : [];

  localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(remaining));

  // Limpiar verificaciones asociadas
  try {
    const localVerifs = JSON.parse(localStorage.getItem(STORAGE_KEY_VERIFICATIONS) || '{}');
    toDelete.forEach(a => {
      delete localVerifs[a.id];
    });
    localStorage.setItem(STORAGE_KEY_VERIFICATIONS, JSON.stringify(localVerifs));
  } catch {}

  // Si Firestore está activo, purgar los documentos en la nube
  if (isFirebaseConfigured() && db) {
    try {
      for (const item of toDelete) {
        await deleteDoc(doc(db, 'asistencias', item.id)).catch(() => {});
        await deleteDoc(doc(db, 'verificaciones', item.id)).catch(() => {});
      }
    } catch {
      // Firestore sync notice
    }
  }

  // Despachar evento para reactividad inmediata en todos los componentes
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY_ATTENDANCE }));
  return remaining;
}

// Verifica el código QR de una escarapela digital
export async function verifyAttendanceRecord(comprobanteId, providedToken = null) {
  if (!comprobanteId || typeof comprobanteId !== 'string') {
    return { success: false, message: 'Código de comprobante no proporcionado o inválido.' };
  }

  const cleanId = comprobanteId.trim();

  // 1. Intentar consultar en Firebase Firestore colección 'verificaciones'
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'verificaciones', cleanId));
      if (snap.exists()) {
        const data = snap.data();
        if (providedToken && data.token && data.token !== providedToken) {
          return {
            success: false,
            message: 'El código de verificación no coincide con el registro oficial. Este pase digital ha sido modificado o no es válido.'
          };
        }
        return { success: true, record: data, fromCloud: true };
      }
    } catch {
      // Firestore sync notice
    }
  }

  // 2. Fallback a caché local de verificaciones
  try {
    const localVerifs = JSON.parse(localStorage.getItem(STORAGE_KEY_VERIFICATIONS) || '{}');
    if (localVerifs[cleanId]) {
      const data = localVerifs[cleanId];
      if (providedToken && data.token && data.token !== providedToken) {
        return {
          success: false,
          message: 'El código de verificación no coincide con el registro original.'
        };
      }
      return { success: true, record: data, fromCloud: false };
    }
  } catch {}

  // 3. Fallback a la lista local de asistencias
  const list = getAttendance();
  const found = list.find(a => a.id === cleanId);
  if (found) {
    const expectedToken = found.tokenSeguridad || await generateVerificationToken(found.id, found.eventoId, found.documento);
    if (providedToken && expectedToken !== providedToken) {
      return {
        success: false,
        message: 'El código de verificación no coincide con el registro original.'
      };
    }

    return {
      success: true,
      record: {
        id: found.id,
        token: expectedToken,
        eventoId: found.eventoId,
        nombreCompleto: found.nombreCompleto,
        tipoDocumento: found.tipoDocumento || 'CC',
        documentoMasked: maskDocumento(found.documento),
        vinculacion: found.vinculacion || 'Asistente',
        placaVehiculo: found.placaVehiculo || '',
        fechaRegistro: found.fechaRegistro,
        esPresencial: Boolean(found.geolocalizacion?.esPresencial),
        distanciaSedeMetros: found.geolocalizacion?.distanciaSedeMetros ?? null,
        estado: 'VALIDO'
      },
      fromCloud: false
    };
  }

  return {
    success: false,
    message: `No se encontró ningún registro de asistencia con el número de comprobante "${cleanId}".`
  };
}

// Métodos de Preguntas en Vivo
export function getQuestions(eventId = null) {
  initStorage();
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_QUESTIONS) || '[]');
    return eventId ? list.filter(q => q.eventoId === eventId) : list;
  } catch {
    return [];
  }
}

export async function addQuestion(qData) {
  const list = getQuestions();
  const newQ = {
    ...qData,
    id: `Q-${Date.now()}`,
    hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    respondida: false,
    destacada: false
  };
  list.unshift(newQ);
  localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(list));

  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, 'preguntas', newQ.id), newQ);
    } catch {
      // Firestore sync notice
    }
  }

  return newQ;
}

export async function toggleQuestionAnswered(qId) {
  const list = getQuestions();
  const item = list.find(q => q.id === qId);
  if (item) {
    item.respondida = !item.respondida;
    localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(list));

    if (isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, 'preguntas', qId), { respondida: item.respondida });
      } catch {
        // Firestore sync notice
      }
    }
  }
  return list;
}

export async function toggleQuestionFeatured(qId) {
  const list = getQuestions();
  const item = list.find(q => q.id === qId);
  if (item) {
    item.destacada = !item.destacada;
    localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(list));

    if (isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, 'preguntas', qId), { destacada: item.destacada });
      } catch {
        // Firestore sync notice
      }
    }
  }
  return list;
}

export async function deleteQuestion(qId) {
  const list = getQuestions().filter(q => q.id !== qId);
  localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(list));

  if (isFirebaseConfigured() && db) {
    try {
      await deleteDoc(doc(db, 'preguntas', qId));
    } catch {
      // Firestore sync notice
    }
  }

  return list;
}

// Métodos de Evaluaciones de Ponentes
export function getEvaluations(eventId = null) {
  initStorage();
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_EVALUATIONS) || '[]');
    return eventId ? list.filter(ev => ev.eventoId === eventId) : list;
  } catch {
    return [];
  }
}

export async function recordEvaluation(evalData) {
  const list = getEvaluations();
  const newEval = {
    ...evalData,
    id: `EVAL-${Date.now()}`,
    fecha: new Date().toLocaleString('es-CO')
  };
  list.unshift(newEval);
  localStorage.setItem(STORAGE_KEY_EVALUATIONS, JSON.stringify(list));

  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, 'evaluaciones', newEval.id), newEval);
    } catch {
      // Firestore sync notice
    }
  }

  return newEval;
}

export async function deleteEvaluation(evalId) {
  const list = getEvaluations().filter(ev => ev.id !== evalId);
  localStorage.setItem(STORAGE_KEY_EVALUATIONS, JSON.stringify(list));

  if (isFirebaseConfigured() && db) {
    try {
      await deleteDoc(doc(db, 'evaluaciones', evalId));
    } catch {
      // Firestore sync notice
    }
  }

  return list;
}

// Métodos de Satisfacción General
export function getSatisfaction(eventId = null) {
  initStorage();
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_SATISFACTION) || '[]');
    return eventId ? list.filter(s => s.eventoId === eventId) : list;
  } catch {
    return [];
  }
}

export async function recordSatisfaction(satData) {
  const list = getSatisfaction();
  const newSat = {
    ...satData,
    id: `SAT-${Date.now()}`,
    fecha: new Date().toLocaleString('es-CO')
  };
  list.unshift(newSat);
  localStorage.setItem(STORAGE_KEY_SATISFACTION, JSON.stringify(list));

  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, 'satisfaccion', newSat.id), newSat);
    } catch {
      // Firestore sync notice
    }
  }

  return newSat;
}

export async function deleteSatisfaction(satId) {
  const list = getSatisfaction().filter(s => s.id !== satId);
  localStorage.setItem(STORAGE_KEY_SATISFACTION, JSON.stringify(list));

  if (isFirebaseConfigured() && db) {
    try {
      await deleteDoc(doc(db, 'satisfaccion', satId));
    } catch {
      // Firestore sync notice
    }
  }

  return list;
}

// =========================================================================
// MÓDULO DE CONTROL DE ALMUERZOS, REFRIGERIOS Y ALIMENTACIÓN
// =========================================================================

export function getMealDeliveries(eventId = null) {
  initStorage();
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_MEALS) || '[]');
    return eventId ? list.filter(m => m.eventoId === eventId) : list;
  } catch {
    return [];
  }
}

// Verifica en tiempo real (en Firestore con fallback local) si un participante ya reclamó una comida específica
export async function checkMealAlreadyClaimed(eventoId, comidaId, documento) {
  if (!eventoId || !comidaId || !documento) return { claimed: false };
  const cleanDoc = normalizeDocumentId(documento);
  const deliveryId = `${eventoId}_${comidaId}_${cleanDoc}`;

  // 1. Verificación directa en Cloud Firestore (evita duplicados multi-dispositivo en milisegundos)
  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDoc(doc(db, 'entregas_comidas', deliveryId));
      if (snap.exists()) {
        const record = snap.data();
        return { claimed: true, record, fromCloud: true };
      }
    } catch (err) {
      console.warn('Aviso al verificar entrega de comida en Firestore:', err);
    }
  }

  // 2. Consulta en caché local segura
  const localList = getMealDeliveries(eventoId);
  const found = localList.find(m => m.comidaId === comidaId && normalizeDocumentId(m.documento) === cleanDoc);
  if (found) {
    return { claimed: true, record: found, fromCloud: false };
  }

  return { claimed: false };
}

// Registra la entrega de un almuerzo/refrigerio asegurando persistencia en Cloud Firestore y caché local
export async function recordMealDelivery(deliveryData) {
  if (!deliveryData?.eventoId || !deliveryData?.comidaId || !deliveryData?.documento) {
    return { success: false, message: 'Datos incompletos para registrar la entrega.' };
  }

  const cleanDoc = normalizeDocumentId(deliveryData.documento);
  const deliveryId = `${deliveryData.eventoId}_${deliveryData.comidaId}_${cleanDoc}`;

  // Doble validación en vivo para garantizar que no haya sido reclamado en otra pantalla justo antes
  if (isFirebaseConfigured() && db) {
    try {
      const existingSnap = await getDoc(doc(db, 'entregas_comidas', deliveryId));
      if (existingSnap.exists()) {
        return {
          success: false,
          alreadyClaimed: true,
          record: existingSnap.data(),
          message: 'Este beneficio ya fue reclamado en otro dispositivo.'
        };
      }
    } catch {}
  }

  const now = new Date();
  const newDelivery = {
    ...deliveryData,
    id: deliveryId,
    documento: cleanDoc,
    fechaDia: deliveryData.fechaDia || getColombiaLocalDateStr(),
    horaEntrega: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    fechaHoraISO: now.toISOString(),
    registradoEn: now.toLocaleString('es-CO')
  };

  // 1. Guardar en caché local
  const list = getMealDeliveries();
  const existingIndex = list.findIndex(m => m.id === deliveryId);
  if (existingIndex >= 0) {
    list[existingIndex] = newDelivery;
  } else {
    list.unshift(newDelivery);
  }
  localStorage.setItem(STORAGE_KEY_MEALS, JSON.stringify(list));

  // 2. Guardar en Cloud Firestore en tiempo real
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, 'entregas_comidas', deliveryId), newDelivery, { merge: true });
    } catch (err) {
      console.warn('Aviso guardando entrega en Firestore:', err);
    }
  }

  // Notificar reactividad a todas las pestañas locales
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY_MEALS }));
  return { success: true, record: newDelivery };
}

// Elimina/revoca una entrega de comida (en caso de anulación administrativa)
export async function deleteMealDelivery(deliveryId) {
  if (!deliveryId) return [];
  const list = getMealDeliveries().filter(m => m.id !== deliveryId);
  localStorage.setItem(STORAGE_KEY_MEALS, JSON.stringify(list));

  if (isFirebaseConfigured() && db) {
    try {
      await deleteDoc(doc(db, 'entregas_comidas', deliveryId));
    } catch (err) {
      console.warn('Aviso eliminando entrega en Firestore:', err);
    }
  }

  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY_MEALS }));
  return list;
}

// Suscripción en Tiempo Real Multi-dispositivo (Firestore Snapshot en vivo)
export function subscribeToEventData(eventId, onUpdate) {
  if (!eventId) return () => {};

  const unsubs = [];

  // 1. Escuchar eventos locales entre pestañas del mismo navegador
  const storageHandler = (e) => {
    if ([
      STORAGE_KEY_ATTENDANCE,
      STORAGE_KEY_QUESTIONS,
      STORAGE_KEY_EVALUATIONS,
      STORAGE_KEY_SATISFACTION,
      STORAGE_KEY_MEALS
    ].includes(e.key)) {
      if (onUpdate) onUpdate();
    }
  };
  window.addEventListener('storage', storageHandler);
  unsubs.push(() => window.removeEventListener('storage', storageHandler));

  // 2. Escuchar Firestore Cloud en tiempo real multi-dispositivo (móvil, tablet, laptop)
  if (db) {
    try {
      // Sincronización en vivo de Asistencias
      const unsubAtt = onSnapshot(
        query(collection(db, 'asistencias'), where('eventoId', '==', eventId)),
        (snapshot) => {
          const cloudList = [];
          snapshot.forEach(docSnap => cloudList.push(docSnap.data()));
          const localOther = getAttendance().filter(a => a.eventoId !== eventId);
          // Si cloudList tiene datos, o si la colección en nube se vació, actualizar la caché
          const combined = [...cloudList, ...localOther];
          localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(combined));
          if (onUpdate) onUpdate();
        },
        (err) => console.warn('Firestore asistencias snapshot:', err)
      );
      unsubs.push(unsubAtt);

      // Sincronización en vivo de Preguntas a Ponentes
      const unsubQ = onSnapshot(
        query(collection(db, 'preguntas'), where('eventoId', '==', eventId)),
        (snapshot) => {
          const cloudQ = [];
          snapshot.forEach(docSnap => cloudQ.push(docSnap.data()));
          const localOther = getQuestions().filter(q => q.eventoId !== eventId);
          const combined = [...cloudQ, ...localOther];
          localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(combined));
          if (onUpdate) onUpdate();
        },
        (err) => console.warn('Firestore preguntas snapshot:', err)
      );
      unsubs.push(unsubQ);

      // Sincronización en vivo de Calificaciones de Ponentes
      const unsubEval = onSnapshot(
        query(collection(db, 'evaluaciones'), where('eventoId', '==', eventId)),
        (snapshot) => {
          const cloudEval = [];
          snapshot.forEach(docSnap => cloudEval.push(docSnap.data()));
          const localOther = getEvaluations().filter(ev => ev.eventoId !== eventId);
          const combined = [...cloudEval, ...localOther];
          localStorage.setItem(STORAGE_KEY_EVALUATIONS, JSON.stringify(combined));
          if (onUpdate) onUpdate();
        },
        (err) => console.warn('Firestore evaluaciones snapshot:', err)
      );
      unsubs.push(unsubEval);

      // Sincronización en vivo de Encuestas de Satisfacción
      const unsubSat = onSnapshot(
        query(collection(db, 'satisfaccion'), where('eventoId', '==', eventId)),
        (snapshot) => {
          const cloudSat = [];
          snapshot.forEach(docSnap => cloudSat.push(docSnap.data()));
          const localOther = getSatisfaction().filter(s => s.eventoId !== eventId);
          const combined = [...cloudSat, ...localOther];
          localStorage.setItem(STORAGE_KEY_SATISFACTION, JSON.stringify(combined));
          if (onUpdate) onUpdate();
        },
        (err) => console.warn('Firestore satisfaccion snapshot:', err)
      );
      unsubs.push(unsubSat);

      // Sincronización en vivo de Entregas de Almuerzos y Refrigerios
      const unsubMeals = onSnapshot(
        query(collection(db, 'entregas_comidas'), where('eventoId', '==', eventId)),
        (snapshot) => {
          const cloudMeals = [];
          snapshot.forEach(docSnap => cloudMeals.push(docSnap.data()));
          const localOther = getMealDeliveries().filter(m => m.eventoId !== eventId);
          const combined = [...cloudMeals, ...localOther];
          localStorage.setItem(STORAGE_KEY_MEALS, JSON.stringify(combined));
          if (onUpdate) onUpdate();
        },
        (err) => console.warn('Firestore entregas_comidas snapshot:', err)
      );
      unsubs.push(unsubMeals);

      // Sincronización en vivo de Lista Oficial de Inscritos (Excel / CSV)
      const unsubInscritos = onSnapshot(
        doc(db, 'inscritos', eventId),
        (snapshot) => {
          if (snapshot.exists()) {
            const cloudData = snapshot.data();
            try {
              localStorage.setItem(STORAGE_KEY_INSCRITOS_PREFIX + eventId, JSON.stringify(cloudData));
            } catch {}
          } else {
            try {
              localStorage.removeItem(STORAGE_KEY_INSCRITOS_PREFIX + eventId);
            } catch {}
          }
          if (onUpdate) onUpdate();
        },
        (err) => console.warn('Firestore inscritos snapshot en subscribeToEventData:', err)
      );
      unsubs.push(unsubInscritos);
    } catch (err) {
      console.error('Error al configurar los listeners en vivo de Firestore:', err);
    }
  }

  return () => {
    unsubs.forEach(unsub => {
      try { unsub(); } catch {}
    });
  };
}

// Función matemática de Haversine para cálculo de distancia GPS exacta en metros
export function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radio de la Tierra en metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Exportar respaldo integral de base de datos en formato JSON (Local-First)
export function exportDatabaseBackupJSON() {
  const backup = {
    version: '1.0',
    fechaExportacion: new Date().toISOString(),
    institucion: 'Facultad de Medicina - Universidad de Antioquia',
    data: {
      events: JSON.parse(localStorage.getItem(STORAGE_KEY_EVENTS) || '[]'),
      attendance: JSON.parse(localStorage.getItem(STORAGE_KEY_ATTENDANCE) || '[]'),
      questions: JSON.parse(localStorage.getItem(STORAGE_KEY_QUESTIONS) || '[]'),
      evaluations: JSON.parse(localStorage.getItem(STORAGE_KEY_EVALUATIONS) || '[]'),
      satisfaction: JSON.parse(localStorage.getItem(STORAGE_KEY_SATISFACTION) || '[]'),
      meals: JSON.parse(localStorage.getItem(STORAGE_KEY_MEALS) || '[]')
    }
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Backup_UdeA_Medicina_Eventos_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Restaurar respaldo integral de base de datos desde archivo JSON
export function importDatabaseBackupJSON(jsonString) {
  try {
    const backup = JSON.parse(jsonString);
    if (!backup?.data || !Array.isArray(backup.data.events)) {
      return { success: false, message: 'El archivo no contiene un formato de respaldo válido de UdeA Medicina.' };
    }

    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(backup.data.events || []));
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(backup.data.attendance || []));
    localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(backup.data.questions || []));
    localStorage.setItem(STORAGE_KEY_EVALUATIONS, JSON.stringify(backup.data.evaluations || []));
    localStorage.setItem(STORAGE_KEY_SATISFACTION, JSON.stringify(backup.data.satisfaction || []));
    if (backup.data.meals) {
      localStorage.setItem(STORAGE_KEY_MEALS, JSON.stringify(backup.data.meals || []));
    }

    return {
      success: true,
      countEvents: backup.data.events.length,
      countAttendance: backup.data.attendance?.length || 0
    };
  } catch (err) {
    return { success: false, message: 'Error al procesar el archivo JSON: ' + (err?.message || 'Formato no válido') };
  }
}

// =========================================================================
// GESTIÓN DE LISTAS DE INSCRITOS POR EVENTO (EXCEL / CSV)
// =========================================================================
const STORAGE_KEY_INSCRITOS_PREFIX = 'udea_med_inscritos_';

export function getEventInscritos(eventoId) {
  if (!eventoId) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INSCRITOS_PREFIX + eventoId);
    if (raw) {
      const parsed = JSON.parse(raw);
      const docs = Array.isArray(parsed?.documents) ? parsed.documents : (Array.isArray(parsed) ? parsed : []);
      if (docs.length > 0) return docs;
    }
    // Respaldo directo desde el evento activo (sincronizado desde Cloud Firestore)
    const events = getEvents();
    const ev = events.find(e => e.id === eventoId);
    if (ev?.inscritosData?.documents && Array.isArray(ev.inscritosData.documents)) {
      try {
        localStorage.setItem(STORAGE_KEY_INSCRITOS_PREFIX + eventoId, JSON.stringify(ev.inscritosData));
      } catch {}
      return ev.inscritosData.documents;
    }
    return [];
  } catch {
    return [];
  }
}

export function getEventInscritosData(eventoId) {
  if (!eventoId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INSCRITOS_PREFIX + eventoId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.documents)) return parsed;
    }
    // Respaldo directo desde el evento activo en memoria/localStorage
    const events = getEvents();
    const ev = events.find(e => e.id === eventoId);
    if (ev?.inscritosData) {
      try {
        localStorage.setItem(STORAGE_KEY_INSCRITOS_PREFIX + eventoId, JSON.stringify(ev.inscritosData));
      } catch {}
      return ev.inscritosData;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveEventInscritos(eventoId, data) {
  if (!eventoId || !data) return { success: false, message: 'Faltan parámetros obligatorios.' };

  const payload = {
    eventoId,
    documents: data.documents || [],
    count: (data.documents || []).length,
    fileName: data.fileName || 'Inscritos.xlsx',
    detectedColumn: data.detectedColumn || '',
    sample: (data.documents || []).slice(0, 10),
    actualizadoEn: new Date().toISOString()
  };

  // 1. Guardar localmente
  try {
    localStorage.setItem(STORAGE_KEY_INSCRITOS_PREFIX + eventoId, JSON.stringify(payload));
  } catch (err) {
    console.warn('Error guardando inscritos en localStorage:', err);
  }

  // 2. Sincronizar en el objeto del evento y guardar en Cloud Firestore colección 'eventos'
  // Garantiza persistencia multi-dispositivo sin depender de reglas externas de colección
  try {
    const events = getEvents();
    const ev = events.find(e => e.id === eventoId);
    if (ev) {
      ev.inscritosResumen = {
        total: payload.count,
        fileName: payload.fileName,
        fechaCarga: payload.actualizadoEn,
        habilitado: payload.count > 0
      };
      ev.inscritosData = payload;
      await saveEvent(ev);
      console.info('✓ Lista de inscritos guardada en Cloud Firestore (evento):', eventoId);
    }
  } catch (err) {
    console.warn('Error actualizando lista en el evento:', err);
  }

  // 3. Sincronizar también en Cloud Firestore colección 'inscritos' (respaldo complementario)
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, 'inscritos', eventoId), payload);
      console.info('✓ Lista de inscritos guardada en Cloud Firestore (colección inscritos):', eventoId);
    } catch {
      // Si la colección 'inscritos' tiene restricción de reglas, el evento ya la guardó arriba
    }
  }

  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY_INSCRITOS_PREFIX + eventoId }));
  return { success: true, payload };
}

export async function deleteEventInscritos(eventoId) {
  if (!eventoId) return;

  try {
    localStorage.removeItem(STORAGE_KEY_INSCRITOS_PREFIX + eventoId);
  } catch {}

  // 1. Eliminar datos del objeto del evento en Firestore
  try {
    const events = getEvents();
    const ev = events.find(e => e.id === eventoId);
    if (ev) {
      delete ev.inscritosResumen;
      delete ev.inscritosData;
      await saveEvent(ev);
    }
  } catch {}

  // 2. Eliminar de colección 'inscritos' en Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await deleteDoc(doc(db, 'inscritos', eventoId));
    } catch {}
  }

  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY_INSCRITOS_PREFIX + eventoId }));
}

export async function fetchEventInscritosData(eventoId) {
  if (!eventoId) return null;
  if (isFirebaseConfigured() && db) {
    // 1. Prioridad: obtener directamente del documento del evento en Firestore (siempre sincronizado)
    try {
      const evSnap = await getDoc(doc(db, 'eventos', eventoId));
      if (evSnap.exists()) {
        const evData = evSnap.data();
        if (evData?.inscritosData) {
          try {
            localStorage.setItem(STORAGE_KEY_INSCRITOS_PREFIX + eventoId, JSON.stringify(evData.inscritosData));
          } catch {}
          return evData.inscritosData;
        }
      }
    } catch (err) {
      console.warn('Aviso leyendo inscritos de evento en Firestore:', err);
    }

    // 2. Intentar leer desde colección 'inscritos'
    try {
      const snap = await getDoc(doc(db, 'inscritos', eventoId));
      if (snap.exists()) {
        const cloudData = snap.data();
        try {
          localStorage.setItem(STORAGE_KEY_INSCRITOS_PREFIX + eventoId, JSON.stringify(cloudData));
        } catch {}
        return cloudData;
      }
    } catch {
      // Si la colección 'inscritos' está restringida, ya se usó el evento
    }
  }
  return getEventInscritosData(eventoId);
}

export function subscribeToEventInscritos(eventoId, onUpdate) {
  if (!eventoId) return () => {};

  const handleLocal = (e) => {
    if (!e || e.key === STORAGE_KEY_INSCRITOS_PREFIX + eventoId) {
      const docs = getEventInscritos(eventoId);
      const fullData = getEventInscritosData(eventoId);
      onUpdate(docs, fullData);
    }
  };
  window.addEventListener('storage', handleLocal);

  let unsubscribeFirestore = () => {};
  if (isFirebaseConfigured() && db) {
    try {
      unsubscribeFirestore = onSnapshot(doc(db, 'inscritos', eventoId), (snapshot) => {
        if (snapshot.exists()) {
          const cloudData = snapshot.data();
          try {
            localStorage.setItem(STORAGE_KEY_INSCRITOS_PREFIX + eventoId, JSON.stringify(cloudData));
          } catch {}
          onUpdate(cloudData?.documents || [], cloudData);
        } else {
          try {
            localStorage.removeItem(STORAGE_KEY_INSCRITOS_PREFIX + eventoId);
          } catch {}
          onUpdate([], null);
        }
      });
    } catch (err) {
      console.warn('Error en listener de Firestore inscritos:', err);
    }
  }

  return () => {
    window.removeEventListener('storage', handleLocal);
    unsubscribeFirestore();
  };
}

