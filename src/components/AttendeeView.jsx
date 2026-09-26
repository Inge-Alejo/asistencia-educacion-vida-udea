import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  MapPin, CheckCircle2, AlertTriangle, Send, Star, Car, User, Mail,
  Phone, CreditCard, MessageSquare, ThumbsUp, HelpCircle,
  Clock, ShieldCheck, ChevronRight, ChevronLeft, ExternalLink, FileText, Check,
  Navigation, Radio, Award, Calendar, KeyRound, RotateCcw, UserPlus,
  Barcode, X
} from 'lucide-react';
import DigitalBadge from './DigitalBadge';
import {
  UDEA_MEDICINA_COORDS,
  calcularDistanciaMetros,
  recordAttendance,
  addQuestion,
  recordEvaluation,
  recordSatisfaction,
  getEventInscritos,
  subscribeToEventInscritos,
  parseColombianDocumentBarcode
} from '../services/storage';
import { maskFullName, maskEmail, areNamesMatching, sanitizeText } from '../services/sanitizer';
import { getOfficialColombiaTime, getEventDaysList, checkEventDayStatus, getColombiaLocalDateStr } from '../services/networkTime';
import { isDocumentEnrolled, normalizeDocumentId } from '../services/enrollmentService';

function getSavedAttendeeSession(eventId) {
  if (typeof window === 'undefined' || !eventId) return null;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const isReset = urlParams.get('reset') === '1' || urlParams.get('new') === '1';
    const sessionKey = `udea_session_attendee_${eventId}`;

    if (isReset) {
      localStorage.removeItem(sessionKey);
      return null;
    }

    const saved = localStorage.getItem(sessionKey);
    if (saved) {
      const session = JSON.parse(saved);
      if (session.documento && session.registrado) {
        return session;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export default function AttendeeView({
  evento,
  asistencias,
  preguntas,
  onDataUpdated
}) {
  // Cooldown anti-spam para preguntas en vivo (20s)
  const [qaCooldown, setQaCooldown] = useState(0);

  useEffect(() => {
    if (qaCooldown > 0) {
      const timer = setTimeout(() => setQaCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [qaCooldown]);

  // Recuperar sesión activa persistente del asistente en este evento
  const sessionInfo = getSavedAttendeeSession(evento?.id);

  // Control del Flujo Secuencial (Pasos 1 a 5)
  // 1: Ubicación GPS, 2: Datos de Asistencia, 3: Preguntas en Vivo, 4: Calificación Ponentes, 5: Microsoft Forms / Satisfacción
  const [activeStep, setActiveStep] = useState(() => (sessionInfo?.registrado ? 3 : 1));
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(() => (sessionInfo?.registrado ? 5 : 1));

  // Estado de Geolocalización
  const [geoState, setGeoState] = useState({
    cargando: false,
    obtenida: false,
    error: null,
    latitud: null,
    longitud: null,
    precision: null,
    distancia: null,
    esPresencial: false
  });

  // Estado de Fecha y Hora Oficial de Colombia vía Internet
  const [officialTime, setOfficialTime] = useState({
    fechaStr: getColombiaLocalDateStr(),
    horaStr: '08:00',
    esVerificadaInternet: false,
    fuente: 'Reloj Local'
  });

  // Sincronizar fecha y hora con internet al cargar el componente
  useEffect(() => {
    let isMounted = true;
    getOfficialColombiaTime().then(res => {
      if (isMounted) setOfficialTime(res);
    });
    return () => { isMounted = false; };
  }, []);

  const currentEventId = evento?.id || '';
  const eventDays = useMemo(() => getEventDaysList(evento), [evento]);
  const dayStatus = useMemo(() => checkEventDayStatus(evento, officialTime.fechaStr), [evento, officialTime.fechaStr]);

  // Lista de personas inscritas oficialmente a este evento (cargada por Excel/CSV en Admin)
  const [prevInscritosEventId, setPrevInscritosEventId] = useState(evento?.id);
  const [inscritosList, setInscritosList] = useState(() => getEventInscritos(evento?.id));

  if (evento?.id !== prevInscritosEventId) {
    setPrevInscritosEventId(evento?.id);
    setInscritosList(getEventInscritos(evento?.id));
  }

  useEffect(() => {
    if (!evento?.id) return;
    const unsubscribe = subscribeToEventInscritos(evento.id, (docs) => {
      setInscritosList(docs);
    });
    return () => unsubscribe();
  }, [evento?.id]);

  // Estado del Formulario de Asistencia
  const [formData, setFormData] = useState(() => ({
    tipoDocumento: sessionInfo?.tipoDocumento || 'CC',
    documento: sessionInfo?.documento || '',
    nombreCompleto: sessionInfo?.nombreCompleto || '',
    correo: sessionInfo?.correo || '',
    telefono: sessionInfo?.telefono || '',
    vinculacion: sessionInfo?.vinculacion || 'Estudiante Pregrado Medicina UdeA',
    placaVehiculo: sessionInfo?.placaVehiculo || '',
    habeasDataAceptado: Boolean(sessionInfo)
  }));

  const currentDoc = (formData?.documento || '').trim();
  const normalizedCurrentDoc = normalizeDocumentId(currentDoc);

  // Set en memoria para validación O(1) instantánea sin degradación de rendimiento
  const inscritosSet = useMemo(() => {
    if (!Array.isArray(inscritosList) || inscritosList.length === 0) return null;
    return new Set(inscritosList);
  }, [inscritosList]);

  // Verificación de si el documento actual figura en la lista de inscritos oficiales del evento
  const enrollmentStatus = useMemo(() => {
    if (!normalizedCurrentDoc || normalizedCurrentDoc.length < 4) {
      return { isEnrolled: true, hasWhitelist: Boolean(inscritosSet && inscritosSet.size > 0) };
    }
    return isDocumentEnrolled(inscritosSet, normalizedCurrentDoc);
  }, [inscritosSet, normalizedCurrentDoc]);

  // Historial de asistencias registradas por este participante en este evento (todas las sesiones)
  const misAsistenciasEvento = useMemo(() => {
    if (!normalizedCurrentDoc || !currentEventId) return [];
    return (asistencias || []).filter(a =>
      a.eventoId === currentEventId && normalizeDocumentId(a.documento) === normalizedCurrentDoc
    );
  }, [asistencias, currentEventId, normalizedCurrentDoc]);

  // Registro previo baseline de este documento en el evento (para autocompletado seguro y validación de coherencia)
  const registroPrevioEvento = useMemo(() => {
    if (!normalizedCurrentDoc || !currentEventId) return null;
    return (asistencias || []).find(a =>
      a.eventoId === currentEventId && normalizeDocumentId(a.documento) === normalizedCurrentDoc
    ) || null;
  }, [asistencias, currentEventId, normalizedCurrentDoc]);

  // Datos precargados del participante en la lista oficial de inscritos (si fueron cargados desde Excel/CSV)
  const inscritosParticipants = evento?.inscritosData?.participants;
  const inscritoData = useMemo(() => {
    if (!normalizedCurrentDoc || !inscritosParticipants || typeof inscritosParticipants !== 'object') return null;
    return inscritosParticipants[normalizedCurrentDoc] || null;
  }, [normalizedCurrentDoc, inscritosParticipants]);

  // Asistencia específica para la fecha o sesión de hoy
  const hoyStr = officialTime.fechaStr || getColombiaLocalDateStr();
  const asistenciaHoy = useMemo(() => {
    if (misAsistenciasEvento.length === 0) return null;
    return misAsistenciasEvento.find(a =>
      a.fechaDia === hoyStr ||
      (dayStatus.diaNumero && a.diaNumero === dayStatus.diaNumero)
    ) || null;
  }, [misAsistenciasEvento, hoyStr, dayStatus.diaNumero]);

  const yaRegistroHoy = Boolean(asistenciaHoy);

  // Detección en tiempo real de registro existente (en multidía, verifica si ya llenó el día de hoy)
  const registroExistente = useMemo(() => {
    if (!normalizedCurrentDoc || !currentEventId) return null;
    if (evento?.esMultidia) {
      return yaRegistroHoy ? asistenciaHoy : null;
    }
    return (asistencias || []).find(a => a.eventoId === currentEventId && normalizeDocumentId(a.documento) === normalizedCurrentDoc);
  }, [normalizedCurrentDoc, currentEventId, evento, yaRegistroHoy, asistenciaHoy, asistencias]);

  const [asistenciaRegistrada, setAsistenciaRegistrada] = useState(() => {
    if (!sessionInfo) return false;
    // Si el evento es multidía, validar si la sesión guardada corresponde al día de hoy
    if (evento?.esMultidia) {
      return sessionInfo.fechaDia === getColombiaLocalDateStr();
    }
    return Boolean(sessionInfo.registrado);
  });

  // Estado consolidado de si este participante ya completó el registro de asistencia oficial en este dispositivo
  const isRegisteredForEvent = useMemo(() => {
    if (asistenciaRegistrada) return true;
    if (sessionInfo?.registrado) {
      if (evento?.esMultidia) {
        return sessionInfo.fechaDia === hoyStr;
      }
      return true;
    }
    return false;
  }, [asistenciaRegistrada, sessionInfo, evento, hoyStr]);

  const [codigoComprobante, setCodigoComprobante] = useState(() => sessionInfo?.comprobanteId || '');
  const [errorAsistencia, setErrorAsistencia] = useState('');
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);

  // Estados para Desafío de Seguridad de Correo al autocompletar o acceder a registro existente en nuevo dispositivo
  const [challengeEmail, setChallengeEmail] = useState('');
  const [challengeError, setChallengeError] = useState('');
  const [verifiedDoc, setVerifiedDoc] = useState(() => (sessionInfo?.documento ? String(sessionInfo.documento).trim() : null));

  // Rastreador del último documento autocompletado para no sobreescribir ediciones manuales
  const lastAutoFilledDocRef = useRef(null);

  // Buffer y temporizador para lector de código de barras USB (teclado HID)
  const keystrokeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const [scannerNotification, setScannerNotification] = useState(null);

  // Determinar si el documento ingresado actualmente está debidamente validado y vinculado
  const isCurrentDocVerified = useMemo(() => {
    if (!normalizedCurrentDoc) return false;
    const targetRecord = registroExistente || registroPrevioEvento || inscritoData;
    if (!targetRecord) return false;

    const isDocMatch = normalizeDocumentId(verifiedDoc) === normalizedCurrentDoc || 
      (sessionInfo && normalizeDocumentId(sessionInfo.documento) === normalizedCurrentDoc);
    const isNameMatch = !targetRecord.nombreCompleto || Boolean(formData.nombreCompleto && areNamesMatching(formData.nombreCompleto, targetRecord.nombreCompleto));
    return Boolean(isDocMatch && isNameMatch);
  }, [normalizedCurrentDoc, verifiedDoc, sessionInfo, formData.nombreCompleto, registroExistente, registroPrevioEvento, inscritoData]);

  // Función para procesar lecturas desde el escáner de código de barras USB
  const handleProcessBarcodeScan = useCallback((rawCode) => {
    if (!rawCode || typeof rawCode !== 'string') return;
    const cleanRaw = rawCode.trim();

    // 1. Decodificar código de documento colombiano (Cédula de Ciudadanía, TI, CE, MRZ o directo)
    const parsed = parseColombianDocumentBarcode(cleanRaw);
    let extractedDoc = '';
    let extractedTipo = 'CC';
    let extractedName = '';

    if (parsed && parsed.documento) {
      extractedDoc = parsed.documento;
      extractedTipo = parsed.tipoDocumento || 'CC';
      extractedName = parsed.nombreCompleto || '';
    } else {
      // Si leyó el código 1D de escarapela o un número directo
      if (cleanRaw.toUpperCase().startsWith('ATT-')) {
        const foundAtt = (asistencias || []).find(a => a.id === cleanRaw && a.eventoId === currentEventId);
        if (foundAtt) {
          setCodigoComprobante(foundAtt.id);
          setIsBadgeModalOpen(true);
          setScannerNotification({
            type: 'already_registered',
            title: '¡Escarapela Digital Identificada!',
            message: `Asistencia ya confirmada para ${foundAtt.nombreCompleto} (${foundAtt.documento}). Visualizando escarapela.`
          });
          return;
        }
      }
      extractedDoc = cleanRaw.replace(/\D/g, '') || cleanRaw;
    }

    const normDoc = normalizeDocumentId(extractedDoc);
    if (!normDoc) return;

    // 2. Verificar si ya registró asistencia hoy para este evento
    const yaRegistrado = (asistencias || []).find(
      a => a.eventoId === currentEventId && normalizeDocumentId(a.documento) === normDoc
    );

    if (yaRegistrado) {
      setFormData(prev => ({
        ...prev,
        tipoDocumento: yaRegistrado.tipoDocumento || extractedTipo,
        documento: yaRegistrado.documento,
        nombreCompleto: yaRegistrado.nombreCompleto,
        correo: yaRegistrado.correo || prev.correo,
        telefono: yaRegistrado.telefono || prev.telefono,
        vinculacion: yaRegistrado.vinculacion || prev.vinculacion,
        placaVehiculo: yaRegistrado.placaVehiculo || prev.placaVehiculo,
        habeasDataAceptado: true
      }));
      setVerifiedDoc(normDoc);
      setCodigoComprobante(yaRegistrado.id);
      setAsistenciaRegistrada(true);
      setMaxUnlockedStep(5);
      setActiveStep(3);
      setScannerNotification({
        type: 'already_registered',
        title: '¡Asistencia de Hoy Ya Registrada!',
        message: `${yaRegistrado.nombreCompleto} (${yaRegistrado.documento}) ya cuenta con asistencia confirmada para la jornada de hoy.`
      });
      return;
    }

    // 3. Comparar con el listado oficial de inscritos del evento
    const matchedInscrito = inscritosParticipants?.[normDoc];

    if (matchedInscrito) {
      lastAutoFilledDocRef.current = normDoc;
      if (isCurrentDocVerified) {
        setFormData({
          tipoDocumento: matchedInscrito.tipoDocumento || extractedTipo || 'CC',
          documento: matchedInscrito.documento || extractedDoc,
          nombreCompleto: matchedInscrito.nombreCompleto || extractedName,
          correo: matchedInscrito.correo || '',
          telefono: matchedInscrito.telefono || '',
          vinculacion: matchedInscrito.vinculacion || 'Estudiante Pregrado Medicina UdeA',
          placaVehiculo: matchedInscrito.placaVehiculo || '',
          habeasDataAceptado: true
        });
        setMaxUnlockedStep(prev => Math.max(prev, 2));
        setActiveStep(2);
        confetti({ particleCount: 65, spread: 70, origin: { y: 0.6 } });
        setScannerNotification({
          type: 'success_inscrito',
          title: '¡Participante Identificado en Lista Oficial!',
          message: `Documento ${extractedDoc} reconocido. Datos de ${matchedInscrito.nombreCompleto} autocompletados desde el listado oficial.`
        });
      } else {
        setFormData(prev => ({
          ...prev,
          tipoDocumento: matchedInscrito.tipoDocumento || extractedTipo || 'CC',
          documento: matchedInscrito.documento || extractedDoc
        }));
        setScannerNotification({
          type: 'info_inscrito',
          title: '¡Inscripción Oficial Identificada!',
          message: `Documento ${extractedDoc} reconocido (${maskFullName(matchedInscrito.nombreCompleto)}). Por seguridad, confirma tu correo abajo para autocompletar tus datos.`
        });
      }
    } else {
      // No figura en la lista oficial de inscritos
      if (extractedName) {
        lastAutoFilledDocRef.current = normDoc;
        setFormData(prev => ({
          ...prev,
          tipoDocumento: extractedTipo,
          documento: extractedDoc,
          nombreCompleto: extractedName,
          habeasDataAceptado: true
        }));
        setVerifiedDoc(normDoc);
        setMaxUnlockedStep(prev => Math.max(prev, 2));
        setActiveStep(2);
        setScannerNotification({
          type: 'warning_notinlist',
          title: '¡Documento Físico Leído con Escáner!',
          message: `${extractedTipo} ${extractedDoc} (${extractedName}) leída. No figuras en el listado previo de inscritos, pero puedes ingresar tus datos de contacto abajo para registrarte.`
        });
      } else {
        setFormData(prev => ({
          ...prev,
          documento: extractedDoc
        }));
        setMaxUnlockedStep(prev => Math.max(prev, 2));
        setActiveStep(2);
        setScannerNotification({
          type: 'info',
          title: 'Documento Escaneado',
          message: `Documento ${extractedDoc} capturado. Completa tus datos para confirmar tu asistencia.`
        });
      }
    }
  }, [asistencias, currentEventId, inscritosParticipants, isCurrentDocVerified]);

  // Interceptor global de pulsaciones para Escáner de Código de Barras USB (HID Wedge)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Si el foco está en un área de texto multilínea (ej: redactando una pregunta), no capturar ráfagas
      if (document.activeElement?.tagName === 'TEXTAREA') return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const buffered = keystrokeBufferRef.current.trim();
        keystrokeBufferRef.current = '';

        if (buffered.length >= 3) {
          e.preventDefault();
          handleProcessBarcodeScan(buffered);
        }
        return;
      }

      // Reiniciar buffer si la pausa entre teclas excede 180ms y el buffer aún era pequeño (escritura humana lenta)
      if (timeDiff > 180 && keystrokeBufferRef.current.length < 5) {
        keystrokeBufferRef.current = '';
      }

      if (e.key.length === 1) {
        keystrokeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [handleProcessBarcodeScan]);

  // Función para validar el correo y autocompletar o autenticar en nuevo dispositivo
  const handleVerifyChallengeEmail = (e) => {
    e?.preventDefault();
    const targetRecord = registroExistente || registroPrevioEvento || inscritoData;
    if (!targetRecord) return;

    const inputEmail = challengeEmail.trim().toLowerCase();
    const targetEmail = (targetRecord.correo || '').trim().toLowerCase();

    if (!inputEmail) {
      setChallengeError('Por favor ingrese su correo registrado para validar su identidad.');
      return;
    }

    if (inputEmail === targetEmail) {
      setFormData(prev => ({
        ...prev,
        tipoDocumento: targetRecord.tipoDocumento || prev.tipoDocumento || 'CC',
        documento: targetRecord.documento || currentDoc,
        nombreCompleto: targetRecord.nombreCompleto || prev.nombreCompleto,
        correo: targetRecord.correo || prev.correo,
        telefono: targetRecord.telefono || prev.telefono,
        vinculacion: targetRecord.vinculacion || prev.vinculacion,
        placaVehiculo: targetRecord.placaVehiculo || prev.placaVehiculo,
        habeasDataAceptado: true
      }));
      setVerifiedDoc(normalizedCurrentDoc);
      setChallengeError('');

      // Si ya tiene registro hoy, restauramos comprobante y sesión para permitir acceso completo
      if (registroExistente) {
        setCodigoComprobante(registroExistente.id);
        setAsistenciaRegistrada(true);
        setMaxUnlockedStep(5);
        setErrorAsistencia('');
      } else {
        setMaxUnlockedStep(prev => Math.max(prev, 2));
        setActiveStep(2);
        confetti({ particleCount: 65, spread: 70, origin: { y: 0.6 } });
      }

      try {
        localStorage.setItem(`udea_session_attendee_${evento?.id}`, JSON.stringify({
          tipoDocumento: targetRecord.tipoDocumento,
          documento: targetRecord.documento || currentDoc,
          nombreCompleto: targetRecord.nombreCompleto,
          correo: targetRecord.correo,
          telefono: targetRecord.telefono,
          vinculacion: targetRecord.vinculacion,
          placaVehiculo: targetRecord.placaVehiculo,
          comprobanteId: registroExistente ? registroExistente.id : undefined,
          registrado: Boolean(registroExistente)
        }));
      } catch {}

      if (registroExistente) {
        setActiveStep(3);
      }
    } else {
      setChallengeError(
        registroExistente
          ? 'El correo ingresado no coincide con el registrado en la asistencia de hoy para este documento.'
          : registroPrevioEvento
            ? 'El correo ingresado no coincide con el registrado en jornadas anteriores para este documento.'
            : 'El correo ingresado no coincide con el registrado en la lista oficial de inscritos para este documento.'
      );
    }
  };

  // Restablecer y limpiar formulario para ingresar con otro documento
  const handleResetParticipant = () => {
    lastAutoFilledDocRef.current = null;
    setScannerNotification(null);
    setVerifiedDoc(null);
    setChallengeEmail('');
    setChallengeError('');
    setFormData({
      tipoDocumento: 'CC',
      documento: '',
      nombreCompleto: '',
      correo: '',
      telefono: '',
      vinculacion: 'Estudiante Pregrado Medicina UdeA',
      placaVehiculo: '',
      habeasDataAceptado: false
    });
    try {
      localStorage.removeItem(`udea_session_attendee_${evento?.id}`);
    } catch {}
  };

  // Función para realizar un nuevo registro desde el paso 3 o cabecera
  const handleNuevoRegistro = () => {
    const confirm = window.confirm(
      '¿Deseas realizar un nuevo registro de asistencia? Se cerrará la sesión actual en este dispositivo para permitir el registro de otro participante o documento.'
    );
    if (!confirm) return;

    lastAutoFilledDocRef.current = null;
    setScannerNotification(null);
    setVerifiedDoc(null);
    setChallengeEmail('');
    setChallengeError('');
    setFormData({
      tipoDocumento: 'CC',
      documento: '',
      nombreCompleto: '',
      correo: '',
      telefono: '',
      vinculacion: 'Estudiante Pregrado Medicina UdeA',
      placaVehiculo: '',
      habeasDataAceptado: false
    });
    setAsistenciaRegistrada(false);
    setCodigoComprobante('');
    setErrorAsistencia('');
    try {
      localStorage.removeItem(`udea_session_attendee_${evento?.id}`);
    } catch {}
    setMaxUnlockedStep(1);
    setActiveStep(1);
  };

  // Registro del participante activo para la Escarapela Digital (prioriza la sesión actual)
  const activeAttendeeRecord = useMemo(() => {
    if (asistenciaHoy) return asistenciaHoy;
    if (misAsistenciasEvento.length > 0) return misAsistenciasEvento[0];

    if (!codigoComprobante && !normalizedCurrentDoc) return null;
    const found = (asistencias || []).find(a =>
      (codigoComprobante && a.id === codigoComprobante) ||
      (a.eventoId === currentEventId && normalizeDocumentId(a.documento) === normalizedCurrentDoc)
    );
    if (found) return found;

    if (isRegisteredForEvent || yaRegistroHoy) {
      return {
        id: codigoComprobante || 'ATT-MED-01',
        eventoId: currentEventId,
        nombreCompleto: formData.nombreCompleto || 'Participante',
        tipoDocumento: formData.tipoDocumento || 'CC',
        documento: formData.documento || '',
        vinculacion: formData.vinculacion || 'Asistente',
        placaVehiculo: formData.placaVehiculo || '',
        diaNumero: dayStatus.diaNumero || 1,
        fechaDia: hoyStr,
        fechaRegistro: new Date().toLocaleString('es-CO')
      };
    }
    return null;
  }, [asistenciaHoy, misAsistenciasEvento, asistencias, codigoComprobante, formData, currentEventId, normalizedCurrentDoc, isRegisteredForEvent, yaRegistroHoy, dayStatus.diaNumero, hoyStr]);

  // Nombre consolidado del participante para mostrar en la escarapela y textos
  const attendeeDisplayName = useMemo(() => {
    return (
      formData.nombreCompleto?.trim() ||
      activeAttendeeRecord?.nombreCompleto?.trim() ||
      sessionInfo?.nombreCompleto?.trim() ||
      ''
    );
  }, [formData.nombreCompleto, activeAttendeeRecord, sessionInfo]);

  // Estado de Preguntas a Ponentes (filtrando ponentes activos)
  const ponentesActivos = useMemo(() => {
    return (evento?.ponentes || []).filter(p => p.activo !== false);
  }, [evento?.ponentes]);

  const defaultPonenteId = ponentesActivos[0]?.id || evento?.ponentes?.[0]?.id || '';
  const [preguntaForm, setPreguntaForm] = useState(() => ({
    ponenteId: defaultPonenteId,
    autor: '',
    esAnonimo: false,
    textoPregunta: ''
  }));
  const [preguntaEnviada, setPreguntaEnviada] = useState(false);

  // Estado de Evaluaciones de Ponentes (una por ponente)
  const [evaluacionesPonentes, setEvaluacionesPonentes] = useState({});
  const [ponentesEvaluados, setPonentesEvaluados] = useState({});

  // Estado de Satisfacción General
  const [satisfaccionForm, setSatisfaccionForm] = useState({
    cumplimiento: 5,
    logistica: 5,
    nps: 10,
    sugerencias: ''
  });
  const [satisfaccionEnviada, setSatisfaccionEnviada] = useState(false);
  const [showEmbeddedForms, setShowEmbeddedForms] = useState(true);

  // Manejar cambio de campos del formulario y limpiar errores en tiempo real
  const handleFieldChange = (field, value) => {
    if (field === 'documento') {
      const cleanNewDoc = String(value).trim();
      // Si el usuario cambia el documento y difiere del previamente verificado, resetear datos previos
      if (verifiedDoc && cleanNewDoc !== verifiedDoc) {
        setVerifiedDoc(null);
        setChallengeEmail('');
        setChallengeError('');
        setFormData(prev => ({
          ...prev,
          documento: value,
          nombreCompleto: '',
          correo: '',
          telefono: '',
          placaVehiculo: ''
        }));
        if (errorAsistencia) setErrorAsistencia('');
        return;
      }
    }

    setFormData(prev => ({ ...prev, [field]: value }));
    if (errorAsistencia) setErrorAsistencia('');
  };

  // Función de captura de Geolocalización GPS precisa
  const handleObtenerUbicacion = () => {
    if (!navigator.geolocation) {
      setGeoState({
        cargando: false,
        obtenida: false,
        error: 'Su navegador o dispositivo no soporta geolocalización GPS.',
        latitud: null,
        longitud: null,
        precision: null,
        distancia: null,
        esPresencial: false,
        origenSenal: null
      });
      setMaxUnlockedStep(prev => Math.max(prev, 2));
      return;
    }

    setGeoState(prev => ({ ...prev, cargando: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = Math.round(position.coords.accuracy || 15);

        // Distancia exacta a la Facultad de Medicina UdeA (Medellín)
        const dist = calcularDistanciaMetros(
          lat,
          lng,
          UDEA_MEDICINA_COORDS.latitude,
          UDEA_MEDICINA_COORDS.longitude
        );

        const presencial = dist <= UDEA_MEDICINA_COORDS.radioMaximoMetros;

        setGeoState({
          cargando: false,
          obtenida: true,
          error: null,
          latitud: lat,
          longitud: lng,
          precision: acc,
          distancia: dist,
          esPresencial: presencial,
          origenSenal: acc <= 50 ? 'Satélite GPS (Alta Precisión Móvil)' : 'Red / WiFi (Triangulación)'
        });

        // Desbloquear automáticamente el paso 2 y avanzar
        setMaxUnlockedStep(prev => Math.max(prev, 2));
        setActiveStep(2);
      },
      (err) => {
        let msg = 'No se pudo obtener la ubicación satelital. Verifique los permisos en su celular.';
        if (err.code === 1) {
          msg = 'Permiso de ubicación denegado en su navegador. Si desea certificar asistencia presencial, active el permiso en el icono de candado 🔒 de la barra de direcciones y pulse "Reintentar", o continúe hacia el formulario como Asistencia Remota.';
        } else if (err.code === 2) {
          msg = 'Señal GPS no disponible en este momento. Puede reintentar o continuar.';
        } else if (err.code === 3) {
          msg = 'Tiempo de espera de GPS agotado. Puede reintentar la captura.';
        }

        setGeoState({
          cargando: false,
          error: msg,
          obtenida: false, // Asegurar que NO se marque como obtenida si falló
          latitud: null,
          longitud: null,
          precision: null,
          distancia: null,
          esPresencial: false,
          origenSenal: null
        });

        setMaxUnlockedStep(prev => Math.max(prev, 2));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Función de Simulación En Sede para Pruebas del Administrador o Docente
  const handleSimularEnSede = () => {
    setGeoState({
      cargando: false,
      obtenida: true,
      error: null,
      latitud: 6.261341,
      longitud: -75.566464,
      precision: 8,
      distancia: 12,
      esPresencial: true,
      origenSenal: 'Modo Demostración / Facultad de Medicina UdeA (Cra. 51D # 62-29)'
    });
    setMaxUnlockedStep(prev => Math.max(prev, 2));
    setActiveStep(2);
  };

  // Envío del Formulario de Asistencia
  const handleRegistrarAsistencia = async (e) => {
    e.preventDefault();
    setErrorAsistencia('');

    const doc = formData.documento.trim();
    const cleanDoc = normalizeDocumentId(doc);
    if (!cleanDoc) {
      setErrorAsistencia('Por favor ingrese su número de documento de identidad.');
      return;
    }
    if (cleanDoc.length < 4 || cleanDoc.length > 20 || !/^[A-Z0-9]+$/.test(cleanDoc)) {
      setErrorAsistencia('El número de documento debe contener entre 4 y 20 caracteres válidos (números o letras).');
      return;
    }

    // Bloquear registro si la fecha actual es anterior a la fecha de inicio del evento
    if (dayStatus.esAntesDeFecha) {
      setErrorAsistencia(
        `El registro de asistencia aún no está disponible. El evento está programado para iniciar el ${dayStatus.fechaInicio || evento.fecha}.`
      );
      return;
    }

    // Validación estricta de admisión: debe figurar en la lista de inscritos si el evento tiene lista cargada
    if (enrollmentStatus.hasWhitelist && !enrollmentStatus.isEnrolled) {
      setErrorAsistencia(
        `El documento ${cleanDoc} no se encuentra en el registro oficial de personas inscritas a este evento. Por favor acércate al punto de información del evento o comunícate con la coordinación académica.`
      );
      return;
    }

    const nombre = formData.nombreCompleto.trim();
    if (!nombre || nombre.length < 5 || nombre.split(/\s+/).length < 2) {
      setErrorAsistencia('Por favor ingrese su nombre y apellido completos (mínimo 2 palabras).');
      return;
    }

    const email = formData.correo.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setErrorAsistencia('Por favor ingrese un correo electrónico válido (ejemplo: usuario@udea.edu.co).');
      return;
    }

    const telClean = formData.telefono.trim().replace(/\D/g, '');
    if (!telClean || telClean.length < 7 || telClean.length > 10) {
      setErrorAsistencia('Por favor ingrese un número de teléfono o celular válido (de 7 a 10 dígitos, ej: 3124567890).');
      return;
    }

    // Validación Estricta de Identidad Anti-Suplantación con jornadas previas del mismo evento
    if (registroPrevioEvento) {
      const isNameValid = areNamesMatching(nombre, registroPrevioEvento.nombreCompleto);
      if (!isNameValid) {
        setErrorAsistencia(
          `Por seguridad e integridad institucional, el documento ${doc} ya cuenta con registros previos en este evento a nombre de "${maskFullName(registroPrevioEvento.nombreCompleto)}". El nombre ingresado debe coincidir con el registrado inicialmente.`
        );
        return;
      }
    }

    // Placa vehicular: Totalmente OPCIONAL si el evento la tiene habilitada. Máximo 6 caracteres alfanuméricos si se provee.
    const placaClean = (formData.placaVehiculo || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (evento.habilitarPlacaVehiculo && placaClean.length > 0 && (placaClean.length < 5 || placaClean.length > 6)) {
      setErrorAsistencia('La placa vehicular debe tener entre 5 y 6 caracteres alfanuméricos (ej: KMW452 o ABC12D). Si no cuenta con vehículo, puede dejar este campo vacío.');
      return;
    }

    if (!formData.habeasDataAceptado) {
      setErrorAsistencia('Debe autorizar el tratamiento de datos personales conforme a la Ley 1581 de 2012 para registrar su asistencia.');
      return;
    }

    const payload = {
      eventoId: evento.id,
      diaNumero: dayStatus.diaNumero || 1,
      fechaDia: officialTime.fechaStr,
      fechaVerificadaInternet: officialTime.esVerificadaInternet,
      fuenteTiempo: officialTime.fuente,
      tipoDocumento: formData.tipoDocumento,
      documento: sanitizeText(cleanDoc, 20),
      nombreCompleto: sanitizeText(nombre, 100),
      correo: sanitizeText(email, 100),
      telefono: sanitizeText(telClean, 25),
      vinculacion: formData.vinculacion,
      placaVehiculo: (evento.habilitarPlacaVehiculo && placaClean) ? sanitizeText(placaClean, 6) : '',
      habeasDataAceptado: true,
      fechaHabeasData: new Date().toISOString(),
      geolocalizacion: {
        latitud: geoState.latitud,
        longitud: geoState.longitud,
        precisionMetros: geoState.precision,
        distanciaSedeMetros: geoState.distancia,
        esPresencial: geoState.esPresencial
      }
    };

    const res = await recordAttendance(payload);
    if (res.success) {
      setAsistenciaRegistrada(true);
      setCodigoComprobante(res.record.id);

      // Guardar sesión persistente del asistente en este dispositivo
      try {
        localStorage.setItem(`udea_session_attendee_${evento.id}`, JSON.stringify({
          ...payload,
          fechaDia: hoyStr,
          diaNumero: dayStatus.diaNumero || 1,
          comprobanteId: res.record.id,
          registrado: true,
          fechaRegistro: new Date().toISOString()
        }));
      } catch (err) {
        console.warn('Error al guardar sesión del asistente:', err);
      }

      // Desbloquear todos los pasos siguientes y avanzar de inmediato a Preguntas en Vivo (Paso 3)
      setMaxUnlockedStep(5);
      setActiveStep(3);

      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#0F5938', '#008744', '#C59B27', '#ffffff']
      });

      if (onDataUpdated) onDataUpdated();
    } else {
      setErrorAsistencia(res.message);
    }
  };

  // Envío de Preguntas al Ponente con sanitización y cooldown
  const handleEnviarPregunta = async (e) => {
    e.preventDefault();
    if (qaCooldown > 0) return;
    const cleanPregunta = sanitizeText(preguntaForm.textoPregunta.trim(), 400);
    if (!cleanPregunta) return;

    const ponenteElegido = evento.ponentes?.find(p => p.id === preguntaForm.ponenteId);
    const ponenteNombre = ponenteElegido?.nombre || (preguntaForm.ponenteId === 'todos' ? 'Todos los Ponentes / Panel' : 'Docente / Ponente UdeA');
    const ponenteTema = ponenteElegido?.temaPonencia || '';

    await addQuestion({
      eventoId: evento.id,
      ponenteId: preguntaForm.ponenteId,
      ponenteNombre,
      ponenteTema,
      autor: preguntaForm.esAnonimo ? 'Asistente Anónimo' : sanitizeText(formData.nombreCompleto || preguntaForm.autor || 'Asistente', 80),
      pregunta: cleanPregunta
    });

    setPreguntaEnviada(true);
    setQaCooldown(20); // 20s cooldown anti-spam
    setPreguntaForm(prev => ({ ...prev, textoPregunta: '' }));
    setTimeout(() => setPreguntaEnviada(false), 3500);
    if (onDataUpdated) onDataUpdated();
  };

  // Envío de Evaluación individual de un Ponente
  const handleCalificarPonente = async (ponenteId) => {
    const data = evaluacionesPonentes[ponenteId] || { dominio: 5, claridad: 5, aplicabilidad: 5, comentario: '' };
    await recordEvaluation({
      eventoId: evento.id,
      ponenteId,
      dominio: data.dominio || 5,
      claridad: data.claridad || 5,
      aplicabilidad: data.aplicabilidad || 5,
      comentario: data.comentario || ''
    });

    setPonentesEvaluados(prev => ({ ...prev, [ponenteId]: true }));
    if (onDataUpdated) onDataUpdated();
  };

  // Envío de Encuesta de Satisfacción General
  const handleEnviarSatisfaccion = async (e) => {
    e.preventDefault();
    await recordSatisfaction({
      eventoId: evento.id,
      cumplimientoObjetivos: satisfaccionForm.cumplimiento,
      organizacionLogistica: satisfaccionForm.logistica,
      npsRecomendacion: satisfaccionForm.nps,
      sugerencias: satisfaccionForm.sugerencias.trim()
    });

    setSatisfaccionEnviada(true);
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#0F5938', '#C59B27', '#ffffff']
    });
    if (onDataUpdated) onDataUpdated();
  };

  return (
    <div className="attendee-view-container">
      {/* Banner Principal del Evento */}
      <section className="event-hero-banner">
        <div className="banner-top-brand">
          <img
            src="/logo-udea-horizontal.png"
            alt="Facultad de Medicina - Universidad de Antioquia"
            className="banner-udea-logo"
          />
          <span className="badge-event-id">{evento.id}</span>
        </div>
        <h1 className="banner-title">{evento.titulo}</h1>
        <div className="banner-meta">
          <span className="meta-point">
            <Clock size={15} /> {evento.fecha} • {evento.horaInicio} - {evento.horaFin}
          </span>
          <span className="meta-point">
            <MapPin size={15} /> {evento.lugar}
          </span>
        </div>
      </section>

      {/* BANNER DE SESIÓN ACTIVA PERSISTENTE (Si el usuario ya registró asistencia) */}
      {asistenciaRegistrada && (
        <div className="attendee-active-session-banner animated-step">
          <div className="session-banner-left">
            <div className="session-badge-check">
              <CheckCircle2 size={22} className="check-icon" />
            </div>
            <div>
              <div className="session-user-row">
                <span className="session-tag">Asistencia Registrada Oficialmente</span>
                <span className="session-comprobante-pill">N° {codigoComprobante}</span>
              </div>
              <h3 className="session-user-name">¡Hola, {formData.nombreCompleto || 'Asistente'}!</h3>
              <p className="session-desc-text">
                Tu asistencia a este evento ya está confirmada. Puedes interactuar en tiempo real con preguntas a los ponentes o calificar sus ponencias.
              </p>
            </div>
          </div>

          <div className="session-banner-actions">
            <button
              type="button"
              className={`btn-session-nav ${activeStep === 3 ? 'active' : ''}`}
              onClick={() => setActiveStep(3)}
            >
              <MessageSquare size={15} />
              <span>Preguntas en Vivo</span>
            </button>
            <button
              type="button"
              className={`btn-session-nav ${activeStep === 4 ? 'active' : ''}`}
              onClick={() => setActiveStep(4)}
            >
              <Star size={15} />
              <span>Calificar Ponentes</span>
            </button>
            <button
              type="button"
              className={`btn-session-nav ${activeStep === 5 ? 'active' : ''}`}
              onClick={() => setActiveStep(5)}
            >
              <FileText size={15} />
              <span>{evento.habilitarMicrosoftForms && evento.microsoftFormsUrl ? 'Microsoft Forms' : 'Satisfacción'}</span>
            </button>
            <button
              type="button"
              className="btn-session-nav badge-btn-pill"
              onClick={() => setIsBadgeModalOpen(true)}
              title="Ver Escarapela Digital para ingreso"
            >
              <Award size={15} />
              <span>Escarapela Digital</span>
            </button>
            <button
              type="button"
              className="btn-change-attendee"
              onClick={handleNuevoRegistro}
              title="Realizar un nuevo registro de asistencia"
            >
              <RotateCcw size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              <span>Realizar nuevo registro</span>
            </button>
          </div>
        </div>
      )}

      {/* Banner de notificación interactiva por escáner de código de barras USB */}
      {scannerNotification && (
        <div className={`scanner-toast-banner ${scannerNotification.type} animated-step`}>
          <div className="scanner-toast-body">
            <Barcode size={22} className="scanner-toast-icon" />
            <div>
              <strong className="scanner-toast-title">{scannerNotification.title}</strong>
              <p className="scanner-toast-msg">{scannerNotification.message}</p>
            </div>
          </div>
          <button
            type="button"
            className="scanner-toast-close"
            onClick={() => setScannerNotification(null)}
            title="Cerrar notificación"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* BARRA DE PROGRESO SECUENCIAL INTERACTIVA */}
      <nav className="stepper-progress-nav" aria-label="Progreso secuencial del registro">
        <div className="stepper-track">
          {[
            { step: 1, label: 'Ubicación GPS', icon: MapPin },
            { step: 2, label: 'Datos Asistencia', icon: User },
            { step: 3, label: 'Preguntas en Vivo', icon: HelpCircle },
            { step: 4, label: 'Calificar Ponentes', icon: Star },
            { step: 5, label: (evento.habilitarMicrosoftForms && evento.microsoftFormsUrl) ? 'Microsoft Forms' : 'Satisfacción', icon: FileText }
          ].map((item) => {
            const isCompleted = item.step < activeStep || (item.step === 2 && isRegisteredForEvent);
            const isCurrent = item.step === activeStep;
            // Restricción solicitada:
            // Una vez que el usuario ya está registrado o en etapas 3+, no se puede devolver a 1 ni 2.
            // Pero sí puede navegar entre los pasos 3, 4 y 5 hacia adelante y atrás.
            const isAccessible = (isRegisteredForEvent || activeStep >= 3)
              ? (item.step >= 3 && item.step <= maxUnlockedStep)
              : (item.step <= maxUnlockedStep);

            return (
              <button
                key={item.step}
                type="button"
                className={`stepper-step-btn ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''} ${!isAccessible ? 'locked' : ''}`}
                onClick={() => {
                  if (isAccessible) setActiveStep(item.step);
                }}
                disabled={!isAccessible}
              >
                <div className="step-circle">
                  {isCompleted ? <Check size={14} /> : <span>{item.step}</span>}
                </div>
                <span className="step-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* =========================================================================
          PASO 1: VALIDACIÓN DE GEOLOCALIZACIÓN GPS
          ========================================================================= */}
      {activeStep === 1 && (
        <section className="attendee-card-module animated-step">
          <div className="module-header">
            <div className="module-icon-wrap">
              <MapPin size={22} />
            </div>
            <div>
              <span className="step-indicator-pill">Paso 1 de 5</span>
              <h2 className="module-title">Verificación de Ubicación Presencial</h2>
              <p className="module-desc">
                Compruebe su presencia en la sede o auditorio de la Facultad de Medicina para certificar su asistencia presencial.
              </p>
              <div className="usb-scanner-ready-badge">
                <Barcode size={15} />
                <span>Lector de cédulas USB activo: Puedes escanear tu documento físico en cualquier momento para avanzar y autocompletar tu asistencia.</span>
              </div>
            </div>
          </div>

          <div className="geo-activation-box large">
            <div className="geo-info-content">
              <div className="geo-icon">
                <Navigation size={30} />
              </div>
              <div>
                <h4>Sensor de Geolocalización Satelital</h4>
                <p>
                  {geoState.obtenida
                    ? (geoState.esPresencial
                        ? `Ubicación satelital confirmada: Estás a ${geoState.distancia} metros del Auditorio de la Facultad de Medicina.`
                        : `Coordenadas registradas: Estás a ${geoState.distancia != null ? `${geoState.distancia} metros` : 'distancia no calculada'} de la Facultad de Medicina.`)
                    : geoState.error
                    ? 'Ocurrió un inconveniente con el permiso o la señal GPS. Puedes pulsar "Reintentar", usar el Modo Demostración o continuar al registro como Asistencia Remota.'
                    : 'Presione el botón para obtener la ubicación satelital precisa de su dispositivo.'}
                </p>

                {geoState.obtenida && geoState.distancia != null && (
                  <div className="geo-tech-specs">
                    <span><strong>Fuente de señal:</strong> {geoState.origenSenal || 'Sensor GPS'}</span>
                    <span><strong>Margen de precisión:</strong> ±{geoState.precision || 15} metros</span>
                    <span><strong>Distancia al auditorio:</strong> {geoState.distancia} m</span>
                  </div>
                )}
              </div>
            </div>

            <div className="geo-actions-wrapper">
              {!geoState.obtenida ? (
                <div className="geo-btn-cluster">
                  <button
                    type="button"
                    className="btn-geo-activate pulse"
                    onClick={handleObtenerUbicacion}
                    disabled={geoState.cargando}
                  >
                    {geoState.error ? <RotateCcw size={16} /> : <Radio size={16} />}
                    <span>{geoState.cargando ? 'Conectando con Satélites GPS...' : geoState.error ? 'Reintentar Obtener Ubicación GPS' : 'Obtener Ubicación Satelital Precisa'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-sim-sede"
                    onClick={handleSimularEnSede}
                    title="Simular que estás físicamente dentro del auditorio para pruebas y demostraciones"
                  >
                    Probar como "En Sede" (Modo Demostración)
                  </button>
                </div>
              ) : (
                <div className="geo-status-confirmed">
                  <div className={`geo-badge ${geoState.esPresencial ? 'verified' : 'unverified'}`}>
                    {geoState.esPresencial ? 'En Sede UdeA (Presencial)' : 'Registro Remoto'}
                  </div>
                  <button
                    type="button"
                    className="btn-re-scan"
                    onClick={handleObtenerUbicacion}
                    disabled={geoState.cargando}
                    title="Volver a escanear señal GPS"
                  >
                    <RotateCcw size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    <span>{geoState.cargando ? 'Escaneando...' : 'Re-escanear GPS'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-change-participant-mini"
                    style={{ marginTop: '0.35rem' }}
                    onClick={handleSimularEnSede}
                    title="Cambiar a En Sede para pruebas"
                  >
                    Probar en Sede
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Comparador Visual de Sede vs Dispositivo */}
          <div className="geo-comparison-radar">
            <div className="geo-radar-col">
              <div className="radar-col-header">
                <span className="radar-badge sede">Sede Oficial UdeA</span>
                <strong>Facultad de Medicina</strong>
              </div>
              <p className="radar-col-sub">Cra. 51D # 62-29, Medellín (Área de la Salud)</p>
              <div className="radar-specs-list">
                <span><strong>Coord:</strong> 6.261341, -75.566464</span>
                <span><strong>Radio de presencia:</strong> {UDEA_MEDICINA_COORDS.radioMaximoMetros} metros</span>
              </div>
            </div>

            <div className="geo-radar-divider">
              <div className="radar-distance-pill">
                {geoState.obtenida && geoState.distancia != null ? `${geoState.distancia} m` : '---'}
              </div>
            </div>

            <div className="geo-radar-col">
              <div className="radar-col-header">
                <span className={`radar-badge ${geoState.obtenida ? (geoState.esPresencial ? 'presencial' : 'remoto') : 'neutral'}`}>
                  {geoState.obtenida ? (geoState.esPresencial ? 'En Auditorio' : 'Remoto') : (geoState.error ? 'No Obtenida' : 'Por Escanear')}
                </span>
                <strong>Tu Dispositivo</strong>
              </div>
              <p className="radar-col-sub">
                {geoState.obtenida
                  ? (geoState.origenSenal || 'Sensor GPS Móvil')
                  : geoState.error
                  ? 'Captura no realizada o permiso denegado'
                  : 'Presione "Obtener Ubicación Satelital"'}
              </p>
              <div className="radar-specs-list">
                <span><strong>Margen:</strong> {geoState.obtenida && geoState.precision ? `±${geoState.precision} m` : 'No capturado'}</span>
                <span><strong>Estado:</strong> {geoState.obtenida ? (geoState.esPresencial ? 'Validado en Sede' : 'Registrado como Remoto') : (geoState.error ? 'Sin permiso / señal' : 'Pendiente')}</span>
              </div>
            </div>
          </div>

          {/* Nota técnica educativa para los asistentes */}
          <div className="geo-edu-note">
            <HelpCircle size={16} className="edu-icon" />
            <div>
              <strong>¿Cómo funciona la precisión de ubicación?</strong>
              <p>
                <strong>En celulares:</strong> El navegador activa el chip satelital GPS de su teléfono con precisión de 5 a 15 metros.
                <br />
                <strong>En computadores:</strong> La ubicación se calcula por la dirección IP de su conexión a internet (puede marcar unos kilómetros de distancia).
                <br />
                <strong>Tranquilidad:</strong> La geolocalización es de verificación y trazabilidad; nunca le impedirá registrar su asistencia si la señal es baja dentro del auditorio.
              </p>
            </div>
          </div>

          {geoState.error && (
            <div className="form-error-banner">
              <AlertTriangle size={16} />
              <div>
                <strong>Aviso:</strong> {geoState.error}
                <p style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                  Puedes continuar y registrar tu asistencia normalmente.
                </p>
              </div>
            </div>
          )}

          <div className="stepper-footer-actions">
            <div></div>
            <button
              type="button"
              className="btn-primary-action"
              onClick={() => {
                setMaxUnlockedStep(prev => Math.max(prev, 2));
                setActiveStep(2);
              }}
            >
              <span>Continuar a Datos de Asistencia</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </section>
      )}

      {/* =========================================================================
          PASO 2: DATOS DEL ASISTENTE Y PLACA VEHICULAR (SI APLICA)
          ========================================================================= */}
      {activeStep === 2 && (
        <section className="attendee-card-module animated-step">
          <div className="module-header">
            <div className="module-icon-wrap">
              <ShieldCheck size={22} />
            </div>
            <div>
              <span className="step-indicator-pill">Paso 2 de 5</span>
              <h2 className="module-title">Registro Oficial de Asistencia</h2>
              <p className="module-desc">
                Ingrese sus datos personales para la emisión oficial del certificado de Educación a lo Largo de la Vida.
              </p>
              <div className="usb-scanner-ready-badge">
                <Barcode size={15} />
                <span>Lector de cédulas USB activo: Si escaneas tu cédula física, tus datos del listado de inscritos se autocompletarán al instante.</span>
              </div>
            </div>
          </div>

          {/* Tarjeta de Jornada Multidía */}
          {evento?.esMultidia && (
            <div className="attendee-day-selector-card">
              <div className="attendee-day-title">
                <h4>
                  <Calendar size={16} color="#006633" />
                  <span>Jornada Multidía: {dayStatus.diaNumero ? `Día ${dayStatus.diaNumero} de ${dayStatus.totalDias}` : 'Sesión Especial'}</span>
                </h4>
              </div>

              <div className="days-progress-tracker">
                {eventDays.map((dStr, idx) => {
                  const attendedForThisDay = misAsistenciasEvento.find(a => a.fechaDia === dStr || a.diaNumero === (idx + 1));
                  const isToday = dStr === officialTime.fechaStr;
                  const diaHorario = (evento?.horariosPorDia && evento.horariosPorDia[dStr]) || {
                    horaInicio: evento?.horaInicio || '08:00',
                    horaFin: evento?.horaFin || '17:00'
                  };

                  return (
                    <div
                      key={dStr}
                      className={`day-progress-step ${attendedForThisDay ? 'attended' : ''} ${isToday ? 'today' : ''}`}
                    >
                      <div className="step-day-label">
                        <span>Día {idx + 1}</span>
                        {attendedForThisDay ? (
                          <CheckCircle2 size={14} color="#10B981" />
                        ) : isToday ? (
                          <span style={{ fontSize: '0.68rem', background: '#006633', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>HOY</span>
                        ) : null}
                      </div>
                      <span className="step-day-date">{dStr}</span>
                      <span className="step-day-hours">{diaHorario.horaInicio} - {diaHorario.horaFin}</span>
                      <span className={`step-status-tag ${attendedForThisDay ? 'ok' : 'pending'}`}>
                        {attendedForThisDay ? 'Registrado' : (isToday ? 'Por Registrar' : 'Pendiente')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Indicador de horario de la jornada activa de hoy */}
              {dayStatus.esDiaActivo && (
                <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.75rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', fontSize: '0.82rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={14} color="#006633" />
                  <span>
                    Jornada de hoy ({officialTime.fechaStr}): <strong>{dayStatus.horaInicio} a {dayStatus.horaFin}</strong>
                    {dayStatus.tieneHorarioEspecial ? ' • Horario especial de cierre' : ''}
                  </span>
                </div>
              )}

              {yaRegistroHoy && (
                <div style={{ marginTop: '0.75rem', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '0.65rem 0.85rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065F46', fontSize: '0.85rem' }}>
                  <CheckCircle2 size={16} color="#10B981" />
                  <span><strong>¡Asistencia de hoy ({officialTime.fechaStr}) registrada!</strong> Tienes tu acreditación lista para la sesión actual.</span>
                </div>
              )}

              {!dayStatus.esDiaActivo && (
                <div style={{ marginTop: '0.75rem', background: '#FFFBEB', border: '1px solid #FCD34D', padding: '0.65rem 0.85rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#92400E', fontSize: '0.82rem' }}>
                  <AlertTriangle size={16} color="#D97706" />
                  <span>Aviso: La fecha oficial de hoy ({officialTime.fechaStr}) no corresponde al calendario programado de sesiones de este evento. Sin embargo, puedes registrarte si estás asistiendo a una jornada extraordinaria.</span>
                </div>
              )}
            </div>
          )}

          {(isRegisteredForEvent && (!evento?.esMultidia || yaRegistroHoy)) ? (
            <div className="success-attendance-box">
              <div className="success-icon-circle">
                <CheckCircle2 size={40} className="check-icon" />
              </div>
              <h3 className="success-title">¡Asistencia Oficial Registrada!</h3>
              <p className="success-text">
                Gracias, <strong>{formData.nombreCompleto}</strong>. Tu registro {evento?.esMultidia && dayStatus.diaNumero ? `para la sesión del Día ${dayStatus.diaNumero} (${officialTime.fechaStr})` : ''} ha sido procesado exitosamente.
              </p>
              <div className="comprobante-chip">
                <span>N° Comprobante:</span> <strong>{codigoComprobante}</strong>
              </div>

              {/* Acceso a la Escarapela Digital Oficial con Código QR */}
              <div className="badge-cta-container">
                <button
                  type="button"
                  className="btn-open-badge-glow pulse"
                  onClick={() => setIsBadgeModalOpen(true)}
                >
                  <Award size={20} />
                  <span>Ver Mi Pase Digital Oficial</span>
                </button>
                <p className="badge-cta-hint">
                  Incluye tu código QR de verificación oficial para identificarte e ingresar al auditorio.
                </p>
              </div>

              <div className="post-register-nav-box">
                <p>Ahora puedes participar con preguntas al ponente o responder las encuestas:</p>
                <div className="next-steps-buttons">
                  <button
                    type="button"
                    className="btn-primary-action"
                    onClick={() => setActiveStep(3)}
                  >
                    <MessageSquare size={16} />
                    <span>Ir a Preguntas al Ponente</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setActiveStep(4)}
                  >
                    <Star size={16} />
                    <span>Calificar Ponentes</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegistrarAsistencia} className="attendance-form">
              {dayStatus.esAntesDeFecha && (
                <div style={{
                  background: '#FFFBEB',
                  border: '1.5px solid #FCD34D',
                  padding: '0.9rem 1.1rem',
                  borderRadius: '10px',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  color: '#92400E',
                  fontSize: '0.9rem'
                }}>
                  <AlertTriangle size={22} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '2px', color: '#78350F' }}>
                      Registro de asistencia aún no habilitado
                    </strong>
                    <span>
                      Este evento está programado para iniciar el <strong>{dayStatus.fechaInicio || evento.fecha}</strong>. Podrás confirmar tu asistencia oficial a partir de dicha fecha.
                    </span>
                  </div>
                </div>
              )}
              {evento?.esMultidia && !yaRegistroHoy && misAsistenciasEvento.length > 0 && (
                <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontSize: '0.88rem' }}>
                  <CheckCircle2 size={18} color="#006633" />
                  <span>
                    Ya registraste asistencia en {misAsistenciasEvento.length} {misAsistenciasEvento.length === 1 ? 'sesión previa' : 'sesiones previas'}. Tus datos han sido precargados para registrar la asistencia del <strong>Día {dayStatus.diaNumero || 1} ({officialTime.fechaStr})</strong>.
                  </span>
                </div>
              )}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Tipo de Documento</label>
                  <select
                    className="form-input"
                    value={formData.tipoDocumento}
                    onChange={(e) => handleFieldChange('tipoDocumento', e.target.value)}
                  >
                    <option value="CC">Cédula de Ciudadanía (CC)</option>
                    <option value="TI">Tarjeta de Identidad (TI)</option>
                    <option value="CE">Cédula de Extranjería (CE)</option>
                    <option value="DE">Documento Extranjero (DE)</option>
                    <option value="PASAPORTE">Pasaporte (PA)</option>
                    <option value="OTRO">Otro Documento</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <CreditCard size={14} /> Número de Documento <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-input ${registroExistente ? 'input-warning-border' : ''}`}
                    placeholder="Ej: 1037654321"
                    value={formData.documento}
                    onChange={(e) => handleFieldChange('documento', e.target.value)}
                    required
                  />

                  {/* Alerta inmediata si el documento ya se encuentra registrado */}
                  {registroExistente ? (
                    isCurrentDocVerified ? (
                      <div className="doc-duplicate-alert animated-step">
                        <div className="doc-duplicate-header">
                          <AlertTriangle size={15} className="warn-icon" />
                          <span>Este documento ya registró asistencia en la jornada de hoy:</span>
                        </div>
                        <div className="doc-duplicate-details">
                          <strong>{maskFullName(registroExistente.nombreCompleto)}</strong> (Comprobante: <code>{registroExistente.id}</code>)
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            className="btn-recover-attendance"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                nombreCompleto: registroExistente.nombreCompleto || prev.nombreCompleto,
                                correo: registroExistente.correo || prev.correo,
                                telefono: registroExistente.telefono || prev.telefono,
                                vinculacion: registroExistente.vinculacion || prev.vinculacion,
                                placaVehiculo: registroExistente.placaVehiculo || prev.placaVehiculo
                              }));
                              setCodigoComprobante(registroExistente.id);
                              setAsistenciaRegistrada(true);
                              setMaxUnlockedStep(5);
                              setErrorAsistencia('');
                              try {
                                localStorage.setItem(`udea_session_attendee_${evento.id}`, JSON.stringify({
                                  ...formData,
                                  nombreCompleto: registroExistente.nombreCompleto,
                                  documento: registroExistente.documento,
                                  comprobanteId: registroExistente.id,
                                  registrado: true
                                }));
                              } catch {}
                              setActiveStep(3);
                            }}
                          >
                            <CheckCircle2 size={15} />
                            <span>Ver mi comprobante e ir a Preguntas en Vivo</span>
                            <ChevronRight size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-change-participant-mini"
                            onClick={handleResetParticipant}
                            title="Limpiar campos para ingresar con otro documento"
                            style={{ alignSelf: 'center' }}
                          >
                            Cambiar documento
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="security-challenge-card animated-step">
                        <div className="security-challenge-header">
                          <ShieldCheck size={16} color="#006633" />
                          <span>Registro de hoy detectado: <strong>{maskFullName(registroExistente.nombreCompleto)}</strong> ({maskEmail(registroExistente.correo)})</span>
                        </div>
                        <p className="security-challenge-desc">
                          Por seguridad y protección de datos personales (Ley 1581), para acceder a tu comprobante y preguntas en vivo en este dispositivo, confirma tu correo electrónico registrado:
                        </p>
                        <div className="security-challenge-form-row">
                          <input
                            type="email"
                            className="form-input challenge-input"
                            placeholder="Confirma tu correo registrado..."
                            value={challengeEmail}
                            onChange={(e) => {
                              setChallengeEmail(e.target.value);
                              setChallengeError('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleVerifyChallengeEmail(e);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn-challenge-action"
                            onClick={handleVerifyChallengeEmail}
                          >
                            <KeyRound size={14} />
                            <span>Validar y Acceder</span>
                          </button>
                          <button
                            type="button"
                            className="btn-change-participant-mini"
                            onClick={handleResetParticipant}
                            title="Limpiar campos para ingresar con otro documento"
                            style={{ alignSelf: 'center' }}
                          >
                            Ingresar con otro documento
                          </button>
                        </div>
                        {challengeError && <p className="challenge-err-text">{challengeError}</p>}
                      </div>
                    )
                  ) : registroPrevioEvento ? (
                    isCurrentDocVerified ? (
                      <div className="doc-autofilled-hint animated-step">
                        <CheckCircle2 size={14} color="#059669" />
                        <span>Datos vinculados de tu registro inicial ({maskFullName(registroPrevioEvento.nombreCompleto)})</span>
                        <button
                          type="button"
                          className="btn-change-participant-mini"
                          onClick={handleResetParticipant}
                          title="Limpiar campos para ingresar con otro documento"
                        >
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      <div className="security-challenge-card animated-step">
                        <div className="security-challenge-header">
                          <ShieldCheck size={16} color="#006633" />
                          <span>Registro previo detectado: <strong>{maskFullName(registroPrevioEvento.nombreCompleto)}</strong> ({maskEmail(registroPrevioEvento.correo)})</span>
                        </div>
                        <p className="security-challenge-desc">
                          Por seguridad y protección de datos personales (Ley 1581), para autocompletar automáticamente tu formulario en este dispositivo, confirma tu correo electrónico:
                        </p>
                        <div className="security-challenge-form-row">
                          <input
                            type="email"
                            className="form-input challenge-input"
                            placeholder="Confirma tu correo registrado..."
                            value={challengeEmail}
                            onChange={(e) => {
                              setChallengeEmail(e.target.value);
                              setChallengeError('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleVerifyChallengeEmail(e);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn-challenge-action"
                            onClick={handleVerifyChallengeEmail}
                          >
                            <KeyRound size={14} />
                            <span>Validar y Autocompletar</span>
                          </button>
                          <button
                            type="button"
                            className="btn-change-participant-mini"
                            onClick={handleResetParticipant}
                            title="Limpiar campos para ingresar con otro documento"
                            style={{ alignSelf: 'center' }}
                          >
                            Ingresar con otro documento
                          </button>
                        </div>
                        {challengeError && <p className="challenge-err-text">{challengeError}</p>}
                      </div>
                    )
                  ) : inscritoData ? (
                    isCurrentDocVerified ? (
                      <div className="doc-autofilled-banner animated-step">
                        <div className="doc-autofilled-header">
                          <CheckCircle2 size={18} className="doc-autofilled-icon" />
                          <div className="doc-autofilled-text">
                            <strong>¡Participante verificado en la lista oficial de inscritos!</strong>
                            <span>
                              Datos de asistencia vinculados para <strong>{formData.nombreCompleto || inscritoData.nombreCompleto}</strong> ({formData.tipoDocumento || 'CC'} {formData.documento}). Puedes verificar tu información y continuar.
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-change-participant-mini"
                          onClick={handleResetParticipant}
                          title="Limpiar campos para ingresar con otro documento"
                          style={{ alignSelf: 'center' }}
                        >
                          Cambiar documento
                        </button>
                      </div>
                    ) : (
                      <div className="security-challenge-card animated-step">
                        <div className="security-challenge-header">
                          <ShieldCheck size={16} color="#006633" />
                          <span>Inscripción previa detectada: <strong>{maskFullName(inscritoData.nombreCompleto)}</strong> ({maskEmail(inscritoData.correo)})</span>
                        </div>
                        <p className="security-challenge-desc">
                          Por seguridad y validación de tu inscripción (Habeas Data - Ley 1581), ingresa tu correo electrónico registrado para autocompletar automáticamente tus datos:
                        </p>
                        <div className="security-challenge-form-row">
                          <input
                            type="email"
                            className="form-input challenge-input"
                            placeholder="Confirma tu correo registrado..."
                            value={challengeEmail}
                            onChange={(e) => {
                              setChallengeEmail(e.target.value);
                              setChallengeError('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleVerifyChallengeEmail(e);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn-challenge-action"
                            onClick={handleVerifyChallengeEmail}
                          >
                            <KeyRound size={14} />
                            <span>Validar y Autocompletar</span>
                          </button>
                          <button
                            type="button"
                            className="btn-change-participant-mini"
                            onClick={handleResetParticipant}
                            title="Limpiar campos para ingresar con otro documento"
                            style={{ alignSelf: 'center' }}
                          >
                            Ingresar con otro documento
                          </button>
                        </div>
                        {challengeError && <p className="challenge-err-text">{challengeError}</p>}
                      </div>
                    )
                  ) : (enrollmentStatus.hasWhitelist && !enrollmentStatus.isEnrolled && normalizedCurrentDoc.length >= 4) ? (
                    <div className="doc-not-enrolled-alert animated-step">
                      <div className="doc-not-enrolled-header">
                        <AlertTriangle size={16} className="warn-icon" />
                        <span>No figura en la lista oficial de inscritos</span>
                      </div>
                      <p className="doc-not-enrolled-desc">
                        El documento <strong>{currentDoc}</strong> no se encuentra en el registro oficial de personas inscritas a este evento. Por favor acércate al punto de información del evento o comunícate con la coordinación académica.
                      </p>
                    </div>
                  ) : (
                    normalizedCurrentDoc.length >= 4 && (
                      <div className="doc-available-hint">
                        <Check size={13} />
                        <span>
                          {enrollmentStatus.hasWhitelist
                            ? 'Documento verificado en la lista oficial de inscritos'
                            : 'Documento disponible para registro de asistencia'}
                        </span>
                      </div>
                    )
                  )}
                </div>

                <div className="form-group col-span-2">
                  <label className="form-label">
                    <User size={14} /> Nombre Completo <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nombres y Apellidos completos"
                    value={formData.nombreCompleto}
                    onChange={(e) => handleFieldChange('nombreCompleto', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Mail size={14} /> Correo Electrónico <span className="req">*</span>
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="ejemplo@udea.edu.co"
                    value={formData.correo}
                    onChange={(e) => handleFieldChange('correo', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Phone size={14} /> Celular / Teléfono <span className="req">*</span>
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="Ej: 3124567890 (10 dígitos)"
                    value={formData.telefono}
                    maxLength={10}
                    onChange={(e) => handleFieldChange('telefono', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required
                  />
                </div>

                <div className="form-group col-span-2">
                  <label className="form-label">Tipo de Vinculación Institucional</label>
                  <select
                    className="form-input"
                    value={formData.vinculacion}
                    onChange={(e) => handleFieldChange('vinculacion', e.target.value)}
                  >
                    <option value="Ponente / Conferencista">Ponente / Conferencista Invitado</option>
                    <option value="Estudiante Pregrado Medicina UdeA">Estudiante Pregrado Medicina UdeA</option>
                    <option value="Residente / Posgrado UdeA">Residente / Especialidades Médicas UdeA</option>
                    <option value="Docente / Investigador UdeA">Docente / Investigador UdeA</option>
                    <option value="Auxiliar / Administrativo UdeA">Auxiliar / Administrativo UdeA</option>
                    <option value="Egresado UdeA">Egresado UdeA</option>
                    <option value="Médico / Especialista Externo">Médico / Especialista Externo</option>
                    <option value="Profesional de la Salud (Enfermería, Terapia, etc.)">Otro Profesional de la Salud</option>
                    <option value="Público General">Público General</option>
                  </select>
                </div>

                {/* CAMPO CONDICIONAL DE PLACA VEHICULAR: Totalmente opcional, máx 6 caracteres */}
                {evento.habilitarPlacaVehiculo && (
                  <div className="form-group col-span-2 vehicle-highlight-field">
                    <label className="form-label vehicle-label">
                      <Car size={16} /> Placa del Vehículo <span style={{ fontSize: '0.8rem', color: '#008744', fontWeight: 'normal', marginLeft: '0.35rem' }}>(Opcional si tiene carro o moto)</span>
                    </label>
                    <input
                      type="text"
                      className="form-input vehicle-input"
                      placeholder="Ej: KMW452 o ABC12D (Opcional - máx. 6 caracteres)"
                      value={formData.placaVehiculo}
                      onChange={(e) => handleFieldChange('placaVehiculo', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                      maxLength={6}
                    />
                    <span className="field-hint">
                      <strong>Nota informativa:</strong> Ingrese la placa únicamente si requiere autorizar el ingreso al parqueadero de la Facultad. Si asiste a pie o en transporte público, déjelo vacío.
                    </span>
                  </div>
                )}
              </div>

              {/* AUTORIZACIÓN DE TRATAMIENTO DE DATOS PERSONALES (HABEAS DATA - LEY 1581 DE 2012) */}
              <div className="habeas-data-card">
                <label className="habeas-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.habeasDataAceptado || false}
                    onChange={(e) => handleFieldChange('habeasDataAceptado', e.target.checked)}
                    className="habeas-checkbox"
                    required
                  />
                  <span className="habeas-text">
                    <strong>Autorización de Tratamiento de Datos Personales (Ley 1581 de 2012):</strong> Autorizo de manera voluntaria, previa y explícita a la <strong>Universidad de Antioquia - Facultad de Medicina</strong> para recolectar, almacenar y tratar mis datos personales con fines de registro de asistencia, emisión de certificaciones oficiales y gestión de eventos de Educación a lo Largo de la Vida, conforme a la política institucional de Habeas Data UdeA. <span className="req">*</span>
                  </span>
                </label>
              </div>

              {errorAsistencia && (
                <div className="form-error-banner interactive">
                  <div className="error-banner-lead">
                    <AlertTriangle size={18} className="error-icon" />
                    <span>{errorAsistencia}</span>
                  </div>
                  {errorAsistencia.includes('Ya se encuentra registrada') && (
                    <button
                        type="button"
                        className="btn-recover-attendance"
                        onClick={() => {
                          const existing = asistencias.find(
                            a => a.eventoId === evento.id && a.documento === formData.documento.trim()
                          );
                          const compId = existing ? existing.id : `ATT-${Date.now()}`;
                          const attendeeName = existing?.nombreCompleto || formData.nombreCompleto;
                          setCodigoComprobante(compId);
                          setAsistenciaRegistrada(true);
                          setMaxUnlockedStep(5);
                          try {
                            localStorage.setItem(`udea_session_attendee_${evento.id}`, JSON.stringify({
                              ...formData,
                              nombreCompleto: attendeeName,
                              comprobanteId: compId,
                              registrado: true
                            }));
                          } catch {}
                          setErrorAsistencia('');
                          setActiveStep(3);
                        }}
                      >
                        <CheckCircle2 size={15} />
                        <span>Ver mi comprobante e ir a Preguntas en Vivo</span>
                        <ChevronRight size={14} />
                      </button>
                  )}
                </div>
              )}

              <div className="stepper-footer-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveStep(1)}
                >
                  <ChevronLeft size={16} />
                  <span>Volver a Ubicación</span>
                </button>

                <button
                  type="submit"
                  className={`btn-primary-action ${(enrollmentStatus.hasWhitelist && !enrollmentStatus.isEnrolled) || dayStatus.esAntesDeFecha ? 'btn-disabled' : ''}`}
                  disabled={(enrollmentStatus.hasWhitelist && !enrollmentStatus.isEnrolled) || dayStatus.esAntesDeFecha}
                  title={
                    dayStatus.esAntesDeFecha
                      ? `El evento inicia el ${dayStatus.fechaInicio || evento?.fecha}`
                      : enrollmentStatus.hasWhitelist && !enrollmentStatus.isEnrolled
                      ? 'No figura en la lista oficial de inscritos'
                      : ''
                  }
                >
                  <span>
                    {dayStatus.esAntesDeFecha
                      ? `Asistencia No Disponible (Inicia ${dayStatus.fechaInicio || evento?.fecha})`
                      : enrollmentStatus.hasWhitelist && !enrollmentStatus.isEnrolled
                      ? 'No Figura en Lista de Inscritos'
                      : evento?.esMultidia
                      ? `Confirmar Asistencia Día ${dayStatus.diaNumero || 1} (${officialTime.fechaStr})`
                      : 'Confirmar Asistencia al Evento'}
                  </span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* =========================================================================
          PASO 3: PREGUNTAS A PONENTES EN VIVO (LIVE Q&A)
          ========================================================================= */}
      {activeStep === 3 && (
        <>
          {/* ACCESO DESTACADO A LA ESCARAPELA DIGITAL (Debajo de las 5 etapas y arriba de las preguntas) */}
          <div className="step-badge-banner-cta animated-step">
            <div className="step-badge-banner-content">
              <div className="step-badge-icon-wrap">
                <Award size={26} />
              </div>
              <div className="step-badge-text-wrap">
                <h3 className="step-badge-title">Escarapela Digital</h3>
                <p className="step-badge-sub">
                  {attendeeDisplayName ? (
                    <>
                      Hola, <strong>{attendeeDisplayName}</strong>. Presenta tu código QR institucional y comprobante de asistencia confirmada en cualquier momento.
                    </>
                  ) : (
                    'Presenta tu código QR institucional y comprobante de asistencia confirmada en cualquier momento.'
                  )}
                </p>
              </div>
            </div>
            <div className="step-badge-banner-actions">
              <button
                type="button"
                className="btn-open-badge-glow pulse"
                onClick={() => setIsBadgeModalOpen(true)}
                title="Ver escarapela digital con código QR"
              >
                <Award size={18} />
                <span>Ver Escarapela Digital</span>
              </button>
              <button
                type="button"
                className="btn-nuevo-registro-banner"
                onClick={handleNuevoRegistro}
                title="Realizar un nuevo registro de asistencia"
              >
                <UserPlus size={16} />
                <span>Realizar nuevo registro</span>
              </button>
            </div>
          </div>

          <section className="attendee-card-module animated-step">
          <div className="module-header">
            <div className="module-icon-wrap questions-icon">
              <HelpCircle size={22} />
            </div>
            <div>
              <span className="step-indicator-pill">Paso 3 de 5</span>
              <h2 className="module-title">Preguntas a los Ponentes en Vivo</h2>
              <p className="module-desc">
                Envíe su pregunta o caso clínico. El moderador en el auditorio la recibirá en tiempo real.
              </p>
            </div>
          </div>

          <form onSubmit={handleEnviarPregunta} className="qa-form">
            <div className="form-group">
              <label className="form-label">Seleccione el Ponente Destinatario</label>
              <select
                className="form-input"
                value={preguntaForm.ponenteId}
                onChange={(e) => setPreguntaForm({ ...preguntaForm, ponenteId: e.target.value })}
                required
              >
                {ponentesActivos.length === 0 ? (
                  <option value="">No hay ponentes activos en este momento</option>
                ) : (
                  ponentesActivos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — {p.temaPonencia || p.titulo}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Escriba su Pregunta o Caso Clínico</label>
              <textarea
                className="form-input form-textarea"
                rows={3}
                placeholder="Escriba aquí su duda sobre la exposición..."
                value={preguntaForm.textoPregunta}
                onChange={(e) => setPreguntaForm({ ...preguntaForm, textoPregunta: e.target.value })}
                required
              ></textarea>
            </div>

            <div className="qa-options-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={preguntaForm.esAnonimo}
                  onChange={(e) => setPreguntaForm({ ...preguntaForm, esAnonimo: e.target.checked })}
                />
                <span>Enviar pregunta de forma anónima</span>
              </label>

              <button type="submit" className="btn-send-question" disabled={qaCooldown > 0}>
                <Send size={16} />
                <span>{qaCooldown > 0 ? `Espere ${qaCooldown}s...` : 'Enviar al Moderador'}</span>
              </button>
            </div>

            {preguntaEnviada && (
              <div className="form-success-banner">
                <CheckCircle2 size={16} />
                <span>¡Pregunta enviada en vivo al moderador!</span>
              </div>
            )}
          </form>

          {/* Muro de Preguntas Enviadas */}
          <div className="qa-feed-wrapper">
            <h4 className="feed-title">Preguntas recientes del auditorio ({preguntas.length})</h4>
            <div className="feed-list">
              {preguntas.length === 0 ? (
                <p className="empty-feed">Aún no se han formulado preguntas. ¡Sea el primero en participar!</p>
              ) : (
                preguntas.slice(0, 5).map((q) => {
                  const ponente = evento.ponentes?.find(p => p.id === q.ponenteId);
                  const docenteNombre = q.ponenteNombre || ponente?.nombre || (q.ponenteId === 'todos' ? 'Todos los Ponentes / Panel' : 'Docente UdeA');
                  return (
                    <div key={q.id} className={`qa-card-item ${q.destacada ? 'featured' : ''}`}>
                      <div className="qa-card-meta">
                        <span className="qa-target">Para: {docenteNombre}</span>
                        <span className="qa-time">{q.hora}</span>
                      </div>
                      <p className="qa-text">"{q.pregunta}"</p>
                      <div className="qa-footer">
                        <span className="qa-author">— {q.autor}</span>
                        {q.respondida && <span className="badge-answered">Respondida en vivo</span>}
                        {q.destacada && <span className="badge-featured">Destacada</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="stepper-footer-actions">
            <div className="stepper-left-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsBadgeModalOpen(true)}
                title="Ver credencial y comprobante oficial con código QR"
              >
                <Award size={16} />
                <span>Escarapela Digital</span>
              </button>
              <button
                type="button"
                className="btn-secondary btn-nuevo-registro-footer"
                onClick={handleNuevoRegistro}
                title="Realizar un nuevo registro de asistencia"
              >
                <UserPlus size={16} />
                <span>Realizar nuevo registro</span>
              </button>
            </div>

            <button
              type="button"
              className="btn-primary-action"
              onClick={() => {
                setMaxUnlockedStep(prev => Math.max(prev, 4));
                setActiveStep(4);
              }}
            >
              <span>Continuar a Calificar Ponentes</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </section>
      </>
    )}

      {/* =========================================================================
          PASO 4: CALIFICACIÓN DINÁMICA DE PONENTES
          ========================================================================= */}
      {activeStep === 4 && (
        <section className="attendee-card-module animated-step">
          <div className="module-header">
            <div className="module-icon-wrap stars-icon">
              <Star size={22} />
            </div>
            <div>
              <span className="step-indicator-pill">Paso 4 de 5</span>
              <h2 className="module-title">Calificación Individual de Ponentes</h2>
              <p className="module-desc">
                Evalúe a los conferencistas del evento. Su retroalimentación promueve la excelencia académica.
              </p>
            </div>
          </div>

          <div className="speakers-evaluation-grid">
            {evento.ponentes?.map((ponente) => {
              const isInactive = ponente.activo === false;
              if (isInactive) {
                return (
                  <div key={ponente.id} className="speaker-eval-card" style={{ opacity: 0.7, borderStyle: 'dashed' }}>
                    <div className="speaker-header">
                      <div className="speaker-avatar" style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF' }}>
                        <User size={20} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 className="speaker-name" style={{ color: '#4B5563', margin: 0 }}>{ponente.nombre}</h3>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', backgroundColor: '#FEF3C7', color: '#92400E' }}>
                            En Pausa / No Activo
                          </span>
                        </div>
                        <span className="speaker-title">{ponente.titulo}</span>
                        <p className="speaker-topic">Ponencia: "{ponente.temaPonencia}"</p>
                      </div>
                    </div>
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.82rem', color: '#6B7280', fontStyle: 'italic' }}>
                      La evaluación para este ponente se encuentra temporalmente en pausa por la coordinación del evento.
                    </p>
                  </div>
                );
              }

              const yaEvaluado = ponentesEvaluados[ponente.id];
              const currentEval = evaluacionesPonentes[ponente.id] || {
                dominio: 5,
                claridad: 5,
                aplicabilidad: 5,
                comentario: ''
              };

              const setField = (field, val) => {
                setEvaluacionesPonentes({
                  ...evaluacionesPonentes,
                  [ponente.id]: {
                    ...currentEval,
                    [field]: val
                  }
                });
              };

              return (
                <div key={ponente.id} className={`speaker-eval-card ${yaEvaluado ? 'completed' : ''}`}>
                  <div className="speaker-header">
                    <div className="speaker-avatar">
                      <User size={20} />
                    </div>
                    <div>
                      <h3 className="speaker-name">{ponente.nombre}</h3>
                      <span className="speaker-title">{ponente.titulo}</span>
                      <p className="speaker-topic">Ponencia: "{ponente.temaPonencia}"</p>
                    </div>
                  </div>

                  {yaEvaluado ? (
                    <div className="eval-success-pill">
                      <CheckCircle2 size={16} />
                      <span>¡Evaluación de este ponente guardada!</span>
                    </div>
                  ) : (
                    <div className="speaker-criteria-form">
                      <div className="criteria-row">
                        <span className="criteria-label">1. Dominio y actualización del tema:</span>
                        <div className="star-rating">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              className={`star-btn ${star <= currentEval.dominio ? 'active' : ''}`}
                              onClick={() => setField('dominio', star)}
                            >
                              <Star size={20} fill="currentColor" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="criteria-row">
                        <span className="criteria-label">2. Claridad expositiva y pedagogía:</span>
                        <div className="star-rating">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              className={`star-btn ${star <= currentEval.claridad ? 'active' : ''}`}
                              onClick={() => setField('claridad', star)}
                            >
                              <Star size={20} fill="currentColor" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="criteria-row">
                        <span className="criteria-label">3. Aplicabilidad clínica y práctica:</span>
                        <div className="star-rating">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              className={`star-btn ${star <= currentEval.aplicabilidad ? 'active' : ''}`}
                              onClick={() => setField('aplicabilidad', star)}
                            >
                              <Star size={20} fill="currentColor" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-sublabel">Comentarios para el conferencista:</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Felicitaciones, aportes o recomendaciones..."
                          value={currentEval.comentario}
                          onChange={(e) => setField('comentario', e.target.value)}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn-submit-eval"
                        onClick={() => handleCalificarPonente(ponente.id)}
                      >
                        <span>Guardar Calificación</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="stepper-footer-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActiveStep(3)}
            >
              <ChevronLeft size={16} />
              <span>Volver a Preguntas</span>
            </button>

            <button
              type="button"
              className="btn-primary-action"
              onClick={() => {
                setMaxUnlockedStep(5);
                setActiveStep(5);
              }}
            >
              <span>Continuar a Encuesta Final</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </section>
      )}

      {/* =========================================================================
          PASO 5: MICROSOFT FORMS INSTITUCIONAL + ENCUESTA DE SATISFACCIÓN
          ========================================================================= */}
      {activeStep === 5 && (
        <section className="attendee-card-module animated-step">
          <div className="module-header">
            <div className="module-icon-wrap satisfaction-icon">
              <ThumbsUp size={22} />
            </div>
            <div>
              <span className="step-indicator-pill">Paso 5 de 5</span>
              <h2 className="module-title">
                {evento.habilitarMicrosoftForms && evento.microsoftFormsUrl ? 'Encuesta Institucional (Microsoft Forms) y Satisfacción' : 'Encuesta de Satisfacción General'}
              </h2>
              <p className="module-desc">
                Su retroalimentación permite mejorar continuamente la calidad de nuestros programas académicos.
              </p>
            </div>
          </div>

          {/* INTEGRACIÓN VISIBLE DE MICROSOFT FORMS (Si el evento tiene habilitado y URL configurada) */}
          {Boolean(evento.habilitarMicrosoftForms && evento.microsoftFormsUrl) && (
            <div className="ms-forms-user-card animated-step">
              <div className="ms-forms-header">
                <div className="ms-icon-wrap" style={{ background: '#0F5938', color: '#fff', borderRadius: '10px', padding: '10px' }}>
                  <FileText size={24} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#0F5938' }}>Encuesta Oficial de la Facultad (Microsoft Forms)</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
                    Por favor responda el formulario institucional de Microsoft 365 para la retroalimentación oficial del evento.
                  </p>
                </div>
              </div>

              <div className="ms-forms-action-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px', alignItems: 'center' }}>
                <a
                  href={evento.microsoftFormsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-open-external-forms"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#0F5938', color: '#ffffff', textDecoration: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.92rem' }}
                >
                  <ExternalLink size={16} />
                  <span>Abrir Encuesta en Microsoft Forms (Nueva Pestaña)</span>
                </a>

                <button
                  type="button"
                  className="btn-toggle-embed"
                  onClick={() => setShowEmbeddedForms(!showEmbeddedForms)}
                  style={{ fontSize: '0.85rem', color: '#64748b', background: 'transparent', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  {showEmbeddedForms ? 'Ocultar Previsualización Embebida' : 'Intentar Previsualizar Aquí'}
                </button>
              </div>

              {showEmbeddedForms && (
                <div className="ms-forms-iframe-container" style={{ marginTop: '14px' }}>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '8px' }}>
                    * Nota: Si su navegador bloquea la visualización por directivas de seguridad de Microsoft (X-Frame-Options), utilice el botón verde arriba para abrirlo directamente.
                  </p>
                  <iframe
                    src={evento.microsoftFormsUrl}
                    title="Formulario Oficial Microsoft Forms UdeA"
                    className="ms-forms-iframe"
                    allowFullScreen
                  ></iframe>
                </div>
              )}
            </div>
          )}

          {/* Encuesta de Satisfacción General Nativa */}
          <div className="native-satisfaction-submodule">
            <h3 className="submodule-title">Calificación Global de la Jornada</h3>

            {satisfaccionEnviada ? (
              <div className="success-attendance-box">
                <div className="success-icon-circle">
                  <CheckCircle2 size={36} className="check-icon" />
                </div>
                <h3 className="success-title">¡Evaluación Registrada con Éxito!</h3>
                <p className="success-text">
                  Muchas gracias por participar en <strong>{evento.titulo}</strong> de la Facultad de Medicina UdeA.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEnviarSatisfaccion} className="satisfaction-form">
                <div className="form-grid-2">
                  <div className="criteria-box">
                    <span className="criteria-label">Cumplimiento de expectativas académicas:</span>
                    <div className="star-rating">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`star-btn ${star <= satisfaccionForm.cumplimiento ? 'active' : ''}`}
                          onClick={() => setSatisfaccionForm({ ...satisfaccionForm, cumplimiento: star })}
                        >
                          <Star size={20} fill="currentColor" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="criteria-box">
                    <span className="criteria-label">Organización, puntualidad e instalaciones:</span>
                    <div className="star-rating">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`star-btn ${star <= satisfaccionForm.logistica ? 'active' : ''}`}
                          onClick={() => setSatisfaccionForm({ ...satisfaccionForm, logistica: star })}
                        >
                          <Star size={20} fill="currentColor" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Net Promoter Score (NPS 0 a 10) */}
                <div className="nps-module">
                  <label className="nps-label">
                    ¿Qué tan probable es que recomiende los eventos de la Facultad de Medicina UdeA a un colega?
                  </label>
                  <div className="nps-scale">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={`nps-btn ${satisfaccionForm.nps === num ? 'selected' : ''}`}
                        onClick={() => setSatisfaccionForm({ ...satisfaccionForm, nps: num })}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <div className="nps-legend">
                    <span>0 = Nada probable</span>
                    <span>10 = Totalmente probable</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Sugerencias temáticas para futuros cursos y diplomados de la Facultad:
                  </label>
                  <textarea
                    className="form-input form-textarea"
                    rows={2}
                    placeholder="¿Qué temas clínicos o quirúrgicos le gustaría que abordáramos próximamente?"
                    value={satisfaccionForm.sugerencias}
                    onChange={(e) => setSatisfaccionForm({ ...satisfaccionForm, sugerencias: e.target.value })}
                  ></textarea>
                </div>

                <button type="submit" className="btn-primary-action">
                  <span>Finalizar y Enviar Evaluación</span>
                </button>
              </form>
            )}
          </div>

          <div className="stepper-footer-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActiveStep(4)}
            >
              <ChevronLeft size={16} />
              <span>Volver a Ponentes</span>
            </button>
            <div></div>
          </div>
        </section>
      )}

      {/* Modal de la Escarapela Digital Oficial */}
      {isBadgeModalOpen && activeAttendeeRecord && (
        <DigitalBadge
          asistente={activeAttendeeRecord}
          evento={evento}
          isModal={true}
          onClose={() => setIsBadgeModalOpen(false)}
        />
      )}
    </div>
  );
}
