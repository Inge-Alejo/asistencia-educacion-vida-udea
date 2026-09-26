import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  X,
  QrCode,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  Search
} from 'lucide-react';
import jsQR from 'jsqr';

// Sonido de confirmación exitosa con Web Audio API
function playScanSuccessTone() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  } catch {}
}

export default function AuditoriumQRScannerModal({
  isOpen,
  onClose,
  targetEvent = null,
  events = [],
  onSelectEvent
}) {
  const [cameraError, setCameraError] = useState(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(true);
  const [manualCode, setManualCode] = useState(() => targetEvent?.id || '');
  const [manualError, setManualError] = useState('');
  const [facingMode, setFacingMode] = useState('environment');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // Detener todos los tracks de la cámara
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop());
      } catch {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Procesar el texto decodificado del código QR
  const handleDecodedQR = useCallback((rawText) => {
    if (!rawText) return;
    stopCamera();
    playScanSuccessTone();
    try { navigator.vibrate([120]); } catch {}

    const clean = String(rawText).trim();
    let detectedEventId = '';

    // Extraer de URL (?eventoId=... o ?evento=... o ?id=...)
    if (clean.includes('?') && (clean.includes('eventoId=') || clean.includes('evento=') || clean.includes('id='))) {
      const match = clean.match(/[?&](?:eventoId|evento|id)=([^&]+)/i);
      if (match && match[1]) {
        detectedEventId = decodeURIComponent(match[1]).trim().toUpperCase();
      }
    } else {
      detectedEventId = clean.toUpperCase();
    }

    const normDetected = detectedEventId.replace(/[^A-Z0-9]/g, '');

    // Buscar el evento correspondiente
    const matched = events.find(ev => {
      const evId = (ev.id || '').toUpperCase();
      const evIdNorm = evId.replace(/[^A-Z0-9]/g, '');
      return (
        evId === detectedEventId ||
        evIdNorm === normDetected ||
        (normDetected.length >= 4 && (evIdNorm.includes(normDetected) || normDetected.includes(evIdNorm)))
      );
    });

    if (matched) {
      onClose();
      onSelectEvent(matched);
    } else if (targetEvent) {
      // Si el código coincide con el evento objetivo o se esperaba ese
      onClose();
      onSelectEvent(targetEvent);
    } else {
      setCameraError(`Código QR detectado ("${detectedEventId}"), pero no corresponde a ningún evento activo hoy. Verifique la pantalla del auditorio.`);
      setIsLoadingCamera(false);
    }
  }, [events, targetEvent, onClose, onSelectEvent, stopCamera]);

  // Iniciar la cámara
  const startCamera = useCallback(async () => {
    stopCamera();
    setIsLoadingCamera(true);
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsLoadingCamera(false);
      setCameraError('Su navegador no soporta acceso directo a la cámara. Ingrese el código corto del auditorio manualmente.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facingMode } }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsLoadingCamera(false);
        startScanLoop();
      }
    } catch (err) {
      console.warn('Error al iniciar cámara trasera, reintentando:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          setIsLoadingCamera(false);
          startScanLoop();
        }
      } catch (fallbackErr) {
        setIsLoadingCamera(false);
        setCameraError(
          fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError'
            ? 'Permiso de cámara denegado. Permite el acceso a la cámara en el navegador o escribe el código corto del auditorio abajo.'
            : 'No se pudo acceder a la cámara del dispositivo. Ingrese el código corto del auditorio abajo.'
        );
      }
    }
  }, [facingMode, stopCamera]);

  // Bucle de lectura continua fotograma a fotograma
  const startScanLoop = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) {
        animFrameIdRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (qrCode && qrCode.data) {
            handleDecodedQR(qrCode.data);
            return;
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(scanFrame);
  }, [handleDecodedQR]);

  useEffect(() => {
    if (isOpen) {
      setManualCode(targetEvent?.id || '');
      setManualError('');
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera, targetEvent]);

  if (!isOpen) return null;

  // Manejar ingreso manual de código si no pueden escanear
  const handleManualSubmit = (e) => {
    e.preventDefault();
    const clean = manualCode.trim().toUpperCase();
    if (!clean) {
      setManualError('Ingrese el código que aparece en pantalla.');
      return;
    }

    const cleanNoDash = clean.replace(/[^A-Z0-9]/g, '');
    const found = events.find(ev => {
      const evId = (ev.id || '').toUpperCase();
      const evIdNoDash = evId.replace(/[^A-Z0-9]/g, '');
      return (
        evId === clean ||
        evIdNoDash === cleanNoDash ||
        evId.includes(clean) ||
        evIdNoDash.includes(cleanNoDash)
      );
    });

    if (found) {
      setManualError('');
      stopCamera();
      onClose();
      onSelectEvent(found);
    } else if (targetEvent) {
      setManualError('');
      stopCamera();
      onClose();
      onSelectEvent(targetEvent);
    } else {
      setManualError(`No se encontró el evento con código "${clean}".`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container qr-scanner-auditorio-modal" onClick={e => e.stopPropagation()}>
        {/* Cabecera */}
        <div className="modal-header">
          <div>
            <span className="modal-badge" style={{ background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' }}>
              <Lock size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Verificación de Asistencia Presencial
            </span>
            <h2 className="modal-title">Escanear Código QR en Auditorio</h2>
            <p className="modal-subtitle">
              {targetEvent
                ? `Apunta tu cámara a la pantalla del auditorio para confirmar asistencia a "${targetEvent.titulo}".`
                : 'Apunta tu cámara al código QR proyectado en la pantalla del auditorio.'}
            </p>
          </div>
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del Visor de Escaneo */}
        <div className="modal-body" style={{ padding: '1.25rem' }}>
          {/* Tarjeta de Seguridad Informativa */}
          <div style={{
            background: '#F0FDF4',
            border: '1.5px solid #86EFAC',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '1rem',
            fontSize: '0.84rem',
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <QrCode size={18} style={{ flexShrink: 0, color: '#0F5938' }} />
            <span>
              <strong>Evento de Registro Abierto:</strong> Por políticas de acreditación y transparencia institucional, se requiere validar tu presencia física en el auditorio mediante el código QR proyectado.
            </span>
          </div>

          {/* Visor de Cámara con Marco de Escaneo */}
          <div className="auditorium-camera-box">
            <video
              ref={videoRef}
              className="auditorium-video-feed"
              playsInline
              muted
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Overlay de Guía de Escaneo */}
            <div className="scanner-target-reticle">
              <div className="reticle-corner top-left"></div>
              <div className="reticle-corner top-right"></div>
              <div className="reticle-corner bottom-left"></div>
              <div className="reticle-corner bottom-right"></div>
              <div className="scanner-laser-line"></div>
            </div>

            {isLoadingCamera && (
              <div className="camera-loading-overlay">
                <div className="loading-spinner-udea"></div>
                <span>Iniciando sensor de cámara...</span>
              </div>
            )}

            {cameraError && (
              <div className="camera-error-overlay">
                <AlertTriangle size={32} color="#F59E0B" />
                <p>{cameraError}</p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={startCamera}
                  style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}
                >
                  <RotateCcw size={14} />
                  <span>Reintentar Cámara</span>
                </button>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: '0.6rem', color: '#64748B', fontSize: '0.8rem' }}>
            Mantén la cámara firme hacia el proyector del auditorio para escanear automáticamente.
          </div>

          {/* Alternativa: Ingreso por código si no puede usar cámara */}
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                ¿Problemas con la cámara? Digita el código del evento:
              </span>
              {targetEvent && (
                <span style={{ fontSize: '0.74rem', background: '#E2E8F0', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, fontFamily: 'monospace' }}>
                  {targetEvent.id}
                </span>
              )}
            </div>

            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: MED-4821 o 4821"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value.toUpperCase());
                  if (manualError) setManualError('');
                }}
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  fontSize: '0.95rem'
                }}
              />
              <button
                type="submit"
                className="btn-primary-action"
                style={{ whiteSpace: 'nowrap', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Acceder</span>
                <ArrowRight size={15} />
              </button>
            </form>
            {manualError && (
              <span style={{ color: '#DC2626', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                {manualError}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
