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

    // Sincronización multi-dispositivo en tiempo real de la colección de listas de inscritos
    try {
      const unsubInscritos = onSnapshot(collection(db, 'inscritos'), (snapshot) => {
        let changed = false;
        const currentEvents = getEvents();
        snapshot.forEach(docSnap => {
          const cloudInscritos = docSnap.data();
          if (cloudInscritos && cloudInscritos.eventoId) {
            try {
              localStorage.setItem(STORAGE_KEY_INSCRITOS_PREFIX + cloudInscritos.eventoId, JSON.stringify(cloudInscritos));
            } catch {}
            const ev = currentEvents.find(e => e.id === cloudInscritos.eventoId);
            if (ev) {
              ev.inscritosData = cloudInscritos;
              ev.inscritosResumen = {
                total: cloudInscritos.count || (cloudInscritos.documents || []).length,
                fileName: cloudInscritos.fileName || 'Inscritos.xlsx',
                fechaCarga: cloudInscritos.actualizadoEn,
                habilitado: (cloudInscritos.count || (cloudInscritos.documents || []).length) > 0
              };
              changed = true;
            }
          }
        });
        if (changed) {
          localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(currentEvents));
          if (onUpdate) onUpdate(currentEvents);
        }
      }, (err) => {
        console.warn('Aviso sincronización Firestore inscritos:', err?.message);
      });
      unsubs.push(unsubInscritos);
    } catch (err) {
      console.warn('Error al suscribir colección inscritos en Firestore:', err);
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
    documento: newRecord.documento,
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
        // Si faltaba el documento completo, recuperarlo del almacenamiento local de asistencias
        if (!data.documento) {
          const localMatch = getAttendance().find(a => a.id === cleanId);
          if (localMatch?.documento) {
            data.documento = localMatch.documento;
          }
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
      if (!data.documento) {
        const localMatch = getAttendance().find(a => a.id === cleanId);
        if (localMatch?.documento) {
          data.documento = localMatch.documento;
        }
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
        documento: found.documento,
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

// Decodificador universal inteligente de documentos de identidad colombianos
// Soporta:
// 1. Cédula Tradicional Amarilla con hologramas (Código PDF417 de la Registraduría Nacional)
// 2. Tarjeta de Identidad Biometríca para menores de edad (TI con código PDF417)
// 3. Cédula Digital de policarbonato (Zona MRZ TD1 ICAO 9303 de 3 líneas o QR)
// 4. Cédula de Extranjería (CE) y Pasaporte
// 5. Código de barras 1D de escarapela o documento numérico directo
//
// GARANTÍA DE PRIVACIDAD Y HABEAS DATA (Ley 1581 de 2012 / SIC):
// Principio de Minimización de Datos en Memoria Volátil:
// El escáner puede emitir en el PDF417 datos de salud/biométricos como RH (factor sanguíneo)
// y el código dactilar AFIS. Estos datos sensibles son DESCARTADOS INMEDIATAMENTE en RAM,
// nunca se retornan, nunca se persisten en LocalStorage ni se sincronizan a Cloud Firestore.
// Decodificador universal inteligente de documentos de identidad colombianos
// Soporta:
// 1. Cédula Tradicional Amarilla con hologramas (Código PDF417 de la Registraduría Nacional)
// 2. Tarjeta de Identidad Biométrica para menores de edad (TI con código PDF417)
// 3. Cédula Digital de policarbonato (Zona MRZ TD1 ICAO 9303 de 3 líneas)
// 4. Detección segura de QR cifrado de la nueva Cédula Digital (evita desbordamientos y corrupción de datos)
// 5. Cédula de Extranjería (CE) y Pasaporte
// 6. Código de barras 1D de escarapela o documento numérico directo
//
// GARANTÍA DE PRIVACIDAD Y HABEAS DATA (Ley 1581 de 2012 / SIC):
// Principio de Minimización de Datos en Memoria Volátil:
// El escáner puede emitir en el PDF417 datos de salud/biométricos como RH (factor sanguíneo)
// y el código dactilar AFIS. Estos datos sensibles son DESCARTADOS INMEDIATAMENTE en RAM,
// nunca se retornan, nunca se persisten en LocalStorage ni se sincronizan a Cloud Firestore.
export function parseColombianDocumentBarcode(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const str = raw.trim();

  // Si es una URL o QR de escarapela digital, NO es un documento de identidad nacional
  if (
    str.startsWith('http://') ||
    str.startsWith('https://') ||
    str.includes('verificar=') ||
    str.includes('verify=') ||
    str.includes('credencial=') ||
    str.includes('?evento=')
  ) {
    return null;
  }

  // 1. Número directo limpio (ej: digitado manualmente o código de barras 1D de escarapela)
  const cleanSimple = str.replace(/[.\s-]/g, '');
  const simpleMatch = cleanSimple.match(/^(?:(CC|TI|CE|PAS|PA|RC))?(\d{6,11})$/i);
  if (simpleMatch && str.length <= 15) {
    return {
      documento: simpleMatch[2],
      nombreCompleto: '',
      primerNombre: '',
      segundoNombre: '',
      primerApellido: '',
      segundoApellido: '',
      tipoDocumento: (simpleMatch[1] || 'CC').toUpperCase(),
      source: 'DIRECT_DOC'
    };
  }

  // 2. Detección segura del QR cifrado de la nueva Cédula Digital (Policarbonato)
  // El código QR impreso en la nueva cédula contiene una firma biométrica encriptada
  // de la Registraduría Nacional / IDEMIA con alta densidad binaria/base64.
  // No contiene texto plano; decodificarlo como texto arrojaría basura y dañaría la interfaz.
  const hasMrzMarkers = str.includes('<') && (str.includes('COL') || str.includes('I<') || str.includes('ID'));
  if (!hasMrzMarkers && (str.length > 130 || str.includes('eyJ') || /[\x00-\x08\x0E-\x1F]/.test(raw))) {
    let hasTraditionalPdf417Offset = false;
    for (let i = 35; i <= 65; i++) {
      if (/^\d{10}$/.test(str.substring(i, i + 10))) {
        hasTraditionalPdf417Offset = true;
        break;
      }
    }

    if (!hasTraditionalPdf417Offset) {
      return {
        isEncryptedDigitalCedulaQR: true,
        documento: '',
        nombreCompleto: '',
        tipoDocumento: 'CC',
        source: 'CEDULA_DIGITAL_QR_ENCRIPTADO',
        error: 'QR_CIFRADO_REGISTRADURIA',
        message: 'El código QR de la nueva Cédula Digital contiene la firma biométrica cifrada exclusiva de la Registraduría Nacional. Por favor apunte el escáner a las 3 líneas de texto (MRZ) en el reverso del documento o digite el número de documento.'
      };
    }
  }

  // 3. Cédula Digital / Documentos con zona mecánica MRZ (3 líneas ICAO Doc 9303 TD1)
  if (hasMrzMarkers) {
    const mrzLines = str.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
    let line1 = '', line2 = '', line3 = '';
    if (mrzLines.length >= 3) {
      line1 = mrzLines[0];
      line2 = mrzLines[1];
      line3 = mrzLines[2];
    } else if (str.length >= 90) {
      line1 = str.substring(0, 30);
      line2 = str.substring(30, 60);
      line3 = str.substring(60, 90);
    }

    if (line3 && line3.includes('<<')) {
      const parts = line3.split('<<');
      const apellidosRaw = parts[0] || '';
      const nombresRaw = parts[1] || '';

      const apellidosList = apellidosRaw.split('<').filter(Boolean);
      const nombresList = nombresRaw.split('<').filter(Boolean);

      const primerApellido = (apellidosList[0] || '').replace(/[^A-ZÁÉÍÓÚÑ]/gi, '').trim();
      const segundoApellido = (apellidosList.slice(1).join(' ') || '').replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, '').trim();
      const primerNombre = (nombresList[0] || '').replace(/[^A-ZÁÉÍÓÚÑ]/gi, '').trim();
      const segundoNombre = (nombresList.slice(1).join(' ') || '').replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, '').trim();

      const nombres = [primerNombre, segundoNombre].filter(Boolean).join(' ');
      const apellidos = [primerApellido, segundoApellido].filter(Boolean).join(' ');
      const nombreCompleto = `${nombres} ${apellidos}`.replace(/\s+/g, ' ').trim();

      // Extraer número de documento estrictamente numérico
      let docNum = '';
      const docMatch = line1.match(/COL([A-Z0-9]+)/) || line2.match(/^([0-9]{7,11})/);
      if (docMatch) {
        docNum = docMatch[1].replace(/<.*$/, '').replace(/^[0]+/, '');
      } else {
        const anyNumber = line2.match(/(\d{7,11})/);
        if (anyNumber) docNum = anyNumber[1];
      }

      // Asegurar que docNum solo tenga dígitos limpios
      docNum = (docNum || '').replace(/\D/g, '');

      let tipoDoc = 'CC';
      if (line1.startsWith('IR') || line1.startsWith('IE') || str.includes('EXTRANJER')) tipoDoc = 'CE';
      else if (line1.startsWith('IT') || str.includes('IDENTIDAD')) tipoDoc = 'TI';

      // Detectar si por fecha de nacimiento en MRZ es menor de 18 años (TI)
      const mrzBirth = line2.match(/^.{0,10}(\d{2})(\d{2})(\d{2})/);
      if (mrzBirth) {
        const yy = parseInt(mrzBirth[1], 10);
        const fullYear = yy > 30 ? 1900 + yy : 2000 + yy;
        const currentYear = new Date().getFullYear();
        if ((currentYear - fullYear) < 18) tipoDoc = 'TI';
      }

      if (docNum && docNum.length >= 6) {
        return {
          documento: docNum,
          nombreCompleto,
          primerNombre,
          segundoNombre,
          primerApellido,
          segundoApellido,
          tipoDocumento: tipoDoc,
          source: 'CEDULA_DIGITAL_MRZ'
        };
      }
    }
  }

  // 4. Código PDF417 de la Registraduría Nacional (Cédula Tradicional Amarilla o Tarjeta de Identidad TI)
  if (str.length > 50 || str.includes('PubDSK')) {
    const cleaned = str.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');

    let docOffset = -1;
    // La estructura de la Registraduría Nacional contiene un bloque de 10 dígitos entre las posiciones 35 y 65
    for (let i = 35; i <= 65; i++) {
      const slice = str.substring(i, i + 10);
      if (/^\d{10}$/.test(slice)) {
        docOffset = i;
        break;
      }
    }

    let docNum = '';
    let primerApellido = '';
    let segundoApellido = '';
    let primerNombre = '';
    let segundoNombre = '';
    let fechaNacimiento = '';
    let tipoDoc = 'CC';

    if (docOffset >= 0) {
      // Estructura posicional oficial de la Registraduría Nacional de Colombia:
      // docOffset .. docOffset + 10: Documento (10 dígitos con relleno 0)
      // docOffset + 10 .. docOffset + 33: Primer Apellido (23 chars)
      // docOffset + 33 .. docOffset + 56: Segundo Apellido (23 chars)
      // docOffset + 56 .. docOffset + 79: Primer Nombre (23 chars)
      // docOffset + 79 .. docOffset + 102: Segundo Nombre (23 chars)
      // docOffset + 102 .. docOffset + 103: Sexo (1 char: M/F)
      // docOffset + 103 .. docOffset + 111: Fecha Nacimiento (8 chars: AAAAMMDD)
      const rawDoc = str.substring(docOffset, docOffset + 10);
      docNum = rawDoc.replace(/\D/g, '').replace(/^[0]+/, ''); // Eliminar ceros a la izquierda y garantizar solo dígitos

      primerApellido = str.substring(docOffset + 10, docOffset + 33).replace(/[^A-ZÁÉÍÓÚÑ]/gi, '').trim();
      segundoApellido = str.substring(docOffset + 33, docOffset + 56).replace(/[^A-ZÁÉÍÓÚÑ]/gi, '').trim();
      primerNombre = str.substring(docOffset + 56, docOffset + 79).replace(/[^A-ZÁÉÍÓÚÑ]/gi, '').trim();
      segundoNombre = str.substring(docOffset + 79, docOffset + 102).replace(/[^A-ZÁÉÍÓÚÑ]/gi, '').trim();

      const rawBirth = str.substring(docOffset + 103, docOffset + 111);
      if (/^\d{8}$/.test(rawBirth)) {
        fechaNacimiento = rawBirth;
      }
    } else {
      // Fallback heurístico por palabras clave si el hardware/driver alteró los offsets fijos
      const docMatch = cleaned.match(/\b0*(\d{7,10})\b/);
      if (docMatch) {
        docNum = docMatch[1].replace(/\D/g, '');
      }

      const nameWords = cleaned
        .split(/\s+/)
        .map(w => w.replace(/[^A-ZÁÉÍÓÚÑ]/g, '').trim())
        .filter(w => w.length >= 2 && !['PUBDSK', 'COL', 'OPE', 'CDS'].includes(w));

      if (nameWords.length >= 2) {
        primerApellido = nameWords[0] || '';
        segundoApellido = nameWords.length > 2 ? nameWords[1] : '';
        primerNombre = nameWords.length > 2 ? nameWords[2] : nameWords[1];
        segundoNombre = nameWords.slice(3).join(' ');
      }
    }

    // Identificar Tarjeta de Identidad (TI: menores de 18 años) vs Cédula de Ciudadanía (CC)
    if (!fechaNacimiento) {
      const birthMatch = cleaned.match(/\b(19\d{2}|20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/);
      if (birthMatch) fechaNacimiento = birthMatch[0];
    }

    if (fechaNacimiento && fechaNacimiento.length === 8) {
      const birthYear = parseInt(fechaNacimiento.substring(0, 4), 10);
      const currentYear = new Date().getFullYear();
      if ((currentYear - birthYear) < 18) {
        tipoDoc = 'TI';
      }
    }

    const nombres = [primerNombre, segundoNombre].filter(Boolean).join(' ');
    const apellidos = [primerApellido, segundoApellido].filter(Boolean).join(' ');
    const nombreCompleto = `${nombres} ${apellidos}`.replace(/\s+/g, ' ').trim();

    // Asegurar que docNum contenga únicamente dígitos numéricos y tenga longitud válida (6 a 11 dígitos)
    docNum = (docNum || '').replace(/\D/g, '');

    if (docNum && docNum.length >= 6) {
      return {
        documento: docNum,
        nombreCompleto: nombreCompleto || '',
        primerNombre,
        segundoNombre,
        primerApellido,
        segundoApellido,
        tipoDocumento: tipoDoc,
        source: 'CEDULA_PDF417'
        // PROTECCIÓN ESTRICTA DE DATOS SENSIBLES:
        // Los campos de salud (factor RH) y huella dactilar (AFIS) NO se retornan ni se almacenan.
      };
    }
  }

  return null;
}

// Alias para compatibilidad con código existente
export const parseColombianCedulaBarcode = parseColombianDocumentBarcode;

// Búsqueda universal de participante para escaneo con lector de código de barras USB o manual
// Acepta: Cédula física colombiana (PDF417), Código de barras 1D de escarapela, Comprobante ATT-..., URL completa de QR, o Cédula digitada
export async function lookupAttendeeUniversal(eventoId, rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { found: false, message: 'Código o número de documento no proporcionado.' };
  }

  let code = rawInput.trim();
  let token = null;
  let docFromUrl = null;

  // 1. PRIMERO: Si el escáner leyó la URL completa del QR de la escarapela digital
  // Ej: https://.../?verificar=ATT-123&doc=1037625123&token=xyz
  const isUrlScan =
    code.includes('verificar=') ||
    code.includes('verify=') ||
    code.includes('credencial=') ||
    code.startsWith('http://') ||
    code.startsWith('https://');

  if (isUrlScan) {
    const urlMatch = code.match(/[?&](?:verificar|verify|credencial)=([^&]+)/i);
    let comprobanteId = urlMatch && urlMatch[1] ? decodeURIComponent(urlMatch[1]).trim() : '';

    const tokenMatch = code.match(/[?&]token=([^&]+)/i);
    if (tokenMatch && tokenMatch[1]) {
      token = decodeURIComponent(tokenMatch[1]).trim();
    }

    const docMatch = code.match(/[?&]doc=([^&]+)/i);
    if (docMatch && docMatch[1]) {
      docFromUrl = decodeURIComponent(docMatch[1]).trim().replace(/\D/g, '');
    }

    // Buscar en la lista de asistencias del evento por ID de comprobante o documento
    const asistencias = getAttendance(eventoId);
    const matchAsistencia = asistencias.find(a =>
      (comprobanteId && a.id === comprobanteId) ||
      (docFromUrl && normalizeDocumentId(a.documento) === normalizeDocumentId(docFromUrl))
    );

    if (matchAsistencia) {
      return {
        found: true,
        source: 'asistencia',
        isRegisteredAttendance: true,
        record: matchAsistencia,
        message: 'Escarapela digital verificada: Asistencia oficial confirmada.'
      };
    }

    // Si no está en local pero es comprobante ATT-..., intentar verificarlo por token / Firestore
    if (comprobanteId && (comprobanteId.toUpperCase().startsWith('ATT-') || comprobanteId.length > 15)) {
      const res = await verifyAttendanceRecord(comprobanteId, token);
      if (res.success && res.record) {
        return {
          found: true,
          source: 'asistencia',
          isRegisteredAttendance: true,
          record: res.record,
          message: 'Escarapela digital verificada: Asistencia oficial confirmada.'
        };
      }
    }

    // Si vino con docFromUrl y no tiene asistencia previa registrada hoy, buscar en inscritos
    if (docFromUrl) {
      const inscritosData = getEventInscritosData(eventoId);
      const normDocUrl = normalizeDocumentId(docFromUrl);
      if (inscritosData?.participants?.[normDocUrl]) {
        const p = inscritosData.participants[normDocUrl];
        return {
          found: true,
          source: 'inscrito',
          isRegisteredAttendance: false,
          record: {
            id: `PRE-${normDocUrl}`,
            documento: p.documento || normDocUrl,
            tipoDocumento: p.tipoDocumento || 'CC',
            nombreCompleto: p.nombreCompleto || 'Participante Inscrito',
            correo: p.correo || '',
            telefono: p.telefono || '',
            vinculacion: p.vinculacion || 'Inscrito Oficial',
            placaVehiculo: p.placaVehiculo || ''
          },
          message: 'Participante identificado en la lista oficial de inscritos.'
        };
      }
    }

    return {
      found: false,
      isBadgeUrl: true,
      scannedDoc: docFromUrl || comprobanteId || '',
      message: `Código QR de escarapela leído (${comprobanteId || 'Comprobante'}), pero no se encontró registro de asistencia en este evento.`
    };
  }

  // 2. SEGUNDO: Decodificar si es documento de identidad físico colombiano (PDF417, MRZ o directo)
  const parsedCedula = parseColombianDocumentBarcode(code);

  if (parsedCedula?.isEncryptedDigitalCedulaQR) {
    return {
      found: false,
      isEncryptedDigitalCedulaQR: true,
      parsedCedula,
      message: parsedCedula.message
    };
  }

  if (parsedCedula?.documento) {
    // Asegurar que code contenga estrictamente el número de documento limpio sin nombres
    code = String(parsedCedula.documento).replace(/\D/g, '') || parsedCedula.documento;
  }

  // Normalizar documento si es cédula
  const normDoc = normalizeDocumentId(code);

  // 1. Si empieza por ATT- o parece ID de comprobante, intentar verificarlo
  if (code.toUpperCase().startsWith('ATT-') || (code.length > 15 && !/^\d+$/.test(code))) {
    const res = await verifyAttendanceRecord(code, token);
    if (res.success && res.record) {
      return {
        found: true,
        source: 'asistencia',
        isRegisteredAttendance: true,
        record: res.record,
        message: 'Asistencia oficial confirmada.'
      };
    }
  }

  // 2. Buscar en la lista de asistencias del evento por documento o comprobante
  const asistencias = getAttendance(eventoId);
  const matchAsistencia = asistencias.find(a =>
    a.id === code ||
    (normDoc && normalizeDocumentId(a.documento) === normDoc)
  );

  if (matchAsistencia) {
    return {
      found: true,
      source: 'asistencia',
      isRegisteredAttendance: true,
      record: matchAsistencia,
      parsedCedula: parsedCedula || null,
      message: 'Asistencia oficial confirmada.'
    };
  }

  // 3. Si no está en asistencias, buscar en la lista de inscritos precargada (Excel/CSV)
  const inscritosData = getEventInscritosData(eventoId);
  if (inscritosData?.participants && normDoc && inscritosData.participants[normDoc]) {
    const p = inscritosData.participants[normDoc];
    return {
      found: true,
      source: 'inscrito',
      isRegisteredAttendance: false,
      parsedCedula: parsedCedula || null,
      record: {
        id: `PRE-${normDoc}`,
        documento: p.documento || normDoc,
        tipoDocumento: p.tipoDocumento || parsedCedula?.tipoDocumento || 'CC',
        nombreCompleto: p.nombreCompleto || parsedCedula?.nombreCompleto || 'Participante Inscrito',
        correo: p.correo || '',
        telefono: p.telefono || '',
        vinculacion: p.vinculacion || 'Inscrito Oficial',
        placaVehiculo: p.placaVehiculo || ''
      },
      message: 'Figura en la lista oficial de inscritos, pero aún no ha completado el formulario de asistencia presencial de hoy.'
    };
  }

  // 4. Si es comprobante ATT- que no estaba en local pero puede estar en Firestore asistencias
  if (isFirebaseConfigured() && db && code.toUpperCase().startsWith('ATT-')) {
    try {
      const snap = await getDoc(doc(db, 'asistencias', code));
      if (snap.exists()) {
        const attData = snap.data();
        return {
          found: true,
          source: 'asistencia',
          isRegisteredAttendance: true,
          record: attData,
          message: 'Asistencia oficial confirmada (recuperada de Cloud Firestore).'
        };
      }
    } catch {}
  }

  return {
    found: false,
    rawInput: code,
    parsedCedula: parsedCedula || null,
    message: `No se encontró ningún participante con el documento o código "${code}".`
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
  const fechaDia = deliveryData.fechaDia || deliveryData.fechaEntrega || getColombiaLocalDateStr();
  const newDelivery = {
    ...deliveryData,
    id: deliveryId,
    documento: cleanDoc,
    fechaDia,
    fechaEntrega: deliveryData.fechaEntrega || fechaDia,
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
    participants: data.participants || {},
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

