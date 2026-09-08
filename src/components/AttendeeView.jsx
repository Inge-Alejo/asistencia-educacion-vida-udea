import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  MapPin, CheckCircle2, AlertTriangle, Send, Star, Car, User, Mail,
  Phone, CreditCard, Sparkles, MessageSquare, ThumbsUp, HelpCircle,
  Clock, ShieldCheck, ChevronRight
} from 'lucide-react';
import {
  UDEA_MEDICINA_COORDS,
  calcularDistanciaMetros,
  recordAttendance,
  addQuestion,
  recordEvaluation,
  recordSatisfaction
} from '../services/storage';

export default function AttendeeView({
  evento,
  asistencias,
  preguntas,
  evaluaciones,
  onDataUpdated
}) {
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
    placaVehiculo: ''
  });

  const [asistenciaRegistrada, setAsistenciaRegistrada] = useState(false);
  const [codigoComprobante, setCodigoComprobante] = useState('');
  const [errorAsistencia, setErrorAsistencia] = useState('');

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

  // Inicializar estado de ponente seleccionado
  useEffect(() => {
    if (evento?.ponentes?.length > 0 && !preguntaForm.ponenteId) {
      setPreguntaForm(prev => ({ ...prev, ponenteId: evento.ponentes[0].id }));
    }
  }, [evento]);

  // Función de captura de Geolocalización GPS
  const handleObtenerUbicacion = () => {
    if (!navigator.geolocation) {
      setGeoState(prev => ({
        ...prev,
        error: 'Su navegador no soporta geolocalización GPS.',
        cargando: false
      }));
      return;
    }

    setGeoState(prev => ({ ...prev, cargando: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = Math.round(position.coords.accuracy);

        // Distancia a la Facultad de Medicina UdeA
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
          esPresencial: presencial
        });
      },
      (err) => {
        let msg = 'No se pudo obtener la ubicación. Verifique los permisos de su dispositivo.';
        if (err.code === 1) msg = 'Permiso denegado por el usuario para acceder al GPS.';
        if (err.code === 2) msg = 'Señal GPS no disponible temporalmente.';
        if (err.code === 3) msg = 'Tiempo de espera de GPS agotado.';

        setGeoState(prev => ({
          ...prev,
          cargando: false,
          error: msg,
          // Permitir continuar con fallback
          obtenida: true,
          esPresencial: false,
          distancia: null
        }));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Envío del Formulario de Asistencia
  const handleRegistrarAsistencia = (e) => {
    e.preventDefault();
    setErrorAsistencia('');

    if (!formData.documento.trim() || !formData.nombreCompleto.trim() || !formData.correo.trim()) {
      setErrorAsistencia('Por favor complete todos los campos obligatorios.');
      return;
    }

    if (evento.habilitarPlacaVehiculo && !formData.placaVehiculo.trim()) {
      setErrorAsistencia('Para este evento es obligatorio registrar la placa del vehículo para el parqueadero.');
      return;
    }

    const payload = {
      eventoId: evento.id,
      tipoDocumento: formData.tipoDocumento,
      documento: formData.documento.trim(),
      nombreCompleto: formData.nombreCompleto.trim(),
      correo: formData.correo.trim(),
      telefono: formData.telefono.trim(),
      vinculacion: formData.vinculacion,
      placaVehiculo: evento.habilitarPlacaVehiculo ? formData.placaVehiculo.trim().toUpperCase() : '',
      geolocalizacion: {
        latitud: geoState.latitud,
        longitud: geoState.longitud,
        precisionMetros: geoState.precision,
        distanciaSedeMetros: geoState.distancia,
        esPresencial: geoState.esPresencial
      }
    };

    const res = recordAttendance(payload);
    if (res.success) {
      setAsistenciaRegistrada(true);
      setCodigoComprobante(res.record.id);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0F5938', '#008744', '#C59B27', '#ffffff']
      });
      if (onDataUpdated) onDataUpdated();
    } else {
      setErrorAsistencia(res.message);
    }
  };

  // Envío de Preguntas al Ponente
  const handleEnviarPregunta = (e) => {
    e.preventDefault();
    if (!preguntaForm.textoPregunta.trim()) return;

    addQuestion({
      eventoId: evento.id,
      ponenteId: preguntaForm.ponenteId,
      autor: preguntaForm.esAnonimo ? 'Asistente Anónimo' : (formData.nombreCompleto || preguntaForm.autor || 'Asistente'),
      pregunta: preguntaForm.textoPregunta.trim()
    });

    setPreguntaEnviada(true);
    setPreguntaForm(prev => ({ ...prev, textoPregunta: '' }));
    setTimeout(() => setPreguntaEnviada(false), 3500);
    if (onDataUpdated) onDataUpdated();
  };

  // Envío de Evaluación individual de un Ponente
  const handleCalificarPonente = (ponenteId) => {
    const data = evaluacionesPonentes[ponenteId] || { dominio: 5, claridad: 5, aplicabilidad: 5, comentario: '' };
    recordEvaluation({
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
  const handleEnviarSatisfaccion = (e) => {
    e.preventDefault();
    recordSatisfaction({
      eventoId: evento.id,
      cumplimientoObjetivos: satisfaccionForm.cumplimiento,
      organizacionLogistica: satisfaccionForm.logistica,
      npsRecomendacion: satisfaccionForm.nps,
      sugerencias: satisfaccionForm.sugerencias.trim()
    });

    setSatisfaccionEnviada(true);
    if (onDataUpdated) onDataUpdated();
  };

  return (
    <div className="attendee-view-container">
      {/* Banner Principal del Evento */}
      <section className="event-hero-banner">
        <div className="banner-badge-row">
          <span className="badge-udea-tag">Facultad de Medicina • UdeA</span>
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

      {/* SECCIÓN 1: VALIDACIÓN DE ASISTENCIA Y GEOLOCALIZACIÓN */}
      <section className="attendee-card-module">
        <div className="module-header">
          <div className="module-icon-wrap">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="module-title">1. Registro de Asistencia Oficial</h2>
            <p className="module-desc">
              Valide su presencia en el auditorio mediante geolocalización satelital para recibir su certificado institucional.
            </p>
          </div>
        </div>

        {asistenciaRegistrada ? (
          <div className="success-attendance-box">
            <div className="success-icon-circle">
              <CheckCircle2 size={40} className="check-icon" />
            </div>
            <h3 className="success-title">¡Asistencia Confirmada con Éxito!</h3>
            <p className="success-text">
              Su participación en <strong>{evento.titulo}</strong> ha sido registrada en el sistema de Educación a lo Largo de la Vida de la Facultad de Medicina UdeA.
            </p>
            <div className="comprobante-chip">
              <span>N° Comprobante:</span> <strong>{codigoComprobante}</strong>
            </div>
            {geoState.obtenida && (
              <div className="geo-validation-result">
                {geoState.esPresencial ? (
                  <span className="status-badge-presencial">
                    <CheckCircle2 size={14} /> Presencia en Sede Validada ({geoState.distancia} m de la Facultad)
                  </span>
                ) : (
                  <span className="status-badge-remoto">
                    <AlertTriangle size={14} /> Registro Remoto / A {geoState.distancia ? `${geoState.distancia} m` : 'distancia'} de la Facultad
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleRegistrarAsistencia} className="attendance-form">
            {/* Control de Geolocalización */}
            <div className="geo-activation-box">
              <div className="geo-info-content">
                <div className="geo-icon">
                  <MapPin size={24} />
                </div>
                <div>
                  <h4>Verificación de Ubicación Presencial</h4>
                  <p>
                    {geoState.obtenida
                      ? (geoState.esPresencial
                          ? `Ubicación satelital verificada: A ${geoState.distancia} metros de la Facultad de Medicina.`
                          : `Ubicación capturada: A ${geoState.distancia ? `${geoState.distancia} metros` : 'distancia'} de la Facultad.`)
                      : 'Presione el botón para comprobar automáticamente su presencia en la sede.'}
                  </p>
                </div>
              </div>

              {!geoState.obtenida ? (
                <button
                  type="button"
                  className="btn-geo-activate"
                  onClick={handleObtenerUbicacion}
                  disabled={geoState.cargando}
                >
                  {geoState.cargando ? 'Detectando GPS...' : 'Verificar mi Ubicación'}
                </button>
              ) : (
                <div className={`geo-badge ${geoState.esPresencial ? 'verified' : 'unverified'}`}>
                  {geoState.esPresencial ? '✓ En Sede UdeA' : '⚠ Registro Remoto'}
                </div>
              )}
            </div>

            {geoState.error && (
              <div className="form-error-banner">
                <AlertTriangle size={16} />
                <span>{geoState.error}</span>
              </div>
            )}

            {/* Campos de Asistencia */}
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Tipo de Documento</label>
                <select
                  className="form-input"
                  value={formData.tipoDocumento}
                  onChange={(e) => setFormData({ ...formData, tipoDocumento: e.target.value })}
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
                  className="form-input"
                  placeholder="Ej: 1037654321"
                  value={formData.documento}
                  onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                  required
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-label">
                  <User size={14} /> Nombre Completo <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nombres y Apellidos como saldrán en su certificado"
                  value={formData.nombreCompleto}
                  onChange={(e) => setFormData({ ...formData, nombreCompleto: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Phone size={14} /> Teléfono Móvil
                </label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="300 123 4567"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-label">Tipo de Vinculación Institucional</label>
                <select
                  className="form-input"
                  value={formData.vinculacion}
                  onChange={(e) => setFormData({ ...formData, vinculacion: e.target.value })}
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

              {/* CAMPO CONDICIONAL DE PLACA VEHICULAR: Solo se muestra si el evento lo habilitó */}
              {evento.habilitarPlacaVehiculo && (
                <div className="form-group col-span-2 vehicle-highlight-field">
                  <label className="form-label vehicle-label">
                    <Car size={16} /> Placa del Vehículo (Acceso a Parqueadero) <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input vehicle-input"
                    placeholder="Ej: ABC-123 o KMW-45E"
                    value={formData.placaVehiculo}
                    onChange={(e) => setFormData({ ...formData, placaVehiculo: e.target.value.toUpperCase() })}
                    maxLength={8}
                    required
                  />
                  <span className="field-hint">
                    Este evento requiere el registro de su placa para autorizar el ingreso y permanencia vehicular en el campus de la Facultad de Medicina.
                  </span>
                </div>
              )}
            </div>

            {errorAsistencia && (
              <div className="form-error-banner">
                <AlertTriangle size={16} />
                <span>{errorAsistencia}</span>
              </div>
            )}

            <button type="submit" className="btn-submit-attendance">
              <span>Confirmar Asistencia al Evento</span>
              <ChevronRight size={18} />
            </button>
          </form>
        )}
      </section>

      {/* SECCIÓN 2: PREGUNTAS A PONENTES EN VIVO (Q&A) */}
      <section className="attendee-card-module">
        <div className="module-header">
          <div className="module-icon-wrap questions-icon">
            <HelpCircle size={22} />
          </div>
          <div>
            <h2 className="module-title">2. Preguntas a los Ponentes en Vivo</h2>
            <p className="module-desc">
              Participe en la sesión de preguntas y respuestas. Su consulta será recibida directamente por el moderador del auditorio.
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
              placeholder="Escriba aquí su duda clínica o consulta sobre la exposición..."
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

            <button type="submit" className="btn-send-question">
              <Send size={16} />
              <span>Enviar al Moderador</span>
            </button>
          </div>

          {preguntaEnviada && (
            <div className="form-success-banner">
              <CheckCircle2 size={16} />
              <span>Pregunta enviada correctamente. Será proyectada por el moderador.</span>
            </div>
          )}
        </form>

        {/* Muro de Preguntas Enviadas en el Evento */}
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
      </section>

      {/* SECCIÓN 3: EVALUACIÓN DINÁMICA DE CADA PONENTE */}
      <section className="attendee-card-module">
        <div className="module-header">
          <div className="module-icon-wrap stars-icon">
            <Star size={22} />
          </div>
          <div>
            <h2 className="module-title">3. Calificación de Ponentes</h2>
            <p className="module-desc">
              Evalúe el desempeño individual de cada conferencista. Sus aportes fortalecen la calidad de nuestra oferta académica.
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
                    <span>¡Evaluación de este ponente completada!</span>
                  </div>
                ) : (
                  <div className="speaker-criteria-form">
                    {/* Criterio 1: Dominio del tema */}
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

                    {/* Criterio 2: Claridad pedagógica */}
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

                    {/* Criterio 3: Aplicabilidad médica */}
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

                    {/* Comentario al Ponente */}
                    <div className="form-group">
                      <label className="form-sublabel">Comentarios u observaciones para el conferencista:</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Felicitaciones, preguntas pendientes o sugerencias..."
                        value={currentEval.comentario}
                        onChange={(e) => setField('comentario', e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-submit-eval"
                      onClick={() => handleCalificarPonente(ponente.id)}
                    >
                      <span>Guardar Calificación de {ponente.nombre.split(' ')[0]}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SECCIÓN 4: EVALUACIÓN DE SATISFACCIÓN GENERAL */}
      <section className="attendee-card-module">
        <div className="module-header">
          <div className="module-icon-wrap satisfaction-icon">
            <ThumbsUp size={22} />
          </div>
          <div>
            <h2 className="module-title">4. Encuesta de Satisfacción General</h2>
            <p className="module-desc">
              Califique la experiencia global del evento organizado por Educación a lo Largo de la Vida UdeA.
            </p>
          </div>
        </div>

        {satisfaccionEnviada ? (
          <div className="success-attendance-box">
            <div className="success-icon-circle">
              <CheckCircle2 size={36} className="check-icon" />
            </div>
            <h3 className="success-title">¡Muchas Gracias por su Evaluación!</h3>
            <p className="success-text">
              Sus respuestas han sido registradas para el mejoramiento continuo de los programas de la Facultad de Medicina.
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
      </section>
    </div>
  );
}
