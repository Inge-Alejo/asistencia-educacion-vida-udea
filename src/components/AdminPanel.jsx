import React, { useState } from 'react';
import {
  Users, HelpCircle, Star, ThumbsUp, Download, QrCode, Plus, Search,
  Filter, CheckCircle, Clock, MapPin, Car, AlertCircle, FileSpreadsheet,
  Link, ExternalLink, ChevronRight, MessageSquare, Trash2, Shield, Lock, KeyRound, LogOut
} from 'lucide-react';
import { exportEventDataToExcel, exportMicrosoftFormsFormat } from '../services/excelExport';
import {
  toggleQuestionAnswered,
  toggleQuestionFeatured,
  deleteQuestion,
  deleteAttendance,
  deleteEvaluation,
  deleteSatisfaction,
  isFirebaseConfigured
} from '../services/storage';
import { changeAdminPassword } from '../services/auth';

export default function AdminPanel({
  evento,
  asistencias,
  preguntas,
  evaluaciones,
  satisfaccion,
  onOpenQRModal,
  onOpenNewEventModal,
  onDeleteEvent,
  onDataUpdated,
  onLogout
}) {
  const [activeTab, setActiveTab] = useState('asistencias');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVinculacion, setFilterVinculacion] = useState('todos');
  const [filterPonente, setFilterPonente] = useState('todos');
  const [msFormsUrl, setMsFormsUrl] = useState(evento.microsoftFormsUrl || '');

  // Estado para cambio de contraseña
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState({ text: '', isError: false });

  // Métricas calculadas
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

  // Filtrado de Asistencias
  const asistenciasFiltradas = asistencias.filter(a => {
    const matchSearch =
      a.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.documento.includes(searchTerm) ||
      (a.placaVehiculo && a.placaVehiculo.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchVinculacion = filterVinculacion === 'todos' || a.vinculacion === filterVinculacion;
    return matchSearch && matchVinculacion;
  });

  // Filtrado de Preguntas
  const preguntasFiltradas = preguntas.filter(q => {
    return filterPonente === 'todos' || q.ponenteId === filterPonente;
  });

  const handleDescargarExcel = () => {
    exportEventDataToExcel({
      evento,
      asistencias,
      preguntas,
      evaluaciones,
      satisfaccion
    });
  };

  const handleDescargarMsForms = () => {
    exportMicrosoftFormsFormat({
      evento,
      asistencias,
      satisfaccion
    });
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
          <button className="btn-secondary" onClick={onOpenNewEventModal}>
            <Plus size={16} />
            <span>Crear Evento</span>
          </button>
          <button className="btn-secondary" onClick={onOpenQRModal}>
            <QrCode size={16} />
            <span>Proyectar QR</span>
          </button>
          <button className="btn-primary-action" onClick={handleDescargarExcel}>
            <Download size={16} />
            <span>Descargar Excel (.xlsx)</span>
          </button>
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
                <option value="Estudiante Pregrado Medicina UdeA">Estudiante Pregrado UdeA</option>
                <option value="Residente / Posgrado UdeA">Residente / Posgrado UdeA</option>
                <option value="Docente / Investigador UdeA">Docente / Investigador</option>
                <option value="Egresado UdeA">Egresado UdeA</option>
                <option value="Médico / Especialista Externo">Médico / Especialista Externo</option>
              </select>
            </div>
          </div>

          <div className="table-responsive-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Documento</th>
                  <th>Nombre del Asistente</th>
                  <th>Correo y Teléfono</th>
                  <th>Vinculación</th>
                  <th>Placa Vehicular</th>
                  <th>Geolocalización GPS</th>
                  <th>Hora Registro</th>
                  <th>Acción</th>
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
                  asistenciasFiltradas.map((a, idx) => (
                    <tr key={a.id || idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{a.documento}</strong>
                        <span className="doc-type-badge">{a.tipoDocumento || 'CC'}</span>
                      </td>
                      <td className="attendee-name-cell">
                        <strong>{a.nombreCompleto}</strong>
                      </td>
                      <td>
                        <div className="contact-cell">
                          <span>{a.correo}</span>
                          {a.telefono && <small>{a.telefono}</small>}
                        </div>
                      </td>
                      <td>
                        <span className="role-chip">{a.vinculacion}</span>
                      </td>
                      <td>
                        {a.placaVehiculo ? (
                          <span className="plate-badge">{a.placaVehiculo}</span>
                        ) : (
                          <span className="text-muted">
                            {evento.habilitarPlacaVehiculo ? 'No registrada' : 'No requería'}
                          </span>
                        )}
                      </td>
                      <td>
                        {a.geolocalizacion?.esPresencial ? (
                          <span className="geo-badge-success" title={`A ${a.geolocalizacion.distanciaSedeMetros}m de la sede`}>
                            <CheckCircle size={13} /> En Sede ({a.geolocalizacion.distanciaSedeMetros}m)
                          </span>
                        ) : (
                          <span className="geo-badge-warning" title={a.geolocalizacion?.distanciaSedeMetros ? `A ${a.geolocalizacion.distanciaSedeMetros}m` : 'Remoto'}>
                            <AlertCircle size={13} /> {a.geolocalizacion?.distanciaSedeMetros ? `${a.geolocalizacion.distanciaSedeMetros}m (Remoto)` : 'Remoto'}
                          </span>
                        )}
                      </td>
                      <td className="time-cell">{a.fechaRegistro}</td>
                      <td>
                        <button
                          className="btn-table-delete"
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: PREGUNTAS A PONENTES (Q&A EN VIVO) */}
      {activeTab === 'preguntas' && (
        <div className="tab-panel">
          <div className="table-controls-bar">
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
            <span className="feed-counter">
              Mostrando {preguntasFiltradas.length} preguntas formuladas
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
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://forms.office.com/r/..."
                  value={msFormsUrl}
                  onChange={(e) => setMsFormsUrl(e.target.value)}
                />
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
                  <p className="no-url-notice">Puede pegar el enlace de su formulario de Microsoft Forms institucional arriba para acceso rápido.</p>
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
    </div>
  );
}
