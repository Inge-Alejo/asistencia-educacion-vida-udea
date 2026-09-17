import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Download,
  Printer,
  ShieldCheck,
  Calendar,
  MapPin,
  User,
  CreditCard,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  X
} from 'lucide-react';

export default function DigitalBadge({
  asistente,
  evento,
  onClose,
  isModal = false
}) {
  const badgeCardRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  if (!asistente || !evento) return null;

  // Determinar la URL oficial base para la verificación
  const officialProdDomain = 'https://asistencia-educacion-vida-udea.vercel.app';
  const detectedOrigin = (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null' && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
    ? window.location.origin
    : officialProdDomain;

  // Enlace que se codifica en el código QR de la escarapela
  const tokenParam = asistente.tokenSeguridad ? `&token=${encodeURIComponent(asistente.tokenSeguridad)}` : '';
  const verificationUrl = `${detectedOrigin}/?verificar=${encodeURIComponent(asistente.id)}${tokenParam}`;

  // Descargar la escarapela como imagen PNG de alta definición
  const handleDownloadBadgePNG = async () => {
    if (!badgeCardRef.current || downloading) return;
    setDownloading(true);

    try {
      const card = badgeCardRef.current;
      const width = 680;
      const height = 980;

      // Crear un canvas de alta resolución
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);

      // Fondo base con gradiente institucional
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#FFFFFF');
      bgGrad.addColorStop(1, '#F4F9F5');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Borde exterior verde UdeA
      ctx.strokeStyle = '#0F5938';
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, width - 20, height - 20);

      // Franja superior verde
      ctx.fillStyle = '#0F5938';
      ctx.fillRect(10, 10, width - 20, 130);

      // Franja dorada de acento
      ctx.fillStyle = '#C59B27';
      ctx.fillRect(10, 140, width - 20, 8);

      // Textos de cabecera
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('UNIVERSIDAD DE ANTIOQUIA', width / 2, 50);

      ctx.font = '600 18px "Inter", sans-serif';
      ctx.fillStyle = '#E8F5E9';
      ctx.fillText('Facultad de Medicina', width / 2, 80);

      ctx.font = '13px "Inter", sans-serif';
      ctx.fillStyle = '#C59B27';
      ctx.fillText('EDUCACIÓN A LO LARGO DE LA VIDA • CREDENCIAL OFICIAL', width / 2, 110);

      // Título del Evento
      ctx.fillStyle = '#1A2B21';
      ctx.font = 'bold 18px "Inter", sans-serif';
      const eventTitle = evento.titulo || 'Evento Académico';
      // Truncar si es muy largo
      const truncatedTitle = eventTitle.length > 55 ? eventTitle.substring(0, 52) + '...' : eventTitle;
      ctx.fillText(truncatedTitle, width / 2, 185);

      // Fecha y lugar
      ctx.font = '13px "Inter", sans-serif';
      ctx.fillStyle = '#4A5568';
      ctx.fillText(`${evento.fecha || ''} • ${evento.lugar || 'Auditorio UdeA'}`, width / 2, 215);

      // Línea divisoria
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, 235);
      ctx.lineTo(width - 40, 235);
      ctx.stroke();

      // Rol / Vinculación Badge
      const isPonente = (asistente.vinculacion || '').includes('Ponente');
      ctx.fillStyle = isPonente ? '#B45309' : '#0F5938';
      ctx.beginPath();
      ctx.roundRect(width / 2 - 140, 255, 280, 32, 16);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px "Inter", sans-serif';
      ctx.fillText((asistente.vinculacion || 'ASISTENTE').toUpperCase(), width / 2, 276);

      // Nombre del participante
      ctx.fillStyle = '#0F5938';
      ctx.font = 'bold 26px "Inter", sans-serif';
      const nombre = asistente.nombreCompleto || 'Participante';
      ctx.fillText(nombre, width / 2, 335);

      // Documento
      ctx.font = '600 16px "Inter", sans-serif';
      ctx.fillStyle = '#2D3748';
      ctx.fillText(`${asistente.tipoDocumento || 'CC'}: ${asistente.documento || ''}`, width / 2, 368);

      // Dibujar QR desde el SVG en el DOM
      const svgElement = card.querySelector('.badge-qr-container svg');
      if (svgElement) {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = () => {
            // Fondo blanco para el QR
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#CBD5E1';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(width / 2 - 125, 420, 250, 250, 12);
            ctx.fill();
            ctx.stroke();

            ctx.drawImage(img, width / 2 - 110, 435, 220, 220);
            resolve();
          };
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        });
      }

      // Sello de seguridad y estado
      ctx.fillStyle = '#008744';
      ctx.font = 'bold 15px "Inter", sans-serif';
      ctx.fillText('✓ ASISTENCIA OFICIAL REGISTRADA EN SEDE', width / 2, 705);

      ctx.fillStyle = '#4A5568';
      ctx.font = '12px "Inter", sans-serif';
      ctx.fillText(`Comprobante: ${asistente.id}`, width / 2, 730);
      ctx.fillText(`Fecha y hora de registro: ${asistente.fechaRegistro || ''}`, width / 2, 750);

      // Franja inferior institucional
      ctx.fillStyle = '#0F5938';
      ctx.fillRect(10, height - 70, width - 20, 60);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '11px "Inter", sans-serif';
      ctx.fillText('Facultad de Medicina • Universidad de Antioquia • Medellín, Colombia', width / 2, height - 40);
      ctx.fillText('Escanee el código QR para validar la autenticidad de esta credencial', width / 2, height - 22);

      // Guardar y descargar imagen
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `Escarapela_${(asistente.documento || 'UdeA')}_${evento.id}.png`;
      downloadLink.href = pngUrl;
      downloadLink.click();
    } catch (err) {
      console.error('Error al generar la escarapela en PNG:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintBadge = () => {
    window.print();
  };

  const badgeContent = (
    <div className="digital-badge-wrapper printable-badge-root">
      <div className="digital-badge-card" ref={badgeCardRef}>
        {/* Ranura decorativa de lanyard de congreso */}
        <div className="badge-lanyard-hanger">
          <div className="lanyard-hole"></div>
        </div>

        {/* Encabezado Institucional */}
        <div className="badge-header-band">
          <div className="badge-logos-row">
            <img
              src="/logo-udea-horizontal.png"
              alt="Universidad de Antioquia - Facultad de Medicina"
              className="badge-header-logo"
            />
          </div>
          <div className="badge-sub-program">
            <span>Facultad de Medicina</span>
            <span className="badge-program-highlight">Educación a lo Largo de la Vida</span>
          </div>
        </div>

        {/* Franja de Acento Dorado */}
        <div className="badge-gold-stripe"></div>

        {/* Información del Evento */}
        <div className="badge-event-details">
          <span className="badge-event-id">{evento.id}</span>
          <h3 className="badge-event-title">{evento.titulo}</h3>
          <div className="badge-event-meta">
            <span><Calendar size={13} /> {evento.fecha}</span>
            <span><MapPin size={13} /> {evento.lugar}</span>
          </div>
        </div>

        {/* Cuerpo del Participante */}
        <div className="badge-attendee-body">
          <div className={`badge-role-pill ${(asistente.vinculacion || '').includes('Ponente') ? 'badge-role-ponente' : ''}`}>
            <User size={13} />
            <span>{asistente.vinculacion || 'Asistente Académico'}</span>
          </div>

          <h2 className="badge-attendee-name">{asistente.nombreCompleto}</h2>

          <div className="badge-id-pill">
            <CreditCard size={14} />
            <span>{asistente.tipoDocumento || 'CC'}: <strong>{asistente.documento}</strong></span>
          </div>
        </div>

        {/* Contenedor del Código QR de Verificación */}
        <div className="badge-qr-section">
          <div className="badge-qr-container">
            <QRCodeSVG
              value={verificationUrl}
              size={180}
              level="H"
              includeMargin={true}
              fgColor="#0F5938"
              bgColor="#FFFFFF"
              imageSettings={{
                src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='%230F5938'/%3E%3Cpath d='M50 20 v60 M20 50 h60' stroke='%23C59B27' stroke-width='12' stroke-linecap='round'/%3E%3C/svg%3E",
                x: undefined,
                y: undefined,
                height: 38,
                width: 38,
                excavate: true,
              }}
            />
          </div>
          <span className="badge-qr-caption">
            <Sparkles size={13} /> Escanee para verificar inscripción oficial
          </span>
        </div>

        {/* Sello de Seguridad y Validación */}
        <div className="badge-security-stamp">
          <div className="security-icon-check">
            <CheckCircle2 size={16} />
          </div>
          <div className="security-stamp-text">
            <strong>ASISTENCIA OFICIAL CONFIRMADA</strong>
            <span>Comprobante: {asistente.id}</span>
            <span>Registrado: {asistente.fechaRegistro}</span>
          </div>
        </div>

        {/* Pie de la Escarapela */}
        <div className="badge-footer-band">
          <p>Facultad de Medicina • Universidad de Antioquia</p>
          <p className="badge-legal-mini">Registro personal intransferible • Ley 1581 de 2012</p>
        </div>
      </div>

      {/* Botones de Acción (no se imprimen) */}
      <div className="badge-actions-bar no-print">
        <button
          type="button"
          className="btn-badge-download"
          onClick={handleDownloadBadgePNG}
          disabled={downloading}
          title="Guardar imagen PNG en su teléfono"
        >
          <Download size={16} />
          <span>{downloading ? 'Generando imagen...' : 'Descargar Escarapela (PNG)'}</span>
        </button>

        <button
          type="button"
          className="btn-badge-print"
          onClick={handlePrintBadge}
          title="Imprimir credencial en formato físico"
        >
          <Printer size={16} />
          <span>Imprimir</span>
        </button>

        <a
          href={verificationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-badge-verify-link"
          title="Abrir enlace de verificación directa"
        >
          <ExternalLink size={16} />
          <span>Probar Escaneo</span>
        </a>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container badge-modal-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="badge-modal-header no-print">
            <div className="badge-modal-title">
              <ShieldCheck size={20} className="shield-green" />
              <span>Escarapela Digital Oficial UdeA</span>
            </div>
            <button className="btn-close-modal" onClick={onClose} aria-label="Cerrar escarapela">
              <X size={20} />
            </button>
          </div>
          <div className="badge-modal-body">
            {badgeContent}
          </div>
        </div>
      </div>
    );
  }

  return badgeContent;
}
