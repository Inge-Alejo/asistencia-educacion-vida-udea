import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Barcode,
  X,
  Volume2,
  VolumeX,
  UserCheck,
  UtensilsCrossed,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  User,
  CreditCard,
  Car,
  Search,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import {
  lookupAttendeeUniversal,
  checkMealAlreadyClaimed,
  recordMealDelivery,
  getMealDeliveries,
  getAttendance
} from '../services/storage';

// Generador de sonidos institucionales sin dependencias externas usando Web Audio API
function playScannerTone(type = 'success') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'success') {
      // Tono ascendente agradable de confirmación (880Hz -> 1760Hz)
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'duplicate') {
      // Doble tono grave de advertencia (Duplicado / Ya reclamado)
      const now = ctx.currentTime;
      [0, 0.14].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now + delay);

        gain.gain.setValueAtTime(0.2, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.11);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.11);
      });
    } else {
      // Tono grave de error (No encontrado)
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch (e) {
    console.warn('Audio synthesis notice:', e);
  }
}

export default function BarcodeScannerDeskModal({
  isOpen,
  onClose,
  evento,
  asistencias = [],
  entregasComidas = [],
  onDataUpdated
}) {
  // Modo de operación: 'checkin' (Acreditación / Puerta) o 'meal' (Alimentación)
  const [scanMode, setScanMode] = useState('checkin');

  // Comida seleccionada para entrega (si el modo es 'meal')
  const comidasConfig = useMemo(() => {
    return Array.isArray(evento?.comidasConfig) && evento.comidasConfig.length > 0
      ? evento.comidasConfig
      : [{ id: 'almuerzo_default', nombre: 'Almuerzo / Refrigerio Institucional', cantidadTotal: '' }];
  }, [evento?.comidasConfig]);

  const [selectedMealId, setSelectedMealId] = useState(() => comidasConfig[0]?.id || 'almuerzo_default');

  // Mantener seleccionada la primera comida si cambia la configuración del evento
  useEffect(() => {
    if (comidasConfig.length > 0 && !comidasConfig.some(c => c.id === selectedMealId)) {
      setSelectedMealId(comidasConfig[0].id);
    }
  }, [comidasConfig, selectedMealId]);

  const activeMealObj = useMemo(() => {
    return comidasConfig.find(c => c.id === selectedMealId) || comidasConfig[0];
  }, [comidasConfig, selectedMealId]);

  // Sonido habilitado/deshabilitado
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Nombre del operador
  const [operador, setOperador] = useState('Logística UdeA');

  // Entrada manual o de escáner en pantalla
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Resultado del último escaneo
  const [lastScanResult, setLastScanResult] = useState(null);

  // Historial de escaneos de la sesión actual
  const [scanHistory, setScanHistory] = useState([]);

  // Referencias para auto-enfoque e interceptor de ráfagas USB
  const manualInputRef = useRef(null);
  const keystrokeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Auto-enfocar el campo de búsqueda manual al abrir o cambiar de modo
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        manualInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, scanMode]);

  // Contadores de comidas en tiempo real para el evento
  const activeMealDeliveries = useMemo(() => {
    const list = Array.isArray(entregasComidas) ? entregasComidas : getMealDeliveries(evento?.id);
    return list.filter(m => m.eventoId === evento?.id && (m.comidaId === selectedMealId || m.comidaNombre === activeMealObj?.nombre));
  }, [entregasComidas, evento?.id, selectedMealId, activeMealObj?.nombre]);

  // Total de asistencias del evento
  const eventAttendanceCount = useMemo(() => {
    const list = Array.isArray(asistencias) ? asistencias : getAttendance(evento?.id);
    return list.filter(a => a.eventoId === evento?.id).length;
  }, [asistencias, evento?.id]);

  // Procesar código escaneado (ya sea por ráfaga rápida de la pistola USB o digitado)
  const processScanCode = useCallback(async (rawCode) => {
    if (!rawCode || isProcessing) return;
    const cleanCode = rawCode.trim();
    if (!cleanCode) return;

    setIsProcessing(true);
    const scannedAtTime = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      // 1. Buscar al asistente en la base de datos oficial
      const lookup = await lookupAttendeeUniversal(evento?.id, cleanCode);

      if (!lookup.found) {
        if (soundEnabled) playScannerTone('error');
        const errResult = {
          success: false,
          type: 'NOT_FOUND',
          scannedCode: cleanCode,
          timestamp: scannedAtTime,
          title: 'Asistente No Encontrado',
          message: `El código o documento "${cleanCode}" no figura en la lista de asistencias ni en los inscritos de este evento.`
        };
        setLastScanResult(errResult);
        setScanHistory(prev => [errResult, ...prev.slice(0, 24)]);
        return;
      }

      const attendee = lookup.record;
      const attendeeDoc = attendee.documento || cleanCode;
      const attendeeName = attendee.nombreCompleto || 'Participante';

      // =========================================================================
      // CASO A: MODO ACREDITACIÓN / CONTROL DE ACCESO (PUERTA)
      // =========================================================================
      if (scanMode === 'checkin') {
        if (soundEnabled) playScannerTone('success');

        // Consultar cuántas comidas lleva reclamadas este asistente en este evento
        const allDeliveries = getMealDeliveries(evento?.id).filter(
          m => String(m.documento).trim().toLowerCase() === String(attendeeDoc).trim().toLowerCase()
        );

        const checkinResult = {
          success: true,
          type: 'CHECKIN_SUCCESS',
          source: lookup.source,
          attendee,
          attendeeDoc,
          attendeeName,
          timestamp: scannedAtTime,
          mealsCount: allDeliveries.length,
          title: lookup.isRegisteredAttendance ? 'Asistencia Oficial Verificada' : 'Inscrito Oficial Detectado',
          message: lookup.message
        };

        setLastScanResult(checkinResult);
        setScanHistory(prev => [checkinResult, ...prev.slice(0, 24)]);
        if (onDataUpdated) onDataUpdated();
        return;
      }

      // =========================================================================
      // CASO B: MODO ENTREGA DE ALIMENTACIÓN / REFRIGERIO
      // =========================================================================
      if (scanMode === 'meal') {
        const mealId = activeMealObj.id;
        const mealNombre = activeMealObj.nombre;

        // 1. Verificar si ya reclamó esta comida específica
        const already = await checkMealAlreadyClaimed(evento?.id, mealId, attendeeDoc);

        if (already.claimed) {
          if (soundEnabled) playScannerTone('duplicate');

          const dupResult = {
            success: false,
            type: 'ALREADY_CLAIMED',
            attendee,
            attendeeDoc,
            attendeeName,
            mealNombre,
            claimedRecord: already.record,
            timestamp: scannedAtTime,
            title: 'Alimentación Ya Reclamada',
            message: `Este participante ya recibió su "${mealNombre}" a las ${already.record?.horaEntrega || 'hora registrada'} (${already.record?.fechaDia || 'hoy'}).`
          };

          setLastScanResult(dupResult);
          setScanHistory(prev => [dupResult, ...prev.slice(0, 24)]);
          return;
        }

        // 2. Registrar la entrega inmediata
        const saveRes = await recordMealDelivery({
          eventoId: evento?.id,
          comidaId: mealId,
          comidaNombre: mealNombre,
          documento: attendeeDoc,
          tipoDocumento: attendee.tipoDocumento || 'CC',
          nombreCompleto: attendeeName,
          metodo: 'HONEYWELL_USB_DESK',
          operador: operador.trim() || 'Logística UdeA'
        });

        if (saveRes.success) {
          if (soundEnabled) playScannerTone('success');

          const deliverySuccess = {
            success: true,
            type: 'MEAL_DELIVERED',
            attendee,
            attendeeDoc,
            attendeeName,
            mealNombre,
            deliveryRecord: saveRes.record,
            timestamp: scannedAtTime,
            title: `¡${mealNombre} Entregado Con Éxito!`,
            message: `Entrega autorizada para ${attendeeName} (${attendee.tipoDocumento || 'CC'} ${attendeeDoc}).`
          };

          setLastScanResult(deliverySuccess);
          setScanHistory(prev => [deliverySuccess, ...prev.slice(0, 24)]);
          if (onDataUpdated) onDataUpdated();
        } else {
          if (soundEnabled) playScannerTone('error');
          const errorDelivery = {
            success: false,
            type: 'DELIVERY_ERROR',
            attendee,
            attendeeDoc,
            attendeeName,
            mealNombre,
            timestamp: scannedAtTime,
            title: 'Error al Registrar Entrega',
            message: saveRes.message || 'No se pudo guardar la entrega en el sistema.'
          };
          setLastScanResult(errorDelivery);
          setScanHistory(prev => [errorDelivery, ...prev.slice(0, 24)]);
        }
      }
    } catch (err) {
      console.error('Error al procesar escaneo USB:', err);
      if (soundEnabled) playScannerTone('error');
    } finally {
      setIsProcessing(false);
      setManualInput('');
      manualInputRef.current?.focus();
    }
  }, [
    evento?.id,
    scanMode,
    activeMealObj,
    soundEnabled,
    operador,
    isProcessing,
    onDataUpdated
  ]);

  // Interceptor global de pulsaciones de teclado para lectores USB tipo Honeywell Xenon HID Wedge
  // Las pistolas USB emiten los caracteres rápidamente (<45ms entre tecla) y rematan con 'Enter'
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e) => {
      // Ignorar si el usuario está enfocado escribiendo en el campo del nombre del operador
      if (document.activeElement?.name === 'operadorInput') return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const buffered = keystrokeBufferRef.current.trim();
        keystrokeBufferRef.current = '';

        if (buffered.length >= 3) {
          e.preventDefault();
          processScanCode(buffered);
        }
        return;
      }

      // Si pasa demasiado tiempo (>220ms), reiniciar el buffer porque probablemente fue escritura manual dispersa
      if (timeDiff > 220) {
        keystrokeBufferRef.current = '';
      }

      // Acumular caracteres imprimibles simples
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        keystrokeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, processScanCode]);

  // Manejar envío manual con el botón o Enter en el input visible
  const handleManualSubmit = (e) => {
    e?.preventDefault();
    if (!manualInput.trim()) return;
    processScanCode(manualInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay desk-scanner-overlay" onClick={onClose}>
      <div className="modal-container desk-scanner-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera de la Estación de Escaneo */}
        <div className="desk-scanner-header">
          <div className="desk-scanner-brand">
            <div className="scanner-brand-icon">
              <Barcode size={24} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="scanner-dialog-title">Estación de Escaneo USB • Honeywell Xenon</h3>
                <span className="scanner-model-badge">XENON 1900 HID</span>
              </div>
              <p className="scanner-dialog-subtitle">
                Lectura instantánea de códigos de barra (Code 128) y códigos QR desde el computador para acreditación y refrigerios.
              </p>
            </div>
          </div>

          <div className="desk-scanner-controls-top">
            <div className="scanner-online-indicator" title="Conexión USB de teclado HID activa en este computador">
              <span className="online-pulse-dot"></span>
              <span>Pistola USB en línea</span>
            </div>

            <button
              type="button"
              className={`btn-sound-toggle ${soundEnabled ? 'active' : 'muted'}`}
              onClick={() => setSoundEnabled(prev => !prev)}
              title={soundEnabled ? 'Sonidos activados' : 'Sonidos silenciados'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{soundEnabled ? 'Audio ON' : 'Silencio'}</span>
            </button>

            <button className="btn-close-modal" onClick={onClose} aria-label="Cerrar estación de escaneo">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Barra de Modos de Operación */}
        <div className="desk-scanner-mode-bar">
          <div className="scanner-mode-tabs">
            <button
              type="button"
              className={`mode-tab-btn ${scanMode === 'checkin' ? 'active' : ''}`}
              onClick={() => {
                setScanMode('checkin');
                manualInputRef.current?.focus();
              }}
            >
              <UserCheck size={17} />
              <span>Acreditación y Control de Acceso (Puerta)</span>
            </button>

            <button
              type="button"
              className={`mode-tab-btn ${scanMode === 'meal' ? 'active' : ''}`}
              onClick={() => {
                setScanMode('meal');
                manualInputRef.current?.focus();
              }}
            >
              <UtensilsCrossed size={17} />
              <span>Entrega de Alimentación / Refrigerios</span>
            </button>
          </div>

          <div className="scanner-meta-inputs">
            {scanMode === 'meal' && (
              <div className="meal-selector-inline">
                <label className="meta-label">Comida a entregar:</label>
                <select
                  value={selectedMealId}
                  onChange={(e) => setSelectedMealId(e.target.value)}
                  className="meal-select-desk"
                >
                  {comidasConfig.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.cantidadTotal ? `(${c.cantidadTotal} cupos)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="operator-input-inline">
              <label className="meta-label">Operador:</label>
              <input
                type="text"
                name="operadorInput"
                value={operador}
                onChange={(e) => setOperador(e.target.value)}
                placeholder="Nombre del operador"
                className="operator-input-field"
                maxLength={35}
              />
            </div>
          </div>
        </div>

        {/* Métricas en Vivo de la Estación */}
        <div className="desk-scanner-kpis">
          <div className="kpi-block green">
            <span className="kpi-label">Asistencias Confirmadas</span>
            <strong className="kpi-value">{eventAttendanceCount}</strong>
          </div>

          {scanMode === 'meal' && (
            <>
              <div className="kpi-block gold">
                <span className="kpi-label">{activeMealObj.nombre} Entregados</span>
                <strong className="kpi-value">
                  {activeMealDeliveries.length}
                  {activeMealObj.cantidadTotal ? ` / ${activeMealObj.cantidadTotal}` : ''}
                </strong>
              </div>

              {activeMealObj.cantidadTotal && (
                <div className="kpi-block blue">
                  <span className="kpi-label">Raciones Disponibles</span>
                  <strong className="kpi-value">
                    {Math.max(0, Number(activeMealObj.cantidadTotal) - activeMealDeliveries.length)}
                  </strong>
                </div>
              )}
            </>
          )}

          <div className="kpi-block neutral">
            <span className="kpi-label">Escaneos en esta Sesión</span>
            <strong className="kpi-value">{scanHistory.length}</strong>
          </div>
        </div>

        {/* Cuerpo Principal Dividido: Panel de Escaneo (Izquierda) e Historial en Vivo (Derecha) */}
        <div className="desk-scanner-grid">
          {/* Columna Izquierda: Disparo del Escáner y Ficha de Resultado */}
          <div className="desk-scanner-left">
            {/* Barra de Entrada / Captura Automática */}
            <form onSubmit={handleManualSubmit} className="scanner-trigger-bar">
              <div className="scanner-input-wrap">
                <Barcode size={18} className="scanner-input-icon" />
                <input
                  ref={manualInputRef}
                  type="text"
                  className="scanner-main-input"
                  placeholder="Apunte el Honeywell Xenon al código de barras o QR (o digite la Cédula)..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  autoComplete="off"
                  disabled={isProcessing}
                />
              </div>

              <button
                type="submit"
                className="btn-desk-submit"
                disabled={!manualInput.trim() || isProcessing}
              >
                <Search size={16} />
                <span>{isProcessing ? 'Buscando...' : 'Buscar / Registrar'}</span>
              </button>
            </form>

            <div className="scanner-hint-text">
              <Sparkles size={13} color="#059669" />
              <span>
                <strong>Listo para disparar:</strong> Al presionar el gatillo del escáner Honeywell Xenon 1900 frente al código de barras o QR de la escarapela, se procesará automáticamente.
              </span>
            </div>

            {/* Ficha Visual Grande del Último Escaneo */}
            {lastScanResult ? (
              <div className={`desk-result-card animated-step ${lastScanResult.success ? 'success' : (lastScanResult.type === 'ALREADY_CLAIMED' ? 'warning' : 'error')}`}>
                <div className="result-status-header">
                  <div className="result-status-title-row">
                    {lastScanResult.success ? (
                      <CheckCircle2 size={26} className="status-icon green" />
                    ) : lastScanResult.type === 'ALREADY_CLAIMED' ? (
                      <AlertTriangle size={26} className="status-icon amber" />
                    ) : (
                      <XCircle size={26} className="status-icon red" />
                    )}
                    <div>
                      <h4 className="result-status-heading">{lastScanResult.title}</h4>
                      <p className="result-status-sub">{lastScanResult.message}</p>
                    </div>
                  </div>

                  <span className="result-badge-time">
                    <Clock size={13} /> {lastScanResult.timestamp}
                  </span>
                </div>

                {/* Si se encontró un asistente */}
                {lastScanResult.attendee && (
                  <div className="result-attendee-details">
                    <div className="attendee-hero-row">
                      <div className="attendee-avatar-circle">
                        <User size={28} />
                      </div>
                      <div className="attendee-primary-info">
                        <span className="attendee-role-tag">
                          {lastScanResult.attendee.vinculacion || 'Asistente Académico'}
                        </span>
                        <h3 className="attendee-fullname">{lastScanResult.attendeeName}</h3>
                        <div className="attendee-doc-row">
                          <CreditCard size={14} />
                          <span><strong>{lastScanResult.attendee.tipoDocumento || 'CC'}:</strong> {lastScanResult.attendeeDoc}</span>
                        </div>
                      </div>
                    </div>

                    <div className="attendee-extra-grid">
                      <div className="extra-item">
                        <small>Placa Vehicular</small>
                        <span>
                          {lastScanResult.attendee.placaVehiculo ? (
                            <strong style={{ color: '#059669' }}><Car size={13} /> {lastScanResult.attendee.placaVehiculo}</strong>
                          ) : (
                            'Sin vehículo registrado'
                          )}
                        </span>
                      </div>

                      <div className="extra-item">
                        <small>Asistencia Registrada</small>
                        <span>
                          {lastScanResult.attendee.fechaRegistro || 'Confirmada'}
                          {lastScanResult.attendee.diaNumero ? ` (Día ${lastScanResult.attendee.diaNumero})` : ''}
                        </span>
                      </div>

                      {scanMode === 'checkin' && (
                        <div className="extra-item">
                          <small>Comidas Reclamadas</small>
                          <strong style={{ color: lastScanResult.mealsCount > 0 ? '#059669' : '#64748B' }}>
                            <UtensilsCrossed size={13} /> {lastScanResult.mealsCount} raciones
                          </strong>
                        </div>
                      )}

                      {scanMode === 'meal' && lastScanResult.deliveryRecord && (
                        <div className="extra-item highlight">
                          <small>Comida Entregada</small>
                          <strong style={{ color: '#0F5938' }}>
                            {lastScanResult.deliveryRecord.comidaNombre} ({lastScanResult.deliveryRecord.horaEntrega})
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="desk-waiting-card">
                <div className="waiting-animation-scanner">
                  <Barcode size={44} color="#0F5938" />
                  <div className="laser-sweep-bar"></div>
                </div>
                <h4>Esperando lectura del escáner Honeywell...</h4>
                <p>
                  Apunte la pistola al código de barras Code 128 o código QR de la credencial del participante. Los datos se validarán en tiempo real.
                </p>
              </div>
            )}
          </div>

          {/* Columna Derecha: Bitácora en Vivo de Escaneos de la Sesión */}
          <div className="desk-scanner-right">
            <div className="session-history-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="#0F5938" />
                <h4 className="session-history-title">Registro en Vivo de la Sesión</h4>
              </div>

              {scanHistory.length > 0 && (
                <button
                  type="button"
                  className="btn-clear-history"
                  onClick={() => setScanHistory([])}
                  title="Limpiar lista de esta pantalla"
                >
                  <RotateCcw size={13} />
                  <span>Limpiar</span>
                </button>
              )}
            </div>

            <div className="session-history-feed">
              {scanHistory.length === 0 ? (
                <div className="empty-feed-placeholder">
                  <p>Aún no se registran escaneos en esta sesión.</p>
                  <small>Los resultados de cada lectura aparecerán aquí automáticamente con fecha y hora.</small>
                </div>
              ) : (
                scanHistory.map((item, index) => (
                  <div
                    key={`${item.timestamp}-${index}`}
                    className={`history-feed-item ${item.success ? 'success' : (item.type === 'ALREADY_CLAIMED' ? 'warning' : 'error')}`}
                  >
                    <div className="item-badge-time">{item.timestamp}</div>
                    <div className="item-content">
                      <div className="item-header-row">
                        <strong className="item-name">{item.attendeeName || item.scannedCode || 'Desconocido'}</strong>
                        <span className={`item-pill ${item.success ? 'pill-green' : (item.type === 'ALREADY_CLAIMED' ? 'pill-amber' : 'pill-red')}`}>
                          {item.type === 'CHECKIN_SUCCESS'
                            ? 'Acreditado'
                            : item.type === 'MEAL_DELIVERED'
                            ? item.mealNombre
                            : item.type === 'ALREADY_CLAIMED'
                            ? 'Duplicado'
                            : 'No Encontrado'}
                        </span>
                      </div>

                      {item.attendeeDoc && (
                        <div className="item-doc-text">
                          {item.attendee?.tipoDocumento || 'CC'}: {item.attendeeDoc} • {item.attendee?.vinculacion || 'Participante'}
                        </div>
                      )}

                      <p className="item-message-text">{item.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
