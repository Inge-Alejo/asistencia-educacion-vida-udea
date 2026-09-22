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
  Award,
  Loader2
} from 'lucide-react';
import jsQR from 'jsqr';
import { verifyAttendanceRecord, getEvents } from '../services/storage';

// Generador de audio sintetizado: Pop Suave moderno para confirmación y tono sutil de advertencia
function playPopSound(isSuccess = true) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    if (isSuccess) {
      // Pop suave y orgánico (barrido 440 Hz -> 920 Hz con decaimiento percusivo agradable)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.06);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } else {
      // Tono suave de advertencia para credencial no válida
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(370, now); // F#4
      osc1.frequency.setValueAtTime(293.66, now + 0.1); // D4

      osc2.frequency.setValueAtTime(185, now);
      osc2.frequency.setValueAtTime(146.83, now + 0.1);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);
    }
  } catch {
    // AudioContext silencioso en caso de restricciones del navegador
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

  const [isLoadingCamera, setIsLoadingCamera] = useState(true);
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

  // Detener la cámara y sus tracks de hardware
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      } catch {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Reanudar escaneo para el siguiente asistente
  const handleResumeScan = useCallback(() => {
    setVerificationResult(null);
    setAutoResumeCountdown(0);
    setIsScanning(true);
  }, []);

  // Procesar código QR detectado
  const handleDecodedQR = useCallback(async (rawText) => {
    if (!rawText) return;
    setIsScanning(false);

    let compId = '';
    let token = '';

    try {
      // Caso 1: Formato URL (?verificar=ATT-123&token=xyz)
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
        // Caso 2: Texto o ID directo (ATT-1726543210-9876)
        compId = rawText.trim();
      }

      if (!compId) {
        throw new Error('El código QR escaneado no corresponde a una credencial válida de la Facultad de Medicina UdeA.');
      }

      // Validar registro en storage (Firestore / Local)
      const result = await verifyAttendanceRecord(compId, token);

      if (result.success) {
        if (soundEnabled) playPopSound(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([60, 40, 60]); } catch {}
        }
      } else {
        if (soundEnabled) playPopSound(false);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([160]); } catch {}
        }
      }

      setVerificationResult({
        ...result,
        scannedAt: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      if (onDataUpdated) onDataUpdated();

      // Temporizador de 10 segundos para continuar escaneando
      if (autoResume) {
        setAutoResumeCountdown(10);
      }
    } catch (err) {
      if (soundEnabled) playPopSound(false);
      setVerificationResult({
        success: false,
        message: err.message || 'Error al validar el código QR escaneado.',
        scannedAt: new Date().toLocaleTimeString('es-CO')
      });
      if (autoResume) {
        setAutoResumeCountdown(10);
      }
    }
  }, [soundEnabled, autoResume, onDataUpdated]);

  // Bucle de escaneo fotograma a fotograma
  const startScanLoop = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) {
        animFrameIdRef.current = requestAnimationFrame(tick);
        return;
      }

      // Verificar que el video tenga dimensiones y datos listos
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
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            handleDecodedQR(code.data);
            return; // Detener bucle hasta que se reanude
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(tick);
    };

    animFrameIdRef.current = requestAnimationFrame(tick);
  }, [handleDecodedQR]);

  // Función principal para iniciar la cámara compatible con iOS Safari y Android
  const startCamera = useCallback(async () => {
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsLoadingCamera(false);
      setHasCameraPermission(false);
      setCameraError('Su navegador no permite el acceso a la cámara. Por favor use Safari en iOS o Chrome en Android con conexión HTTPS.');
      return;
    }

    // Variantes de configuración en cascada para compatibilidad total
    const constraintsList = [
      {
        audio: false,
        video: {
          facingMode: facingMode === 'user' ? 'user' : { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      },
      {
        audio: false,
        video: {
          facingMode: facingMode === 'user' ? 'user' : 'environment'
        }
      },
      {
        audio: false,
        video: true
      }
    ];

    let stream = null;
    let finalError = null;

    for (const constraints of constraintsList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {
        finalError = err;
      }
    }

    if (!stream) {
      setIsLoadingCamera(false);
      setHasCameraPermission(false);
      if (finalError?.name === 'NotAllowedError' || finalError?.name === 'PermissionDeniedError') {
        setCameraError('Permiso de cámara denegado. En iOS vaya a Ajustes > Safari > Cámara > Permitir. En Android autorice el permiso del sitio.');
      } else {
        setCameraError(`No se pudo activar la cámara: ${finalError?.message || 'Dispositivo no disponible'}`);
      }
      return;
    }

    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) {
      setIsLoadingCamera(false);
      return;
    }

    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.setAttribute('muted', 'true');
    video.muted = true;
    video.srcObject = stream;

    const onPlayReady = async () => {
      try {
        await video.play();
      } catch (e) {
        console.warn('Video play deferred:', e);
      }
      setIsLoadingCamera(false);
      setHasCameraPermission(true);
      setCameraError('');
      startScanLoop();
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      onPlayReady();
    } else {
      video.onloadedmetadata = () => {
        onPlayReady();
      };
      setTimeout(() => {
        if (streamRef.current) {
          onPlayReady();
        }
      }, 500);
    }
  }, [facingMode, stopCamera, startScanLoop]);

  // Inicializar cámara cuando el modal se abre
  useEffect(() => {
    let active = true;

    if (isOpen) {
      const timer = setTimeout(() => {
        if (active) {
          setIsLoadingCamera(true);
          setCameraError('');
          startCamera();
        }
      }, 0);

      return () => {
        active = false;
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }

    return () => {
      active = false;
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Reanudar escaneo cuando el estado isScanning vuelve a ser true
  useEffect(() => {
    if (isOpen && isScanning && hasCameraPermission) {
      startScanLoop();
    }
  }, [isOpen, isScanning, hasCameraPermission, startScanLoop]);

  // Temporizador de auto-reanudación tras escaneo exitoso (10 segundos)
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

  // Alternar entre cámara trasera y frontal
  const handleToggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  const record = verificationResult?.record;
  const isTargetEvent = record && eventoActual?.id ? record.eventoId === eventoActual.id : true;
  const eventoAsociado = record?.eventoId ? eventosMap[record.eventoId] : null;

  return (
    <div className="modal-overlay qr-scanner-modal-overlay" onClick={onClose}>
      <div
        className="qr-scanner-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera del Escáner */}
        <div className="scanner-modal-header">
          <div className="scanner-header-left">
            <div className="scanner-header-icon-wrap">
              <Camera size={22} />
            </div>
            <div>
              <h3 className="scanner-modal-title">Acreditación y Verificación QR en Puerta</h3>
              <p className="scanner-modal-subtitle">
                Facultad de Medicina UdeA {eventoActual?.titulo ? `• ${eventoActual.titulo}` : ''}
              </p>
            </div>
          </div>

          <div className="scanner-header-actions">
            {/* Control de Sonido */}
            <button
              type="button"
              className={`scanner-tool-btn ${soundEnabled ? 'active' : ''}`}
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playPopSound(true);
              }}
              title={soundEnabled ? 'Silenciar sonido' : 'Activar sonido Pop'}
              aria-label="Alternar sonido"
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            {/* Alternar Cámara Trasera / Frontal */}
            <button
              type="button"
              className="scanner-tool-btn"
              onClick={handleToggleFacingMode}
              title="Cambiar entre cámara trasera y frontal"
              aria-label="Cambiar cámara"
            >
              <RefreshCw size={18} />
            </button>

            {/* Cerrar Modal */}
            <button
              type="button"
              className="scanner-tool-btn scanner-close-btn"
              onClick={onClose}
              title="Cerrar escáner"
              aria-label="Cerrar ventana"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Cuerpo del Visor de la Cámara / Resultados */}
        <div className="scanner-modal-body">
          {/* Canvas oculto para decodificación de imagen */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Visor de Video en Vivo: SIEMPRE montado para mantener la referencia */}
          <div className="scanner-viewport-wrapper">
            <video
              ref={videoRef}
              playsInline
              webkit-playsinline="true"
              autoPlay
              muted
              className={`scanner-video-element ${!isScanning ? 'paused' : ''}`}
            />

            {/* Indicador de Carga mientras la cámara inicia en iOS/Android */}
            {isLoadingCamera && !cameraError && (
              <div className="scanner-loading-overlay">
                <Loader2 size={36} className="spinner-rotate" />
                <span>Iniciando sensor de cámara...</span>
                <small>Permita el acceso si su navegador lo solicita</small>
              </div>
            )}

            {/* Error de Permiso de Cámara */}
            {cameraError && (
              <div className="scanner-camera-error-box">
                <AlertTriangle size={36} className="error-icon" />
                <h4>Cámara No Disponible</h4>
                <p>{cameraError}</p>
                <button
                  type="button"
                  className="btn-retry-camera"
                  onClick={startCamera}
                >
                  <RefreshCw size={16} />
                  <span>Reintentar Acceso</span>
                </button>
              </div>
            )}

            {/* Mira y Guía Láser de Escaneo */}
            {isScanning && !isLoadingCamera && !cameraError && (
              <div className="scanner-targeting-overlay">
                <div className="targeting-box">
                  <span className="corner-bracket top-left" />
                  <span className="corner-bracket top-right" />
                  <span className="corner-bracket bottom-left" />
                  <span className="corner-bracket bottom-right" />
                  <div className="scanner-laser-line" />
                </div>
                <p className="scanner-instruction-text">
                  Apunte la cámara al código QR de la escarapela digital
                </p>
              </div>
            )}
          </div>

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
                          <span className="status-pill-badge green">Pase Digital Verificado</span>
                          <h4 className="result-attendee-name">{record?.nombreCompleto || 'Participante'}</h4>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="status-badge-icon amber">
                          <AlertTriangle size={24} />
                        </div>
                        <div>
                          <span className="status-pill-badge amber">Registrado en Otro Evento</span>
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
                  {/* Documento */}
                  <div className="detail-item">
                    <span className="detail-label">
                      <CreditCard size={14} /> Documento de Identidad
                    </span>
                    <span className="detail-value highlight">
                      {record.tipoDocumento || 'CC'} {record.documento || record.documentoMasked || 'N/A'}
                    </span>
                  </div>

                  {/* Vinculación */}
                  <div className="detail-item">
                    <span className="detail-label">
                      <User size={14} /> Vinculación UdeA
                    </span>
                    <span className="detail-value">
                      {record.vinculacion || 'Asistente Académico'}
                    </span>
                  </div>

                  {/* Placa Vehicular */}
                  <div className="detail-item">
                    <span className="detail-label">
                      <Car size={14} /> Placa Vehicular / Parqueadero
                    </span>
                    <span className={`detail-value ${record.placaVehiculo && record.placaVehiculo !== 'No registrada' ? 'has-plate' : 'no-plate'}`}>
                      {record.placaVehiculo && record.placaVehiculo !== 'No registrada'
                        ? `${record.placaVehiculo} (Autorizado)`
                        : 'Sin vehículo registrado'}
                    </span>
                  </div>

                  {/* Geolocalización */}
                  <div className="detail-item">
                    <span className="detail-label">
                      <MapPin size={14} /> Geolocalización en Sede
                    </span>
                    <span className={`detail-value ${record.geolocalizacion?.esPresencial ? 'gps-ok' : 'gps-external'}`}>
                      {record.geolocalizacion?.esPresencial
                        ? `En Sede (${record.geolocalizacion.distanciaMetros || 0} m)`
                        : 'Registro remoto / Fuera de sede'}
                    </span>
                  </div>

                  {/* Evento */}
                  <div className="detail-item full-span">
                    <span className="detail-label">
                      <Calendar size={14} /> Evento Académico
                    </span>
                    <span className="detail-value">
                      {eventoAsociado?.titulo || record.eventoId || 'Facultad de Medicina UdeA'}
                    </span>
                  </div>

                  {/* Comprobante ID */}
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

              {/* Acciones del Resultado con Temporizador de 10 Segundos */}
              <div className="scanner-result-actions">
                <div className="auto-resume-toggle">
                  <label className="checkbox-label" title="Reanudar la cámara automáticamente tras 10 segundos">
                    <input
                      type="checkbox"
                      checked={autoResume}
                      onChange={(e) => setAutoResume(e.target.checked)}
                    />
                    <span>
                      Continuar escaneando {autoResume && autoResumeCountdown > 0 ? `(${autoResumeCountdown}s)` : ''}
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
