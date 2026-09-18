import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, HelpCircle, Star, ThumbsUp, Download, QrCode, Plus, Search,
  Filter, CheckCircle, Clock, MapPin, Car, AlertCircle, FileSpreadsheet,
  ExternalLink, Trash2, Shield, KeyRound, LogOut, Upload, X, Award,
  Database, HardDrive, Server, Activity, Wifi, Camera, Edit3,
  CheckCircle2, Globe, Phone
} from 'lucide-react';
import DigitalBadge from './DigitalBadge';
import QRScannerModal from './QRScannerModal';
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
  isFirebaseConfigured,
  exportDatabaseBackupJSON,
  importDatabaseBackupJSON,
  saveEvent
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
  const [isEditSelectorOpen, setIsEditSelectorOpen] = useState(false);
  const [isInscritosModalOpen, setIsInscritosModalOpen] = useState(false);

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
      alert(`✓ Se han eliminado exitosamente todos los registros de asistencia del evento "${evento?.titulo || ''}".`);
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

  // -------------------------------------------------------------
  // MONITOR DE CAPACIDAD Y ALMACENAMIENTO EN TIEMPO REAL (FIRESTORE)
  // -------------------------------------------------------------
  const dbMetrics = useMemo(() => {
    const aJson = JSON.stringify(asistencias || []);
    const pJson = JSON.stringify(preguntas || []);
    const eJson = JSON.stringify(evaluaciones || []);
    const sJson = JSON.stringify(satisfaccion || []);

    const aBytes = typeof Blob !== 'undefined' ? new Blob([aJson]).size : aJson.length;
    const pBytes = typeof Blob !== 'undefined' ? new Blob([pJson]).size : pJson.length;
    const eBytes = typeof Blob !== 'undefined' ? new Blob([eJson]).size : eJson.length;
    const sBytes = typeof Blob !== 'undefined' ? new Blob([sJson]).size : sJson.length;

    const totalBytes = aBytes + pBytes + eBytes + sBytes;
    const totalKB = (totalBytes / 1024).toFixed(2);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(4);

    // Límite Spark Firestore: 1 GiB = 1024 MB
    const MAX_STORAGE_BYTES = 1024 * 1024 * 1024;
    const porcentajeUso = ((totalBytes / MAX_STORAGE_BYTES) * 100).toFixed(4);
    const totalDocumentos = (asistencias?.length || 0) + (preguntas?.length || 0) + (evaluaciones?.length || 0) + (satisfaccion?.length || 0);

    return {
      asistenciasCount: asistencias?.length || 0,
      asistenciasKB: (aBytes / 1024).toFixed(1),
      preguntasCount: preguntas?.length || 0,
      preguntasKB: (pBytes / 1024).toFixed(1),
      evaluacionesCount: evaluaciones?.length || 0,
      evaluacionesKB: (eBytes / 1024).toFixed(1),
      satisfaccionCount: satisfaccion?.length || 0,
      satisfaccionKB: (sBytes / 1024).toFixed(1),
      totalDocumentos,
      totalBytes,
      totalKB,
      totalMB,
      porcentajeUso,
      isFirebaseLive: isFirebaseConfigured(),
      lastSync: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  }, [asistencias, preguntas, evaluaciones, satisfaccion]);

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
      String(q?.autor || '').toLowerCase().includes(termQ);

    let matchEstado = true;
    if (filterEstadoPregunta === 'pendientes') matchEstado = !q?.respondida;
    else if (filterEstadoPregunta === 'respondidas') matchEstado = q?.respondida;
    else if (filterEstadoPregunta === 'destacadas') matchEstado = q?.destacada;

    return matchPonente && matchSearch && matchEstado;
  });

  const handleDescargarExcel = () => {
    try {
      exportEventDataToExcel({
        evento,
        asistencias,
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
              {isFirebaseConfigured() ? '☁️ Cloud Firestore Activo' : '💾 Modo Local de Contingencia'}
            </span>
          </div>
          <p className="admin-subheading">
            Gestión de asistencia, geolocalización, preguntas al ponente y reportes de Educación a lo Largo de la Vida.
          </p>
        </div>

        <div className="admin-buttons-group">
          <button
            type="button"
            className="btn-primary-action btn-scanner-action"
            onClick={() => setIsQRScannerOpen(true)}
            title="Escanear en vivo con la cámara del celular o webcam para verificar y acreditar credenciales"
          >
            <Camera size={16} />
            <span>Escanear QR en Puerta</span>
          </button>
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
                    alert(`✓ Respaldo restaurado exitosamente: ${res.countEvents} eventos y ${res.countAttendance} asistencias.`);
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

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Preguntas a Ponentes</span>
            <div className="kpi-icon-wrap gold">
              <HelpCircle size={18} />
            </div>
          </div>
          <div className="kpi-value">{totalPreguntas}</div>
          <span className="kpi-meta">
            {preguntasRespondidas} de {totalPreguntas} respondidas en vivo
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Calificación Ponentes</span>
            <div className="kpi-icon-wrap amber">
              <Star size={18} />
            </div>
          </div>
          <div className="kpi-value">★ {promedioPonentes}</div>
          <span className="kpi-meta">Basado en {totalEvals} evaluaciones</span>
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
        <button
          className={`tab-link ${activeTab === 'preguntas' ? 'active' : ''}`}
          onClick={() => setActiveTab('preguntas')}
        >
          <HelpCircle size={16} />
          <span>Preguntas a Ponentes ({totalPreguntas})</span>
        </button>
        <button
          className={`tab-link ${activeTab === 'evaluaciones' ? 'active' : ''}`}
          onClick={() => setActiveTab('evaluaciones')}
        >
          <Star size={16} />
          <span>Calificaciones de Ponentes</span>
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
                              🚗 {a.placaVehiculo}
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
                <option value="pendientes">⏳ Solo Pendientes ({preguntas.filter(q => !q.respondida).length})</option>
                <option value="destacadas">★ Solo Destacadas ({preguntas.filter(q => q.destacada).length})</option>
                <option value="respondidas">✓ Solo Respondidas ({preguntas.filter(q => q.respondida).length})</option>
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
                return (
                  <div key={q.id} className={`admin-qa-card ${q.destacada ? 'featured' : ''} ${q.respondida ? 'answered' : ''}`}>
                    <div className="admin-qa-header">
                      <span className="qa-target-pill">
                        Dirigida a: <strong>{ponente?.nombre || 'Ponente'}</strong>
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
                          onClick={() => {
                            if (confirm('¿Eliminar esta pregunta?')) {
                              deleteQuestion(q.id);
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
                <div key={ponente.id} className="speaker-report-card">
                  <div className="report-card-top">
                    <div>
                      <h3 className="speaker-card-name">{ponente.nombre}</h3>
                      <span className="speaker-card-role">{ponente.titulo}</span>
                      <p className="speaker-card-topic">Ponencia: "{ponente.temaPonencia}"</p>
                    </div>
                    <div className="speaker-global-score">
                      <span className="score-num">★ {avgGeneral}</span>
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
                                <span className="comment-date">— {e.fecha} (Dominio: {e.dominio} ★ | Claridad: {e.claridad} ★ | Aplicabilidad: {e.aplicabilidad} ★)</span>
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
              <div className="nps-big-score">★ {promedioExpectativas} <small>/ 5</small></div>
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
                <label className="form-label">URL del Formulario de Microsoft Forms Vinculado:</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://forms.office.com/r/..."
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
                        const updated = { ...evento, microsoftFormsUrl: msFormsUrl.trim() };
                        saveEvent(updated);
                        if (onDataUpdated) onDataUpdated();
                        setFormsUrlFeedback('¡Enlace guardado en el evento con éxito!');
                        setTimeout(() => setFormsUrlFeedback(''), 3500);
                      } catch (err) {
                        console.error('Error guardando enlace Forms:', err);
                        alert('Error al guardar el enlace: ' + (err?.message || 'Error'));
                      } finally {
                        setIsSavingFormsUrl(false);
                      }
                    }}
                  >
                    {isSavingFormsUrl ? 'Guardando...' : 'Guardar Enlace'}
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
                    <span>Abrir Formulario de Microsoft Forms</span>
                  </a>
                ) : (
                  <p className="no-url-notice">Puede pegar el enlace de su formulario de Microsoft Forms institucional arriba y hacer clic en &quot;Guardar Enlace&quot; para vincularlo al evento.</p>
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

      {/* PESTAÑA 6: ESTADO Y CAPACIDAD DE LA BASE DE DATOS EN TIEMPO REAL */}
      {activeTab === 'database' && (
        <div className="tab-panel">
          {/* Header con Badge Pulsante de Estado Firestore */}
          <div className="db-status-hero">
            <div className="db-status-hero-left">
              <div className="db-live-indicator">
                <span className="live-dot" />
                <span className="live-text">Google Cloud Firestore en Tiempo Real</span>
              </div>
              <h3 className="db-status-title">Monitor de Capacidad y Almacenamiento</h3>
              <p className="db-status-subtitle">
                Supervisión continua de cuotas, volumen de almacenamiento y documentos en la nube institucional UdeA (Plan Firebase Spark - 100% Gratuito).
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
            {/* Tarjeta 1: Almacenamiento Consumido */}
            <div className="db-metric-card">
              <div className="db-card-header">
                <div className="db-card-title-wrap">
                  <HardDrive size={20} className="db-icon-primary" />
                  <h4>Almacenamiento en Base de Datos</h4>
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
                  <span>Uso: <strong>{dbMetrics.porcentajeUso}%</strong> del límite</span>
                  <span>Restante: <strong>{(1024 - parseFloat(dbMetrics.totalMB)).toFixed(2)} MB libres</strong></span>
                </div>
              </div>

              <p className="db-metric-footnote">
                ✓ El evento actual consume una fracción mínima del límite gratuito de 1.024 MB de Firestore Spark.
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
              <span>Desglose de Colecciones en Tiempo Real ({dbMetrics.totalDocumentos} documentos activos)</span>
            </h4>

            <div className="db-collections-grid">
              <div className="db-collection-card">
                <div className="col-top">
                  <span className="col-name">asistencias</span>
                  <span className="col-count">{dbMetrics.asistenciasCount} docs</span>
                </div>
                <div className="col-size-bar">
                  <span>Tamaño estimado: <strong>{dbMetrics.asistenciasKB} KB</strong></span>
                </div>
                <div className="col-meta">Datos de registro, georreferenciación y vehículo</div>
              </div>

              <div className="db-collection-card">
                <div className="col-top">
                  <span className="col-name">preguntas</span>
                  <span className="col-count">{dbMetrics.preguntasCount} docs</span>
                </div>
                <div className="col-size-bar">
                  <span>Tamaño estimado: <strong>{dbMetrics.preguntasKB} KB</strong></span>
                </div>
                <div className="col-meta">Interacción y preguntas a ponentes en vivo</div>
              </div>

              <div className="db-collection-card">
                <div className="col-top">
                  <span className="col-name">evaluaciones</span>
                  <span className="col-count">{dbMetrics.evaluacionesCount} docs</span>
                </div>
                <div className="col-size-bar">
                  <span>Tamaño estimado: <strong>{dbMetrics.evaluacionesKB} KB</strong></span>
                </div>
                <div className="col-meta">Rúbrica de calificación docente y ponencias</div>
              </div>

              <div className="db-collection-card">
                <div className="col-top">
                  <span className="col-name">satisfaccion</span>
                  <span className="col-count">{dbMetrics.satisfaccionCount} docs</span>
                </div>
                <div className="col-size-bar">
                  <span>Tamaño estimado: <strong>{dbMetrics.satisfaccionKB} KB</strong></span>
                </div>
                <div className="col-meta">Métricas de calidad, logística y NPS</div>
              </div>
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
                      const res = await importDatabaseBackupJSON(file);
                      alert(res.message);
                      if (res.success && onDataUpdated) onDataUpdated();
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
              <p>⚠️ <strong>Atención de Auditoría:</strong> Se purgarán los comprobantes oficiales de ingreso y asistencias tanto de la base de datos local como de la nube institucional.</p>
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
                  <span>✓ Confirmación autorizada. Haga clic en el botón rojo para proceder.</span>
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
