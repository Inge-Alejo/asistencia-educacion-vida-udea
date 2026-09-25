import React, { useRef, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import { ESCUDO_UDEA_QR_BASE64 } from '../assets/escudoQrBase64';
import {
  FileDown,
  Image as ImageIcon,
  ShieldCheck,
  Calendar,
  MapPin,
  User,
  CreditCard,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Barcode,
  X
} from 'lucide-react';

export default function DigitalBadge({
  asistente,
  evento,
  onClose,
  isModal = false
}) {
  const badgeCardRef = useRef(null);
  const barcodeSvgRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  // Renderizar código de barras 1D Code 128 con la cédula/documento del asistente
  useEffect(() => {
    if (barcodeSvgRef.current && asistente) {
      const val = String(asistente.documento || asistente.id || 'UDEA').trim();
      try {
        JsBarcode(barcodeSvgRef.current, val, {
          format: 'CODE128',
          width: 2.1,
          height: 48,
          displayValue: true,
          font: 'Inter, system-ui, sans-serif',
          fontSize: 13,
          fontOptions: 'bold',
          textMargin: 4,
          lineColor: '#0F5938',
          background: '#FFFFFF',
          margin: 6
        });
      } catch (err) {
        console.warn('Error al generar código de barras Code 128:', err);
      }
    }
  }, [asistente]);

  if (!asistente || !evento) return null;

  // Determinar la URL oficial base para la verificación
  const officialProdDomain = 'https://asistencia-educacion-vida-udea.vercel.app';
  const detectedOrigin = (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null' && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
    ? window.location.origin
    : officialProdDomain;

  // Enlace que se codifica en el código QR de la credencial
  const tokenParam = asistente.tokenSeguridad ? `&token=${encodeURIComponent(asistente.tokenSeguridad)}` : '';
  const docParam = asistente.documento ? `&doc=${encodeURIComponent(asistente.documento)}` : '';
  const eventParam = (asistente.eventoId || evento?.id) ? `&evento=${encodeURIComponent(asistente.eventoId || evento?.id)}` : '';
  const verificationUrl = `${detectedOrigin}/?verificar=${encodeURIComponent(asistente.id)}${docParam}${eventParam}${tokenParam}`;

  // Función compartida para renderizar el pase digital en un Canvas de alta definición (2x)
  const generateBadgeCanvas = async () => {
    const card = badgeCardRef.current;
    if (!card) return null;

    const width = 680;
    const height = 1100;

    // Crear canvas con escala 2x para nitidez cristalina
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // Fondo base con gradiente institucional suave
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#FFFFFF');
    bgGrad.addColorStop(1, '#F4F9F5');
    ctx.fillStyle = bgGrad;

    // Borde exterior suavemente redondeado
    ctx.beginPath();
    ctx.roundRect(10, 10, width - 20, height - 20, 24);
    ctx.fill();
    ctx.strokeStyle = '#0F5938';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Franja superior verde UdeA redondeada arriba
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(10, 10, width - 20, 140, [24, 24, 0, 0]);
    ctx.clip();
    ctx.fillStyle = '#0F5938';
    ctx.fillRect(10, 10, width - 20, 140);
    ctx.restore();

    // Franja dorada de acento
    ctx.fillStyle = '#C59B27';
    ctx.fillRect(10, 148, width - 20, 6);

    // Textos de cabecera institucional
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('UNIVERSIDAD DE ANTIOQUIA', width / 2, 55);

    ctx.font = '600 18px "Inter", sans-serif';
    ctx.fillStyle = '#E8F5E9';
    ctx.fillText('Facultad de Medicina', width / 2, 85);

    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.fillStyle = '#C59B27';
    ctx.fillText('EDUCACIÓN A LO LARGO DE LA VIDA • PASE DIGITAL OFICIAL', width / 2, 115);

    // Chip de Pase Digital Activo
    ctx.fillStyle = '#EAFBF0';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 170, 320, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#0F5938';
    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.fillText('● PASE DIGITAL MÓVIL • ASISTENCIA CONFIRMADA', width / 2, 189);

    // Título del Evento
    ctx.fillStyle = '#1A2B21';
    ctx.font = 'bold 18px "Inter", sans-serif';
    const eventTitle = evento.titulo || 'Evento Académico';
    const truncatedTitle = eventTitle.length > 52 ? eventTitle.substring(0, 49) + '...' : eventTitle;
    ctx.fillText(truncatedTitle, width / 2, 230);

    // Fecha y lugar
    ctx.font = '13px "Inter", sans-serif';
    ctx.fillStyle = '#4A5568';
    ctx.fillText(`${evento.fecha || ''} • ${evento.lugar || 'Auditorio UdeA'}`, width / 2, 258);

    // Línea divisoria
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 278);
    ctx.lineTo(width - 40, 278);
    ctx.stroke();

    // Rol / Vinculación Badge
    const isPonente = (asistente.vinculacion || '').includes('Ponente');
    ctx.fillStyle = isPonente ? '#B45309' : '#0F5938';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 140, 298, 280, 32, 16);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px "Inter", sans-serif';
    ctx.fillText((asistente.vinculacion || 'ASISTENTE').toUpperCase(), width / 2, 319);

    // Nombre del participante
    ctx.fillStyle = '#0F5938';
    ctx.font = 'bold 26px "Inter", sans-serif';
    const nombre = asistente.nombreCompleto || 'Participante';
    ctx.fillText(nombre, width / 2, 372);

    // Documento
    ctx.font = '600 16px "Inter", sans-serif';
    ctx.fillStyle = '#2D3748';
    ctx.fillText(`${asistente.tipoDocumento || 'CC'}: ${asistente.documento || ''}`, width / 2, 404);

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
          ctx.roundRect(width / 2 - 125, 435, 250, 250, 16);
          ctx.fill();
          ctx.stroke();

          ctx.drawImage(img, width / 2 - 110, 450, 220, 220);

          // Asegurar que el escudo quede nítido y perfecto en el centro del QR en el Canvas
          const emblemImg = new Image();
          emblemImg.onload = () => {
            ctx.drawImage(emblemImg, width / 2 - 26, 450 + 110 - 26, 52, 52);
            resolve();
          };
          emblemImg.onerror = () => resolve();
          emblemImg.src = ESCUDO_UDEA_QR_BASE64;
        };
        img.onerror = () => resolve();
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
      });
    }

    // Texto descriptivo bajo el QR
    ctx.fillStyle = '#4A5568';
    ctx.font = '600 12px "Inter", sans-serif';
    ctx.fillText('Escanee con la cámara para verificar autenticidad', width / 2, 715);

    // Sello de seguridad y estado
    ctx.fillStyle = '#EAFBF0';
    ctx.strokeStyle = '#86EFAC';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(width / 2 - 200, 735, 400, 75, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#008744';
    ctx.font = 'bold 15px "Inter", sans-serif';
    ctx.fillText('ASISTENCIA OFICIAL CONFIRMADA', width / 2, 762);

    ctx.fillStyle = '#166534';
    ctx.font = '12px "Inter", sans-serif';
    ctx.fillText(`Comprobante: ${asistente.id}`, width / 2, 782);
    ctx.fillText(`Registrado: ${asistente.fechaRegistro || ''}`, width / 2, 798);

    // Código de Barras 1D Code 128 (Escáner de Código de Barras USB)
    try {
      const barcodeCanvas = document.createElement('canvas');
      const barcodeVal = String(asistente.documento || asistente.id || 'UDEA').trim();
      JsBarcode(barcodeCanvas, barcodeVal, {
        format: 'CODE128',
        width: 3.2,
        height: 65,
        displayValue: true,
        fontSize: 18,
        font: 'Inter, sans-serif',
        fontOptions: 'bold',
        textMargin: 6,
        lineColor: '#0F5938',
        background: '#FFFFFF',
        margin: 10
      });

      const bcW = Math.min(barcodeCanvas.width, 460);
      const bcH = (bcW / barcodeCanvas.width) * barcodeCanvas.height;
      const bcX = (width - bcW) / 2;
      const bcY = 828;

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bcX - 12, bcY - 6, bcW + 24, bcH + 12, 10);
      ctx.fill();
      ctx.stroke();

      ctx.drawImage(barcodeCanvas, bcX, bcY, bcW, bcH);

      ctx.fillStyle = '#0F5938';
      ctx.font = '600 11px "Inter", sans-serif';
      ctx.fillText('Código de Barras Oficial • ' + (asistente.tipoDocumento || 'CC') + ' ' + (asistente.documento || ''), width / 2, bcY + bcH + 20);
    } catch (e) {
      console.warn('Error al renderizar código de barras en canvas:', e);
    }

    // Franja inferior institucional redondeada abajo
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(10, height - 90, width - 20, 80, [0, 0, 24, 24]);
    ctx.clip();
    ctx.fillStyle = '#0F5938';
    ctx.fillRect(10, height - 90, width - 20, 80);
    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px "Inter", sans-serif';
    ctx.fillText('Facultad de Medicina • Universidad de Antioquia • Medellín, Colombia', width / 2, height - 52);
    ctx.font = '10px "Inter", sans-serif';
    ctx.fillStyle = '#C59B27';
    ctx.fillText('Pase digital personal e intransferible • Protección de Datos Ley 1581 de 2012', width / 2, height - 32);

    return canvas;
  };

  // Descarga directa en formato PDF Oficial
  const handleDownloadBadgePDF = async () => {
    if (downloading) return;
    setDownloading(true);

    try {
      const canvas = await generateBadgeCanvas();
      if (!canvas) return;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [105, 170] // Dimensiones de pase digital móvil / credencial portátil con código de barras
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 105, 155, undefined, 'FAST');

      const cleanDoc = (asistente.documento || 'UdeA').toString().replace(/[^a-zA-Z0-9]/g, '');
      const eventIdClean = (evento.id || 'EVT').replace(/[^a-zA-Z0-9]/g, '');
      pdf.save(`Pase_Digital_UdeA_${cleanDoc}_${eventIdClean}.pdf`);
    } catch (err) {
      console.error('Error al generar el PDF del pase digital:', err);
      alert('Hubo un inconveniente al generar el PDF. Puedes utilizar la opción de guardar imagen PNG en tu dispositivo.');
    } finally {
      setDownloading(false);
    }
  };

  // Descargar la credencial como imagen PNG de alta definición
  const handleDownloadBadgePNG = async () => {
    if (downloading) return;
    setDownloading(true);

    try {
      const canvas = await generateBadgeCanvas();
      if (!canvas) return;

      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      const cleanDoc = (asistente.documento || 'UdeA').toString().replace(/[^a-zA-Z0-9]/g, '');
      downloadLink.download = `Pase_Digital_UdeA_${cleanDoc}_${evento.id}.png`;
      downloadLink.href = pngUrl;
      downloadLink.click();
    } catch (err) {
      console.error('Error al generar el pase digital en PNG:', err);
    } finally {
      setDownloading(false);
    }
  };

  const badgeContent = (
    <div className="digital-badge-wrapper printable-badge-root">
      <div className="digital-badge-card modern-digital-pass" ref={badgeCardRef}>
        {/* Encabezado Institucional Verde con Logo */}
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

        {/* Indicador de Estado de Pase Digital Móvil */}
        <div className="badge-digital-status-pill">
          <span className="status-live-dot"></span>
          <span>Pase Digital Oficial • Asistencia Confirmada</span>
        </div>

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
              size={145}
              level="H"
              includeMargin={true}
              fgColor="#0F5938"
              bgColor="#FFFFFF"
              imageSettings={{
                src: ESCUDO_UDEA_QR_BASE64,
                x: undefined,
                y: undefined,
                height: 34,
                width: 34,
                excavate: true,
              }}
            />
          </div>
          <span className="badge-qr-caption">
            <Sparkles size={13} /> Escanee con la cámara para validar autenticidad
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
            <span>
              Registrado: {asistente.fechaRegistro}
              {asistente.diaNumero ? ` (Día ${asistente.diaNumero})` : ''}
            </span>
          </div>
        </div>

        {/* Código de Barras 1D Code 128 Oficial (Escáner USB de PC) */}
        <div className="badge-barcode-section">
          <div className="badge-barcode-wrapper">
            <svg ref={barcodeSvgRef} className="badge-barcode-svg"></svg>
          </div>
          <span className="badge-barcode-caption">
            <Barcode size={13} /> Escáner de Código de Barras • Documento {asistente.tipoDocumento || 'CC'}
          </span>
        </div>

        {/* Pie de la Credencial con cierre armónico y márgenes simétricos */}
        <div className="badge-footer-band">
          <p className="badge-footer-inst">Facultad de Medicina • Universidad de Antioquia</p>
          <p className="badge-legal-mini">Pase digital personal e intransferible • Ley 1581 de 2012</p>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container badge-modal-dialog" onClick={(e) => e.stopPropagation()}>
          {/* Encabezado fijo superior */}
          <div className="badge-modal-header no-print">
            <div className="badge-modal-title">
              <ShieldCheck size={20} className="shield-green" />
              <span>Escarapela Digital</span>
            </div>
            <button className="btn-close-modal" onClick={onClose} aria-label="Cerrar credencial">
              <X size={20} />
            </button>
          </div>

          {/* Cuerpo del modal con scroll interno y márgenes generosos */}
          <div className="badge-modal-body">
            {badgeContent}
          </div>

          {/* Barra de Acciones fija en la parte inferior: siempre visible de inmediato */}
          <div className="badge-modal-footer-actions no-print">
            <button
              type="button"
              className="btn-action-pdf-primary"
              onClick={handleDownloadBadgePDF}
              disabled={downloading}
              title="Descargar credencial oficial en formato PDF"
            >
              <FileDown size={17} />
              <span>{downloading ? 'Generando PDF...' : 'Descargar PDF'}</span>
            </button>

            <button
              type="button"
              className="btn-action-png-secondary"
              onClick={handleDownloadBadgePNG}
              disabled={downloading}
              title="Guardar imagen PNG en su teléfono"
            >
              <ImageIcon size={16} />
              <span>Imagen (PNG)</span>
            </button>

            <a
              href={verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-action-verify-ghost"
              title="Probar verificación oficial con cámara"
            >
              <ExternalLink size={15} />
              <span>Probar QR</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {badgeContent}
      <div className="badge-modal-footer-actions inline-actions no-print">
        <button
          type="button"
          className="btn-action-pdf-primary"
          onClick={handleDownloadBadgePDF}
          disabled={downloading}
        >
          <FileDown size={17} />
          <span>{downloading ? 'Generando PDF...' : 'Descargar PDF'}</span>
        </button>
        <button
          type="button"
          className="btn-action-png-secondary"
          onClick={handleDownloadBadgePNG}
          disabled={downloading}
        >
          <ImageIcon size={16} />
          <span>Imagen (PNG)</span>
        </button>
      </div>
    </div>
  );
}
