import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, HelpCircle, Star, ThumbsUp, Download, QrCode, Plus, Search,
  Filter, CheckCircle, Clock, MapPin, Car, AlertCircle, FileSpreadsheet,
  ExternalLink, Trash2, Shield, KeyRound, LogOut, Upload, X, Award,
  Database, HardDrive, Server, Activity, Wifi, Camera, Edit3,
  CheckCircle2, Globe, Phone, Cloud, AlertTriangle, UtensilsCrossed, Barcode,
  BarChart3, Lock, Play
} from 'lucide-react';
import DigitalBadge from './DigitalBadge';
import QRScannerModal from './QRScannerModal';
import MealScannerModal from './MealScannerModal';
import BarcodeScannerDeskModal from './BarcodeScannerDeskModal';
import EventSelectorModal from './EventSelectorModal';
import InscritosModal from './InscritosModal';
import { exportEventDataToExcel, exportMicrosoftFormsFormat } from '../services/excelExport';
import {
  toggleQuestionAnswered,
  toggleQuestionFeatured,
  deleteQuestion,
  deleteAttendance,
  deleteAllAttendance,
  deleteEvaluation,
  deleteSatisfaction,
  deleteMealDelivery,
  isFirebaseConfigured,
  exportDatabaseBackupJSON,
  importDatabaseBackupJSON,
  getGlobalDatabaseMetrics,
  saveEvent,
  togglePonenteActivo,
  getEventPolls,
  createPoll,
  togglePollStatus,
  deletePoll
} from '../services/storage';
import { changeAdminPassword } from '../services/auth';

function formatRegistrationDate(fechaRegistro, horaRegistro) {
  if (!fechaRegistro) return { date: '—', time: '' };
  const str = String(fechaRegistro).trim();

  // Si contiene coma (ej: '17/9/2026, 7:34:35 p. m.')
  if (str.includes(',')) {
    const parts = str.split(',');
    return {
      date: parts[0].trim(),
      time: (horaRegistro || parts[1] || '').trim()
    };
  }

  // Si tiene espacio entre fecha y hora (ej: '2026-09-17 17:49:05')
  if (str.includes(' ')) {
    const parts = str.split(' ');
    return {
      date: parts[0].trim(),
      time: (horaRegistro || parts.slice(1).join(' ')).trim()
    };
  }

  return {
    date: str,
    time: horaRegistro || ''
  };
}

export default function AdminPanel({
  evento = {},
  events = [],
  onSelectEvent,
  asistencias = [],
  entregasComidas = [],
  preguntas = [],
  evaluaciones = [],
  satisfaccion = [],
  onOpenQRModal,
  onOpenNewEventModal,
  onOpenEditEventModal,
  onDeleteEvent,
  onDataUpdated,
  onLogout
}) {
  const [activeTab, setActiveTab] = useState('asistencias');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVinculacion, setFilterVinculacion] = useState('todos');
  const [selectedGeoRecord, setSelectedGeoRecord] = useState(null);
  const [selectedBadgeAttendee, setSelectedBadgeAttendee] = useState(null);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [isMealScannerOpen, setIsMealScannerOpen] = useState(false);
  const [isBarcodeDeskModalOpen, setIsBarcodeDeskModalOpen] = useState(false);
  const [isEditSelectorOpen, setIsEditSelectorOpen] = useState(false);
  const [isInscritosModalOpen, setIsInscritosModalOpen] = useState(false);

  // Estados para control de Alimentación y Refrigerios
  const [mealFilterId, setMealFilterId] = useState('ALL');
  const [mealSearchTerm, setMealSearchTerm] = useState('');

  // Estados para filtros de Preguntas en Vivo (corrige error de carga)
  const [searchTermQuestions, setSearchTermQuestions] = useState('');
  const [filterPonente, setFilterPonente] = useState('todos');
  const [filterEstadoPregunta, setFilterEstadoPregunta] = useState('todas');

  // Estados para Microsoft Forms institucional
  const [prevEventId, setPrevEventId] = useState(evento?.id);
  const [msFormsUrl, setMsFormsUrl] = useState(evento?.microsoftFormsUrl || '');
  const [isSavingFormsUrl, setIsSavingFormsUrl] = useState(false);
  const [formsUrlFeedback, setFormsUrlFeedback] = useState('');

  // Sincronizar URL de Microsoft Forms si cambia el evento seleccionado (patrón oficial React)
  if (evento?.id !== prevEventId) {
    setPrevEventId(evento?.id);
    setMsFormsUrl(evento?.microsoftFormsUrl || '');
  }

  // Estados para Votaciones y Encuestas Relámpago en Vivo
  const [polls, setPolls] = useState(() => getEventPolls(evento?.id));
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '', '']);
  const [isSubmittingPoll, setIsSubmittingPoll] = useState(false);

  useEffect(() => {
    setPolls(getEventPolls(evento?.id));
  }, [evento?.id, asistencias, preguntas]);

  const handleCrearEncuesta = async (e) => {
    e.preventDefault();
    const cleanPregunta = newPollQuestion.trim();
    const cleanOpciones = newPollOptions.map(o => o.trim()).filter(Boolean);
    if (!cleanPregunta) {
      alert('Por favor escribe la pregunta o caso clínico.');
      return;
    }
    if (cleanOpciones.length < 2) {
      alert('Debes incluir al menos dos opciones para que los participantes puedan votar.');
      return;
    }
    setIsSubmittingPoll(true);
    try {
      const res = await createPoll({
        eventoId: evento.id,
        pregunta: cleanPregunta,
        opciones: cleanOpciones.map((txt, idx) => ({ id: `opt-${idx + 1}`, texto: txt, votos: 0 })),
        estado: 'ACTIVA'
      });
      if (res.success) {
        setPolls(getEventPolls(evento.id));
        setNewPollQuestion('');
        setNewPollOptions(['', '', '']);
        setIsCreatingPoll(false);
        if (onDataUpdated) onDataUpdated();
      } else {
        alert('Error al crear encuesta: ' + res.message);
      }
    } catch (err) {
      alert('Error inesperado: ' + err.message);
    } finally {
      setIsSubmittingPoll(false);
    }
  };

  const handleToggleEstadoEncuesta = async (pollId, nuevoEstado) => {
    await togglePollStatus(pollId, nuevoEstado);
    setPolls(getEventPolls(evento.id));
    if (onDataUpdated) onDataUpdated();
  };

  const handleEliminarEncuesta = async (pollId) => {
    if (confirm('¿Eliminar esta encuesta relámpago permanentemente?')) {
      await deletePoll(pollId);
      setPolls(getEventPolls(evento.id));
      if (onDataUpdated) onDataUpdated();
    }
  };

  // Estados para eliminación masiva de datos con cuenta regresiva de 3s
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeCountdown, setPurgeCountdown] = useState(3);
  const [isPurging, setIsPurging] = useState(false);

  // Efecto de temporizador de 3 segundos para confirmar eliminación masiva
  useEffect(() => {
    let timer;
    if (showPurgeModal && purgeCountdown > 0) {
      timer = setTimeout(() => {
        setPurgeCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [showPurgeModal, purgeCountdown]);

  const handleOpenPurgeModal = () => {
    setPurgeCountdown(3);
    setShowPurgeModal(true);
  };

  const handleConfirmPurgeAll = async () => {
    if (purgeCountdown > 0 || isPurging) return;
    setIsPurging(true);
    try {
      await deleteAllAttendance(evento?.id);
      setShowPurgeModal(false);
      if (onDataUpdated) onDataUpdated();
      alert(`Se han eliminado exitosamente todos los registros de asistencia del evento "${evento?.titulo || ''}".`);
    } catch (err) {
      console.error('Error al purgar asistencias:', err);
      alert('Hubo un inconveniente al eliminar los registros de asistencia.');
    } finally {
      setIsPurging(false);
    }
  };

  // Estados para cambio de contraseña y feedback
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState({ text: '', isError: false });

  // Validar si el evento tiene ponentes habilitados
  const hasPonentes = Boolean(evento?.habilitarPonentes !== false && (evento?.ponentes?.length > 0 || !evento?.id));

  // Si los ponentes están desactivados y la pestaña activa era de ponentes, cambiar a asistencias
  useEffect(() => {
    if (evento?.habilitarPonentes === false && (activeTab === 'preguntas' || activeTab === 'evaluaciones')) {
      setActiveTab('asistencias');
    }
  }, [evento?.habilitarPonentes, activeTab]);

  // Estado para alternar activación individual de ponentes en tiempo real
  const [togglingPonenteId, setTogglingPonenteId] = useState(null);

  const handleTogglePonente = async (ponenteId) => {
    if (!evento?.id || togglingPonenteId) return;
    setTogglingPonenteId(ponenteId);
    try {
      await togglePonenteActivo(evento.id, ponenteId);
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Error al alternar estado de ponente:', err);
    } finally {
      setTogglingPonenteId(null);
    }
  };

  // -------------------------------------------------------------
  // MONITOR DE CAPACIDAD Y ALMACENAMIENTO GLOBAL EN TIEMPO REAL
  // Consolidado total de todos los eventos académicos de la Facultad
  // -------------------------------------------------------------
  const dbMetrics = useMemo(() => {
    return getGlobalDatabaseMetrics();
  }, [asistencias, preguntas, evaluaciones, satisfaccion, entregasComidas, polls, events, activeTab]);

  // Estadísticas Rápidas
  const totalAsistentes = asistencias.length;
  const presencialesGPS = asistencias.filter(a => a.geolocalizacion?.esPresencial).length;
  const porcentajePresencial = totalAsistentes > 0 ? Math.round((presencialesGPS / totalAsistentes) * 100) : 0;
  const vehiculosRegistrados = asistencias.filter(a => a.placaVehiculo && a.placaVehiculo !== 'No registrada').length;

  const totalPreguntas = preguntas.length;
  const preguntasRespondidas = preguntas.filter(q => q.respondida).length;

  // Promedio de evaluaciones de ponentes
  const totalEvals = evaluaciones.length;
  const promedioPonentes = totalEvals > 0
    ? (evaluaciones.reduce((acc, ev) => acc + (ev.dominio + ev.claridad + ev.aplicabilidad) / 3, 0) / totalEvals).toFixed(1)
    : '5.0';

  // Métricas de Satisfacción General
  const totalSat = satisfaccion.length;
  const promedioExpectativas = totalSat > 0
    ? (satisfaccion.reduce((acc, s) => acc + s.cumplimientoObjetivos, 0) / totalSat).toFixed(1)
    : '5.0';
  const promedioNPS = totalSat > 0
    ? (satisfaccion.reduce((acc, s) => acc + s.npsRecomendacion, 0) / totalSat).toFixed(1)
    : '10.0';

  // Filtrado de Asistencias seguro
  const asistenciasFiltradas = (asistencias || []).filter(a => {
    const docStr = String(a?.documento || '');
    const nameStr = String(a?.nombreCompleto || '').toLowerCase();
    const placaStr = String(a?.placaVehiculo || '').toLowerCase();
    const term = (searchTerm || '').toLowerCase();

    const matchSearch =
      nameStr.includes(term) ||
      docStr.includes(searchTerm) ||
      (placaStr && placaStr.includes(term));

    const matchVinculacion = filterVinculacion === 'todos' || a?.vinculacion === filterVinculacion;
    return matchSearch && matchVinculacion;
  });

  // Filtrado Multicriterio de Preguntas en Vivo seguro
  const preguntasFiltradas = (preguntas || []).filter(q => {
    const matchPonente = filterPonente === 'todos' || q?.ponenteId === filterPonente;
    const termQ = (searchTermQuestions || '').toLowerCase().trim();
    const matchSearch =
      !termQ ||
      String(q?.pregunta || '').toLowerCase().includes(termQ) ||
      String(q?.autor || '').toLowerCase().includes(termQ) ||
      String(q?.ponenteNombre || '').toLowerCase().includes(termQ);

    let matchEstado = true;
    if (filterEstadoPregunta === 'pendientes') matchEstado = !q?.respondida;
    else if (filterEstadoPregunta === 'respondidas') matchEstado = q?.respondida;
    else if (filterEstadoPregunta === 'destacadas') matchEstado = q?.destacada;

    return matchPonente && matchSearch && matchEstado;
  });

  // Filtrado de Entregas de Alimentación
  const currentEventId = evento?.id;
  const filteredMealDeliveries = useMemo(() => {
    const list = (entregasComidas || []).filter(e => e.eventoId === currentEventId);
    return list.filter(d => {
      const matchMeal = mealFilterId === 'ALL' || d.comidaId === mealFilterId;
      const term = (mealSearchTerm || '').trim().toLowerCase();
      const matchSearch = !term ||
        (d.nombreCompleto && d.nombreCompleto.toLowerCase().includes(term)) ||
        (d.documento && String(d.documento).includes(term)) ||
        (d.comidaNombre && d.comidaNombre.toLowerCase().includes(term));
      return matchMeal && matchSearch;
    });
  }, [entregasComidas, currentEventId, mealFilterId, mealSearchTerm]);

  const handleDescargarExcel = () => {
    try {
      exportEventDataToExcel({
        evento,
        asistencias,
        entregasComidas,
        preguntas,
        evaluaciones,
        satisfaccion
      });
    } catch (err) {
      console.error('Error al exportar Excel:', err);
      alert('Hubo un inconveniente al generar el libro de Excel: ' + (err?.message || 'Error desconocido'));
    }
  };

  const handleDescargarMsForms = () => {
    try {
      exportMicrosoftFormsFormat({
        evento,
        asistencias,
        satisfaccion
      });
    } catch (err) {
      console.error('Error al exportar Microsoft Forms:', err);
      alert('Hubo un inconveniente al generar el formato de Microsoft Forms: ' + (err?.message || 'Error desconocido'));
    }
  };

  return (
    <div className="admin-panel-container">
      {/* Barra de Acciones y Título del Panel */}
      <div className="admin-action-bar">
        <div>
          <div className="admin-title-row">
            <h2 className="admin-heading">Panel de Control y Analítica en Tiempo Real</h2>
            <span className="live-pill">
              <span className="live-dot"></span> Sincronizado en Vivo
            </span>
            <span className={`db-status-pill ${isFirebaseConfigured() ? 'cloud' : 'local'}`}>
              {isFirebaseConfigured() ? (
                <>
                  <Cloud size={13} />
                  <span>Cloud Firestore Activo</span>
                </>
              ) : (
                <>
                  <HardDrive size={13} />
                  <span>Modo Local de Contingencia</span>
                </>
              )}
            </span>
          </div>
          <p className="admin-subheading">
            Gestión de asistencia, geolocalización, preguntas al ponente y reportes de Educación a lo Largo de la Vida.
          </p>
        </div>

        <div className="admin-buttons-group">
          <button
            type="button"
            className="btn-primary-action btn-scanner-desk-action"
            onClick={() => setIsBarcodeDeskModalOpen(true)}
            style={{
              background: '#0F5938',
              borderColor: '#0F5938',
              color: '#FFFFFF',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 2px 6px rgba(15, 89, 56, 0.25)'
            }}
            title="Abrir estación para lector de código de barras USB en computador"
          >
            <Barcode size={17} />
            <span>Escáner de Barras USB (PC)</span>
          </button>
          <button
            type="button"
            className="btn-secondary btn-scanner-action"
            onClick={() => setIsQRScannerOpen(true)}
            title="Escanear en vivo con la cámara del celular o webcam para verificar y acreditar credenciales"
          >
            <Camera size={16} />
            <span>Cámara QR Móvil</span>
          </button>
          {evento?.habilitarAlimentacion && (
            <button
              type="button"
              className="btn-secondary btn-meals-action"
              onClick={() => setIsMealScannerOpen(true)}
              style={{
                background: '#E8F5E9',
                borderColor: '#86EFAC',
                color: '#0F5938',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
              title="Abrir lector QR de la cámara del celular para entregar almuerzos o refrigerios"
            >
              <UtensilsCrossed size={16} />
              <span>Escanear Almuerzos / Refrigerios</span>
            </button>
          )}
          <button className="btn-secondary" onClick={onOpenNewEventModal}>
            <Plus size={16} />
            <span>Crear Evento</span>
          </button>
          <button
            type="button"
            className="btn-edit-event"
            onClick={() => setIsEditSelectorOpen(true)}
            title="Ver la lista de eventos creados para seleccionar cuál editar"
          >
            <Edit3 size={16} />
            <span>Editar Evento Existente</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsInscritosModalOpen(true)}
            title="Cargar o gestionar lista oficial de personas inscritas (Excel / CSV) para este evento"
          >
            <FileSpreadsheet size={16} />
            <span>Lista de Inscritos {evento?.inscritosResumen?.total ? `(${evento.inscritosResumen.total})` : ''}</span>
          </button>
          <button className="btn-secondary" onClick={onOpenQRModal}>
            <QrCode size={16} />
            <span>Proyectar QR</span>
          </button>
          <button className="btn-primary-action" onClick={handleDescargarExcel}>
            <Download size={16} />
            <span>Descargar Excel (.xlsx)</span>
          </button>
          <button
            className="btn-secondary"
            onClick={exportDatabaseBackupJSON}
            title="Exportar copia de seguridad integral de la base de datos en archivo .JSON"
          >
            <Download size={15} />
            <span>Respaldar BD (JSON)</span>
          </button>
          <label
            className="btn-secondary"
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            title="Restaurar base de datos desde un archivo de copia de seguridad .JSON"
          >
            <Upload size={15} />
            <span>Restaurar BD</span>
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!window.confirm('¿Desea restaurar los datos desde este archivo? Se actualizarán los eventos y asistencias locales.')) {
                  e.target.value = '';
                  return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                  const res = importDatabaseBackupJSON(event.target.result);
                  if (res.success) {
                    alert(`Respaldo restaurado exitosamente: ${res.countEvents} eventos y ${res.countAttendance} asistencias.`);
                    if (onDataUpdated) onDataUpdated();
                  } else {
                    alert('Error al restaurar respaldo: ' + res.message);
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </label>
          {onDeleteEvent && (
            <button
              className="btn-danger-outline"
              onClick={onDeleteEvent}
              title="Eliminar permanentemente este evento y todos sus registros asociados"
            >
              <Trash2 size={16} />
              <span>Eliminar Evento</span>
            </button>
          )}
          {onLogout && (
            <button className="btn-secondary btn-logout-action" onClick={onLogout} title="Cerrar sesión de administrador">
              <LogOut size={16} />
              <span>Cerrar Sesión</span>
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de Métricas Rápidas (KPIs) */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Asistentes Totales</span>
            <div className="kpi-icon-wrap green">
              <Users size={18} />
            </div>
          </div>
          <div className="kpi-value">{totalAsistentes}</div>
          <span className="kpi-meta">
            {presencialesGPS} confirmados en sede GPS ({porcentajePresencial}%)
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Placas / Parqueadero</span>
            <div className="kpi-icon-wrap blue">
              <Car size={18} />
            </div>
          </div>
          <div className="kpi-value">{vehiculosRegistrados}</div>
          <span className="kpi-meta">
            {evento.habilitarPlacaVehiculo
              ? 'Módulo de parqueadero ACTIVO en este evento'
              : 'Módulo de parqueadero DESACTIVADO'}
          </span>
        </div>

        <div className="kpi-card" style={{ opacity: hasPonentes ? 1 : 0.75 }}>
          <div className="kpi-header">
            <span className="kpi-label">Preguntas a Ponentes</span>
            <div className="kpi-icon-wrap gold">
              <HelpCircle size={18} />
            </div>
          </div>
          <div className="kpi-value">{hasPonentes ? totalPreguntas : '—'}</div>
          <span className="kpi-meta">
            {hasPonentes
              ? `${preguntasRespondidas} de ${totalPreguntas} respondidas en vivo`
              : 'Módulo de ponentes DESACTIVADO en este evento'}
          </span>
        </div>

        <div className="kpi-card" style={{ opacity: hasPonentes ? 1 : 0.75 }}>
          <div className="kpi-header">
            <span className="kpi-label">Calificación Ponentes</span>
            <div className="kpi-icon-wrap amber">
              <Star size={18} />
            </div>
          </div>
          <div className="kpi-value">{hasPonentes ? promedioPonentes : '—'}</div>
          <span className="kpi-meta">
            {hasPonentes
              ? `Basado en ${totalEvals} evaluaciones`
              : 'Módulo de ponentes DESACTIVADO en este evento'}
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">NPS Recomendación</span>
            <div className="kpi-icon-wrap teal">
              <ThumbsUp size={18} />
            </div>
          </div>
          <div className="kpi-value">{promedioNPS} / 10</div>
          <span className="kpi-meta">Satisfacción general {promedioExpectativas} / 5</span>
        </div>
      </div>

      {/* Navegación por Pestañas de Administración */}
      <div className="admin-tabs-nav">
        <button
          className={`tab-link ${activeTab === 'asistencias' ? 'active' : ''}`}
          onClick={() => setActiveTab('asistencias')}
        >
          <Users size={16} />
          <span>Listado de Asistencia ({totalAsistentes})</span>
        </button>
        {hasPonentes && (
          <button
            className={`tab-link ${activeTab === 'preguntas' ? 'active' : ''}`}
            onClick={() => setActiveTab('preguntas')}
          >
            <HelpCircle size={16} />
            <span>Preguntas a Ponentes ({totalPreguntas})</span>
          </button>
        )}
        {hasPonentes && (
          <button
            className={`tab-link ${activeTab === 'evaluaciones' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluaciones')}
          >
            <Star size={16} />
            <span>Calificaciones de Ponentes</span>
          </button>
        )}
        <button
          className={`tab-link ${activeTab === 'encuestas' ? 'active' : ''}`}
          onClick={() => setActiveTab('encuestas')}
        >
          <BarChart3 size={16} />
          <span>Votaciones en Vivo {evento?.habilitarEncuestasEnVivo === false ? '(Desactivado)' : `(${polls.length})`}</span>
        </button>
        <button
          className={`tab-link ${activeTab === 'satisfaccion' ? 'active' : ''}`}
          onClick={() => setActiveTab('satisfaccion')}
        >
          <ThumbsUp size={16} />
          <span>Satisfacción General</span>
        </button>
        <button
          className={`tab-link ${activeTab === 'integracion' ? 'active' : ''}`}
          onClick={() => setActiveTab('integracion')}
        >
          <FileSpreadsheet size={16} />
          <span>Excel y Microsoft Forms</span>
        </button>
        {evento?.habilitarAlimentacion && (
          <button
            className={`tab-link ${activeTab === 'alimentacion' ? 'active' : ''}`}
            onClick={() => setActiveTab('alimentacion')}
          >
            <UtensilsCrossed size={16} />
            <span>Alimentación ({(entregasComidas || []).filter(e => e.eventoId === evento.id).length})</span>
          </button>
        )}
        <button
          className={`tab-link ${activeTab === 'database' ? 'active' : ''}`}
          onClick={() => setActiveTab('database')}
        >
          <Database size={16} />
          <span>Capacidad y Uso DB ({dbMetrics.totalDocumentos})</span>
        </button>
      </div>

      {/* PESTAÑA 1: LISTADO DE ASISTENCIAS */}
      {activeTab === 'asistencias' && (
        <div className="tab-panel">
          <div className="table-controls-bar">
            <div className="search-box">
              <Search size={16} />
              <input
                 type="text"
                 placeholder="Buscar por nombre, documento o placa..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
             </div>

             <div className="filter-box">
               <Filter size={16} />
               <select
                 value={filterVinculacion}
                 onChange={(e) => setFilterVinculacion(e.target.value)}
               >
                 <option value="todos">Todos los roles institucionales</option>
                 <option value="Ponente / Conferencista">Ponente / Conferencista</option>
                 <option value="Estudiante Pregrado Medicina UdeA">Estudiante Pregrado UdeA</option>
                 <option value="Residente / Posgrado UdeA">Residente / Posgrado UdeA</option>
                 <option value="Docente / Investigador UdeA">Docente / Investigador UdeA</option>
                 <option value="Auxiliar / Administrativo UdeA">Auxiliar / Administrativo</option>
                 <option value="Egresado UdeA">Egresado UdeA</option>
                 <option value="Médico / Especialista Externo">Médico / Especialista Externo</option>
               </select>
             </div>

              {asistencias.length > 0 && (
                <button
                  type="button"
                  className="btn-danger-purge"
                  onClick={handleOpenPurgeModal}
                  title="Eliminar permanentemente todos los registros de personas de este evento"
                >
                  <Trash2 size={15} />
                  <span>Eliminar Todos los Asistentes ({asistencias.length})</span>
                </button>
              )}
           </div>

           <div className="table-responsive-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>N°</th>
                  <th style={{ width: '135px' }}>Documento</th>
                  <th style={{ minWidth: '180px' }}>Asistente</th>
                  <th style={{ minWidth: '210px' }}>Contacto</th>
                  <th style={{ minWidth: '160px' }}>Vinculación</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Placa</th>
                  <th style={{ minWidth: '150px' }}>Ubicación GPS</th>
                  <th style={{ width: '140px' }}>Registro</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {asistenciasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="empty-table-row">
                      No se encontraron registros de asistencia que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  asistenciasFiltradas.map((a, idx) => {
                    const dateInfo = formatRegistrationDate(a.fechaRegistro, a.horaRegistro);
                    const isPonente = a.vinculacion?.includes('Ponente');
                    const isEspecialista = a.vinculacion?.includes('Especialista') || a.vinculacion?.includes('Docente');
                    const isEgresado = a.vinculacion?.includes('Egresado');
                    const roleClass = isPonente ? 'role-chip-ponente' : isEspecialista ? 'role-chip-docente' : isEgresado ? 'role-chip-egresado' : 'role-chip-estudiante';

                    return (
                      <tr key={a.id || idx} className="admin-table-row">
                        <td className="row-index-cell">{idx + 1}</td>
                        <td>
                          <div className="doc-cluster">
                            <span className="doc-val">{a.documento}</span>
                            <span className="doc-pill">{a.tipoDocumento || 'CC'}</span>
                          </div>
                        </td>
                        <td className="attendee-name-cell">
                          <span className="attendee-name-text">{a.nombreCompleto}</span>
                        </td>
                        <td>
                          <div className="contact-cluster">
                            <span className="contact-email-text" title={a.correo}>{a.correo}</span>
                            {a.telefono && (
                              <span className="contact-phone-text">
                                <Phone size={11} className="contact-sub-icon" />
                                <span>{a.telefono}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`role-chip ${roleClass}`}>
                            {a.vinculacion || 'Asistente'}
                          </span>
                        </td>
                          <td className="plate-cell text-center">
                            {a.placaVehiculo ? (
                              <span className="plate-badge" title={`Vehículo: ${a.placaVehiculo}`}>
                                <Car size={13} />
                                <span>{a.placaVehiculo}</span>
                              </span>
                            ) : (
                              <span className="no-plate-dash" title="Sin vehículo registrado">—</span>
                            )}
                          </td>
                        <td>
                          <div className="geo-cluster">
                            {a.geolocalizacion?.esPresencial ? (
                              <span className="geo-pill in-situ" title={`Confirmado en sede (a ${a.geolocalizacion.distanciaSedeMetros}m)`}>
                                <CheckCircle2 size={12} />
                                <span>En Sede ({a.geolocalizacion.distanciaSedeMetros}m)</span>
                              </span>
                            ) : (
                              <span className="geo-pill remote" title={a.geolocalizacion?.distanciaSedeMetros ? `A ${a.geolocalizacion.distanciaSedeMetros}m de la sede` : 'Asistencia remota'}>
                                <Globe size={12} />
                                <span>Remoto {a.geolocalizacion?.distanciaSedeMetros ? `(${a.geolocalizacion.distanciaSedeMetros}m)` : ''}</span>
                              </span>
                            )}

                            {a.geolocalizacion?.latitud && a.geolocalizacion?.longitud && (
                              <button
                                type="button"
                                className="btn-geo-map-pill"
                                onClick={() => setSelectedGeoRecord(a)}
                                title="Ver ubicación en mapa satelital interactivo"
                              >
                                <MapPin size={11} />
                                <span>Mapa</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="timestamp-cluster">
                            <span className="time-date-text">{dateInfo.date}</span>
                            <div className="time-sub-line">
                              {dateInfo.time && <span className="time-clock-text">{dateInfo.time}</span>}
                              {(evento.esMultidia || a.diaNumero) && (
                                <span className="day-badge-clean">
                                  Día {a.diaNumero || 1}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="actions-cell text-center">
                          <div className="table-actions-cluster">
                            <button
                              type="button"
                              className="btn-table-action-badge"
                              title={`Ver pase digital oficial de ${a.nombreCompleto}`}
                              onClick={() => setSelectedBadgeAttendee(a)}
                            >
                              <Award size={15} />
                            </button>
                            <button
                              type="button"
                              className="btn-table-action-delete"
                              title={`Eliminar asistencia de ${a.nombreCompleto}`}
                              onClick={async () => {
                                if (window.confirm(`¿Eliminar el registro de asistencia de "${a.nombreCompleto}" (Doc: ${a.documento})?`)) {
                                  await deleteAttendance(a.id);
                                  if (onDataUpdated) onDataUpdated();
                                }
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                      </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: PREGUNTAS A PONENTES (Q&A EN VIVO) */}
      {activeTab === 'preguntas' && (
        <div className="tab-panel">
          <div className="table-controls-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <div className="search-box" style={{ flex: '1', minWidth: '220px' }}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar en preguntas o remitente..."
                value={searchTermQuestions}
                onChange={(e) => setSearchTermQuestions(e.target.value)}
              />
            </div>

            <div className="filter-box">
              <Filter size={16} />
              <select
                value={filterPonente}
                onChange={(e) => setFilterPonente(e.target.value)}
              >
                <option value="todos">Todos los ponentes</option>
                {evento.ponentes?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-box">
              <select
                value={filterEstadoPregunta}
                onChange={(e) => setFilterEstadoPregunta(e.target.value)}
              >
                <option value="todas">Todas las preguntas</option>
                <option value="pendientes">Solo Pendientes ({preguntas.filter(q => !q.respondida).length})</option>
                <option value="destacadas">Solo Destacadas ({preguntas.filter(q => q.destacada).length})</option>
                <option value="respondidas">Solo Respondidas ({preguntas.filter(q => q.respondida).length})</option>
              </select>
            </div>

            <span className="feed-counter">
              Mostrando {preguntasFiltradas.length} de {preguntas.length} preguntas
            </span>
          </div>

          <div className="admin-qa-grid">
            {preguntasFiltradas.length === 0 ? (
              <div className="empty-card-state">
                <HelpCircle size={36} />
                <p>No hay preguntas recibidas para este filtro.</p>
              </div>
            ) : (
              preguntasFiltradas.map((q) => {
                const ponente = evento.ponentes?.find(p => p.id === q.ponenteId);
                const docenteNombre = q.ponenteNombre || ponente?.nombre || (q.ponenteId === 'todos' ? 'Todos los Ponentes / Panel' : 'Docente UdeA');
                return (
                  <div key={q.id} className={`admin-qa-card ${q.destacada ? 'featured' : ''} ${q.respondida ? 'answered' : ''}`}>
                    <div className="admin-qa-header">
                      <span className="qa-target-pill">
                        Dirigida a: <strong>{docenteNombre}</strong>
                        {ponente && ponente.activo === false && (
                          <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}>
                            En Pausa
                          </span>
                        )}
                      </span>
                      <span className="qa-time-stamp">{q.hora}</span>
                    </div>

                    <p className="admin-qa-question">"{q.pregunta}"</p>

                    <div className="admin-qa-footer">
                      <span className="qa-author-tag">Remitente: {q.autor}</span>

                      <div className="qa-actions-group">
                        <button
                          className={`btn-action-pill ${q.respondida ? 'active' : ''}`}
                          onClick={() => {
                            toggleQuestionAnswered(q.id);
                            if (onDataUpdated) onDataUpdated();
                          }}
                        >
                          <CheckCircle size={14} />
                          <span>{q.respondida ? 'Respondida' : 'Marcar Respondida'}</span>
                        </button>

                        <button
                          className={`btn-action-pill star ${q.destacada ? 'active' : ''}`}
                          onClick={() => {
                            toggleQuestionFeatured(q.id);
                            if (onDataUpdated) onDataUpdated();
                          }}
                        >
                          <Star size={14} />
                          <span>{q.destacada ? 'Destacada' : 'Destacar'}</span>
                        </button>

                        <button
                          className="btn-action-pill delete"
                          onClick={async () => {
                            if (confirm('¿Eliminar esta pregunta?')) {
                              await deleteQuestion(q.id);
                              if (onDataUpdated) onDataUpdated();
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: CALIFICACIONES DE PONENTES */}
      {activeTab === 'evaluaciones' && (
        <div className="tab-panel">
          <div className="speakers-admin-overview">
            {evento.ponentes?.map((ponente) => {
              const evals = evaluaciones.filter(e => e.ponenteId === ponente.id);
              const count = evals.length;

              const avgDominio = count > 0
                ? (evals.reduce((acc, ev) => acc + ev.dominio, 0) / count).toFixed(1)
                : '5.0';
              const avgClaridad = count > 0
                ? (evals.reduce((acc, ev) => acc + ev.claridad, 0) / count).toFixed(1)
                : '5.0';
              const avgAplicabilidad = count > 0
                ? (evals.reduce((acc, ev) => acc + ev.aplicabilidad, 0) / count).toFixed(1)
                : '5.0';
              const avgGeneral = count > 0
                ? ((Number(avgDominio) + Number(avgClaridad) + Number(avgAplicabilidad)) / 3).toFixed(1)
                : '5.0';

              return (
                <div key={ponente.id} className="speaker-report-card" style={{ opacity: ponente.activo === false ? 0.78 : 1 }}>
                  <div className="report-card-top">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 className="speaker-card-name" style={{ margin: 0 }}>{ponente.nombre}</h3>
                        <button
                          type="button"
                          onClick={() => handleTogglePonente(ponente.id)}
                          disabled={togglingPonenteId === ponente.id}
                          title={ponente.activo === false ? 'Haga clic para activar a este ponente' : 'Haga clic para pausar/desactivar a este ponente'}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            borderRadius: '12px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: ponente.activo === false ? '#FEF3C7' : '#DCFCE7',
                            color: ponente.activo === false ? '#92400E' : '#166534',
                            transition: 'all .2s ease'
                          }}
                        >
                          <span style={{
                            display: 'inline-block',
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: ponente.activo === false ? '#D97706' : '#16A34A'
                          }}></span>
                          {togglingPonenteId === ponente.id
                            ? 'Actualizando...'
                            : (ponente.activo === false ? 'Inactivo (Pausado)' : 'Activo en Vivo')}
                        </button>
                      </div>
                      <span className="speaker-card-role">{ponente.titulo}</span>
                      <p className="speaker-card-topic">Ponencia: "{ponente.temaPonencia}"</p>
                    </div>
                    <div className="speaker-global-score">
                      <span className="score-num" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Star size={15} fill="#D97706" color="#D97706" /> {avgGeneral}
                      </span>
                      <span className="score-count">{count} evaluaciones</span>
                    </div>
                  </div>

                  <div className="criteria-metrics-bar">
                    <div className="metric-row">
                      <span className="metric-name">Dominio y Actualización:</span>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${(Number(avgDominio) / 5) * 100}%` }}
                        ></div>
                      </div>
                      <strong className="metric-val">{avgDominio} / 5</strong>
                    </div>

                    <div className="metric-row">
                      <span className="metric-name">Claridad Pedagógica:</span>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${(Number(avgClaridad) / 5) * 100}%` }}
                        ></div>
                      </div>
                      <strong className="metric-val">{avgClaridad} / 5</strong>
                    </div>

                    <div className="metric-row">
                      <span className="metric-name">Aplicabilidad Médica:</span>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${(Number(avgAplicabilidad) / 5) * 100}%` }}
                        ></div>
                      </div>
                      <strong className="metric-val">{avgAplicabilidad} / 5</strong>
                    </div>
                  </div>

                  <div className="attendee-comments-box">
                    <h4>Comentarios y aportes de los asistentes ({evals.filter(e => e.comentario).length}):</h4>
                    <div className="comments-scroll">
                      {evals.filter(e => e.comentario).length === 0 ? (
                        <p className="no-comments">No se han registrado comentarios escritos para este ponente.</p>
                      ) : (
                        evals
                          .filter(e => e.comentario)
                          .map((e, idx) => (
                            <div key={e.id || idx} className="comment-quote-row">
                              <div className="comment-quote">
                                "{e.comentario}"
                                <span className="comment-date">— {e.fecha} (Dominio: {e.dominio}/5 | Claridad: {e.claridad}/5 | Aplicabilidad: {e.aplicabilidad}/5)</span>
                              </div>
                              <button
                                className="btn-action-pill delete"
                                title="Eliminar esta valoración del ponente"
                                onClick={async () => {
                                  if (window.confirm('¿Desea eliminar permanentemente esta valoración?')) {
                                    await deleteEvaluation(e.id);
                                    if (onDataUpdated) onDataUpdated();
                                  }
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PESTAÑA: ENCUESTAS RELÁMPAGO Y VOTACIONES EN VIVO */}
      {activeTab === 'encuestas' && (
        <div className="tab-panel">
          {/* Barra de control superior */}
          <div className="polls-admin-header-card" style={{ background: '#FFFFFF', padding: '1.25rem', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BarChart3 size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0F172A', fontWeight: 700 }}>
                    Votaciones y Encuestas Relámpago en Vivo (Live Polls)
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
                    Lanza preguntas de opción múltiple o casos clínicos interactivos para que el público vote en tiempo real desde sus móviles.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {evento?.habilitarEncuestasEnVivo === false ? (
                  <button
                    type="button"
                    className="btn-primary-action"
                    style={{ background: '#7C3AED', borderColor: '#6D28D9' }}
                    onClick={async () => {
                      await saveEvent({ ...evento, habilitarEncuestasEnVivo: true });
                      if (onDataUpdated) onDataUpdated();
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Activar Módulo para este Evento</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary-action"
                    style={{ background: '#0F5938', borderColor: '#0B432A' }}
                    onClick={() => setIsCreatingPoll(prev => !prev)}
                  >
                    {isCreatingPoll ? <X size={16} /> : <Plus size={16} />}
                    <span>{isCreatingPoll ? 'Cancelar' : 'Nueva Encuesta Relámpago'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Aviso si el módulo está desactivado en la configuración del evento */}
            {evento?.habilitarEncuestasEnVivo === false && (
              <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#92400E', fontSize: '0.88rem' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Módulo actualmente deshabilitado:</strong> Los asistentes no verán la sección de votaciones en vivo en sus celulares. Puedes activarlo con el botón superior o desde "Editar Evento".
                </span>
              </div>
            )}
          </div>

          {/* Formulario de creación de nueva encuesta */}
          {isCreatingPoll && (
            <div className="card-form-new-poll animated-step" style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '12px', border: '1.5px solid #7C3AED', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.65rem' }}>
                <h4 style={{ margin: 0, color: '#5B21B6', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem', fontWeight: 700 }}>
                  <BarChart3 size={18} /> Configurar Nueva Pregunta / Caso Clínico
                </h4>
                <span style={{ fontSize: '0.78rem', background: '#EDE9FE', color: '#6D28D9', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                  Votación Inmediata
                </span>
              </div>

              <form onSubmit={handleCrearEncuesta}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, color: '#1E293B', display: 'block', marginBottom: '4px' }}>
                    Pregunta a consultar al auditorio: <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Ej: ¿Cuál es la terapia de primera línea indicada ante este caso clínico?"
                    value={newPollQuestion}
                    onChange={(e) => setNewPollQuestion(e.target.value)}
                    required
                    style={{ width: '100%', resize: 'vertical', minHeight: '60px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, color: '#1E293B', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span>Opciones de respuesta: <span style={{ color: '#DC2626' }}>*</span></span>
                    {newPollOptions.length < 6 && (
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#7C3AED', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                        onClick={() => setNewPollOptions([...newPollOptions, ''])}
                      >
                        <Plus size={13} /> Agregar opción
                      </button>
                    )}
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {newPollOptions.map((opt, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#EDE9FE', color: '#6D28D9', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <input
                          type="text"
                          className="form-input"
                          placeholder={`Opción ${String.fromCharCode(65 + idx)}${idx < 2 ? ' (Obligatoria)' : ' (Opcional)'}`}
                          value={opt}
                          onChange={(e) => {
                            const copy = [...newPollOptions];
                            copy[idx] = e.target.value;
                            setNewPollOptions(copy);
                          }}
                          required={idx < 2}
                          style={{ flex: 1 }}
                        />
                        {newPollOptions.length > 2 && (
                          <button
                            type="button"
                            className="btn-action-pill delete"
                            onClick={() => setNewPollOptions(newPollOptions.filter((_, i) => i !== idx))}
                            title="Eliminar esta opción"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setIsCreatingPoll(false);
                      setNewPollQuestion('');
                      setNewPollOptions(['', '', '']);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-action"
                    disabled={isSubmittingPoll}
                    style={{ background: '#7C3AED', borderColor: '#6D28D9' }}
                  >
                    <BarChart3 size={16} />
                    <span>{isSubmittingPoll ? 'Publicando...' : 'Lanzar Encuesta al Público'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Listado de Encuestas */}
          <div className="polls-admin-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {polls.length === 0 ? (
              <div className="empty-state-card" style={{ background: '#FFFFFF', padding: '3rem 1.5rem', borderRadius: '12px', textAlign: 'center', border: '1px dashed #CBD5E1' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F1F5F9', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <BarChart3 size={28} />
                </div>
                <h4 style={{ margin: '0 0 0.5rem', color: '#1E293B', fontSize: '1.05rem', fontWeight: 700 }}>
                  No hay encuestas relámpago registradas
                </h4>
                <p style={{ margin: '0 auto 1.25rem', color: '#64748B', maxWidth: '420px', fontSize: '0.88rem', lineHeight: 1.4 }}>
                  Crea tu primera pregunta de opción múltiple para que los asistentes voten en tiempo real durante la conferencia o caso clínico.
                </p>
                {evento?.habilitarEncuestasEnVivo !== false && (
                  <button
                    type="button"
                    className="btn-primary-action"
                    onClick={() => setIsCreatingPoll(true)}
                    style={{ margin: '0 auto' }}
                  >
                    <Plus size={16} />
                    <span>Crear Primera Encuesta</span>
                  </button>
                )}
              </div>
            ) : (
              polls.map((poll) => {
                const totalVotos = Number(poll.totalVotos) || 0;
                const isActiva = poll.estado === 'ACTIVA';

                return (
                  <div
                    key={poll.id}
                    className="poll-admin-card"
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      border: isActiva ? '2px solid #7C3AED' : '1px solid #E2E8F0',
                      padding: '1.25rem',
                      boxShadow: isActiva ? '0 4px 16px rgba(124, 58, 237, 0.08)' : '0 2px 6px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '20px',
                          background: isActiva ? '#DCFCE7' : '#F1F5F9',
                          color: isActiva ? '#166534' : '#64748B',
                          border: `1px solid ${isActiva ? '#86EFAC' : '#CBD5E1'}`
                        }}>
                          {isActiva ? '🟢 ACTIVA (Recibiendo votos)' : '🔒 CERRADA'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                          👥 {totalVotos} {totalVotos === 1 ? 'voto' : 'votos'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        {isActiva ? (
                          <button
                            type="button"
                            className="btn-action-pill"
                            style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
                            onClick={() => handleToggleEstadoEncuesta(poll.id, 'CERRADA')}
                            title="Cerrar votación (bloquea nuevos votos)"
                          >
                            <Lock size={13} />
                            <span>Cerrar Votación</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-action-pill"
                            style={{ background: '#EDE9FE', color: '#6D28D9', border: '1px solid #C4B5FD', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
                            onClick={() => handleToggleEstadoEncuesta(poll.id, 'ACTIVA')}
                            title="Reabrir votación para recibir más respuestas"
                          >
                            <Play size={13} />
                            <span>Reabrir Votación</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-action-pill delete"
                          onClick={() => handleEliminarEncuesta(poll.id)}
                          title="Eliminar encuesta"
                          style={{ padding: '5px 8px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <h4 style={{ margin: '0 0 1.15rem', color: '#0F172A', fontSize: '1.08rem', fontWeight: 700, lineHeight: 1.35 }}>
                      {poll.pregunta}
                    </h4>

                    {/* Barras de resultados en vivo */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {(poll.opciones || []).map((opt, idx) => {
                        const count = Number(opt.votos) || 0;
                        const pct = totalVotos > 0 ? Math.round((count / totalVotos) * 100) : 0;
                        const isLeading = totalVotos > 0 && Math.max(...poll.opciones.map(o => Number(o.votos) || 0)) === count && count > 0;

                        return (
                          <div key={opt.id || idx} style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px 12px', border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden' }}>
                            {/* Barra de progreso de fondo */}
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${pct}%`,
                                background: isLeading ? 'rgba(15, 89, 56, 0.12)' : 'rgba(124, 58, 237, 0.08)',
                                transition: 'width 0.4s ease',
                                pointerEvents: 'none'
                              }}
                            />

                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  background: isLeading ? '#0F5938' : '#64748B',
                                  color: '#FFFFFF',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <span style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.92rem' }}>
                                  {opt.texto}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                                  {count} {count === 1 ? 'voto' : 'votos'}
                                </span>
                                <strong style={{ fontSize: '0.95rem', color: isLeading ? '#0F5938' : '#7C3AED', minWidth: '42px', textAlign: 'right' }}>
                                  {pct}%
                                </strong>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 4: SATISFACCIÓN GENERAL */}
      {activeTab === 'satisfaccion' && (
        <div className="tab-panel">
          <div className="satisfaction-admin-grid">
            <div className="satisfaction-kpi-card">
              <h3>Net Promoter Score (NPS)</h3>
              <div className="nps-big-score">{promedioNPS} <small>/ 10</small></div>
              <p className="nps-desc">
                Índice de recomendación académica de los cursos de Educación a lo Largo de la Vida de la Facultad de Medicina.
              </p>
            </div>

            <div className="satisfaction-kpi-card">
              <h3>Cumplimiento de Objetivos</h3>
              <div className="nps-big-score">{promedioExpectativas} <small>/ 5</small></div>
              <p className="nps-desc">
                Calificación promedio sobre el alcance y pertinencia académica del evento.
              </p>
            </div>
          </div>

          <div className="suggestions-list-card">
            <h3>Sugerencias temáticas para futuros cursos y diplomados UdeA ({satisfaccion.filter(s => s.sugerencias).length})</h3>
            <div className="suggestions-scroll">
              {satisfaccion.filter(s => s.sugerencias).length === 0 ? (
                <p className="no-comments">No se han registrado sugerencias para futuros eventos.</p>
              ) : (
                satisfaccion
                  .filter(s => s.sugerencias)
                  .map((s, idx) => (
                    <div key={s.id || idx} className="suggestion-item-row">
                      <div className="suggestion-item">
                        <p className="suggestion-text">"{s.sugerencias}"</p>
                        <span className="suggestion-meta">Recibida el {s.fecha} • NPS: {s.npsRecomendacion}/10 • Objetivos: {s.cumplimientoObjetivos}/5</span>
                      </div>
                      <button
                        className="btn-action-pill delete"
                        title="Eliminar este registro de satisfacción"
                        onClick={async () => {
                          if (window.confirm('¿Desea eliminar permanentemente esta respuesta de satisfacción?')) {
                            await deleteSatisfaction(s.id);
                            if (onDataUpdated) onDataUpdated();
                          }
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 5: EXCEL Y MICROSOFT FORMS */}
      {activeTab === 'integracion' && (
        <div className="tab-panel">
          <div className="integration-cards-grid">
            {/* Tarjeta de Exportación a Excel */}
            <div className="integration-card">
              <div className="int-header">
                <FileSpreadsheet size={28} className="excel-icon" />
                <div>
                  <h3>Reporte Consolidado en Excel (.xlsx)</h3>
                  <p>Descarga un libro de Microsoft Excel en tiempo real con 5 hojas ordenadas.</p>
                </div>
              </div>

              <ul className="sheet-breakdown-list">
                <li><strong>Hoja 1:</strong> Asistencias y Validación de Geolocalización GPS.</li>
                <li><strong>Hoja 2:</strong> Preguntas formuladas a Ponentes (Q&A).</li>
                <li><strong>Hoja 3:</strong> Calificaciones y Criterios por Ponente.</li>
                <li><strong>Hoja 4:</strong> Encuesta de Satisfacción General y Métricas NPS.</li>
                <li><strong>Hoja 5:</strong> Ficha Técnica Institucional del Evento.</li>
              </ul>

              <button className="btn-primary-action full-width" onClick={handleDescargarExcel}>
                <Download size={18} />
                <span>Descargar Libro Completo en Excel (.xlsx)</span>
              </button>
            </div>

            {/* Tarjeta de Conexión con Microsoft Forms */}
            <div className="integration-card">
              <div className="int-header">
                <ExternalLink size={28} className="msforms-icon" />
                <div>
                  <h3>Conexión y Formato Microsoft Forms</h3>
                  <p>Compatibilidad con Microsoft 365, SharePoint y Power Automate institucional.</p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">URL del Formulario Institucional (Microsoft Forms o Google Forms):</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://forms.office.com/r/... o https://forms.gle/..."
                    value={msFormsUrl}
                    onChange={(e) => setMsFormsUrl(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ whiteSpace: 'nowrap', padding: '9px 14px' }}
                    disabled={isSavingFormsUrl}
                    onClick={async () => {
                      if (!evento?.id) {
                        alert('No hay un evento seleccionado para vincular.');
                        return;
                      }
                      setIsSavingFormsUrl(true);
                      try {
                        const trimmedUrl = msFormsUrl.trim();
                        const updated = {
                          ...evento,
                          microsoftFormsUrl: trimmedUrl,
                          habilitarMicrosoftForms: Boolean(trimmedUrl)
                        };
                        await saveEvent(updated);
                        if (onDataUpdated) onDataUpdated();
                        setFormsUrlFeedback('¡Enlace institucional vinculado y activado para los asistentes con éxito!');
                        setTimeout(() => setFormsUrlFeedback(''), 4000);
                      } catch (err) {
                        console.error('Error guardando enlace Forms:', err);
                        alert('Error al guardar el enlace: ' + (err?.message || 'Error'));
                      } finally {
                        setIsSavingFormsUrl(false);
                      }
                    }}
                  >
                    {isSavingFormsUrl ? 'Guardando...' : 'Guardar y Habilitar Enlace'}
                  </button>
                </div>
                {formsUrlFeedback && (
                  <p style={{ color: '#006633', fontSize: '0.85rem', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={14} /> {formsUrlFeedback}
                  </p>
                )}
              </div>

              <div className="msforms-actions">
                {msFormsUrl ? (
                  <a
                    href={msFormsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary full-width"
                  >
                    <ExternalLink size={16} />
                    <span>Abrir Formulario Institucional Vinculado</span>
                  </a>
                ) : (
                  <p className="no-url-notice">Puede pegar el enlace de su encuesta institucional (Microsoft Forms o Google Forms) arriba y hacer clic en &quot;Guardar y Habilitar Enlace&quot; para vincularlo al evento.</p>
                )}

                <button className="btn-secondary full-width" onClick={handleDescargarMsForms}>
                  <Download size={16} />
                  <span>Exportar Formato Idéntico a Microsoft Forms (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Tarjeta de Seguridad y Cambio de Contraseña */}
            <div className="integration-card">
              <div className="int-header">
                <Shield size={28} className="security-icon" />
                <div>
                  <h3>Seguridad y Contraseña Administrativa</h3>
                  <p>Gestión de la clave de acceso para moderadores de la Facultad.</p>
                </div>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setPwdMsg({ text: '', isError: false });
                  const res = await changeAdminPassword(currentPwd, newPwd);
                  if (res.success) {
                    setPwdMsg({ text: res.message, isError: false });
                    setCurrentPwd('');
                    setNewPwd('');
                  } else {
                    setPwdMsg({ text: res.message, isError: true });
                  }
                }}
                className="pwd-change-form"
              >
                <div className="form-group">
                  <label className="form-sublabel">Contraseña Actual:</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Contraseña actual"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-sublabel">Nueva Contraseña (mínimo 6 caracteres):</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Nueva contraseña segura"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    required
                  />
                </div>

                {pwdMsg.text && (
                  <div className={`pwd-status-msg ${pwdMsg.isError ? 'error' : 'success'}`}>
                    {pwdMsg.text}
                  </div>
                )}

                <button type="submit" className="btn-secondary full-width">
                  <KeyRound size={15} />
                  <span>Actualizar Contraseña de Acceso</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 6: CONTROL DE ALIMENTACIÓN Y REFRIGERIOS */}
      {activeTab === 'alimentacion' && (
        <div className="tab-panel animated-step">
          <div className="pane-header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F5938', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UtensilsCrossed size={20} />
                <span>Control y Entrega de Almuerzos y Refrigerios</span>
              </h3>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748B' }}>
                Escanea el código QR de la escarapela digital para validar y registrar la entrega en tiempo real con Cloud Firestore.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary-action"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1rem', fontSize: '0.88rem' }}
                onClick={() => setIsMealScannerOpen(true)}
              >
                <Camera size={16} />
                <span>Abrir Escáner de Comidas</span>
              </button>
            </div>
          </div>

          {/* Tarjetas de Comidas Configuradas y Progreso */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
            {(evento.comidasConfig || []).map((comida) => {
              const entregadas = (entregasComidas || []).filter(e => e.eventoId === evento.id && e.comidaId === comida.id).length;
              const totalObjetivo = comida.cantidadTotal ? Number(comida.cantidadTotal) : totalAsistentes;
              const porcentaje = totalObjetivo > 0 ? Math.round((entregadas / totalObjetivo) * 100) : 0;
              const restantes = Math.max(0, totalObjetivo - entregadas);
              const isSelected = mealFilterId === comida.id;
              return (
                <div
                  key={comida.id}
                  onClick={() => setMealFilterId(isSelected ? 'ALL' : comida.id)}
                  style={{
                    background: isSelected ? '#F0FDF4' : '#FFFFFF',
                    border: isSelected ? '2px solid #006633' : '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '0.85rem 1rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B' }}>{comida.nombre}</span>
                    <UtensilsCrossed size={15} color={isSelected ? '#006633' : '#94A3B8'} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '4px' }}>
                    {comida.horario && (
                      <span style={{ fontSize: '0.73rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={11} /> {comida.horario}
                      </span>
                    )}
                    {comida.cantidadTotal ? (
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0F5938', background: '#E8F5E9', padding: '1px 6px', borderRadius: '4px' }}>
                        {comida.cantidadTotal} raciones
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.4rem' }}>
                    <strong style={{ fontSize: '1.2rem', color: '#0F5938' }}>{entregadas}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      de {totalObjetivo} ({porcentaje}%) • {restantes} rest.
                    </span>
                  </div>
                  <div style={{ background: '#E2E8F0', height: '5px', borderRadius: '3px', marginTop: '0.4rem', overflow: 'hidden' }}>
                    <div style={{ background: porcentaje >= 100 ? '#DC2626' : '#006633', height: '100%', width: `${Math.min(100, porcentaje)}%`, transition: 'width 0.3s' }}></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filtros y Búsqueda de Entregas */}
          <div className="table-filters" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-input-wrap" style={{ flex: 1, minWidth: '220px' }}>
              <Search size={15} className="search-icon" />
              <input
                type="text"
                className="form-input search-input"
                placeholder="Buscar entrega por nombre o cédula..."
                value={mealSearchTerm}
                onChange={(e) => setMealSearchTerm(e.target.value)}
              />
            </div>
            <div className="filter-select-wrap">
              <Filter size={15} className="filter-icon" />
              <select
                className="form-input filter-select"
                value={mealFilterId}
                onChange={(e) => setMealFilterId(e.target.value)}
              >
                <option value="ALL">Todas las Comidas</option>
                {(evento.comidasConfig || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            {mealFilterId !== 'ALL' && (
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.4rem 0.65rem' }}
                onClick={() => setMealFilterId('ALL')}
              >
                Limpiar Filtro
              </button>
            )}
          </div>

          {/* Tabla de Entregas de Alimentación */}
          {filteredMealDeliveries.length === 0 ? (
            <div className="empty-tab-state" style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
              <UtensilsCrossed size={40} color="#94A3B8" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
              <h4 style={{ margin: '0 0 0.35rem', color: '#334155' }}>No hay entregas registradas aún</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B' }}>
                Abre el escáner con la cámara del celular para comenzar a registrar entregas de comida a los asistentes.
              </p>
              <button
                type="button"
                className="btn-primary-action"
                style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => setIsMealScannerOpen(true)}
              >
                <Camera size={15} />
                <span>Abrir Escáner Ahora</span>
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Documento</th>
                    <th>Nombre Asistente</th>
                    <th>Comida / Refrigerio</th>
                    <th>Método</th>
                    <th>Operador</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMealDeliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: '#64748B' }}>
                        <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                        {delivery.horaEntrega || '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap' }}>
                        {delivery.tipoDocumento || 'CC'}: {delivery.documento}
                      </td>
                      <td style={{ fontWeight: 500, color: '#0F172A' }}>
                        {delivery.nombreCompleto}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#E8F5E9', color: '#0F5938', padding: '2px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600 }}>
                          <UtensilsCrossed size={12} />
                          {delivery.comidaNombre}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          {(delivery.metodo === 'BARCODE_SCANNER_USB' || delivery.metodo === 'HONEYWELL_USB_DESK' || delivery.metodo === 'ESCANER_USB')
                            ? 'Escáner USB'
                            : delivery.metodo === 'MANUAL'
                            ? 'Manual'
                            : 'Cámara QR'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748B' }}>
                        {delivery.operador || 'Logística UdeA'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-action-icon delete"
                          onClick={async () => {
                            if (window.confirm(`¿Deseas anular la entrega de "${delivery.comidaNombre}" a ${delivery.nombreCompleto} (${delivery.documento})? Podrá volver a reclamar.`)) {
                              await deleteMealDelivery(delivery.id);
                              if (onDataUpdated) onDataUpdated();
                            }
                          }}
                          title="Anular entrega de este participante"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 7: ESTADO Y CAPACIDAD DE LA BASE DE DATOS EN TIEMPO REAL */}
      {activeTab === 'database' && (
        <div className="tab-panel">
          {/* Header con Badge Pulsante de Estado Firestore */}
          <div className="db-status-hero">
            <div className="db-status-hero-left">
              <div className="db-live-indicator">
                <span className="live-dot" />
                <span className="live-text">Google Cloud Firestore en Tiempo Real</span>
              </div>
              <h3 className="db-status-title">Monitor de Capacidad y Almacenamiento Global</h3>
              <p className="db-status-subtitle">
                Supervisión continua de cuotas, volumen de almacenamiento y documentos en la nube institucional UdeA (Plan Firebase Spark - 100% Gratuito) acumulado de todos los eventos académicos.
              </p>
            </div>
            <div className="db-status-hero-right">
              <div className="db-sync-badge">
                <Activity size={15} />
                <span>Última sincronización: <strong>{dbMetrics.lastSync}</strong></span>
              </div>
            </div>
          </div>

          {/* Grid de Métricas de Almacenamiento y Capacidad */}
          <div className="db-metrics-grid">
            {/* Tarjeta 1: Almacenamiento Consumido Global */}
            <div className="db-metric-card">
              <div className="db-card-header">
                <div className="db-card-title-wrap">
                  <HardDrive size={20} className="db-icon-primary" />
                  <h4>Almacenamiento Global (Todos los Eventos)</h4>
                </div>
                <span className="db-badge-free">1 GiB Gratuito</span>
              </div>

              <div className="db-storage-main-val">
                <span className="storage-num">{dbMetrics.totalKB}</span>
                <span className="storage-unit">KB</span>
                <span className="storage-approx">({dbMetrics.totalBytes.toLocaleString()} bytes)</span>
              </div>

              {/* Barra de Progreso de Almacenamiento */}
              <div className="db-progress-wrapper">
                <div className="db-progress-bar-bg">
                  <div
                    className="db-progress-bar-fill"
                    style={{ width: `${Math.max(parseFloat(dbMetrics.porcentajeUso) * 100, 1.2)}%` }}
                  />
                </div>
                <div className="db-progress-labels">
                  <span>Uso Global: <strong>{dbMetrics.porcentajeUso}%</strong> del límite</span>
                  <span>Restante: <strong>{(1024 - parseFloat(dbMetrics.totalMB)).toFixed(2)} MB libres</strong></span>
                </div>
              </div>

              <p className="db-metric-footnote">
                Métrica consolidada de todos los eventos académicos registrados en la plataforma. Consume una fracción mínima del límite gratuito de 1.024 MB (1 GiB) de Firestore Spark.
              </p>
            </div>

            {/* Tarjeta 2: Operaciones Diarias de Lectura / Escritura */}
            <div className="db-metric-card">
              <div className="db-card-header">
                <div className="db-card-title-wrap">
                  <Server size={20} className="db-icon-primary" />
                  <h4>Cuotas de Operaciones Diarias</h4>
                </div>
                <span className="db-badge-quota">Plan Spark</span>
              </div>

              <div className="db-quota-list">
                <div className="db-quota-item">
                  <div className="quota-info">
                    <span className="quota-name">Escrituras Diarias Gratuitas</span>
                    <span className="quota-limit">Hasta 20.000 / día</span>
                  </div>
                  <div className="quota-status-pill green">
                    <CheckCircle size={13} />
                    <span>Holgura Alta (Soporta miles de registros)</span>
                  </div>
                </div>

                <div className="db-quota-item">
                  <div className="quota-info">
                    <span className="quota-name">Lecturas Diarias Gratuitas</span>
                    <span className="quota-limit">Hasta 50.000 / día</span>
                  </div>
                  <div className="quota-status-pill green">
                    <CheckCircle size={13} />
                    <span>Holgura Alta (Sincronización multi-pantalla)</span>
                  </div>
                </div>

                <div className="db-quota-item">
                  <div className="quota-info">
                    <span className="quota-name">Conexiones Simultáneas</span>
                    <span className="quota-limit">Hasta 100 en tiempo real</span>
                  </div>
                  <div className="quota-status-pill blue">
                    <Wifi size={13} />
                    <span>Auditorios y Aulas UdeA</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desglose por Colección en Tiempo Real */}
          <div className="db-collections-panel">
            <h4 className="db-panel-heading">
              <Database size={18} />
              <span>Desglose de Colecciones Globales en Tiempo Real ({dbMetrics.totalDocumentos} documentos en total)</span>
            </h4>

            <div className="db-collections-grid">
              {(dbMetrics.collections || []).map((col) => (
                <div className="db-collection-card" key={col.name}>
                  <div className="col-top">
                    <span className="col-name">{col.label || col.name}</span>
                    <span className="col-count">{col.count} docs</span>
                  </div>
                  <div className="col-size-bar">
                    <span>Tamaño acumulado: <strong>{col.kb} KB</strong> ({col.bytes.toLocaleString()} bytes)</span>
                  </div>
                  <div className="col-meta">{col.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tarjeta de Respaldo y Acciones de Base de Datos */}
          <div className="db-backup-card">
            <div className="backup-card-info">
              <h4>Respaldo y Portabilidad de la Base de Datos</h4>
              <p>
                Descargue un volcado íntegro de la base de datos en formato JSON para copias de seguridad de auditoría institucional, o restaure datos en caso de contingencia.
              </p>
            </div>
            <div className="backup-card-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={exportDatabaseBackupJSON}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Download size={16} />
                <span>Exportar Respaldo Completo (JSON)</span>
              </button>
              <label
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}
              >
                <Upload size={16} />
                <span>Restaurar Respaldo (JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const text = await file.text();
                        const res = importDatabaseBackupJSON(text);
                        alert(res.message || (res.success ? 'Respaldo importado correctamente.' : 'Error al importar'));
                        if (res.success && onDataUpdated) onDataUpdated();
                      } catch (err) {
                        alert('Error al leer el archivo JSON: ' + err.message);
                      }
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INSPECCIÓN DE UBICACIÓN GPS EXACTA */}
      {selectedGeoRecord && (
        <div className="modal-overlay" onClick={() => setSelectedGeoRecord(null)}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', padding: '1.75rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ background: '#ecfdf5', padding: '0.5rem', borderRadius: '8px', color: '#059669', display: 'flex' }}>
                  <MapPin size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: '700' }}>
                    Ubicación Satelital del Registro
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                    Auditoría de presencia y geolocalización en tiempo real
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setSelectedGeoRecord(null)}
                title="Cerrar modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Ficha de Asistente */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1rem', color: '#1e293b' }}>
                    {selectedGeoRecord.nombreCompleto}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Doc: <strong>{selectedGeoRecord.documento}</strong> ({selectedGeoRecord.tipoDocumento || 'CC'}) • {selectedGeoRecord.vinculacion}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Registrado el: <strong>{selectedGeoRecord.fechaRegistro}</strong>
                  </div>
                </div>

                <div>
                  {selectedGeoRecord.geolocalizacion?.esPresencial ? (
                    <span className="geo-badge-success" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>
                      <CheckCircle size={14} /> En Sede Oficial
                    </span>
                  ) : (
                    <span className="geo-badge-warning" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>
                      <AlertCircle size={14} /> Fuera de Sede / Remoto
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed #cbd5e1' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Distancia a Sede</span>
                  <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>
                    {selectedGeoRecord.geolocalizacion?.distanciaSedeMetros !== undefined
                      ? `${selectedGeoRecord.geolocalizacion.distanciaSedeMetros} metros`
                      : 'No calculada'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Precisión GPS</span>
                  <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>
                    ±{selectedGeoRecord.geolocalizacion?.precisionMetros || 10} m
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Coordenadas</span>
                  <div style={{ fontWeight: '600', color: '#0369a1', fontSize: '0.85rem' }}>
                    {selectedGeoRecord.geolocalizacion?.latitud?.toFixed(6)}, {selectedGeoRecord.geolocalizacion?.longitud?.toFixed(6)}
                  </div>
                </div>
              </div>
            </div>

            {/* Mapa Interactivo Embebido (OpenStreetMap) */}
            {selectedGeoRecord.geolocalizacion?.latitud && selectedGeoRecord.geolocalizacion?.longitud && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MapPin size={15} color="#059669" />
                  <span>Visor Cartográfico (Marcador en la posición exacta del dispositivo):</span>
                </div>
                <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                  <iframe
                    title="Ubicación Asistente"
                    width="100%"
                    height="300"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight="0"
                    marginWidth="0"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedGeoRecord.geolocalizacion.longitud - 0.005}%2C${selectedGeoRecord.geolocalizacion.latitud - 0.005}%2C${selectedGeoRecord.geolocalizacion.longitud + 0.005}%2C${selectedGeoRecord.geolocalizacion.latitud + 0.005}&layer=mapnik&marker=${selectedGeoRecord.geolocalizacion.latitud}%2C${selectedGeoRecord.geolocalizacion.longitud}`}
                    style={{ display: 'block', width: '100%' }}
                  />
                </div>
              </div>
            )}

            {/* Botones de Acción */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <a
                href={`https://www.google.com/maps?q=${selectedGeoRecord.geolocalizacion?.latitud},${selectedGeoRecord.geolocalizacion?.longitud}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
              >
                <ExternalLink size={15} />
                <span>Abrir en Google Maps</span>
              </a>

              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedGeoRecord(null)}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para visualizar el pase digital oficial de cualquier asistente */}
      {selectedBadgeAttendee && (
        <DigitalBadge
          asistente={selectedBadgeAttendee}
          evento={evento}
          isModal={true}
          onClose={() => setSelectedBadgeAttendee(null)}
        />
      )}

      {/* Modal Seguro para Purgar / Eliminar Todos los Asistentes con cuenta de 3 segundos */}
      {showPurgeModal && (
        <div className="modal-overlay" onClick={() => !isPurging && setShowPurgeModal(false)}>
          <div className="modal-container purge-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="purge-modal-header">
              <div className="purge-icon-circle">
                <AlertCircle size={32} />
              </div>
              <h3 className="purge-modal-title">¿Eliminar Todos los Asistentes?</h3>
              <p className="purge-modal-subtitle">
                Esta acción eliminará de forma <strong>permanente e irreversible</strong> el registro de las <strong>{asistencias.length} personas</strong> inscritas en <em>"{evento?.titulo || 'este evento'}"</em>.
              </p>
            </div>

            <div className="purge-modal-warning-box">
              <p>
                <AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: '5px', color: '#DC2626' }} />
                <strong>Atención de Auditoría:</strong> Se purgarán los comprobantes oficiales de ingreso y asistencias tanto de la base de datos local como de la nube institucional.
              </p>
            </div>

            <div className="purge-countdown-indicator">
              {purgeCountdown > 0 ? (
                <div className="countdown-pill locked">
                  <Clock size={16} />
                  <span>Por seguridad institucional, confirmación habilitada en: <strong>{purgeCountdown}s</strong></span>
                </div>
              ) : (
                <div className="countdown-pill ready">
                  <CheckCircle size={16} />
                  <span>Confirmación autorizada. Haga clic en el botón rojo para proceder.</span>
                </div>
              )}
            </div>

            <div className="purge-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowPurgeModal(false)}
                disabled={isPurging}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`btn-danger-confirm ${purgeCountdown > 0 || isPurging ? 'disabled' : 'active'}`}
                onClick={handleConfirmPurgeAll}
                disabled={purgeCountdown > 0 || isPurging}
                title={purgeCountdown > 0 ? `Espere ${purgeCountdown} segundos para habilitar la confirmación` : 'Eliminar permanentemente todos los registros'}
              >
                <Trash2 size={16} />
                <span>
                  {isPurging
                    ? 'Purgando datos...'
                    : purgeCountdown > 0
                    ? `Espere (${purgeCountdown}s)...`
                    : `Eliminar Definitivamente (${asistencias.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Escaneo y Acreditación de QR en Puerta con Cámara */}
      {isQRScannerOpen && (
        <QRScannerModal
          isOpen={isQRScannerOpen}
          onClose={() => setIsQRScannerOpen(false)}
          eventoActual={evento}
          onDataUpdated={onDataUpdated}
        />
      )}

      {/* Modal de Escaneo de Alimentación / Almuerzos / Refrigerios con Cámara */}
      {isMealScannerOpen && (
        <MealScannerModal
          isOpen={isMealScannerOpen}
          onClose={() => setIsMealScannerOpen(false)}
          eventoActual={evento}
          asistencias={asistencias}
          entregasComidas={entregasComidas}
          onDataUpdated={onDataUpdated}
        />
      )}

      {/* Modal de Escaneo con Lector de Barras USB (PC / Computador) */}
      {isBarcodeDeskModalOpen && (
        <BarcodeScannerDeskModal
          isOpen={isBarcodeDeskModalOpen}
          onClose={() => setIsBarcodeDeskModalOpen(false)}
          evento={evento}
          asistencias={asistencias}
          entregasComidas={entregasComidas}
          onDataUpdated={onDataUpdated}
        />
      )}

      {/* Modal para Seleccionar Evento a Editar de la Lista de Existentes */}
      {isEditSelectorOpen && (
        <EventSelectorModal
          isOpen={isEditSelectorOpen}
          onClose={() => setIsEditSelectorOpen(false)}
          events={events}
          currentEventId={evento?.id}
          onSelectForEdit={(ev) => {
            if (onOpenEditEventModal) onOpenEditEventModal(ev);
          }}
          onSelectToView={(ev) => {
            if (onSelectEvent) onSelectEvent(ev);
          }}
          onOpenNewEvent={onOpenNewEventModal}
        />
      )}

      {/* Modal para Carga y Verificación de Lista de Inscritos (Excel / CSV) */}
      {isInscritosModalOpen && (
        <InscritosModal
          isOpen={isInscritosModalOpen}
          onClose={() => setIsInscritosModalOpen(false)}
          evento={evento}
          onInscritosUpdated={onDataUpdated}
        />
      )}
    </div>
  );
}
