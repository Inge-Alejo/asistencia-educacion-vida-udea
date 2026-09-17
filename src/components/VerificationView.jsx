import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  MapPin,
  Clock,
  User,
  CreditCard,
  Car,
  Award,
  ArrowLeft,
  Lock,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { verifyAttendanceRecord, getEvents } from '../services/storage';

export default function VerificationView({
  comprobanteId,
  tokenSeguridad,
  onVolver
}) {
  const [loading, setLoading] = useState(true);
  const [resultado, setResultado] = useState(null);
  const [evento, setEvento] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function doVerify() {
      setLoading(true);
      try {
        const res = await verifyAttendanceRecord(comprobanteId, tokenSeguridad);
        if (!isMounted) return;

        setResultado(res);

        // Buscar información complementaria del evento
        if (res.success && res.record?.eventoId) {
          const events = getEvents();
          const foundEvent = events.find(e => e.id === res.record.eventoId);
          setEvento(foundEvent || null);
        }
      } catch (err) {
        if (!isMounted) return;
        setResultado({
          success: false,
          message: 'Ocurrió un error inesperado al consultar el servidor de verificación: ' + err.message
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (comprobanteId) {
      doVerify();
    } else {
      setLoading(false);
      setResultado({
        success: false,
        message: 'No se suministró un código de comprobante para verificar.'
      });
    }

    return () => {
      isMounted = false;
    };
  }, [comprobanteId, tokenSeguridad]);

  return (
    <div className="verification-screen-root">
      {/* Cabecera institucional limpia */}
      <div className="verification-header-bar">
        <div className="container verification-header-inner">
          <div className="verification-brand">
            <img
              src="/logo-udea-horizontal.png"
              alt="Universidad de Antioquia - Facultad de Medicina"
              className="verification-official-logo"
            />
            <div className="verification-brand-titles">
              <span className="inst-sub">Universidad de Antioquia</span>
              <h1 className="inst-title">Facultad de Medicina</h1>
              <span className="inst-tagline">Sistema de Verificación Digital de Asistencia</span>
            </div>
          </div>

          <button
            type="button"
            className="btn-back-portal"
            onClick={onVolver}
          >
            <ArrowLeft size={16} />
            <span>Volver al Portal</span>
          </button>
        </div>
      </div>

      <main className="container verification-main">
        {loading ? (
          <div className="verification-loading-card">
            <div className="loading-spinner-udea"></div>
            <h3>Consultando Registro Oficial en Tiempo Real...</h3>
            <p>Consultando base oficial de la Facultad de Medicina...</p>
          </div>
        ) : resultado?.success ? (
          <div className="verification-card-success">
            {/* Cinta superior de validación oficial */}
            <div className="verification-status-banner verified">
              <div className="status-icon-circle">
                <CheckCircle2 size={36} className="text-white" />
              </div>
              <div className="status-text">
                <span className="badge-official-text">DOCUMENTO AUTÉNTICO • REGISTRO ACTIVO</span>
                <h2>Inscripción y Asistencia Oficialmente Confirmadas</h2>
                <p>Verificado satisfactoriamente en el sistema oficial de la Facultad de Medicina.</p>
              </div>
            </div>

            {/* Ficha de Detalles del Asistente */}
            <div className="verification-details-body">
              <div className="verified-person-highlight">
                <div className="avatar-shield">
                  <User size={36} />
                </div>
                <div>
                  <span className="person-role-tag">
                    {resultado.record.vinculacion || 'Participante Académico'}
                  </span>
                  <h2 className="person-name">{resultado.record.nombreCompleto}</h2>
                  <div className="person-id-row">
                    <span className="person-doc-pill">
                      <CreditCard size={14} />
                      <strong>{resultado.record.tipoDocumento || 'CC'}:</strong> {resultado.record.documentoMasked || resultado.record.documento}
                    </span>
                  </div>
                </div>
              </div>

              {/* Información del Evento Académico */}
              <div className="verified-event-box">
                <span className="event-label-mini">Evento Académico Certificado</span>
                <h3 className="verified-event-title">
                  {evento?.titulo || `Evento ${resultado.record.eventoId}`}
                </h3>

                <div className="verified-event-meta-grid">
                  <div className="meta-block">
                    <Calendar size={16} />
                    <div>
                      <small>Fecha del Evento</small>
                      <strong>{evento?.fecha || 'Fecha oficial UdeA'}</strong>
                    </div>
                  </div>

                  <div className="meta-block">
                    <MapPin size={16} />
                    <div>
                      <small>Auditorio / Lugar</small>
                      <strong>{evento?.lugar || 'Facultad de Medicina - Sede Central'}</strong>
                    </div>
                  </div>

                  <div className="meta-block">
                    <Clock size={16} />
                    <div>
                      <small>Fecha y Hora de Registro</small>
                      <strong>{resultado.record.fechaRegistro || 'Confirmado'}</strong>
                    </div>
                  </div>

                  <div className="meta-block">
                    <ShieldCheck size={16} />
                    <div>
                      <small>Modalidad</small>
                      <strong className={resultado.record.esPresencial ? 'text-presencial' : ''}>
                        {resultado.record.esPresencial ? '✓ Presencial en Auditorio' : 'Registro de Asistencia'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sello Técnico y Trazabilidad */}
              <div className="verification-security-meta">
                <div className="security-tag-pill">
                  <Lock size={14} />
                  <span>Comprobante: <strong>{resultado.record.id}</strong></span>
                </div>
                {resultado.record.token && (
                  <div className="security-tag-pill token-tag">
                    <Sparkles size={14} />
                    <span>Validación Oficial: <code>{resultado.record.token.substring(0, 10).toUpperCase()}</code></span>
                  </div>
                )}
                <div className="security-tag-pill source-tag">
                  <span>{resultado.fromCloud ? '☁️ Sincronizado en la Nube' : '💾 Validación Local Segura'}</span>
                </div>
              </div>

              {/* Cláusula Institucional de Protección de Datos */}
              <div className="verification-privacy-notice">
                <p>
                  <strong>Garantía de Protección de Datos (Habeas Data):</strong> En cumplimiento de la Ley Estatutaria 1581 de 2012 y la política institucional de la Universidad de Antioquia, esta consulta pública no expone números telefónicos ni correos electrónicos privados de los participantes.
                </p>
              </div>

              <div className="verification-actions">
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={onVolver}
                >
                  <ArrowLeft size={16} />
                  <span>Ir al Portal del Evento</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Alerta de Registro No Válido */
          <div className="verification-card-error">
            <div className="verification-status-banner unverified">
              <div className="status-icon-circle error">
                <AlertTriangle size={36} className="text-white" />
              </div>
              <div className="status-text">
                <span className="badge-official-text error">VERIFICACIÓN FALLIDA • REGISTRO NO ENCONTRADO</span>
                <h2>Escarapela o Credencial No Válida</h2>
                <p>{resultado?.message || 'El código escaneado no coincide con ningún registro oficial vigente de la Facultad de Medicina.'}</p>
              </div>
            </div>

            <div className="verification-error-content">
              <p className="error-desc">
                Por motivos de seguridad y control de aforo presencial, este código no pudo ser autenticado en el sistema de la Universidad de Antioquia.
              </p>
              <ul className="error-reasons-list">
                <li>El código QR escaneado pudo haber sido alterado o manipulado.</li>
                <li>La asistencia aún no ha sido registrada o fue eliminada por la organización.</li>
                <li>El enlace corresponde a una prueba o no cuenta con la validación requerida.</li>
              </ul>

              <div className="verification-actions">
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={onVolver}
                >
                  <ArrowLeft size={16} />
                  <span>Volver al Portal Oficial</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="verification-footer">
        <p>Facultad de Medicina • Universidad de Antioquia • Educación a lo Largo de la Vida</p>
        <p>Cra. 51D # 62 - 29, Medellín, Colombia • Tel: +57 (604) 219 6000</p>
      </footer>
    </div>
  );
}
