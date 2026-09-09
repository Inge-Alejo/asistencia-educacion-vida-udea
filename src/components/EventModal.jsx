import React, { useState } from 'react';
import { X, Plus, Trash2, Calendar, Clock, MapPin, Car, User, BookOpen, Link, AlertCircle } from 'lucide-react';

export default function EventModal({ isOpen, onClose, onSave, initialEvent = null }) {
  const [titulo, setTitulo] = useState(initialEvent?.titulo || '');
  const [fecha, setFecha] = useState(initialEvent?.fecha || new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState(initialEvent?.horaInicio || '08:00');
  const [horaFin, setHoraFin] = useState(initialEvent?.horaFin || '17:00');
  const [lugar, setLugar] = useState(initialEvent?.lugar || 'Auditorio Manuel Uribe Ángel - Facultad de Medicina UdeA');
  const [habilitarPlacaVehiculo, setHabilitarPlacaVehiculo] = useState(initialEvent?.habilitarPlacaVehiculo ?? true);
  const [descripcion, setDescripcion] = useState(initialEvent?.descripcion || '');
  const [microsoftFormsUrl, setMicrosoftFormsUrl] = useState(initialEvent?.microsoftFormsUrl || '');

  const [ponentes, setPonentes] = useState(
    initialEvent?.ponentes || [
      { id: `PON-${Date.now()}-1`, nombre: '', titulo: '', temaPonencia: '' }
    ]
  );

  if (!isOpen) return null;

  const handleAddPonente = () => {
    setPonentes([
      ...ponentes,
      { id: `PON-${Date.now()}-${ponentes.length + 1}`, nombre: '', titulo: '', temaPonencia: '' }
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

    const eventPayload = {
      id: initialEvent?.id || `EVT-MED-${Date.now().toString().slice(-4)}`,
      titulo,
      fecha,
      horaInicio,
      horaFin,
      lugar,
      coordenadas: { lat: 6.261341, lng: -75.566464 },
      habilitarPlacaVehiculo,
      descripcion,
      microsoftFormsUrl,
      ponentes: ponentes.filter(p => p.nombre.trim() !== '')
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

          {/* Fila de Fecha y Horarios */}
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">
                <Calendar size={15} /> Fecha
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
                  Si se activa, el formulario de asistencia incluirá obligatoriamente el campo para la placa vehicular del participante para coordinar el ingreso al parqueadero de la Facultad.
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

          {/* Conexión con Microsoft Forms */}
          <div className="form-group">
            <label className="form-label">
              <Link size={15} /> Enlace de Microsoft Forms Institucional (Opcional)
            </label>
            <input
              type="url"
              className="form-input"
              value={microsoftFormsUrl}
              onChange={(e) => setMicrosoftFormsUrl(e.target.value)}
              placeholder="https://forms.office.com/r/..."
            />
            <span className="form-help-text">
              Puedes vincular un formulario de Microsoft 365 para respaldo o validación cruzada.
            </span>
          </div>

          {/* Sección de Ponentes */}
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
                <div key={ponente.id || idx} className="speaker-form-card">
                  <div className="speaker-number-badge">{idx + 1}</div>
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

          <div className="modal-actions-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary-action">
              {initialEvent ? 'Guardar Cambios' : 'Crear Evento y Generar QR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
