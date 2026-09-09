import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  MapPin, CheckCircle2, AlertTriangle, Send, Star, Car, User, Mail,
  Phone, CreditCard, Sparkles, MessageSquare, ThumbsUp, HelpCircle,
  Clock, ShieldCheck, ChevronRight, ChevronLeft, ExternalLink, FileText, Check,
  Navigation, Radio
} from 'lucide-react';
import {
  UDEA_MEDICINA_COORDS,
  calcularDistanciaMetros,
  recordAttendance,
  addQuestion,
  recordEvaluation,
  recordSatisfaction
} from '../services/storage';
import { maskFullName, sanitizeText } from '../services/sanitizer';

export default function AttendeeView({
  evento,
  asistencias,
  preguntas,
  evaluaciones,
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

  // Control del Flujo Secuencial (Pasos 1 a 5)
  // 1: Ubicación GPS, 2: Datos de Asistencia, 3: Preguntas en Vivo, 4: Calificación Ponentes, 5: Microsoft Forms / Satisfacción
  const [activeStep, setActiveStep] = useState(1);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(1);

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

  // Estado del Formulario de Asistencia
  const [formData, setFormData] = useState({
    tipoDocumento: 'CC',
    documento: '',
    nombreCompleto: '',
    correo: '',
    telefono: '',
    vinculacion: 'Estudiante Pregrado Medicina UdeA',
    placaVehiculo: '',
    habeasDataAceptado: false
  });

  const [asistenciaRegistrada, setAsistenciaRegistrada] = useState(false);
  const [codigoComprobante, setCodigoComprobante] = useState('');
  const [errorAsistencia, setErrorAsistencia] = useState('');

  // Detección en tiempo real de documento previamente registrado en este evento
  const registroExistente = useMemo(() => {
    if (!formData.documento || !formData.documento.trim() || !evento?.id) return null;
    const doc = formData.documento.trim();
    return (asistencias || []).find(a => a.eventoId === evento.id && a.documento === doc);
  }, [asistencias, evento?.id, formData.documento]);

  // Estado de Preguntas a Ponentes
  const [preguntaForm, setPreguntaForm] = useState({
    ponenteId: evento?.ponentes?.[0]?.id || '',
    autor: '',
    esAnonimo: false,
    textoPregunta: ''
  });
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

  // Inicializar estado de ponente seleccionado
  useEffect(() => {
    if (evento?.ponentes?.length > 0 && !preguntaForm.ponenteId) {
      setPreguntaForm(prev => ({ ...prev, ponenteId: evento.ponentes[0].id }));
    }
  }, [evento]);

  // Recuperar sesión activa persistente del asistente en este evento
  // Si ya se registró previamente en este dispositivo, va DIRECTAMENTE al Paso 3 (Preguntas en Vivo)
  useEffect(() => {
    if (!evento?.id) return;
    try {
      const sessionKey = `udea_session_attendee_${evento.id}`;
      const saved = localStorage.getItem(sessionKey);
      if (saved) {
        const session = JSON.parse(saved);
        if (session.documento && session.registrado) {
          setFormData(prev => ({
            ...prev,
            tipoDocumento: session.tipoDocumento || prev.tipoDocumento,
            documento: session.documento,
            nombreCompleto: session.nombreCompleto || prev.nombreCompleto,
            correo: session.correo || prev.correo,
            telefono: session.telefono || prev.telefono,
            vinculacion: session.vinculacion || prev.vinculacion,
            placaVehiculo: session.placaVehiculo || prev.placaVehiculo,
            habeasDataAceptado: true
          }));
          setCodigoComprobante(session.comprobanteId || '');
          setAsistenciaRegistrada(true);
          setMaxUnlockedStep(5);
          // Va directamente a Preguntas en Vivo
          setActiveStep(3);
        }
      }
    } catch (e) {
      console.warn('Error al recuperar sesión del asistente:', e);
    }
  }, [evento?.id]);

  // Manejar cambio de campos del formulario y limpiar errores en tiempo real
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errorAsistencia) setErrorAsistencia('');
  };

  // Función de captura de Geolocalización GPS precisa
  const handleObtenerUbicacion = () => {
    if (!navigator.geolocation) {
      setGeoState(prev => ({
        ...prev,
        error: 'Su navegador no soporta geolocalización GPS.',
        cargando: false
      }));
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
        let msg = 'No se pudo obtener la ubicación. Verifique los permisos en su celular.';
        if (err.code === 1) msg = 'Permiso de ubicación denegado en su navegador.';
        if (err.code === 2) msg = 'Señal GPS no disponible.';
        if (err.code === 3) msg = 'Tiempo de espera de GPS agotado.';

        setGeoState(prev => ({
          ...prev,
          cargando: false,
          error: msg,
          obtenida: true,
          esPresencial: false,
          distancia: null
        }));

        setMaxUnlockedStep(prev => Math.max(prev, 2));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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
    if (!doc) {
      setErrorAsistencia('Por favor ingrese su número de documento de identidad.');
      return;
    }
    if (formData.tipoDocumento !== 'PASAPORTE' && !/^\d{5,12}$/.test(doc)) {
      setErrorAsistencia('El número de documento debe contener entre 5 y 12 dígitos numéricos.');
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

    // Placa vehicular: Totalmente OPCIONAL. Máximo 6 caracteres alfanuméricos si se provee.
    const placaClean = formData.placaVehiculo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (placaClean.length > 0 && (placaClean.length < 5 || placaClean.length > 6)) {
      setErrorAsistencia('La placa vehicular debe tener entre 5 y 6 caracteres alfanuméricos (ej: KMW452). Si no cuenta con vehículo o moto, puede dejar este campo vacío.');
      return;
    }

    if (!formData.habeasDataAceptado) {
      setErrorAsistencia('Debe autorizar el tratamiento de datos personales conforme a la Ley 1581 de 2012 para registrar su asistencia.');
      return;
    }

    const payload = {
      eventoId: evento.id,
      tipoDocumento: formData.tipoDocumento,
      documento: sanitizeText(doc, 20),
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
          comprobanteId: res.record.id,
          registrado: true,
          fechaRegistro: new Date().toISOString()
        }));
      } catch (err) {
        console.warn('Error al guardar sesión del asistente:', err);
      }

      // Desbloquear todos los pasos siguientes (Preguntas, Evaluaciones, Forms)
      setMaxUnlockedStep(5);

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

    await addQuestion({
      eventoId: evento.id,
      ponenteId: preguntaForm.ponenteId,
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
                <span className="session-tag">✓ Asistencia Registrada Oficialmente</span>
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
              className={`btn-session-nav ${activeStep === 2 ? 'active' : ''}`}
              onClick={() => setActiveStep(2)}
            >
              <FileText size={15} />
              <span>Ver Comprobante</span>
            </button>
            <button
              type="button"
              className="btn-change-attendee"
              onClick={() => {
                if (window.confirm('¿Deseas registrar a otra persona con otro documento en este dispositivo?')) {
                  localStorage.removeItem(`udea_session_attendee_${evento.id}`);
                  setAsistenciaRegistrada(false);
                  setCodigoComprobante('');
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
                  setActiveStep(1);
                  setMaxUnlockedStep(1);
                }
              }}
              title="Registrar a otro participante"
            >
              Cambiar Asistente
            </button>
          </div>
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
            { step: 5, label: evento.microsoftFormsUrl ? 'Microsoft Forms' : 'Satisfacción', icon: FileText }
          ].map((item) => {
            const isCompleted = item.step < activeStep || (item.step === 2 && asistenciaRegistrada);
            const isCurrent = item.step === activeStep;
            const isUnlocked = item.step <= maxUnlockedStep;
            const Icon = item.icon;

            return (
              <button
                key={item.step}
                type="button"
                className={`stepper-step-btn ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''} ${!isUnlocked ? 'locked' : ''}`}
                onClick={() => {
                  if (isUnlocked) setActiveStep(item.step);
                }}
                disabled={!isUnlocked}
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
                        ? `✓ Ubicación satelital confirmada: Estás a ${geoState.distancia} metros del Auditorio de la Facultad de Medicina.`
                        : `✓ Coordenadas registradas: Estás a ${geoState.distancia ? `${geoState.distancia} metros` : 'distancia'} de la Facultad de Medicina.`)
                    : 'Presione el botón para obtener la ubicación satelital precisa de su dispositivo.'}
                </p>

                {geoState.obtenida && (
                  <div className="geo-tech-specs">
                    <span>📡 <strong>Fuente de señal:</strong> {geoState.origenSenal || 'Sensor GPS'}</span>
                    <span>🎯 <strong>Margen de precisión:</strong> ±{geoState.precision || 15} metros</span>
                    <span>📏 <strong>Distancia al auditorio:</strong> {geoState.distancia} m</span>
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
                    <Radio size={16} />
                    <span>{geoState.cargando ? 'Conectando con Satélites GPS...' : 'Obtener Ubicación Satelital Precisa'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-sim-sede"
                    onClick={handleSimularEnSede}
                    title="Simular que estás físicamente dentro del auditorio para pruebas y demostraciones"
                  >
                    ⚡ Probar como "En Sede" (Modo Demostración)
                  </button>
                </div>
              ) : (
                <div className="geo-status-confirmed">
                  <div className={`geo-badge ${geoState.esPresencial ? 'verified' : 'unverified'}`}>
                    {geoState.esPresencial ? '✓ En Sede UdeA (Presencial)' : '⚠ Registro Remoto'}
                  </div>
                  <button
                    type="button"
                    className="btn-re-scan"
                    onClick={handleObtenerUbicacion}
                  >
                    🔄 Re-escanear GPS
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
                <span>📍 <strong>Coord:</strong> 6.261341, -75.566464</span>
                <span>⭕ <strong>Radio de presencia:</strong> {UDEA_MEDICINA_COORDS.radioMaximoMetros} metros</span>
              </div>
            </div>

            <div className="geo-radar-divider">
              <div className="radar-distance-pill">
                {geoState.obtenida ? `${geoState.distancia} m` : '---'}
              </div>
            </div>

            <div className="geo-radar-col">
              <div className="radar-col-header">
                <span className={`radar-badge ${geoState.obtenida ? (geoState.esPresencial ? 'presencial' : 'remoto') : 'neutral'}`}>
                  {geoState.obtenida ? (geoState.esPresencial ? 'En Auditorio' : 'Remoto') : 'Por Escanear'}
                </span>
                <strong>Tu Dispositivo</strong>
              </div>
              <p className="radar-col-sub">
                {geoState.obtenida
                  ? (geoState.origenSenal || 'Sensor GPS Móvil')
                  : 'Presione "Obtener Ubicación Satelital"'}
              </p>
              <div className="radar-specs-list">
                <span>🎯 <strong>Margen:</strong> {geoState.precision ? `±${geoState.precision} m` : 'No capturado'}</span>
                <span>📌 <strong>Estado:</strong> {geoState.obtenida ? (geoState.esPresencial ? '✓ Validado en Sede' : 'Registrado como Remoto') : 'Pendiente'}</span>
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
            </div>
          </div>

          {asistenciaRegistrada ? (
            <div className="success-attendance-box">
              <div className="success-icon-circle">
                <CheckCircle2 size={40} className="check-icon" />
              </div>
              <h3 className="success-title">¡Asistencia Oficial Registrada!</h3>
              <p className="success-text">
                Gracias, <strong>{formData.nombreCompleto}</strong>. Tu registro ha sido procesado exitosamente.
              </p>
              <div className="comprobante-chip">
                <span>N° Comprobante:</span> <strong>{codigoComprobante}</strong>
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
                    <option value="PASAPORTE">Pasaporte</option>
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
                    <div className="doc-duplicate-alert animated-step">
                      <div className="doc-duplicate-header">
                        <AlertTriangle size={15} className="warn-icon" />
                        <span>Este documento ya registró asistencia en este evento:</span>
                      </div>
                      <div className="doc-duplicate-details">
                        <strong>{maskFullName(registroExistente.nombreCompleto)}</strong> (Comprobante: <code>{registroExistente.id}</code>)
                      </div>
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
                          } catch (e) {}
                          setActiveStep(3);
                        }}
                      >
                        <CheckCircle2 size={15} />
                        <span>Ver mi comprobante e ir a Preguntas en Vivo</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  ) : (
                    formData.documento.trim().length >= 4 && (
                      <div className="doc-available-hint">
                        <Check size={13} />
                        <span>Documento disponible para nuevo registro</span>
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
                    <option value="Estudiante Pregrado Medicina UdeA">Estudiante Pregrado Medicina UdeA</option>
                    <option value="Residente / Posgrado UdeA">Residente / Especialidades Médicas UdeA</option>
                    <option value="Docente / Investigador UdeA">Docente / Investigador UdeA</option>
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
                      💡 <strong>Campo opcional:</strong> Ingrese la placa únicamente si requiere autorizar el ingreso al parqueadero de la Facultad. Si asiste a pie o en transporte público, déjelo vacío.
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
                          } catch (e) {}
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

                <button type="submit" className="btn-primary-action">
                  <span>Confirmar Asistencia al Evento</span>
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
                {evento.ponentes?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {p.temaPonencia}
                  </option>
                ))}
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
                  return (
                    <div key={q.id} className={`qa-card-item ${q.destacada ? 'featured' : ''}`}>
                      <div className="qa-card-meta">
                        <span className="qa-target">Para: {ponente?.nombre || 'Ponente'}</span>
                        <span className="qa-time">{q.hora}</span>
                      </div>
                      <p className="qa-text">"{q.pregunta}"</p>
                      <div className="qa-footer">
                        <span className="qa-author">— {q.autor}</span>
                        {q.respondida && <span className="badge-answered">✓ Respondida en vivo</span>}
                        {q.destacada && <span className="badge-featured">★ Destacada</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="stepper-footer-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActiveStep(2)}
            >
              <ChevronLeft size={16} />
              <span>Ver Asistencia</span>
            </button>

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
                              ★
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
                              ★
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
                              ★
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
                {evento.microsoftFormsUrl ? 'Encuesta Institucional (Microsoft Forms) y Satisfacción' : 'Encuesta de Satisfacción General'}
              </h2>
              <p className="module-desc">
                Su retroalimentación permite mejorar continuamente la calidad de nuestros programas académicos.
              </p>
            </div>
          </div>

          {/* INTEGRACIÓN VISIBLE DE MICROSOFT FORMS (Si el evento tiene URL configurada) */}
          {evento.microsoftFormsUrl && (
            <div className="ms-forms-user-card">
              <div className="ms-forms-header">
                <div className="ms-icon-wrap">
                  <FileText size={24} className="ms-icon" />
                </div>
                <div>
                  <h3>Formulario Oficial de la Facultad (Microsoft Forms)</h3>
                  <p>Por favor responda el formulario institucional a continuación o ábralo en pantalla completa.</p>
                </div>
              </div>

              <div className="ms-forms-action-bar">
                <a
                  href={evento.microsoftFormsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-open-external-forms"
                >
                  <ExternalLink size={16} />
                  <span>Abrir en Pantalla Completa (Microsoft 365)</span>
                </a>

                <button
                  type="button"
                  className="btn-toggle-embed"
                  onClick={() => setShowEmbeddedForms(!showEmbeddedForms)}
                >
                  {showEmbeddedForms ? 'Ocultar Formulario Embebido' : 'Mostrar Formulario Embebido'}
                </button>
              </div>

              {showEmbeddedForms && (
                <div className="ms-forms-iframe-container">
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
                          ★
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
                          ★
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
    </div>
  );
}
