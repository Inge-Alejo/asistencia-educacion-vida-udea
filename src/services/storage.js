// Servicio de Almacenamiento Local y Estado Persistente
// Diseñado para la Facultad de Medicina - Universidad de Antioquia
// Soporte híbrido: Cloud Firestore (en tiempo real) + LocalStorage (fallback de contingencia)

import {
  isFirebaseConfigured,
  db,
  collection,
  doc,
  setDoc,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc
} from './firebase';

export { isFirebaseConfigured };

const STORAGE_KEY_EVENTS = 'udea_med_events_v1';
const STORAGE_KEY_ATTENDANCE = 'udea_med_attendance_v1';
const STORAGE_KEY_QUESTIONS = 'udea_med_questions_v1';
const STORAGE_KEY_EVALUATIONS = 'udea_med_evaluations_v1';
const STORAGE_KEY_SATISFACTION = 'udea_med_satisfaction_v1';

// Coordenadas oficiales de la Facultad de Medicina UdeA (Calle 67 # 53-108, Medellín)
export const UDEA_MEDICINA_COORDS = {
  latitude: 6.262500,
  longitude: -75.568300,
  name: 'Facultad de Medicina UdeA (Sede Principal Medellín)',
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
    coordenadas: { lat: 6.2625, lng: -75.5683 },
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
    coordenadas: { lat: 6.2625, lng: -75.5683 },
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
      latitud: 6.26248,
      longitud: -75.56828,
      precisionMetros: 12,
      distanciaSedeMetros: 22,
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
      latitud: 6.26261,
      longitud: -75.56815,
      precisionMetros: 18,
      distanciaSedeMetros: 35,
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
      latitud: 6.26235,
      longitud: -75.56845,
      precisionMetros: 15,
      distanciaSedeMetros: 48,
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

// Inicializador de LocalStorage
export function initStorage() {
  if (!localStorage.getItem(STORAGE_KEY_EVENTS)) {
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(SEED_EVENTS));
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
  } catch (e) {
    return SEED_EVENTS;
  }
}

export function saveEvent(eventData) {
  const events = getEvents();
  const index = events.findIndex(e => e.id === eventData.id);
  if (index >= 0) {
    events[index] = eventData;
  } else {
    events.unshift(eventData);
  }
  localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
  return eventData;
}

export async function deleteEvent(eventId) {
  // 1. Eliminar evento de la lista
  const events = getEvents().filter(e => e.id !== eventId);
  localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));

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
  } catch (e) {}

  return events;
}

// Métodos de Asistencia
export function getAttendance(eventId = null) {
  initStorage();
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_ATTENDANCE) || '[]');
    return eventId ? list.filter(a => a.eventoId === eventId) : list;
  } catch (e) {
    return [];
  }
}

export async function recordAttendance(record) {
  const list = getAttendance();
  // Evitar duplicados por cédula y evento
  const existe = list.find(a => a.eventoId === record.eventoId && a.documento === record.documento);
  if (existe) {
    return { success: false, message: 'Ya se encuentra registrada la asistencia con este número de documento.' };
  }
  const newRecord = {
    ...record,
    id: `ATT-${Date.now()}`,
    fechaRegistro: new Date().toLocaleString('es-CO')
  };
  list.unshift(newRecord);
  localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(list));

  // Sincronización en la nube con Firestore si está configurado
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, 'asistencias', newRecord.id), newRecord);
    } catch (err) {
      console.warn('Registro local exitoso. Firestore cloud sync notice:', err);
    }
  }

  return { success: true, record: newRecord };
}

export async function deleteAttendance(attId) {
  const list = getAttendance().filter(a => a.id !== attId);
  localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(list));

  if (isFirebaseConfigured() && db) {
    try {
      await deleteDoc(doc(db, 'asistencias', attId));
    } catch (err) {
      console.warn('Firestore deleteDoc attendance notice:', err);
    }
  }

  return list;
}

// Métodos de Preguntas en Vivo
export function getQuestions(eventId = null) {
  initStorage();
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_QUESTIONS) || '[]');
    return eventId ? list.filter(q => q.eventoId === eventId) : list;
  } catch (e) {
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
    } catch (err) {
      console.warn('Pregunta local guardada. Firestore sync notice:', err);
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
      } catch (err) {
        console.warn('Firestore updateDoc notice:', err);
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
      } catch (err) {
        console.warn('Firestore updateDoc notice:', err);
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
    } catch (err) {
      console.warn('Firestore deleteDoc notice:', err);
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
  } catch (e) {
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
    } catch (err) {
      console.warn('Firestore eval notice:', err);
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
    } catch (err) {
      console.warn('Firestore eval delete notice:', err);
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
  } catch (e) {
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
    } catch (err) {
      console.warn('Firestore sat notice:', err);
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
    } catch (err) {
      console.warn('Firestore sat delete notice:', err);
    }
  }

  return list;
}

// Suscripción en Tiempo Real Multi-dispositivo (Firestore Snapshot + Local Fallback)
export function subscribeToEventData(eventId, onUpdate) {
  if (!eventId) return () => {};

  if (!isFirebaseConfigured() || !db) {
    // Si no hay Firebase activo, escuchar eventos locales entre pestañas
    const handler = (e) => {
      if ([STORAGE_KEY_ATTENDANCE, STORAGE_KEY_QUESTIONS, STORAGE_KEY_EVALUATIONS, STORAGE_KEY_SATISFACTION].includes(e.key)) {
        if (onUpdate) onUpdate();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  try {
    const unsubAtt = onSnapshot(query(collection(db, 'asistencias'), where('eventoId', '==', eventId)), (snapshot) => {
      const cloudList = [];
      snapshot.forEach(docSnap => cloudList.push(docSnap.data()));
      if (cloudList.length > 0) {
        const localOther = getAttendance().filter(a => a.eventoId !== eventId);
        const combined = [...cloudList, ...localOther];
        localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(combined));
        if (onUpdate) onUpdate();
      }
    }, (err) => console.warn('Firestore asistencias snapshot:', err));

    const unsubQ = onSnapshot(query(collection(db, 'preguntas'), where('eventoId', '==', eventId)), (snapshot) => {
      const cloudQ = [];
      snapshot.forEach(docSnap => cloudQ.push(docSnap.data()));
      if (cloudQ.length > 0) {
        const localOther = getQuestions().filter(q => q.eventoId !== eventId);
        const combined = [...cloudQ, ...localOther];
        localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(combined));
        if (onUpdate) onUpdate();
      }
    }, (err) => console.warn('Firestore preguntas snapshot:', err));

    return () => {
      unsubAtt();
      unsubQ();
    };
  } catch (err) {
    console.warn('Error setting up Firestore listener:', err);
    return () => {};
  }
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
