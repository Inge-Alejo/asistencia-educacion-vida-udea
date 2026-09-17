import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Download, Sparkles, MapPin, Calendar, Clock, Car, Check, Users } from 'lucide-react';
import { ESCUDO_UDEA_QR_BASE64 } from '../assets/escudoQrBase64';

export default function QRProjectionModal({ isOpen, onClose, evento, asistencias = [] }) {
  const qrRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // Dominio oficial de producción para escaneo móvil en vivo
  const baseUrl = 'https://asistencia-educacion-vida-udea.vercel.app';

  if (!isOpen || !evento) return null;

  // URL absoluta y limpia con parámetro de versión/actualización (?v=2.2) para obligar a los móviles a cargar la versión más reciente sin caché vieja
  const qrTargetUrl = `${baseUrl}/?evento=${encodeURIComponent(evento.id)}&view=attendee&v=2.2`;

  const handleDownloadQR = () => {
    const svgElement = qrRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 1200;
      canvas.height = 1200;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 100, 100, 1000, 1000);

      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `QR_${evento.id}_UdeA_Medicina.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrTargetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container qr-projection-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="projection-header">
          <div className="projection-branding">
            <img
              src="/logo-udea-horizontal.png"
              alt="Universidad de Antioquia - Facultad de Medicina"
              className="projection-official-logo"
            />
            <span className="inst-badge">Educación a lo Largo de la Vida</span>
          </div>
          <button className="btn-close-modal no-print" onClick={onClose} aria-label="Cerrar modal">
            <X size={24} />
          </button>
        </div>

        <div className="projection-body">
          {/* Tarjeta de Información del Evento */}
          <div className="projection-info-card">
            <span className="event-code-badge">{evento.id}</span>
            <h1 className="projection-event-title">{evento.titulo}</h1>

            <div className="projection-meta-grid">
              <div className="meta-item">
                <Calendar size={18} />
                <span>{evento.fecha}</span>
              </div>
              <div className="meta-item">
                <Clock size={18} />
                <span>{evento.horaInicio} - {evento.horaFin}</span>
              </div>
              <div className="meta-item">
                <MapPin size={18} />
                <span>{evento.lugar}</span>
              </div>
              <div className="meta-item live-counter-meta" style={{ color: '#008744', fontWeight: '700', backgroundColor: '#eafaf1', padding: '0.35rem 0.65rem', borderRadius: '6px' }}>
                <Users size={18} />
                <span>{asistencias.length} Asistente(s) Registrado(s) en Vivo</span>
              </div>
              {evento.habilitarPlacaVehiculo && (
                <div className="meta-item vehicle-allowed">
                  <Car size={18} />
                  <span>Registro vehicular habilitado para parqueadero</span>
                </div>
              )}
            </div>

            <div className="scan-instructions-box">
              <div className="instructions-icon">
                <Sparkles size={24} />
              </div>
              <div className="instructions-text">
                <h3>Escanee con la cámara de su teléfono móvil</h3>
                <p>1. Abra la cámara de su celular y apunte al código QR.</p>
                <p>2. Toque la notificación para abrir el formulario oficial.</p>
                <p>3. Valide su ubicación presencial y confirme su asistencia.</p>
              </div>
            </div>

          </div>

          {/* Tarjeta del Código QR de Gran Tamaño */}
          <div className="projection-qr-card">
            <div className="qr-wrapper" ref={qrRef}>
              <QRCodeSVG
                value={qrTargetUrl}
                size={320}
                level="H"
                includeMargin={true}
                fgColor="#0F5938" // Verde UdeA
                bgColor="#FFFFFF"
                imageSettings={{
                  src: ESCUDO_UDEA_QR_BASE64,
                  x: undefined,
                  y: undefined,
                  height: 64,
                  width: 64,
                  excavate: true,
                }}
              />
            </div>

            <p className="qr-caption">Código QR Oficial de Asistencia</p>

            <div className="qr-link-box no-print">
              <span className="qr-url-preview">{qrTargetUrl}</span>
              <button
                type="button"
                className="btn-copy-link"
                onClick={handleCopyLink}
                title="Copiar enlace directo"
              >
                {copied ? <Check size={14} /> : 'Copiar'}
              </button>
            </div>

            {/* Botones de acción del proyector */}
            <div className="projection-action-buttons no-print">
              <button className="btn-secondary" onClick={handleDownloadQR}>
                <Download size={16} />
                <span>Descargar Imagen HD</span>
              </button>
            </div>
          </div>
        </div>

        <div className="projection-footer">
          <p className="footer-notice">
            Portal oficial de registro presencial • Facultad de Medicina de la Universidad de Antioquia • Medellín, Colombia
          </p>
        </div>
      </div>
    </div>
  );
}
