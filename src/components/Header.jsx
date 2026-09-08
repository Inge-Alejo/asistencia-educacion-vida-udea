import React from 'react';
import { ShieldCheck, UserCheck, Settings, QrCode, Building2, Calendar } from 'lucide-react';

export default function Header({ currentView, setCurrentView, currentEvent, events, onSelectEvent, onOpenQRModal }) {
  return (
    <header className="udea-header">
      <div className="header-top-bar">
        <div className="container header-content">
          {/* Identidad Institucional UdeA */}
          <div className="brand-wrapper">
            <div className="udea-badge-emblem">
              <span className="emblem-cross">+</span>
              <span className="emblem-text">UdeA</span>
            </div>
            <div className="brand-text">
              <span className="institution-name">Universidad de Antioquia</span>
              <h1 className="faculty-title">Facultad de Medicina</h1>
              <span className="program-subtitle">Educación a lo Largo de la Vida • Asistencia y Gestión Académica</span>
            </div>
          </div>

          {/* Selector de Evento Activo en la cabecera */}
          <div className="header-event-selector">
            <Calendar size={16} className="selector-icon" />
            <select
              value={currentEvent?.id || ''}
              onChange={(e) => {
                const found = events.find(ev => ev.id === e.target.value);
                if (found) onSelectEvent(found);
              }}
              className="event-dropdown"
              aria-label="Seleccionar evento"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.titulo.length > 45 ? ev.titulo.substring(0, 45) + '...' : ev.titulo} ({ev.fecha})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Barra de Navegación de Vistas */}
      <nav className="header-nav-bar">
        <div className="container nav-content">
          <div className="nav-tabs">
            <button
              className={`nav-tab-btn ${currentView === 'attendee' ? 'active' : ''}`}
              onClick={() => setCurrentView('attendee')}
            >
              <UserCheck size={18} />
              <span>Portal del Asistente (Móvil/QR)</span>
            </button>

            <button
              className={`nav-tab-btn ${currentView === 'admin' ? 'active' : ''}`}
              onClick={() => setCurrentView('admin')}
            >
              <Settings size={18} />
              <span>Panel de Administración</span>
            </button>
          </div>

          <div className="nav-actions">
            <button
              className="btn-projection-trigger"
              onClick={onOpenQRModal}
              title="Proyectar Código QR del Evento en pantalla grande"
            >
              <QrCode size={18} />
              <span>Proyectar QR del Evento</span>
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
