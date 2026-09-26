import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  ShieldCheck,
  QrCode,
  Search,
  ExternalLink,
  Sparkles,
  ArrowRight,
  GraduationCap,
  Award,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { getColombiaLocalDateStr, checkEventDayStatus } from '../services/networkTime';

export default function InstitutionalLanding({
  events = [],
  onSelectEvent,
  onOpenAdminLogin,
  isAdmin = false
}) {
  const [eventCodeInput, setEventCodeInput] = useState('');
  const [searchError, setSearchError] = useState('');

  // Fecha actual en hora de Colombia (America/Bogota)
  const todayStr = getColombiaLocalDateStr();

  // Categorizar eventos por su ciclo de vida hoy
  const activeTodayEvents = [];
  const upcomingEvents = [];

  events.forEach(evt => {
    const status = checkEventDayStatus(evt, todayStr);
    if (status.esDiaActivo) {
      activeTodayEvents.push({ evt, status });
    } else if (status.esAntesDeFecha) {
      upcomingEvents.push({ evt, status });
    }
  });

  const handleSearchCode = (e) => {
    e.preventDefault();
    const clean = eventCodeInput.trim().toUpperCase();
    if (!clean) {
      setSearchError('Por favor ingrese el código del evento (ej: EVT-MED-01)');
      return;
    }

    const match = events.find(
      ev => ev.id.toUpperCase() === clean || ev.id.toUpperCase().includes(clean)
    );

    if (match) {
      setSearchError('');
      onSelectEvent(match);
    } else {
      setSearchError(`No se encontró ningún evento con el código "${clean}". Verifique con los organizadores.`);
    }
  };

  return (
    <div className="institutional-landing-container animated-step">
      {/* HERO INSTITUCIONAL PRINCIPAL */}
      <section className="landing-hero-card">
        <div className="landing-hero-backdrop"></div>
        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <GraduationCap size={16} />
            <span>Facultad de Medicina · Universidad de Antioquia</span>
          </div>

          <h1 className="landing-hero-title">
            Portal Oficial de Asistencia y Acreditación Académica
          </h1>

          <p className="landing-hero-subtitle">
            Sistema institucional de registro presencial, interacción con ponentes en vivo y gestión de escarapelas digitales de la Dirección de Educación a lo Largo de la Vida.
          </p>

          <div className="landing-hero-features-row">
            <div className="feature-pill">
              <ShieldCheck size={14} className="feature-icon" />
              <span>Verificación Presencial GPS</span>
            </div>
            <div className="feature-pill">
              <Award size={14} className="feature-icon" />
              <span>Escarapela Digital Inmutable</span>
            </div>
            <div className="feature-pill">
              <QrCode size={14} className="feature-icon" />
              <span>Registro Ágil por QR</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 1: EVENTOS EN CURSO HOY (EN VIVO) */}
      <section className="landing-live-section">
        <div className="section-header-row">
          <div className="live-pulse-indicator">
            <span className="pulse-dot"></span>
            <span className="pulse-text">Jornadas Académicas de Hoy</span>
          </div>
          <span className="date-chip">
            <Calendar size={13} />
            <span>{todayStr}</span>
          </span>
        </div>

        {activeTodayEvents.length > 0 ? (
          <div className="live-events-grid">
            {activeTodayEvents.map(({ evt, status }) => {
              const activePonentes = (evt.ponentes || []).filter(p => p.activo !== false);
              return (
                <article key={evt.id} className="live-event-card">
                  <div className="live-event-badge-row">
                    <span className="live-badge-glow">
                      <span className="pulse-small"></span> En Curso Hoy
                    </span>
                    <span className="event-code-tag">{evt.id}</span>
                  </div>

                  <h2 className="live-event-title">{evt.titulo}</h2>

                  {evt.descripcion && (
                    <p className="live-event-description">{evt.descripcion}</p>
                  )}

                  <div className="live-event-meta-grid">
                    <div className="meta-item">
                      <Clock size={15} className="meta-icon" />
                      <span>{evt.horaInicio || '08:00'} - {evt.horaFin || '18:00'}</span>
                    </div>

                    <div className="meta-item">
                      <MapPin size={15} className="meta-icon" />
                      <span title={evt.lugar}>{evt.lugar || 'Facultad de Medicina UdeA'}</span>
                    </div>

                    {evt.habilitarPonentes !== false && activePonentes.length > 0 && (
                      <div className="meta-item full-width">
                        <User size={15} className="meta-icon" />
                        <span>
                          {activePonentes.length} {activePonentes.length === 1 ? 'Ponente' : 'Ponentes'}:{' '}
                          <strong>{activePonentes.map(p => p.nombre).slice(0, 2).join(', ')}</strong>
                          {activePonentes.length > 2 ? ` y ${activePonentes.length - 2} más` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="live-event-cta-box">
                    <button
                      type="button"
                      className="btn-enter-event-primary"
                      onClick={() => onSelectEvent(evt)}
                    >
                      <span>Registrar Mi Asistencia Ahora</span>
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="no-live-events-box">
            <div className="no-events-icon-wrap">
              <Calendar size={32} />
            </div>
            <h3>No hay eventos con registro abierto en este momento</h3>
            <p>
              El registro de asistencia se activa automáticamente durante el día programado para cada evento.
              Si estás en un auditorio de la Facultad, escanea el código QR proyectado en pantalla o ingresa el código del evento abajo.
            </p>
          </div>
        )}
      </section>

      {/* SECCIÓN 2: BUSCADOR POR CÓDIGO DIRECTO */}
      <section className="landing-search-section">
        <div className="search-card">
          <div className="search-card-header">
            <div className="search-icon-wrap">
              <Search size={20} />
            </div>
            <div>
              <h3 className="search-title">¿Tienes el código del evento?</h3>
              <p className="search-desc">
                Si el lector de código QR de tu teléfono no abrió el evento automáticamente, ingresa el código asignado por los organizadores:
              </p>
            </div>
          </div>

          <form onSubmit={handleSearchCode} className="search-code-form">
            <div className="search-input-group">
              <input
                type="text"
                className="search-code-input"
                placeholder="Ejemplo: EVT-MED-01"
                value={eventCodeInput}
                onChange={(e) => {
                  setEventCodeInput(e.target.value);
                  if (searchError) setSearchError('');
                }}
              />
              <button type="submit" className="search-code-btn">
                <span>Buscar Evento</span>
                <ArrowRight size={16} />
              </button>
            </div>
            {searchError && (
              <p className="search-error-msg">{searchError}</p>
            )}
          </form>
        </div>
      </section>

      {/* SECCIÓN 3: CÓMO FUNCIONA EL SISTEMA */}
      <section className="landing-how-it-works">
        <h3 className="how-title">¿Cómo registrar mi asistencia en el auditorio?</h3>
        <div className="steps-cards-grid">
          <div className="how-card">
            <div className="how-number">1</div>
            <h4>Escanear Código QR</h4>
            <p>Abre la cámara de tu celular y apunta al código QR proyectado en la pantalla del auditorio o salón.</p>
          </div>

          <div className="how-card">
            <div className="how-number">2</div>
            <h4>Validación de Sede</h4>
            <p>Permite la verificación de ubicación presencial en el campus de la Facultad de Medicina (Área de la Salud).</p>
          </div>

          <div className="how-card">
            <div className="how-number">3</div>
            <h4>Escarapela Digital</h4>
            <p>Ingresa tu documento y obtén tu credencial digital segura para control de accesos y refrigerios.</p>
          </div>

          <div className="how-card">
            <div className="how-number">4</div>
            <h4>Preguntas y Encuesta</h4>
            <p>Haz preguntas en tiempo real a los ponentes y califica la calidad académica de la jornada.</p>
          </div>
        </div>
      </section>

      {/* ACCESO EXCLUSIVO DOCENTES Y ORGANIZADORES */}
      <section className="landing-admin-access">
        <div className="admin-access-card">
          <div className="admin-access-info">
            <Lock size={18} className="admin-lock-icon" />
            <div>
              <strong>Acceso para Coordinadores y Docentes</strong>
              <p>Gestionar eventos, proyectar códigos QR, exportar listas de asistencia y visualizar métricas en tiempo real.</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-admin-access-link"
            onClick={onOpenAdminLogin}
          >
            <span>{isAdmin ? 'Ir al Panel de Administración' : 'Iniciar Sesión Administrativa'}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}
