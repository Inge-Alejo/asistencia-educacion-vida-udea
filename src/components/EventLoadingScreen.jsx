import React from 'react';
import { Loader2, GraduationCap, ShieldCheck } from 'lucide-react';

export default function EventLoadingScreen({
  message = 'Cargando evento académico...',
  subtitle = 'Conectando con los servidores de la Facultad de Medicina UdeA'
}) {
  return (
    <div className="event-loading-fullscreen animated-step">
      <div className="event-loading-card">
        <div className="event-loading-brand">
          <img
            src="/logo-udea-horizontal.png"
            alt="Universidad de Antioquia"
            className="loading-udea-logo"
          />
          <div className="loading-inst-text">
            <span className="loading-inst-name">Universidad de Antioquia</span>
            <span className="loading-fac-name">Facultad de Medicina</span>
          </div>
        </div>

        <div className="event-loading-spinner-wrap">
          <Loader2 className="spinner-loading-icon" size={44} />
        </div>

        <h2 className="event-loading-title">{message}</h2>
        <p className="event-loading-sub">{subtitle}</p>

        <div className="event-loading-footer-badge">
          <ShieldCheck size={14} />
          <span>Verificación Oficial en Tiempo Real</span>
        </div>
      </div>
    </div>
  );
}
