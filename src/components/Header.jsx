import React from 'react';
import { UserCheck, Settings, QrCode, Lock, LogOut, Calendar, GraduationCap } from 'lucide-react';

export default function Header({
  currentView,
  onNavigateView,
  currentEvent,
  events,
  onSelectEvent,
  onOpenQRModal,
  isAdmin,
  onLogoutAdmin
}) {
  return (
    <header className="udea-header">
      <div className="header-top-bar">
        <div className="container header-content">
          {/* Identidad Institucional UdeA */}
          <div className="brand-wrapper" onClick={() => onNavigateView('attendee')} style={{ cursor: 'pointer' }} title="Ir al Portal Institucional">
            <img
              src="/logo-udea-horizontal.png"
              alt="Universidad de Antioquia - Facultad de Medicina"
              className="udea-official-header-logo"
            />
            <div className="brand-text">
              <span className="institution-name">Universidad de Antioquia</span>
              <h1 className="faculty-title">Facultad de Medicina</h1>
              <span className="program-subtitle">Educación a lo Largo de la Vida • Gestión Académica</span>
            </div>
          </div>

          {/* Selector de Evento Activo: Solo administradores pueden cambiar de evento */}
          {isAdmin && currentView === 'admin' ? (
            <div className="header-event-selector">
              <Calendar size={16} className="selector-icon" />
              <select
                value={currentEvent?.id || ''}
                onChange={(e) => {
                  const found = events.find(ev => ev.id === e.target.value);
                  if (found) onSelectEvent(found);
                }}
                className="event-dropdown"
                aria-label="Seleccionar evento administrativo"
              >
                {events.map((ev) => {
                  const displayTitle = ev.titulo?.length > 45 ? ev.titulo.substring(0, 45) + '...' : (ev.titulo || 'Evento');
                  return (
                    <option key={ev.id} value={ev.id}>
                      {displayTitle} — [{ev.id}] ({ev.fecha})
                    </option>
                  );
                })}
              </select>
            </div>
          ) : currentEvent ? (
            <div className="header-event-locked-badge" title={`Evento oficial: ${currentEvent?.titulo || 'Evento Académico UdeA'} [Código: ${currentEvent?.id}]`}>
              <div className="locked-badge-header">
                <span className="locked-pill-tag">
                  <Lock size={11} />
                  <span>{currentEvent?.id || 'Evento Oficial'}</span>
                </span>
                {currentEvent?.fecha && (
                  <span className="locked-date">
                    <Calendar size={11} />
                    <span>{currentEvent.fecha}</span>
                  </span>
                )}
              </div>
              <div className="locked-text-wrap">
                <strong className="locked-title">
                  {currentEvent?.titulo || 'Evento Académico UdeA'}
                </strong>
              </div>
            </div>
          ) : (
            <div className="header-event-locked-badge portal-badge" title="Portal Institucional de Asistencia UdeA">
              <div className="locked-badge-header">
                <span className="locked-pill-tag" style={{ background: '#DCFCE7', color: '#166534' }}>
                  <GraduationCap size={12} />
                  <span>Portal Institucional</span>
                </span>
              </div>
              <div className="locked-text-wrap">
                <strong className="locked-title">Educación Médica Continua</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra de Navegación de Vistas */}
      <nav className="header-nav-bar">
        <div className="container nav-content">
          <div className="nav-tabs">
            <button
              className={`nav-tab-btn ${currentView === 'attendee' ? 'active' : ''}`}
              onClick={() => onNavigateView('attendee')}
            >
              <UserCheck size={16} />
              <span className="tab-text-full">Portal del Asistente (Móvil/QR)</span>
              <span className="tab-text-compact">Asistente</span>
            </button>

            <button
              className={`nav-tab-btn ${currentView === 'admin' ? 'active' : ''}`}
              onClick={() => onNavigateView('admin')}
            >
              {isAdmin ? <Settings size={16} /> : <Lock size={16} />}
              <span className="tab-text-full">
                Panel de Administración {isAdmin ? '' : '(Protegido)'}
              </span>
              <span className="tab-text-compact">Admin</span>
            </button>
          </div>

          <div className="nav-actions">
            {isAdmin && currentView === 'admin' && (
              <button
                className="btn-admin-logout"
                onClick={onLogoutAdmin}
                title="Cerrar sesión de administración"
              >
                <LogOut size={15} />
                <span className="logout-btn-text">Salir</span>
              </button>
            )}

            <button
              className="btn-projection-trigger"
              onClick={onOpenQRModal}
              title="Proyectar Código QR del Evento en pantalla grande"
            >
              <QrCode size={16} />
              <span className="proj-btn-text">Proyectar QR</span>
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
