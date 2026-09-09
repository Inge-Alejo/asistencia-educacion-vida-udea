import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Download, Printer, Sparkles, MapPin, Calendar, Clock, Car, Globe, Check, Users } from 'lucide-react';

export default function QRProjectionModal({ isOpen, onClose, evento, asistencias = [] }) {
  const qrRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // Determinar la URL base oficial
  const officialProdDomain = 'https://asistencia-educacion-vida-udea.vercel.app';
  const detectedOrigin = (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null')
    ? window.location.origin
    : officialProdDomain;

  const [baseUrl, setBaseUrl] = useState(detectedOrigin);

  if (!isOpen || !evento) return null;

  // URL absoluta y limpia a la que dirigirá el QR al escanear con el teléfono móvil
  const qrTargetUrl = `${baseUrl.replace(/\/$/, '')}/?evento=${encodeURIComponent(evento.id)}&view=attendee`;

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

  const handlePrint = () => {
    window.print();
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
          <button className="btn-close-modal" onClick={onClose} aria-label="Cerrar modal">
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

            {/* Selector del Dominio del Enlace (Permite alternar entre dominio local y Vercel) */}
            <div className="qr-domain-switcher">
              <label className="domain-label">
                <Globe size={14} /> Dominio destino del QR:
              </label>
              <div className="domain-buttons">
                <button
                  type="button"
                  className={`btn-domain-choice ${baseUrl === officialProdDomain ? 'active' : ''}`}
                  onClick={() => setBaseUrl(officialProdDomain)}
                >
                  Producción Vercel (.app)
                </button>
                {detectedOrigin !== officialProdDomain && (
                  <button
                    type="button"
                    className={`btn-domain-choice ${baseUrl === detectedOrigin ? 'active' : ''}`}
                    onClick={() => setBaseUrl(detectedOrigin)}
                  >
                    Origen Actual ({detectedOrigin.replace(/https?:\/\//, '')})
                  </button>
                )}
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
                  src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='%230F5938'/%3E%3Cpath d='M50 20 v60 M20 50 h60' stroke='%23C59B27' stroke-width='12' stroke-linecap='round'/%3E%3C/svg%3E",
                  x: undefined,
                  y: undefined,
                  height: 56,
                  width: 56,
                  excavate: true,
                }}
              />
            </div>

            <p className="qr-caption">Código QR Oficial de Asistencia</p>

            <div className="qr-link-box">
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
            <div className="projection-action-buttons">
              <button className="btn-secondary" onClick={handleDownloadQR}>
                <Download size={16} />
                <span>Descargar Imagen HD</span>
              </button>
              <button className="btn-secondary" onClick={handlePrint}>
                <Printer size={16} />
                <span>Imprimir Afiche</span>
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
