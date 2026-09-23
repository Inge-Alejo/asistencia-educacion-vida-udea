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
  RotateCcw,
  UserPlus
} from 'lucide-react';
import {
  lookupAttendeeUniversal,
  checkMealAlreadyClaimed,
  recordMealDelivery,
  recordAttendance,
  getMealDeliveries,
  getAttendance,
  normalizeDocumentId,
  getColombiaLocalDateStr
} from '../services/storage';

// Generador de tonos institucionales con Web Audio API de baja latencia
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

  // Estados para registro rápido in-situ (cuando no figura en la lista)
  const [quickRegName, setQuickRegName] = useState('');
  const [quickRegVinculacion, setQuickRegVinculacion] = useState('Estudiante Pregrado Medicina UdeA');
  const [isQuickRegistering, setIsQuickRegistering] = useState(false);

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

  // Registro rápido para asistentes no listados (walk-in)
  const handleQuickRegister = async () => {
    if (!lastScanResult?.scannedCode || !quickRegName.trim() || isQuickRegistering) return;
    setIsQuickRegistering(true);
    const scannedAtTime = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      const docClean = normalizeDocumentId(lastScanResult.scannedCode);
      const newAtt = {
        eventoId: evento?.id,
        nombreCompleto: quickRegName.trim(),
        tipoDocumento: 'CC',
        documento: docClean,
        correo: '',
        telefono: '',
        vinculacion: quickRegVinculacion,
        placaVehiculo: '',
        habeasDataAceptado: true,
        fechaHabeasData: new Date().toLocaleString('es-CO'),
        metodoRegistro: 'ESCANER_USB',
        esPresencial: true,
        geolocalizacion: {
          esPresencial: true,
          distanciaSedeMetros: 0,
          modo: 'ESCANER_USB_PRESENCIAL',
          verificadoPorOperador: operador.trim() || 'Logística UdeA'
        }
      };

      const resAtt = await recordAttendance(newAtt);
      if (resAtt.success) {
        if (soundEnabled) playScannerTone('success');

        let deliveryRecord = null;
        // Si además está en modo entrega de comida, registrarla de inmediato
        if (scanMode === 'meal' && activeMealObj) {
          const saveMeal = await recordMealDelivery({
            eventoId: evento?.id,
            comidaId: activeMealObj.id,
            comidaNombre: activeMealObj.nombre,
            documento: docClean,
            tipoDocumento: 'CC',
            nombreCompleto: quickRegName.trim(),
            vinculacion: quickRegVinculacion,
            comprobanteId: resAtt.record?.id || 'N/A',
            fechaEntrega: getColombiaLocalDateStr(),
            metodo: 'BARCODE_SCANNER_USB',
            operador: operador.trim() || 'Logística UdeA'
          });
          if (saveMeal.success) {
            deliveryRecord = saveMeal.record;
          }
        }

        const successRes = {
          success: true,
          type: scanMode === 'meal' ? 'MEAL_DELIVERED' : 'CHECKIN_REGISTERED',
          attendee: resAtt.record || newAtt,
          attendeeDoc: docClean,
          attendeeName: quickRegName.trim(),
          timestamp: scannedAtTime,
          mealsCount: deliveryRecord ? 1 : 0,
          deliveryRecord,
          mealNombre: activeMealObj?.nombre,
          title: scanMode === 'meal' ? `¡Asistencia y ${activeMealObj?.nombre} Registrados!` : '¡Asistencia Registrada con Éxito!',
          message: `Participante ${quickRegName.trim()} (CC ${docClean}) registrado y guardado oficialmente en el sistema.`
        };

        setLastScanResult(successRes);
        setScanHistory(prev => [successRes, ...prev.slice(0, 24)]);
        setQuickRegName('');
        if (onDataUpdated) onDataUpdated();
      } else {
        alert(resAtt.message || 'No se pudo guardar la asistencia.');
      }
    } catch (e) {
      console.error('Error en registro rápido:', e);
      alert('Error registrando asistencia: ' + (e?.message || 'Error'));
    } finally {
      setIsQuickRegistering(false);
    }
  };

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
        // Consultar cuántas comidas lleva reclamadas este asistente en este evento
        const allDeliveries = getMealDeliveries(evento?.id).filter(
          m => normalizeDocumentId(m.documento) === normalizeDocumentId(attendeeDoc)
        );

        // Subcaso A.1: El participante proviene de la lista oficial de inscritos (aún no en asistencias)
        if (lookup.source === 'inscrito') {
          const newAttendanceRecord = {
            eventoId: evento?.id,
            nombreCompleto: attendee.nombreCompleto || 'Participante Inscrito',
            tipoDocumento: attendee.tipoDocumento || 'CC',
            documento: attendeeDoc,
            correo: attendee.correo || '',
            telefono: attendee.telefono || '',
            vinculacion: attendee.vinculacion || 'Asistente Acreditado',
            placaVehiculo: attendee.placaVehiculo || '',
            habeasDataAceptado: true,
            fechaHabeasData: new Date().toLocaleString('es-CO'),
            metodoRegistro: 'ESCANER_USB',
            esPresencial: true,
            geolocalizacion: {
              esPresencial: true,
              distanciaSedeMetros: 0,
              modo: 'ESCANER_USB_PRESENCIAL',
              verificadoPorOperador: operador.trim() || 'Logística UdeA'
            }
          };

          const saveAttRes = await recordAttendance(newAttendanceRecord);

          if (saveAttRes.success) {
            if (soundEnabled) playScannerTone('success');
            const checkinResult = {
              success: true,
              type: 'CHECKIN_REGISTERED',
              source: 'inscrito_registrado',
              attendee: saveAttRes.record || newAttendanceRecord,
              attendeeDoc,
              attendeeName,
              timestamp: scannedAtTime,
              mealsCount: allDeliveries.length,
              title: '¡Asistencia Registrada con Escáner!',
              message: `Participante de la lista oficial registrado y guardado exitosamente en la base de datos.`
            };
            setLastScanResult(checkinResult);
            setScanHistory(prev => [checkinResult, ...prev.slice(0, 24)]);
            if (onDataUpdated) onDataUpdated();
            return;
          } else {
            // Ya estaba registrado para este día
            if (soundEnabled) playScannerTone('success');
            const checkinResult = {
              success: true,
              type: 'CHECKIN_CONFIRMED',
              source: lookup.source,
              attendee,
              attendeeDoc,
              attendeeName,
              timestamp: scannedAtTime,
              mealsCount: allDeliveries.length,
              title: 'Asistencia Previamente Registrada',
              message: saveAttRes.message || 'El participante ya contaba con registro oficial de asistencia.'
            };
            setLastScanResult(checkinResult);
            setScanHistory(prev => [checkinResult, ...prev.slice(0, 24)]);
            if (onDataUpdated) onDataUpdated();
            return;
          }
        }

        // Subcaso A.2: Ya es una asistencia registrada en la base de datos
        if (soundEnabled) playScannerTone('success');
        const checkinResult = {
          success: true,
          type: 'CHECKIN_CONFIRMED',
          source: lookup.source,
          attendee,
          attendeeDoc,
          attendeeName,
          timestamp: scannedAtTime,
          mealsCount: allDeliveries.length,
          title: 'Asistencia Oficial Confirmada',
          message: `Participante verificado en la base de datos (${attendee.fechaRegistro || 'hoy'}).`
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

        // 2. Si el participante proviene de la lista de inscritos y no tenía asistencia previa,
        // registrar también su asistencia oficial en el evento
        if (lookup.source === 'inscrito' && !lookup.isRegisteredAttendance) {
          try {
            await recordAttendance({
              eventoId: evento?.id,
              nombreCompleto: attendee.nombreCompleto || 'Participante Inscrito',
              tipoDocumento: attendee.tipoDocumento || 'CC',
              documento: attendeeDoc,
              correo: attendee.correo || '',
              telefono: attendee.telefono || '',
              vinculacion: attendee.vinculacion || 'Asistente Acreditado',
              placaVehiculo: attendee.placaVehiculo || '',
              habeasDataAceptado: true,
              fechaHabeasData: new Date().toLocaleString('es-CO'),
              metodoRegistro: 'ESCANER_USB',
              esPresencial: true,
              geolocalizacion: {
                esPresencial: true,
                distanciaSedeMetros: 0,
                modo: 'ESCANER_USB_PRESENCIAL',
                verificadoPorOperador: operador.trim() || 'Logística UdeA'
              }
            });
          } catch (attErr) {
            console.warn('Aviso registrando asistencia al entregar comida:', attErr);
          }
        }

        // 3. Registrar la entrega inmediata
        const saveRes = await recordMealDelivery({
          eventoId: evento?.id,
          comidaId: mealId,
          comidaNombre: mealNombre,
          documento: attendeeDoc,
          tipoDocumento: attendee.tipoDocumento || 'CC',
          nombreCompleto: attendeeName,
          vinculacion: attendee.vinculacion || 'Asistente',
          comprobanteId: attendee.id || 'N/A',
          fechaEntrega: getColombiaLocalDateStr(),
          metodo: 'BARCODE_SCANNER_USB',
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
            message: `Entrega guardada en el sistema para ${attendeeName} (${attendee.tipoDocumento || 'CC'} ${attendeeDoc}).`
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

  // Interceptor global de pulsaciones de teclado para lectores de código de barras USB (HID Wedge)
  // Los escáneres USB emiten caracteres rápidamente (<45ms entre tecla) y finalizan con 'Enter'
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e) => {
      // Ignorar si el usuario está enfocado escribiendo en inputs de texto específicos
      if (document.activeElement?.name === 'operadorInput' || document.activeElement?.name === 'quickRegInput') return;

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
                <h3 className="scanner-dialog-title">Estación de Escaneo USB (PC)</h3>
                <span className="scanner-model-badge">ESCÁNER USB</span>
              </div>
              <p className="scanner-dialog-subtitle">
                Lectura instantánea de códigos de barra (Code 128) y códigos QR desde el computador para acreditación y refrigerios.
              </p>
            </div>
          </div>

          <div className="desk-scanner-controls-top">
            <div className="scanner-online-indicator" title="Conexión USB de teclado HID activa en este computador">
              <span className="online-pulse-dot"></span>
              <span>Lector USB en línea</span>
            </div>

            <button
              type="button"
              className={`btn-sound-toggle ${soundEnabled ? 'active' : 'muted'}`}
              onClick={() => setSoundEnabled(prev => !prev)}
              title={soundEnabled ? 'Sonidos activados' : 'Sonidos silenciados'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{soundEnabled ? 'Audio ON' : 'Audio OFF'}</span>
            </button>

            <button
              type="button"
              className="btn-close-modal"
              onClick={onClose}
              aria-label="Cerrar estación"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Barra de Modalidad: Acreditación vs Entrega de Alimentos */}
        <div className="desk-scanner-modality-bar">
          <div className="modality-switch-buttons">
            <button
              type="button"
              className={`btn-modality ${scanMode === 'checkin' ? 'active checkin' : ''}`}
              onClick={() => {
                setScanMode('checkin');
                manualInputRef.current?.focus();
              }}
            >
              <UserCheck size={17} />
              <span>Acreditación / Puerta (Asistencia)</span>
            </button>

            <button
              type="button"
              className={`btn-modality ${scanMode === 'meal' ? 'active meal' : ''}`}
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
                  placeholder="Apunte el escáner al código de barras o QR (o digite la Cédula)..."
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
                <strong>Listo para escanear:</strong> Al presionar el gatillo del escáner frente al código de barras o QR de la escarapela, se procesará y guardará automáticamente.
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

                {/* Si no se encontró el asistente, permitir registro rápido in-situ */}
                {lastScanResult.type === 'NOT_FOUND' && (
                  <div style={{ marginTop: '0.85rem', padding: '0.9rem', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #FECACA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem', color: '#991B1B', fontWeight: 700, fontSize: '0.88rem' }}>
                      <UserPlus size={16} />
                      <span>Registrar Asistencia en Sitio con Documento {lastScanResult.scannedCode}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        type="text"
                        name="quickRegInput"
                        placeholder="Nombre completo del participante..."
                        value={quickRegName}
                        onChange={(e) => setQuickRegName(e.target.value)}
                        style={{ flex: 1, minWidth: '180px', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      />
                      <select
                        value={quickRegVinculacion}
                        onChange={(e) => setQuickRegVinculacion(e.target.value)}
                        style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      >
                        <option value="Estudiante Pregrado Medicina UdeA">Estudiante Pregrado UdeA</option>
                        <option value="Residente / Posgrado UdeA">Residente / Posgrado</option>
                        <option value="Docente / Investigador UdeA">Docente / Investigador</option>
                        <option value="Egresado UdeA">Egresado</option>
                        <option value="Médico / Especialista Externo">Médico / Especialista Externo</option>
                        <option value="Asistente Académico">Otro / Asistente Académico</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleQuickRegister}
                        disabled={!quickRegName.trim() || isQuickRegistering}
                        style={{ background: '#0F5938', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '7px 14px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                      >
                        {isQuickRegistering ? 'Guardando...' : 'Guardar Asistencia'}
                      </button>
                    </div>
                  </div>
                )}

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
                <h4>Esperando lectura del escáner USB...</h4>
                <p>
                  Apunte el lector al código de barras 1D o código QR de la credencial del participante. Los datos se validarán y guardarán automáticamente en tiempo real.
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
                  title="Limpiar bitácora de escaneos visibles de la sesión"
                >
                  <RotateCcw size={13} />
                  <span>Limpiar</span>
                </button>
              )}
            </div>

            <div className="session-history-feed">
              {scanHistory.length === 0 ? (
                <div className="empty-feed-placeholder">
                  <Barcode size={32} />
                  <p>Aún no se han realizado escaneos en esta sesión.</p>
                  <small>Al leer con el escáner USB aparecerán aquí en orden cronológico.</small>
                </div>
              ) : (
                scanHistory.map((item, index) => (
                  <div
                    key={index}
                    className={`history-feed-item ${item.success ? 'success' : (item.type === 'ALREADY_CLAIMED' ? 'warning' : 'error')}`}
                  >
                    <span className="item-badge-time">{item.timestamp}</span>
                    <div className="item-content">
                      <div className="item-header-row">
                        <strong className="item-name">
                          {item.attendeeName || item.scannedCode || 'Código'}
                        </strong>
                        <span className={`item-pill ${item.success ? 'pill-green' : (item.type === 'ALREADY_CLAIMED' ? 'pill-amber' : 'pill-red')}`}>
                          {item.type === 'MEAL_DELIVERED'
                            ? 'COMIDA ENTREGADA'
                            : item.type === 'CHECKIN_REGISTERED'
                            ? 'ASISTENCIA REGISTRADA'
                            : item.type === 'CHECKIN_CONFIRMED'
                            ? 'VERIFICADO'
                            : item.type === 'ALREADY_CLAIMED'
                            ? 'DUPLICADO'
                            : 'NO ENCONTRADO'}
                        </span>
                      </div>
                      {item.attendeeDoc && (
                        <div className="item-doc-text">
                          {item.attendee?.tipoDocumento || 'CC'}: {item.attendeeDoc}
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
