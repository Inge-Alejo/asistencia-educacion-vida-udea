import React, { useState } from 'react';
import { X, Search, Calendar, MapPin, Clock, Edit3, Eye, Plus, Layers, CheckCircle2 } from 'lucide-react';

export default function EventSelectorModal({
  isOpen,
  onClose,
  events = [],
  currentEventId = null,
  onSelectForEdit,
  onSelectToView,
  onOpenNewEvent
}) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredEvents = events.filter((ev) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchTitulo = String(ev.titulo || '').toLowerCase().includes(term);
    const matchFecha = String(ev.fecha || '').toLowerCase().includes(term) ||
      String(ev.fechaInicio || '').toLowerCase().includes(term) ||
      String(ev.fechaFin || '').toLowerCase().includes(term);
    const matchLugar = String(ev.lugar || '').toLowerCase().includes(term);
    return matchTitulo || matchFecha || matchLugar;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container event-selector-modal" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera del Modal */}
        <div className="modal-header">
          <div>
            <span className="modal-badge">Gestión de Eventos UdeA</span>
            <h2 className="modal-title">Editar Evento Existente</h2>
            <p className="modal-subtitle">
              Selecciona el evento académico que deseas editar, modificar sus fechas, horarios o ponentes:
            </p>
          </div>
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del Modal con padding institucional */}
        <div className="modal-body event-selector-body">
          {/* Buscador de Eventos */}
          <div className="event-selector-search-bar">
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Buscar evento por título, fecha o auditorio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input search-events-input"
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchTerm('')}
                  title="Limpiar búsqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="events-count-chip">
              {filteredEvents.length} {filteredEvents.length === 1 ? 'evento disponible' : 'eventos disponibles'}
            </span>
          </div>

          {/* Lista de Eventos Existentes */}
          <div className="event-selector-list">
            {filteredEvents.length === 0 ? (
              <div className="empty-events-state">
                <Calendar size={40} color="#94A3B8" />
                <h4>No se encontraron eventos coincidentes</h4>
                <p>Verifica el término de búsqueda o crea un nuevo evento académico.</p>
                {onOpenNewEvent && (
                  <button
                    type="button"
                    className="btn-primary-action"
                    onClick={() => {
                      onClose();
                      onOpenNewEvent();
                    }}
                    style={{ marginTop: '0.85rem' }}
                  >
                    <Plus size={16} />
                    <span>Crear Nuevo Evento</span>
                  </button>
                )}
              </div>
            ) : (
              filteredEvents.map((ev) => {
                const isCurrent = ev.id === currentEventId;
                const hasCustomSchedules = ev.esMultidia && ev.horariosPorDia && Object.keys(ev.horariosPorDia).length > 0;

                return (
                  <div
                    key={ev.id}
                    className={`event-selector-card ${isCurrent ? 'is-current-active' : ''}`}
                  >
                    <div className="event-card-main-info">
                      <div className="event-card-top-tags">
                        {isCurrent && (
                          <span className="current-event-pill">
                            <CheckCircle2 size={13} /> Activo en Pantalla
                          </span>
                        )}
                        {ev.esMultidia ? (
                          <span className="multiday-event-pill">
                            <Layers size={13} /> Multidía ({ev.diasEvento?.length || 'Varios'} días)
                          </span>
                        ) : (
                          <span className="singleday-event-pill">1 Solo Día</span>
                        )}
                        {hasCustomSchedules && (
                          <span className="custom-schedule-pill" title="Tiene jornadas con horarios diferenciados de cierre o inicio">
                            <Clock size={12} /> Horarios por Fecha
                          </span>
                        )}
                      </div>

                      <h3 className="event-card-title">{ev.titulo}</h3>

                      <div className="event-card-meta-row">
                        <span className="meta-item">
                          <Calendar size={14} />
                          {ev.esMultidia
                            ? `${ev.fechaInicio || ev.fecha} al ${ev.fechaFin || ev.fecha}`
                            : ev.fecha}
                        </span>
                        <span className="meta-item">
                          <Clock size={14} />
                          {ev.horaInicio} - {ev.horaFin}
                        </span>
                        <span className="meta-item">
                          <MapPin size={14} />
                          {ev.lugar}
                        </span>
                      </div>

                      {ev.descripcion && (
                        <p className="event-card-desc-preview">
                          {ev.descripcion}
                        </p>
                      )}
                    </div>

                    <div className="event-card-actions">
                      <button
                        type="button"
                        className="btn-edit-this-event"
                        onClick={() => {
                          onClose();
                          onSelectForEdit(ev);
                        }}
                        title={`Editar "${ev.titulo}"`}
                      >
                        <Edit3 size={15} />
                        <span>Editar Este Evento</span>
                      </button>

                      {!isCurrent && onSelectToView && (
                        <button
                          type="button"
                          className="btn-view-this-event"
                          onClick={() => {
                            onSelectToView(ev);
                          }}
                          title={`Seleccionar y ver en panel`}
                        >
                          <Eye size={14} />
                          <span>Ver en Panel</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pie del Modal */}
        <div className="modal-footer">
          {onOpenNewEvent ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                onClose();
                onOpenNewEvent();
              }}
            >
              <Plus size={16} />
              <span>Crear Nuevo Evento</span>
            </button>
          ) : <div />}

          <button type="button" className="btn-secondary" onClick={onClose}>
            <span>Cerrar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
