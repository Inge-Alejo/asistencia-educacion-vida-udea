import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  MapPin,
  Car,
  Calendar,
  Clock,
  User,
  CreditCard,
  Volume2,
  VolumeX,
  RefreshCw,
  Award
} from 'lucide-react';
import jsQR from 'jsqr';
import { verifyAttendanceRecord, getEvents } from '../services/storage';

// Generador de sonido sintético Web Audio API para confirmación auditiva en puerta
function playBeep(isSuccess = true) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isSuccess) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Nota La (A5)
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12); // Octava alta (A6)
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    }
  } catch {
    // AudioContext puede estar restringido por política del navegador hasta el primer clic
  }
}

export default function QRScannerModal({
  isOpen,
  onClose,
  eventoActual,
  onDataUpdated
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameIdRef = useRef(null);

  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [isScanning, setIsScanning] = useState(true);
  const [verificationResult, setVerificationResult] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoResume, setAutoResume] = useState(true);
  const [autoResumeCountdown, setAutoResumeCountdown] = useState(0);

  // Mapa de eventos para referenciar nombres de eventos
  const [eventosMap] = useState(() => {
    try {
      const evs = getEvents();
      const map = {};
      evs.forEach(ev => { map[ev.id] = ev; });
      return map;
    } catch {
      return {};
    }
  });

  // Detener la cámara de manera segura
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Reanudar escaneo para el siguiente participante
  const handleResumeScan = useCallback(() => {
    setVerificationResult(null);
    setAutoResumeCountdown(0);
    setIsScanning(true);
  }, []);

  // Procesar código QR decodificado
  const handleDecodedQR = useCallback(async (rawText) => {
    if (!rawText) return;
    setIsScanning(false);

    let compId = '';
    let token = '';

    try {
      // Caso 1: URL completa: https://.../?verificar=ATT-123&token=abc
      if (rawText.includes('verificar=') || rawText.includes('verify=') || rawText.includes('credencial=')) {
        const urlMatch = rawText.match(/[?&](?:verificar|verify|credencial)=([^&]+)/i);
        if (urlMatch && urlMatch[1]) {
          compId = decodeURIComponent(urlMatch[1]);
        }
        const tokenMatch = rawText.match(/[?&]token=([^&]+)/i);
        if (tokenMatch && tokenMatch[1]) {
          token = decodeURIComponent(tokenMatch[1]);
        }
      } else {
        // Caso 2: Texto directo (ej: ATT-1726543210-9876)
        compId = rawText.trim();
      }

      if (!compId) {
        throw new Error('El código escaneado no contiene un formato de acreditación válido de la Facultad de Medicina UdeA.');
      }

      // Validar registro en la base de datos
      const result = await verifyAttendanceRecord(compId, token);

      if (result.success) {
        if (soundEnabled) playBeep(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([60, 40, 60]); } catch {}
        }
      } else {
        if (soundEnabled) playBeep(false);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([150]); } catch {}
        }
      }

      setVerificationResult({
        ...result,
        scannedAt: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      if (onDataUpdated) onDataUpdated();

      // Si autoResume está habilitado, iniciar cuenta regresiva para escanear al siguiente
      if (autoResume) {
        setAutoResumeCountdown(4);
      }
    } catch (err) {
      if (soundEnabled) playBeep(false);
      setVerificationResult({
        success: false,
        message: err.message || 'Error al validar el código QR escaneado.',
        scannedAt: new Date().toLocaleTimeString('es-CO')
      });
      if (autoResume) {
        setAutoResumeCountdown(4);
      }
    }
  }, [soundEnabled, autoResume, onDataUpdated]);

  // Bucle de escaneo continuo con requestAnimationFrame
  const startScanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          handleDecodedQR(code.data);
          return; // Detiene el bucle hasta reanudar
        }
      }
      animFrameIdRef.current = requestAnimationFrame(tick);
    };

    animFrameIdRef.current = requestAnimationFrame(tick);
  }, [handleDecodedQR]);

  // Iniciar flujo de cámara al abrir o cambiar de lente
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let isMounted = true;

    async function initCamera() {
      stopCamera();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMounted) {
          setCameraError('Su navegador o dispositivo no soporta acceso directo a la cámara web.');
          setHasCameraPermission(false);
        }
        return;
      }

      try {
        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (isMounted) {
            setHasCameraPermission(true);
            setCameraError('');
            startScanLoop();
          }
        }
      } catch (err) {
        if (!isMounted) return;
        setHasCameraPermission(false);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError('Permiso de cámara denegado. Autorice el acceso a la cámara en su navegador para escanear.');
        } else {
          setCameraError('No fue posible activar la cámara: ' + err.message);
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, facingMode, stopCamera, startScanLoop]);

  // Efecto cuando el estado isScanning vuelve a true
  useEffect(() => {
    if (isOpen && isScanning && hasCameraPermission) {
      startScanLoop();
    }
  }, [isOpen, isScanning, hasCameraPermission, startScanLoop]);

  // Manejar cuenta regresiva de auto-reanudación
  useEffect(() => {
    if (isScanning || !autoResume || !verificationResult) return;

    if (autoResumeCountdown > 0) {
      const timer = setTimeout(() => {
        setAutoResumeCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (autoResumeCountdown === 0) {
      const resumeTimer = setTimeout(() => {
        handleResumeScan();
      }, 80);
      return () => clearTimeout(resumeTimer);
    }
  }, [autoResumeCountdown, isScanning, autoResume, verificationResult, handleResumeScan]);

  // Alternar entre cámara frontal y trasera
  const handleToggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  const record = verificationResult?.record;
  const isTargetEvent = record && eventoActual?.id ? record.eventoId === eventoActual.id : true;
  const eventoAsociado = record?.eventoId ? eventosMap[record.eventoId] : null;

  return (
    <div className="modal-overlay qr-scanner-modal-overlay" onClick={onClose}>
      <div className="modal-container qr-scanner-modal-dialog" onClick={(e) => e.stopPropagation()}>
        
        {/* Cabecera del Escáner */}
        <div className="scanner-modal-header">
          <div className="scanner-header-left">
            <div className="scanner-header-icon-wrap">
              <Camera size={22} />
            </div>
            <div>
              <h3 className="scanner-modal-title">Acreditación y Verificación QR en Puerta</h3>
              <p className="scanner-modal-subtitle">
                Facultad de Medicina UdeA {eventoActual ? `• ${eventoActual.titulo}` : ''}
              </p>
            </div>
          </div>

          <div className="scanner-header-actions">
            {/* Control de Sonido */}
            <button
              type="button"
              className={`scanner-tool-btn ${soundEnabled ? 'active' : ''}`}
              onClick={() => setSoundEnabled(prev => !prev)}
              title={soundEnabled ? 'Sonido de confirmación activado' : 'Sonido desactivado'}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            {/* Alternar Cámara Trasera / Frontal */}
            <button
              type="button"
              className="scanner-tool-btn"
              onClick={handleToggleFacingMode}
              title="Cambiar entre cámara trasera y frontal"
            >
              <RefreshCw size={18} />
            </button>

            {/* Cerrar Modal */}
            <button
              type="button"
              className="btn-close-modal"
              onClick={onClose}
              title="Cerrar escáner"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Cuerpo del Visor de la Cámara / Resultados */}
        <div className="scanner-modal-body">
          {/* Canvas oculto para procesamiento de frames de imagen */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Estado de error de cámara */}
          {cameraError && (
            <div className="scanner-camera-error-box">
              <AlertTriangle size={36} className="error-icon" />
              <h4>Acceso a la Cámara No Disponible</h4>
              <p>{cameraError}</p>
              <button
                type="button"
                className="btn-primary"
                onClick={startCamera}
                style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <RefreshCw size={16} />
                <span>Reintentar Conexión</span>
              </button>
            </div>
          )}

          {/* Visor de Video en Vivo mientras se está escaneando */}
          {hasCameraPermission && !cameraError && (
            <div className="scanner-viewport-wrapper">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`scanner-video-element ${!isScanning ? 'paused' : ''}`}
              />

              {/* Mira de Escaneo Láser Animada */}
              {isScanning && (
                <div className="scanner-targeting-overlay">
                  <div className="targeting-box">
                    <span className="corner-bracket top-left" />
                    <span className="corner-bracket top-right" />
                    <span className="corner-bracket bottom-left" />
                    <span className="corner-bracket bottom-right" />
                    <div className="scanner-laser-line" />
                  </div>
                  <p className="scanner-instruction-text">
                    Apunte la cámara hacia el código QR de la credencial o escarapela
                  </p>
                </div>
              )}
            </div>
          )}

          {/* FICHA DE RESULTADOS DE LA VERIFICACIÓN */}
          {verificationResult && (
            <div className={`scanner-result-card ${verificationResult.success ? (isTargetEvent ? 'success' : 'warning') : 'error'}`}>
              
              <div className="result-card-header">
                <div className="result-status-wrap">
                  {verificationResult.success ? (
                    isTargetEvent ? (
                      <>
                        <div className="status-badge-icon green">
                          <CheckCircle2 size={24} />
                        </div>
                        <div>
                          <span className="status-pill-badge green">✓ Pase Digital Oficial Verificado</span>
                          <h4 className="result-attendee-name">{record?.nombreCompleto || 'Participante'}</h4>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="status-badge-icon amber">
                          <AlertTriangle size={24} />
                        </div>
                        <div>
                          <span className="status-pill-badge amber">⚠️ Registrado en Otro Evento</span>
                          <h4 className="result-attendee-name">{record?.nombreCompleto || 'Participante'}</h4>
                        </div>
                      </>
                    )
                  ) : (
                    <>
                      <div className="status-badge-icon red">
                        <AlertTriangle size={24} />
                      </div>
                      <div>
                        <span className="status-pill-badge red">Comprobante No Válido</span>
                        <h4 className="result-attendee-name">Verificación Fallida</h4>
                      </div>
                    </>
                  )}
                </div>

                <span className="result-timestamp">
                  <Clock size={13} />
                  <span>{verificationResult.scannedAt}</span>
                </span>
              </div>

              {verificationResult.success && record ? (
                <div className="result-details-grid">
                  {/* Documento y Vinculación */}
                  <div className="detail-item">
                    <span className="detail-label">
                      <CreditCard size={14} /> Documento de Identidad
                    </span>
                    <span className="detail-value highlight">
                      {record.tipoDocumento || 'CC'} {record.documento}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">
                      <User size={14} /> Vinculación UdeA
                    </span>
                    <span className="detail-value">
                      {record.vinculacion || 'Asistente Académico'}
                    </span>
                  </div>

                  {/* Placa de Vehículo */}
                  <div className="detail-item">
                    <span className="detail-label">
                      <Car size={14} /> Placa Vehicular / Parqueadero
                    </span>
                    <span className={`detail-value ${record.placaVehiculo && record.placaVehiculo !== 'No registrada' ? 'has-plate' : 'no-plate'}`}>
                      {record.placaVehiculo && record.placaVehiculo !== 'No registrada'
                        ? `🚗 ${record.placaVehiculo} (Ingreso Autorizado)`
                        : 'Sin vehículo registrado'}
                    </span>
                  </div>

                  {/* Estado de Presencialidad GPS */}
                  <div className="detail-item">
                    <span className="detail-label">
                      <MapPin size={14} /> Geolocalización en Sede
                    </span>
                    <span className={`detail-value ${record.geolocalizacion?.esPresencial ? 'gps-ok' : 'gps-external'}`}>
                      {record.geolocalizacion?.esPresencial
                        ? `✓ En Sede Facultad (${record.geolocalizacion.distanciaMetros || 0} m)`
                        : 'Registro remoto / GPS no presencial'}
                    </span>
                  </div>

                  {/* Evento Académico */}
                  <div className="detail-item full-span">
                    <span className="detail-label">
                      <Calendar size={14} /> Evento Correspondiente
                    </span>
                    <span className="detail-value">
                      {eventoAsociado?.titulo || record.eventoId || 'Facultad de Medicina UdeA'}
                    </span>
                  </div>

                  {/* Código Comprobante */}
                  <div className="detail-item full-span code-footer">
                    <span className="detail-label">
                      <Award size={14} /> Comprobante Oficial:
                    </span>
                    <span className="code-text">{record.id}</span>
                  </div>
                </div>
              ) : (
                <div className="result-error-message">
                  <p>{verificationResult.message}</p>
                </div>
              )}

              {/* Barra de Acciones y Auto-reanudación */}
              <div className="scanner-result-actions">
                <div className="auto-resume-toggle">
                  <label className="checkbox-label" title="Reanudar la cámara automáticamente tras 4 segundos">
                    <input
                      type="checkbox"
                      checked={autoResume}
                      onChange={(e) => setAutoResume(e.target.checked)}
                    />
                    <span>
                      Reanudar automático {autoResume && autoResumeCountdown > 0 ? `(${autoResumeCountdown}s)` : ''}
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  className="btn-primary-action scanner-next-btn"
                  onClick={handleResumeScan}
                >
                  <RotateCcw size={16} />
                  <span>Escanear Siguiente Asistente</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
