import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Calendar, Clock, MapPin, Car, User, BookOpen, Link, Layers, CheckCircle2, UtensilsCrossed, Coffee } from 'lucide-react';
import { getEventDaysList } from '../services/networkTime';

const DEFAULT_MEALS = [
  { id: 'comida-1', nombre: 'Refrigerio Mañana', horario: '09:30 - 10:30', cantidadTotal: 100 },
  { id: 'comida-2', nombre: 'Almuerzo Institucional', horario: '12:30 - 14:00', cantidadTotal: 100 },
  { id: 'comida-3', nombre: 'Refrigerio Tarde', horario: '16:00 - 17:00', cantidadTotal: 100 }
];

export default function EventModal({ isOpen, onClose, onSave, initialEvent = null }) {
  const [prevEventId, setPrevEventId] = useState(initialEvent?.id || null);

  const [titulo, setTitulo] = useState(initialEvent?.titulo || '');
  const [descripcion, setDescripcion] = useState(initialEvent?.descripcion || '');
  const [esMultidia, setEsMultidia] = useState(Boolean(initialEvent?.esMultidia));
  const [fecha, setFecha] = useState(() => initialEvent?.fecha || new Date().toISOString().slice(0, 10));
  const [fechaInicio, setFechaInicio] = useState(() => initialEvent?.fechaInicio || initialEvent?.fecha || new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = useState(() => initialEvent?.fechaFin || initialEvent?.fecha || new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState(initialEvent?.horaInicio || '08:00');
  const [horaFin, setHoraFin] = useState(initialEvent?.horaFin || '17:00');
  const [lugar, setLugar] = useState(initialEvent?.lugar || 'Auditorio Manuel Uribe Ángel - Facultad de Medicina UdeA');
  const [habilitarPlacaVehiculo, setHabilitarPlacaVehiculo] = useState(initialEvent?.habilitarPlacaVehiculo ?? true);
  const [habilitarAlimentacion, setHabilitarAlimentacion] = useState(Boolean(initialEvent?.habilitarAlimentacion));
  const [comidasConfig, setComidasConfig] = useState(() => (
    Array.isArray(initialEvent?.comidasConfig) && initialEvent.comidasConfig.length > 0
      ? initialEvent.comidasConfig
      : DEFAULT_MEALS
  ));
  const [microsoftFormsUrl, setMicrosoftFormsUrl] = useState(initialEvent?.microsoftFormsUrl || '');
  const [habilitarMicrosoftForms, setHabilitarMicrosoftForms] = useState(Boolean(initialEvent?.habilitarMicrosoftForms ?? (initialEvent?.microsoftFormsUrl ? true : false)));
  const [habilitarPonentes, setHabilitarPonentes] = useState(initialEvent?.habilitarPonentes ?? (initialEvent ? Boolean(initialEvent.ponentes && initialEvent.ponentes.length > 0) : true));

  const [ponentes, setPonentes] = useState(() => (
    initialEvent?.ponentes?.length
      ? initialEvent.ponentes.map(p => ({ ...p, activo: p.activo ?? true }))
      : [{ id: `PON-INIT-1`, nombre: '', titulo: '', temaPonencia: '', activo: true }]
  ));

  // Sincronizar estado si cambia el evento a editar o se abre en modo creación
  if ((initialEvent?.id || null) !== prevEventId) {
    setPrevEventId(initialEvent?.id || null);
    setTitulo(initialEvent?.titulo || '');
    setDescripcion(initialEvent?.descripcion || '');
    setEsMultidia(Boolean(initialEvent?.esMultidia));
    setFecha(initialEvent?.fecha || new Date().toISOString().slice(0, 10));
    setFechaInicio(initialEvent?.fechaInicio || initialEvent?.fecha || new Date().toISOString().slice(0, 10));
    setFechaFin(initialEvent?.fechaFin || initialEvent?.fecha || new Date().toISOString().slice(0, 10));
    setHoraInicio(initialEvent?.horaInicio || '08:00');
    setHoraFin(initialEvent?.horaFin || '17:00');
    setHorariosPorDia(initialEvent?.horariosPorDia || {});
    setLugar(initialEvent?.lugar || 'Auditorio Manuel Uribe Ángel - Facultad de Medicina UdeA');
    setHabilitarPlacaVehiculo(initialEvent?.habilitarPlacaVehiculo ?? true);
    setHabilitarAlimentacion(Boolean(initialEvent?.habilitarAlimentacion));
    setComidasConfig(
      Array.isArray(initialEvent?.comidasConfig) && initialEvent.comidasConfig.length > 0
        ? initialEvent.comidasConfig
        : DEFAULT_MEALS
    );
    setMicrosoftFormsUrl(initialEvent?.microsoftFormsUrl || '');
    setHabilitarMicrosoftForms(Boolean(initialEvent?.habilitarMicrosoftForms ?? (initialEvent?.microsoftFormsUrl ? true : false)));
    setHabilitarPonentes(initialEvent?.habilitarPonentes ?? (initialEvent ? Boolean(initialEvent.ponentes && initialEvent.ponentes.length > 0) : true));
    setPonentes(initialEvent?.ponentes?.length
      ? initialEvent.ponentes.map(p => ({ ...p, activo: p.activo ?? true }))
      : [{ id: 'PON-INIT-1', nombre: '', titulo: '', temaPonencia: '', activo: true }]
    );
  }

  const [horariosPorDia, setHorariosPorDia] = useState(() => initialEvent?.horariosPorDia || {});

  const handleDayScheduleChange = (dateStr, field, value) => {
    setHorariosPorDia(prev => ({
      ...prev,
      [dateStr]: {
        horaInicio: prev[dateStr]?.horaInicio || horaInicio,
        horaFin: prev[dateStr]?.horaFin || horaFin,
        [field]: value
      }
    }));
  };

  // Lista calculada de días para eventos multidía
  const computedDaysList = useMemo(() => {
    if (!esMultidia) return [fecha];
    return getEventDaysList({
      esMultidia: true,
      fechaInicio,
      fechaFin
    });
  }, [esMultidia, fecha, fechaInicio, fechaFin]);

  if (!isOpen) return null;

  const handleAddPonente = () => {
    setPonentes([
      ...ponentes,
      { id: `PON-${Date.now()}-${ponentes.length + 1}`, nombre: '', titulo: '', temaPonencia: '', activo: true }
    ]);
  };

  const handleRemovePonente = (index) => {
    if (ponentes.length === 1) return;
    const updated = ponentes.filter((_, i) => i !== index);
    setPonentes(updated);
  };

  const handlePonenteChange = (index, field, value) => {
    const updated = [...ponentes];
    updated[index][field] = value;
    setPonentes(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!titulo.trim()) {
      alert('Por favor ingrese el título del evento.');
      return;
    }

    if (esMultidia && fechaInicio > fechaFin) {
      alert('La fecha de inicio no puede ser posterior a la fecha de finalización.');
      return;
    }

    const computedHorariosPorDia = esMultidia
      ? computedDaysList.reduce((acc, dStr) => {
          acc[dStr] = {
            horaInicio: horariosPorDia[dStr]?.horaInicio || horaInicio,
            horaFin: horariosPorDia[dStr]?.horaFin || horaFin
          };
          return acc;
        }, {})
      : null;

    const eventPayload = {
      id: initialEvent?.id || `EVT-MED-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      esMultidia: Boolean(esMultidia),
      fecha: esMultidia ? fechaInicio : fecha,
      fechaInicio: esMultidia ? fechaInicio : fecha,
      fechaFin: esMultidia ? fechaFin : fecha,
      diasEvento: computedDaysList,
      horaInicio,
      horaFin,
      horariosPorDia: computedHorariosPorDia,
      lugar,
      coordenadas: initialEvent?.coordenadas || { lat: 6.261341, lng: -75.566464 },
      habilitarPlacaVehiculo,
      habilitarAlimentacion,
      comidasConfig: habilitarAlimentacion
        ? comidasConfig.filter(c => c.nombre && c.nombre.trim()).map(c => ({
            id: c.id || `comida-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            nombre: c.nombre.trim(),
            horario: (c.horario || '').trim(),
            cantidadTotal: c.cantidadTotal !== undefined && c.cantidadTotal !== '' && !isNaN(Number(c.cantidadTotal))
              ? Number(c.cantidadTotal)
              : null
          }))
        : [],
      microsoftFormsUrl: habilitarMicrosoftForms ? microsoftFormsUrl.trim() : '',
      habilitarMicrosoftForms,
      habilitarPonentes,
      ponentes: habilitarPonentes
        ? ponentes
            .filter(p => p.nombre.trim() !== '')
            .map(p => ({ ...p, activo: p.activo ?? true }))
        : [],
      inscritosResumen: initialEvent?.inscritosResumen || null,
      inscritosData: initialEvent?.inscritosData || null
    };

    onSave(eventPayload);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container event-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="modal-badge">Facultad de Medicina UdeA</span>
            <h2 className="modal-title">
              {initialEvent ? 'Editar Evento Académico' : 'Crear Nuevo Evento Académico'}
            </h2>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-body">
          {/* Título del Evento */}
          <div className="form-group">
            <label className="form-label" htmlFor="event-title">
              Nombre / Título del Evento Académico <span className="req">*</span>
            </label>
            <input
              id="event-title"
              type="text"
              className="form-input"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Simposio de Actualización en Pediatría y Neonatología"
              required
            />
          </div>

          {/* Selector de Duración: 1 Día o Multidía */}
          <div className="event-duration-type-selector">
            <label className="form-label">
              <Layers size={15} /> Modalidad de Duración del Evento
            </label>
            <div className="duration-pill-group">
              <button
                type="button"
                className={`duration-pill-btn ${!esMultidia ? 'active' : ''}`}
                onClick={() => setEsMultidia(false)}
              >
                <Calendar size={14} />
                <span>Jornada de 1 Solo Día</span>
              </button>
              <button
                type="button"
                className={`duration-pill-btn ${esMultidia ? 'active' : ''}`}
                onClick={() => setEsMultidia(true)}
              >
                <Layers size={14} />
                <span>Evento Multidía (Varios Días)</span>
              </button>
            </div>
          </div>

          {/* Fila de Fecha y Horarios según modalidad */}
          {!esMultidia ? (
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">
                  <Calendar size={15} /> Fecha de la Jornada
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  <Clock size={15} /> Hora Inicio
                </label>
                <input
                  type="time"
                  className="form-input"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  <Clock size={15} /> Hora Fin
                </label>
                <input
                  type="time"
                  className="form-input"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                  required
                />
              </div>
            </div>
          ) : (
            <div className="multiday-config-box">
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">
                    <Calendar size={15} /> Fecha de Inicio (Día 1)
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <Calendar size={15} /> Fecha de Finalización
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={fechaFin}
                    min={fechaInicio}
                    onChange={(e) => setFechaFin(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">
                    <Clock size={15} /> Horario Diario de Inicio
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <Clock size={15} /> Horario Diario de Cierre
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    value={horaFin}
                    onChange={(e) => setHoraFin(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Vista previa y configuración de horarios por jornada */}
              <div className="days-preview-container">
                <span className="days-preview-title">
                  <CheckCircle2 size={14} color="#006633" />
                  Sesiones programadas ({computedDaysList.length} {computedDaysList.length === 1 ? 'día' : 'días'}):
                </span>
                <div className="days-tags-wrap">
                  {computedDaysList.map((dStr, idx) => (
                    <span key={dStr} className="day-badge-tag">
                      <strong>Día {idx + 1}:</strong> {dStr}
                    </span>
                  ))}
                </div>
              </div>

              {/* Ajuste personalizado de hora de finalización/inicio por fecha */}
              <div className="days-custom-schedules-card">
                <div className="days-custom-schedules-header">
                  <Clock size={16} color="#006633" />
                  <div>
                    <strong>Horario Específico por cada Fecha</strong>
                    <p className="days-schedules-subtitle">
                      Si alguna fecha finaliza a una hora diferente (ej. cierre al mediodía o tarde), puedes ajustar su horario de finalización aquí:
                    </p>
                  </div>
                </div>

                <div className="days-schedules-table">
                  {computedDaysList.map((dStr, idx) => {
                    const diaConfig = horariosPorDia[dStr] || { horaInicio, horaFin };
                    const currentInicio = diaConfig.horaInicio || horaInicio;
                    const currentFin = diaConfig.horaFin || horaFin;
                    const isCustom = currentInicio !== horaInicio || currentFin !== horaFin;

                    return (
                      <div key={dStr} className={`day-schedule-item ${isCustom ? 'is-custom' : ''}`}>
                        <div className="day-schedule-meta">
                          <span className="day-schedule-badge">Día {idx + 1}</span>
                          <span className="day-schedule-date">{dStr}</span>
                          {isCustom && <span className="custom-schedule-tag">Hora ajustada</span>}
                        </div>
                        <div className="day-schedule-inputs-row">
                          <div className="day-input-pair">
                            <span className="mini-label">Inicio:</span>
                            <input
                              type="time"
                              className="form-input time-mini-input"
                              value={currentInicio}
                              onChange={(e) => handleDayScheduleChange(dStr, 'horaInicio', e.target.value)}
                            />
                          </div>
                          <span className="time-separator">hasta</span>
                          <div className="day-input-pair">
                            <span className="mini-label">Finalización:</span>
                            <input
                              type="time"
                              className="form-input time-mini-input"
                              value={currentFin}
                              onChange={(e) => handleDayScheduleChange(dStr, 'horaFin', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="days-preview-note" style={{ marginTop: '0.6rem' }}>
                  El sistema validará la asistencia de cada día según su horario de finalización programado y la hora oficial de Colombia.
                </p>
              </div>
            </div>
          )}

          {/* Descripción opcional del Evento */}
          <div className="form-group">
            <label className="form-label" htmlFor="event-desc">
              Descripción / Resumen del Evento (Opcional)
            </label>
            <textarea
              id="event-desc"
              rows={2}
              className="form-input"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Breve información o propósito del evento académico..."
            />
          </div>

          {/* Lugar y Auditorio */}
          <div className="form-group">
            <label className="form-label">
              <MapPin size={15} /> Sede / Auditorio
            </label>
            <div className="quick-select-wrapper">
              <input
                type="text"
                className="form-input"
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                placeholder="Auditorio, aula o laboratorio de la Facultad"
                required
              />
              <div className="quick-tags">
                <button
                  type="button"
                  className="tag-btn"
                  onClick={() => setLugar('Auditorio Manuel Uribe Ángel - Fac. Medicina UdeA')}
                >
                  Auditorio M. Uribe Ángel
                </button>
                <button
                  type="button"
                  className="tag-btn"
                  onClick={() => setLugar('Paraninfo Edificio San Ignacio UdeA')}
                >
                  Paraninfo San Ignacio
                </button>
                <button
                  type="button"
                  className="tag-btn"
                  onClick={() => setLugar('Laboratorio de Simulación Médica UdeA - Piso 3')}
                >
                  Simulación Médica
                </button>
              </div>
            </div>
          </div>

          {/* CONTROL EXCLUSIVO: Habilitar Registro de Placa de Vehículo */}
          <div className="form-toggle-card">
            <div className="toggle-info">
              <div className="toggle-icon-wrap">
                <Car size={22} className="car-icon" />
              </div>
              <div>
                <label className="toggle-title" htmlFor="switch-placa">
                  Habilitar Registro de Placa del Vehículo
                </label>
                <p className="toggle-description">
                  Si se activa, el formulario de asistencia incluirá el campo opcional para la placa vehicular del participante para coordinar el ingreso al parqueadero de la Facultad.
                </p>
              </div>
            </div>
            <label className="switch">
              <input
                id="switch-placa"
                type="checkbox"
                checked={habilitarPlacaVehiculo}
                onChange={(e) => setHabilitarPlacaVehiculo(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          {/* CONTROL EXCLUSIVO: Habilitar Control de Almuerzos y Refrigerios */}
          <div className="form-toggle-card">
            <div className="toggle-info">
              <div className="toggle-icon-wrap meals" style={{ background: '#E8F5E9', color: '#006633' }}>
                <UtensilsCrossed size={22} />
              </div>
              <div>
                <label className="toggle-title" htmlFor="switch-alimentacion">
                  Habilitar Control de Almuerzos y Refrigerios
                </label>
                <p className="toggle-description">
                  Activa el módulo de escaneo de QR en el Panel Administrativo para registrar la entrega de almuerzos o refrigerios y evitar que un participante reclame más de una vez.
                </p>
              </div>
            </div>
            <label className="switch">
              <input
                id="switch-alimentacion"
                type="checkbox"
                checked={habilitarAlimentacion}
                onChange={(e) => setHabilitarAlimentacion(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          {/* Constructor Dinámico de Comidas / Refrigerios */}
          {habilitarAlimentacion && (
            <div className="form-section-card meals-config-card animated-step" style={{ background: '#F8FAFC', border: '1.5px solid #CBD5E1', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, color: '#0F5938', fontSize: '0.92rem' }}>
                  <Coffee size={18} />
                  <span>Comidas y Refrigerios del Evento</span>
                </div>
                <button
                  type="button"
                  className="btn-add-mini"
                  style={{ background: '#0F5938', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '5px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                  onClick={() => {
                    const nextNum = comidasConfig.length + 1;
                    setComidasConfig([
                      ...comidasConfig,
                      {
                        id: `comida-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                        nombre: `Refrigerio ${nextNum}`,
                        horario: '10:00 - 11:00',
                        cantidadTotal: 100
                      }
                    ]);
                  }}
                >
                  <Plus size={13} />
                  <span>Agregar Comida</span>
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 0.85rem', lineHeight: 1.35 }}>
                Define las comidas disponibles y la cantidad de raciones contratadas/programadas para llevar control de stock en tiempo real.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {comidasConfig.map((comida, idx) => (
                  <div
                    key={comida.id || idx}
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F5938', background: '#E8F5E9', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {idx + 1}
                    </span>
                    <div style={{ flex: '2 1 180px' }}>
                      <label style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginBottom: '2px', fontWeight: 500 }}>
                        Nombre de la Comida / Refrigerio <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.83rem' }}
                        placeholder="Ej: Refrigerio Mañana, Almuerzo..."
                        value={comida.nombre}
                        onChange={(e) => {
                          const updated = [...comidasConfig];
                          updated[idx] = { ...updated[idx], nombre: e.target.value };
                          setComidasConfig(updated);
                        }}
                        required
                      />
                    </div>
                    <div style={{ flex: '1.2 1 120px' }}>
                      <label style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginBottom: '2px', fontWeight: 500 }}>
                        Horario (Opcional)
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.83rem' }}
                        placeholder="Ej: 12:30 - 14:00"
                        value={comida.horario || ''}
                        onChange={(e) => {
                          const updated = [...comidasConfig];
                          updated[idx] = { ...updated[idx], horario: e.target.value };
                          setComidasConfig(updated);
                        }}
                      />
                    </div>
                    <div style={{ flex: '0.9 1 95px' }}>
                      <label style={{ fontSize: '0.72rem', color: '#0F5938', display: 'block', marginBottom: '2px', fontWeight: 600 }}>
                        Raciones / Cant. <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.83rem', fontWeight: 600, color: '#0F5938' }}
                        placeholder="Ej: 100"
                        value={comida.cantidadTotal ?? ''}
                        onChange={(e) => {
                          const updated = [...comidasConfig];
                          const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                          updated[idx] = { ...updated[idx], cantidadTotal: isNaN(val) ? '' : val };
                          setComidasConfig(updated);
                        }}
                        required
                      />
                    </div>
                    {comidasConfig.length > 1 && (
                      <button
                        type="button"
                        style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '6px', borderRadius: '4px', alignSelf: 'flex-end', marginBottom: '2px', transition: 'color 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; }}
                        onClick={() => {
                          setComidasConfig(comidasConfig.filter((_, i) => i !== idx));
                        }}
                        title="Eliminar esta comida"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conexión con Microsoft Forms */}
          <div className="form-group" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '12px' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={habilitarMicrosoftForms}
                onChange={(e) => setHabilitarMicrosoftForms(e.target.checked)}
              />
              <span>Habilitar Evaluación Institucional con Microsoft Forms (Paso 5)</span>
            </label>
            <span className="form-help-text" style={{ marginTop: '4px', display: 'block', color: '#64748b' }}>
              Permite a los asistentes acceder a una encuesta institucional externa de Microsoft 365. Si se desactiva, los asistentes solo responderán la evaluación y satisfacción nativa.
            </span>

            {habilitarMicrosoftForms && (
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginBottom: '6px', color: '#1e293b' }}>
                  <Link size={15} /> Enlace de Microsoft Forms Institucional
                </label>
                <input
                  type="url"
                  className="form-input"
                  value={microsoftFormsUrl}
                  onChange={(e) => setMicrosoftFormsUrl(e.target.value)}
                  placeholder="https://forms.office.com/r/..."
                  required={habilitarMicrosoftForms}
                />
                <span className="form-help-text">
                  Recomendación: Debido a las políticas de seguridad de Microsoft (bloqueo de iframes), los asistentes podrán abrir el formulario de forma segura en una pestaña independiente y marcarlo como completado.
                </span>
              </div>
            )}
          </div>

          {/* CONTROL EXCLUSIVO: Habilitar Ponentes y Evaluaciones del Evento */}
          <div className="form-toggle-card">
            <div className="toggle-info">
              <div className="toggle-icon-wrap speakers" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                <User size={22} />
              </div>
              <div>
                <label className="toggle-title" htmlFor="switch-ponentes">
                  Habilitar Ponentes y Evaluaciones del Evento
                </label>
                <p className="toggle-description">
                  Active esta opción si el evento cuenta con conferencistas, docentes o expositores invitados. Si se desactiva, los asistentes no tendrán los pasos de preguntas ni calificación docente.
                </p>
              </div>
            </div>
            <label className="switch">
              <input
                id="switch-ponentes"
                type="checkbox"
                checked={habilitarPonentes}
                onChange={(e) => setHabilitarPonentes(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          {/* Sección de Ponentes */}
          {habilitarPonentes && (
            <div className="speakers-builder-section">
              <div className="section-header-row">
                <div>
                  <h3 className="section-title">Ponentes y Evaluaciones del Evento</h3>
                  <p className="section-subtitle">
                    Cada ponente registrado generará automáticamente una tarjeta de evaluación individual para los asistentes.
                  </p>
                </div>
                <button type="button" className="btn-add-speaker" onClick={handleAddPonente}>
                  <Plus size={16} /> Agregar Ponente
                </button>
              </div>

            <div className="speakers-list-container">
              {ponentes.map((ponente, idx) => (
                <div key={ponente.id || idx} className="speaker-form-card" style={{ opacity: (ponente.activo ?? true) ? 1 : 0.75 }}>
                  <div className="speaker-number-badge">{idx + 1}</div>

                  {/* Interruptor de activación / desactivación del ponente */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '22px', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={ponente.activo ?? true}
                          onChange={(e) => handlePonenteChange(idx, 'activo', e.target.checked)}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: (ponente.activo ?? true) ? '#006633' : '#9CA3AF',
                          transition: '.25s', borderRadius: '22px'
                        }}>
                          <span style={{
                            position: 'absolute', content: '""', height: '16px', width: '16px', left: (ponente.activo ?? true) ? '19px' : '3px', bottom: '3px',
                            backgroundColor: 'white', transition: '.25s', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }}></span>
                        </span>
                      </label>
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: (ponente.activo ?? true) ? '#006633' : '#4B5563' }}>
                        {(ponente.activo ?? true) ? 'Ponente Activo' : 'Ponente Inactivo / En Pausa'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                      {(ponente.activo ?? true) ? 'Habilitado en Q&A y Evaluación' : 'Oculto para preguntas y evaluación'}
                    </span>
                  </div>

                  <div className="speaker-inputs-grid">
                    <div className="form-group">
                      <label className="form-sublabel">
                        <User size={13} /> Nombre Completo del Ponente
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Ej: Dra. Camila Restrepo"
                        value={ponente.nombre}
                        onChange={(e) => handlePonenteChange(idx, 'nombre', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-sublabel">Título / Especialidad</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Ej: Médica Neumóloga UdeA"
                        value={ponente.titulo}
                        onChange={(e) => handlePonenteChange(idx, 'titulo', e.target.value)}
                      />
                    </div>
                    <div className="form-group col-span-2">
                      <label className="form-sublabel">
                        <BookOpen size={13} /> Tema / Título de la Ponencia
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Ej: Diagnóstico Temprano de la Hipertensión Pulmonar"
                        value={ponente.temaPonencia}
                        onChange={(e) => handlePonenteChange(idx, 'temaPonencia', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {ponentes.length > 1 && (
                    <button
                      type="button"
                      className="btn-remove-speaker"
                      onClick={() => handleRemovePonente(idx)}
                      title="Eliminar ponente"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          )}

          <div className="modal-actions-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary-action">
              {initialEvent ? 'Guardar Cambios del Evento' : 'Crear Evento y Generar QR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
