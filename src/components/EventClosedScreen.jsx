import React, { useState } from 'react';
import {
  CalendarX,
  Calendar,
  Clock,
  MapPin,
  ArrowLeft,
  Award,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

export default function EventClosedScreen({
  evento,
  onGoHome,
  onViewBadgeIfRegistered
}) {
  const [showSupportInfo, setShowSupportInfo] = useState(false);

  // Verificar si hay sesión previa registrada en este dispositivo
  const hasExistingSession = typeof window !== 'undefined' && Boolean(
    localStorage.getItem(`udea_session_attendee_${evento?.id}`)
  );

  return (
    <div className="event-closed-container animated-step">
      <div className="event-closed-card">
        <div className="closed-icon-badge">
          <CalendarX size={44} className="closed-icon" />
        </div>

        <span className="closed-tag">Periodo de Registro Culminado</span>

        <h1 className="closed-event-title">{evento?.titulo || 'Evento Académico'}</h1>

        <div className="closed-event-meta">
          <span className="meta-pill">
            <Calendar size={13} />
            <span>Fecha oficial: {evento?.fechaFin || evento?.fecha || 'Finalizada'}</span>
          </span>
          {evento?.lugar && (
            <span className="meta-pill">
              <MapPin size={13} />
              <span>{evento.lugar}</span>
            </span>
          )}
        </div>

        <div className="closed-explanation-box">
          <AlertCircle size={20} className="explanation-icon" />
          <p>
            El periodo oficial para el registro de asistencia presencial a este evento académico ha finalizado.
            Por políticas institucionales de la Facultad de Medicina, los registros solo se habilitan durante la jornada del evento.
          </p>
        </div>

        {/* Si el usuario ya se había registrado ese día en este dispositivo */}
        {hasExistingSession && (
          <div className="already-registered-access-box">
            <Award size={22} className="award-icon" />
            <div>
              <strong>Tu registro previo fue guardado exitosamente</strong>
              <p>Puedes consultar o descargar tu Escarapela Digital de participación.</p>
            </div>
            <button
              type="button"
              className="btn-view-existing-badge"
              onClick={onViewBadgeIfRegistered}
            >
              <span>Ver Mi Escarapela</span>
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Botones de acción principales */}
        <div className="closed-actions-row">
          <button
            type="button"
            className="btn-primary-action"
            onClick={onGoHome}
          >
            <ArrowLeft size={16} />
            <span>Ir al Portal de Eventos UdeA</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowSupportInfo(!showSupportInfo)}
          >
            <HelpCircle size={16} />
            <span>Soporte Académico</span>
          </button>
        </div>

        {/* Soporte informativo desplegable */}
        {showSupportInfo && (
          <div className="support-info-dropdown animated-step">
            <h4>Coordinación de Educación Continua</h4>
            <p>
              Si asististe presencialmente y requieres asistencia con tu constancia o certificación académica, por favor comunícate con la coordinación:
            </p>
            <ul>
              <li><strong>Sede:</strong> Facultad de Medicina UdeA, Cra. 51D # 62 - 29 (Medellín)</li>
              <li><strong>Teléfono:</strong> +57 (604) 219 6000</li>
              <li><strong>Dependencia:</strong> Educación a lo Largo de la Vida</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
