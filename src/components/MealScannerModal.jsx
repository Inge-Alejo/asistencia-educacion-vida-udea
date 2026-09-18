import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Camera,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  User,
  CreditCard,
  Volume2,
  VolumeX,
  RefreshCw,
  Award,
  Loader2,
  UtensilsCrossed,
  Coffee,
  Clock,
  Search,
  Check
} from 'lucide-react';
import jsQR from 'jsqr';
import {
  verifyAttendanceRecord,
  checkMealAlreadyClaimed,
  recordMealDelivery,
  normalizeDocumentId
} from '../services/storage';

// Generador de audio sintetizado para confirmaciones positivas y alertas de duplicado
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
      // Tono dulce de éxito (440 Hz -> 920 Hz)
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
      // Tono de advertencia / ya reclamado (acorde menor descendente)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(370, now);
      osc1.frequency.setValueAtTime(261.63, now + 0.12);

      osc2.frequency.setValueAtTime(185, now);
      osc2.frequency.setValueAtTime(130.81, now + 0.12);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    }
  } catch {
    // AudioContext silencioso si hay restricciones de navegador
  }
}

export default function MealScannerModal({
  isOpen,
  onClose,
  eventoActual,
  asistencias = [],
  entregasComidas = [],
  onDataUpdated
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // Lista de comidas configuradas en el evento
  const comidasDisponibles = useMemo(() => {
    if (Array.isArray(eventoActual?.comidasConfig) && eventoActual.comidasConfig.length > 0) {
      return eventoActual.comidasConfig;
    }
    return [
      { id: 'comida-1', nombre: 'Refrigerio Mañana', horario: '09:30 - 10:30' },
      { id: 'comida-2', nombre: 'Almuerzo Institucional', horario: '12:30 - 14:00' },
      { id: 'comida-3', nombre: 'Refrigerio Tarde', horario: '16:00 - 17:00' }
    ];
  }, [eventoActual]);

  // Comida activa seleccionada por el operador para entregar
  const [selectedMealId, setSelectedMealId] = useState(() => comidasDisponibles[0]?.id || 'comida-1');
  const selectedMeal = useMemo(() => {
    return comidasDisponibles.find(c => c.id === selectedMealId) || comidasDisponibles[0];
  }, [comidasDisponibles, selectedMealId]);

  // Conteo de entregas de la comida activa seleccionada
  const conteoComidaActual = useMemo(() => {
    const entregadas = entregasComidas.filter(
      e => e.eventoId === eventoActual?.id && e.comidaId === selectedMeal?.id
    ).length;
    const totalAsistentes = asistencias.filter(a => a.eventoId === eventoActual?.id).length;
    return { entregadas, totalAsistentes };
  }, [entregasComidas, eventoActual?.id, selectedMeal?.id, asistencias]);

  // Estados de la cámara y escaneo
  const [isLoadingCamera, setIsLoadingCamera] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [isScanning, setIsScanning] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoResume, setAutoResume] = useState(true);
  const [autoResumeCountdown, setAutoResumeCountdown] = useState(null);

  // Resultado del último escaneo
  // { status: 'SUCCESS' | 'ALREADY_CLAIMED' | 'NOT_FOUND' | 'ERROR', message, attendee, meal, claimedAt }
  const [scanResult, setScanResult] = useState(null);

  // Entrega manual por número de documento
  const [manualDocInput, setManualDocInput] = useState('');
  const [manualProcessing, setManualProcessing] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  // Detener cámara
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Procesar entrega de comida para un participante
  const processMealDelivery = useCallback(async (attendee, compId = null, method = 'QR_CAMERA') => {
    if (!attendee || !attendee.documento) {
      setScanResult({
        status: 'NOT_FOUND',
        message: 'No se encontraron datos válidos del participante.',
        scannedAt: new Date().toLocaleTimeString('es-CO')
      });
      if (soundEnabled) playPopSound(false);
      return;
    }

    if (!selectedMeal) {
      setScanResult({
        status: 'ERROR',
        message: 'No hay ninguna comida seleccionada para entregar.',
        scannedAt: new Date().toLocaleTimeString('es-CO')
      });
      if (soundEnabled) playPopSound(false);
      return;
    }

    // 1. Verificación directa contra Cloud Firestore y caché local para detectar si YA fue reclamado
    const check = await checkMealAlreadyClaimed(eventoActual.id, selectedMeal.id, attendee.documento);

    if (check.claimed) {
      if (soundEnabled) playPopSound(false);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([180, 80, 180]); } catch {}
      }

      setScanResult({
        status: 'ALREADY_CLAIMED',
        attendee,
        meal: selectedMeal,
        previousClaim: check.record,
        message: `Este beneficio ya fue entregado a este participante.`,
        scannedAt: new Date().toLocaleTimeString('es-CO')
      });

      if (autoResume) {
        setAutoResumeCountdown(4);
      }
      return;
    }

    // 2. Si no ha sido reclamado, registrar en Cloud Firestore y caché local
    const saveRes = await recordMealDelivery({
      eventoId: eventoActual.id,
      comidaId: selectedMeal.id,
      comidaNombre: selectedMeal.nombre,
      documento: attendee.documento,
      nombreCompleto: attendee.nombreCompleto || 'Participante Acreditado',
      tipoDocumento: attendee.tipoDocumento || 'CC',
      vinculacion: attendee.vinculacion || 'Asistente',
      comprobanteId: compId || attendee.id || 'N/A',
      operador: 'Personal de Logística UdeA',
      metodo: method
    });

    if (saveRes.success) {
      if (soundEnabled) playPopSound(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([60, 40, 60]); } catch {}
      }

      setScanResult({
        status: 'SUCCESS',
        attendee,
        meal: selectedMeal,
        delivery: saveRes.record,
        message: `¡${selectedMeal.nombre} entregado exitosamente!`,
        scannedAt: new Date().toLocaleTimeString('es-CO')
      });

      if (onDataUpdated) onDataUpdated();

      if (autoResume) {
        setAutoResumeCountdown(3);
      }
    } else {
      if (soundEnabled) playPopSound(false);
      setScanResult({
        status: saveRes.alreadyClaimed ? 'ALREADY_CLAIMED' : 'ERROR',
        attendee,
        meal: selectedMeal,
        previousClaim: saveRes.record,
        message: saveRes.message || 'Error al registrar la entrega de la comida.',
        scannedAt: new Date().toLocaleTimeString('es-CO')
      });

      if (autoResume) {
        setAutoResumeCountdown(4);
      }
    }
  }, [eventoActual?.id, selectedMeal, soundEnabled, autoResume, onDataUpdated]);

  // Manejar decodificación del código QR
  const handleDecodedQR = useCallback(async (rawText) => {
    if (!rawText || !rawText.trim()) return;

    setIsScanning(false);

    try {
      let compId = '';
      let token = null;

      // Caso 1: URL de verificación institucional (/?verificar=ATT-xxx&token=yyy)
      if (rawText.includes('verificar=')) {
        try {
          const urlObj = new URL(rawText, window.location.origin);
          compId = urlObj.searchParams.get('verificar') || '';
          token = urlObj.searchParams.get('token') || null;
        } catch {
          const matchId = rawText.match(/[?&]verificar=([^&]+)/);
          if (matchId) compId = decodeURIComponent(matchId[1]);
          const matchTok = rawText.match(/[?&]token=([^&]+)/);
          if (matchTok) token = decodeURIComponent(matchTok[1]);
        }
      } else {
        compId = rawText.trim();
      }

      if (!compId) {
        throw new Error('El código QR escaneado no contiene un formato de escarapela válido.');
      }

      // 1. Buscar primero en la lista de asistencias del evento en memoria
      const cleanCompId = compId.trim();
      let foundAttendee = asistencias.find(
        a => a.eventoId === eventoActual?.id && (
          a.id === cleanCompId ||
          normalizeDocumentId(a.documento) === normalizeDocumentId(cleanCompId)
        )
      );

      // 2. Si no se encontró en memoria, consultar la verificación oficial en Cloud Firestore
      if (!foundAttendee) {
        const verifyRes = await verifyAttendanceRecord(cleanCompId, token);
        if (verifyRes.success && verifyRes.record) {
          foundAttendee = verifyRes.record;
        }
      }

      if (!foundAttendee) {
        throw new Error(`El código (${cleanCompId}) no corresponde a un asistente registrado en este evento.`);
      }

      // Procesar la entrega con el asistente identificado
      await processMealDelivery(foundAttendee, cleanCompId, 'QR_CAMERA');

    } catch (err) {
      if (soundEnabled) playPopSound(false);
      setScanResult({
        status: 'NOT_FOUND',
        message: err.message || 'Error al validar el código QR escaneado.',
        scannedAt: new Date().toLocaleTimeString('es-CO')
      });
      if (autoResume) {
        setAutoResumeCountdown(4);
      }
    }
  }, [asistencias, eventoActual?.id, processMealDelivery, soundEnabled, autoResume]);

  // Bucle de lectura de fotogramas del canvas
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
            return;
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(tick);
    };

    animFrameIdRef.current = requestAnimationFrame(tick);
  }, [handleDecodedQR]);

  // Iniciar la cámara
  const startCamera = useCallback(async () => {
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsLoadingCamera(false);
      setHasCameraPermission(false);
      setCameraError('Tu navegador no soporta acceso a la cámara o el sitio no se encuentra bajo HTTPS seguro.');
      return;
    }

    setIsLoadingCamera(true);
    setCameraError('');

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
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();

        setIsLoadingCamera(false);
        setHasCameraPermission(true);
        setIsScanning(true);
        startScanLoop();
      }
    } catch (err) {
      console.warn('Error accediendo a cámara con facingMode ideal, intentando fallback básico:', err);
      try {
        const streamFallback = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = streamFallback;
        if (videoRef.current) {
          videoRef.current.srcObject = streamFallback;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();

          setIsLoadingCamera(false);
          setHasCameraPermission(true);
          setIsScanning(true);
          startScanLoop();
        }
      } catch (finalErr) {
        setIsLoadingCamera(false);
        setHasCameraPermission(false);
        if (finalErr.name === 'NotAllowedError' || finalErr.name === 'PermissionDeniedError') {
          setCameraError('Permiso denegado. Habilita el acceso a la cámara en los permisos de tu navegador o celular.');
        } else if (finalErr.name === 'NotFoundError' || finalErr.name === 'DevicesNotFoundError') {
          setCameraError('No se encontró ninguna cámara disponible en este dispositivo.');
        } else {
          setCameraError(`No fue posible activar la cámara: ${finalErr.message || 'Error de hardware o permisos'}`);
        }
      }
    }
  }, [facingMode, startScanLoop, stopCamera]);

  // Reanudar escaneo para el siguiente participante
  const handleResumeScanning = useCallback(() => {
    setAutoResumeCountdown(null);
    setScanResult(null);
    setIsScanning(true);
    startScanLoop();
  }, [startScanLoop]);

  // Manejar cuenta regresiva de auto-resume
  useEffect(() => {
    if (autoResumeCountdown === null) return;
    if (autoResumeCountdown <= 0) {
      handleResumeScanning();
      return;
    }

    const timer = setTimeout(() => {
      setAutoResumeCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoResumeCountdown, handleResumeScanning]);

  // Control del ciclo de vida de la cámara al abrir o cerrar el modal
  useEffect(() => {
    if (isOpen) {
      setScanResult(null);
      setAutoResumeCountdown(null);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Cambiar cámara frontal / trasera
  const handleToggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Entrega manual por número de documento
  const handleManualDeliver = async (e) => {
    e?.preventDefault();
    const cleanDoc = normalizeDocumentId(manualDocInput);
    if (!cleanDoc) return;

    setManualProcessing(true);

    // Buscar en asistencias del evento
    const attendee = asistencias.find(
      a => a.eventoId === eventoActual?.id && normalizeDocumentId(a.documento) === cleanDoc
    );

    if (attendee) {
      await processMealDelivery(attendee, null, 'MANUAL');
      setManualDocInput('');
    } else {
      if (soundEnabled) playPopSound(false);
      setScanResult({
        status: 'NOT_FOUND',
        message: `El documento ${cleanDoc} no figura como asistente registrado en este evento.`,
        scannedAt: new Date().toLocaleTimeString('es-CO')
      });
      if (autoResume) {
        setAutoResumeCountdown(4);
      }
    }

    setManualProcessing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay meal-scanner-overlay" onClick={onClose}>
      <div
        className="modal-container meal-scanner-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Escáner */}
        <div className="meal-scanner-header">
          <div className="meal-scanner-header-info">
            <div className="meal-badge-title">
              <UtensilsCrossed size={18} />
              <span>Control de Entrega de Alimentos</span>
            </div>
            <h2 className="meal-event-title">{eventoActual?.titulo || 'Evento Académico'}</h2>
          </div>
          <button className="btn-close-modal" onClick={onClose} title="Cerrar Escáner">
            <X size={20} />
          </button>
        </div>

        {/* Barra de Selección de Comida / Refrigerio Activo */}
        <div className="meal-selector-bar">
          <label className="meal-selector-label">
            <Coffee size={15} />
            <span>Selecciona qué comida estás entregando:</span>
          </label>
          <div className="meal-chips-list">
            {comidasDisponibles.map((comida) => {
              const isSelected = comida.id === selectedMeal?.id;
              const deliveredCount = entregasComidas.filter(
                e => e.eventoId === eventoActual?.id && e.comidaId === comida.id
              ).length;
              return (
                <button
                  key={comida.id}
                  type="button"
                  className={`meal-chip-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedMealId(comida.id);
                    setScanResult(null);
                    setAutoResumeCountdown(null);
                    if (!isScanning) handleResumeScanning();
                  }}
                >
                  <span className="meal-chip-name">{comida.nombre}</span>
                  {comida.horario && <span className="meal-chip-time">{comida.horario}</span>}
                  <span className="meal-chip-badge">{deliveredCount} entregados</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Resumen KPI de la comida activa */}
        <div className="meal-kpi-strip">
          <div className="meal-kpi-item">
            <span className="meal-kpi-sub">Comida en Curso:</span>
            <strong className="meal-kpi-val" style={{ color: '#006633' }}>{selectedMeal?.nombre}</strong>
          </div>
          <div className="meal-kpi-item">
            <span className="meal-kpi-sub">Raciones Entregadas:</span>
            <strong className="meal-kpi-val">
              {conteoComidaActual.entregadas} / {conteoComidaActual.totalAsistentes}
            </strong>
          </div>
          <div className="meal-kpi-item">
            <span className="meal-kpi-sub">Pendientes:</span>
            <strong className="meal-kpi-val" style={{ color: '#D97706' }}>
              {Math.max(0, conteoComidaActual.totalAsistentes - conteoComidaActual.entregadas)}
            </strong>
          </div>
        </div>

        {/* Área del Escáner con Video */}
        <div className="meal-viewport-section">
          {isLoadingCamera && (
            <div className="scanner-loading-view">
              <Loader2 size={36} className="spinner-icon" color="#006633" />
              <span>Conectando cámara del celular...</span>
            </div>
          )}

          {cameraError && (
            <div className="scanner-error-view">
              <AlertTriangle size={36} color="#DC2626" />
              <p>{cameraError}</p>
              <button type="button" className="btn-primary-action" onClick={startCamera}>
                <RefreshCw size={15} />
                <span>Reintentar Conexión</span>
              </button>
            </div>
          )}

          {/* Video Stream & Canvas Oculto */}
          <div className={`scanner-video-wrapper ${!isScanning ? 'paused' : ''}`}>
            <video ref={videoRef} className="scanner-video-feed" playsInline muted />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Guía visual del visor QR */}
            {isScanning && !isLoadingCamera && !cameraError && (
              <div className="scanner-crosshair-overlay">
                <div className="scanner-bracket top-left"></div>
                <div className="scanner-bracket top-right"></div>
                <div className="scanner-bracket bottom-left"></div>
                <div className="scanner-bracket bottom-right"></div>
                <div className="scanner-laser-line"></div>
                <span className="scanner-guide-text">Apunta al código QR de la escarapela</span>
              </div>
            )}

            {/* Tarjeta Flotante con Resultado del Escaneo */}
            {scanResult && (
              <div className={`meal-scan-result-card ${scanResult.status.toLowerCase()} animated-step`}>
                {scanResult.status === 'SUCCESS' && (
                  <div className="result-content-wrap success">
                    <div className="result-icon-circle success">
                      <CheckCircle2 size={32} />
                    </div>
                    <div className="result-text-body">
                      <span className="result-status-title">¡ENTREGA AUTORIZADA!</span>
                      <h3 className="result-attendee-name">{scanResult.attendee?.nombreCompleto}</h3>
                      <div className="result-badges-row">
                        <span className="result-pill">
                          <CreditCard size={12} /> {scanResult.attendee?.tipoDocumento || 'CC'}: {scanResult.attendee?.documento}
                        </span>
                        <span className="result-pill highlight">
                          <UtensilsCrossed size={12} /> {scanResult.meal?.nombre}
                        </span>
                        <span className="result-pill">
                          <Clock size={12} /> {scanResult.scannedAt}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {scanResult.status === 'ALREADY_CLAIMED' && (
                  <div className="result-content-wrap duplicate">
                    <div className="result-icon-circle duplicate">
                      <AlertTriangle size={32} />
                    </div>
                    <div className="result-text-body">
                      <span className="result-status-title danger">⚠️ YA RECLAMÓ ESTE BENEFICIO</span>
                      <h3 className="result-attendee-name">{scanResult.attendee?.nombreCompleto}</h3>
                      <p className="result-duplicate-warning">
                        Este participante ya reclamó su <strong>{scanResult.meal?.nombre}</strong> hoy a las{' '}
                        <strong>{scanResult.previousClaim?.horaEntrega || 'hora registrada'}</strong>.
                      </p>
                      <div className="result-badges-row">
                        <span className="result-pill">
                          <CreditCard size={12} /> Doc: {scanResult.attendee?.documento}
                        </span>
                        <span className="result-pill danger">Reclamo Duplicado Bloqueado</span>
                      </div>
                    </div>
                  </div>
                )}

                {scanResult.status === 'NOT_FOUND' && (
                  <div className="result-content-wrap not-found">
                    <div className="result-icon-circle warning">
                      <AlertTriangle size={30} />
                    </div>
                    <div className="result-text-body">
                      <span className="result-status-title warning">NO REGISTRADO EN EVENTO</span>
                      <p className="result-error-msg">{scanResult.message}</p>
                    </div>
                  </div>
                )}

                {/* Barra de Reanudación */}
                <div className="result-resume-bar">
                  {autoResume && autoResumeCountdown !== null ? (
                    <span className="auto-resume-text">
                      Siguiente escaneo en <strong>{autoResumeCountdown}s</strong>...
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="btn-next-scan"
                    onClick={handleResumeScanning}
                  >
                    <span>Escanear Siguiente</span>
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controles de Escaneo Rápido */}
        <div className="meal-scanner-controls-row">
          <button
            type="button"
            className="btn-scanner-tool"
            onClick={handleToggleFacingMode}
            title="Cambiar entre cámara trasera y frontal"
          >
            <RotateCcw size={15} />
            <span>{facingMode === 'environment' ? 'Cámara Trasera' : 'Cámara Frontal'}</span>
          </button>

          <button
            type="button"
            className={`btn-scanner-tool ${soundEnabled ? 'active' : ''}`}
            onClick={() => setSoundEnabled(prev => !prev)}
            title="Activar o desactivar sonido de confirmación"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{soundEnabled ? 'Sonido ON' : 'Silencio'}</span>
          </button>

          <button
            type="button"
            className={`btn-scanner-tool ${autoResume ? 'active' : ''}`}
            onClick={() => setAutoResume(prev => !prev)}
            title="Pausar o reanudar automáticamente tras cada escaneo"
          >
            <RefreshCw size={15} />
            <span>{autoResume ? 'Auto: Continuo' : 'Auto: Manual'}</span>
          </button>

          <button
            type="button"
            className={`btn-scanner-tool ${showManualInput ? 'active' : ''}`}
            onClick={() => setShowManualInput(prev => !prev)}
            title="Digitar documento manualmente si el participante no tiene celular"
          >
            <Search size={15} />
            <span>Buscar Cédula</span>
          </button>
        </div>

        {/* Caja de Registro Manual (por si no tiene celular o está apagado) */}
        {showManualInput && (
          <form onSubmit={handleManualDeliver} className="manual-doc-deliver-form animated-step">
            <div className="manual-input-wrap">
              <CreditCard size={16} className="input-inner-icon" />
              <input
                type="text"
                className="form-input manual-doc-input"
                placeholder="Digitar número de documento (sin puntos)..."
                value={manualDocInput}
                onChange={(e) => setManualDocInput(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="btn-manual-submit"
                disabled={manualProcessing || !manualDocInput.trim()}
              >
                {manualProcessing ? <Loader2 size={14} className="spinner-icon" /> : <Check size={14} />}
                <span>Validar y Entregar</span>
              </button>
            </div>
            <p className="manual-help-text">
              Úsalo si el asistente no tiene su escarapela en mano o se le apagó el celular. Valida su asistencia oficial en el evento y registra la entrega.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
