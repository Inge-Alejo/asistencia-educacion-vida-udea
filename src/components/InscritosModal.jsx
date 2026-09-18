import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Trash2, Search, FileText } from 'lucide-react';
import { parseEnrollmentFile, normalizeDocumentId } from '../services/enrollmentService';
import { saveEventInscritos, getEventInscritosData, deleteEventInscritos } from '../services/storage';

export default function InscritosModal({ isOpen, onClose, evento, onInscritosUpdated }) {
  const [prevEventId, setPrevEventId] = useState(evento?.id);
  const [currentInscritosData, setCurrentInscritosData] = useState(() => {
    return evento?.id ? getEventInscritosData(evento.id) : null;
  });
  const [parsedData, setParsedData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchDocTest, setSearchDocTest] = useState('');
  const [testResult, setTestResult] = useState(null);

  if (evento?.id !== prevEventId) {
    setPrevEventId(evento?.id);
    setCurrentInscritosData(evento?.id ? getEventInscritosData(evento.id) : null);
    setParsedData(null);
    setErrorMessage('');
    setSearchDocTest('');
    setTestResult(null);
  }

  if (!isOpen) return null;

  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsProcessing(true);
    setErrorMessage('');

    const res = await parseEnrollmentFile(file, file.name);
    setIsProcessing(false);

    if (res.success) {
      setParsedData(res);
    } else {
      setErrorMessage(res.message || 'Error al procesar el archivo.');
      setParsedData(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleSave = async () => {
    if (!parsedData || !evento?.id) return;
    setIsProcessing(true);
    const saveRes = await saveEventInscritos(evento.id, parsedData);
    setIsProcessing(false);

    if (saveRes.success) {
      setCurrentInscritosData(saveRes.payload);
      setParsedData(null);
      if (onInscritosUpdated) onInscritosUpdated();
    } else {
      setErrorMessage('Error al guardar la lista de inscritos en la base de datos.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Está seguro de eliminar la lista de inscritos de este evento? El registro de asistencia volverá a ser libre y no exigirá inscripción previa.')) {
      return;
    }
    setIsProcessing(true);
    await deleteEventInscritos(evento.id);
    setIsProcessing(false);
    setCurrentInscritosData(null);
    setParsedData(null);
    setTestResult(null);
    if (onInscritosUpdated) onInscritosUpdated();
  };

  const handleTestSearch = (e) => {
    e?.preventDefault();
    const cleanTest = normalizeDocumentId(searchDocTest);
    if (!cleanTest) {
      setTestResult(null);
      return;
    }

    const docs = currentInscritosData?.documents || parsedData?.documents || [];
    const exists = docs.includes(cleanTest);
    setTestResult({
      doc: cleanTest,
      found: exists
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container inscritos-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera */}
        <div className="modal-header">
          <div>
            <span className="modal-badge">Control de Acceso y Admisión</span>
            <h2 className="modal-title">Lista Oficial de Personas Inscritas</h2>
            <p className="modal-subtitle">
              Evento: <strong>{evento?.titulo}</strong>
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

        {/* Cuerpo del Modal con padding y márgenes adecuados */}
        <div className="modal-body inscritos-modal-body">
          {/* Estado actual de la lista del evento */}
          {currentInscritosData ? (
            <div className="inscritos-status-banner active">
              <div className="status-banner-left">
                <CheckCircle2 size={24} color="#006633" />
                <div>
                  <strong>Lista de inscritos activa ({currentInscritosData.count} personas)</strong>
                  <p>
                    Archivo cargado: <code>{currentInscritosData.fileName}</code>
                    {currentInscritosData.detectedColumn && ` • Columna: "${currentInscritosData.detectedColumn}"`}
                  </p>
                  <small>Última actualización: {new Date(currentInscritosData.actualizadoEn).toLocaleString('es-CO')}</small>
                </div>
              </div>
              <button
                type="button"
                className="btn-danger-outline"
                onClick={handleDelete}
                disabled={isProcessing}
                title="Eliminar lista para permitir registro libre sin restricción"
              >
                <Trash2 size={15} />
                <span>Eliminar Lista</span>
              </button>
            </div>
          ) : (
            <div className="inscritos-status-banner empty">
              <AlertTriangle size={20} color="#D97706" />
              <div>
                <strong>Registro Abierto (Sin Lista Previa)</strong>
                <p>Actualmente cualquier persona puede registrar su asistencia. Si subes un archivo Excel o CSV, el sistema exigirá que el documento del asistente figure en dicho archivo.</p>
              </div>
            </div>
          )}

          {/* Probador rápido de documento */}
          {(currentInscritosData || parsedData) && (
            <div className="test-search-box">
              <label className="test-search-label">
                <Search size={14} /> Verificar cédula en la lista oficial:
              </label>
              <form onSubmit={handleTestSearch} className="test-search-row">
                <input
                  type="text"
                  className="form-input test-search-input"
                  placeholder="Ingresa un documento (ej: 1053873161 o con puntos)..."
                  value={searchDocTest}
                  onChange={(e) => {
                    setSearchDocTest(e.target.value);
                    setTestResult(null);
                  }}
                />
                <button type="submit" className="btn-secondary">
                  Consultar
                </button>
              </form>

              {testResult && (
                <div className={`test-result-badge ${testResult.found ? 'success' : 'not-found'}`}>
                  {testResult.found ? (
                    <>
                      <CheckCircle2 size={16} />
                      <span>✓ El documento <strong>{testResult.doc}</strong> SÍ figura como inscrito oficial.</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} />
                      <span>✗ El documento <strong>{testResult.doc}</strong> NO se encuentra en la lista de este evento.</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Zona de Subida de Archivo (Drag & Drop) */}
          <div
            className="excel-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <FileSpreadsheet size={38} color="#006633" />
            <h4>
              {currentInscritosData ? 'Reemplazar o Actualizar Archivo Excel / CSV' : 'Subir Archivo de Personas Inscritas'}
            </h4>
            <p>
              Arrastra aquí el archivo exportado de la plataforma (<strong>.xlsx</strong>, <strong>.xls</strong> o <strong>.csv</strong>) o selecciónalo desde tu equipo.
            </p>

            <label className="btn-primary-action file-picker-label">
              <Upload size={16} />
              <span>{isProcessing ? 'Procesando archivo...' : 'Seleccionar Archivo Excel / CSV'}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                style={{ display: 'none' }}
                disabled={isProcessing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </label>
          </div>

          {/* Mensaje de Error si la lectura falla */}
          {errorMessage && (
            <div className="error-banner animated-step">
              <AlertTriangle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Vista Previa de Archivo Analizado pendiente por guardar */}
          {parsedData && (
            <div className="parsed-preview-card animated-step">
              <div className="parsed-preview-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} color="#006633" />
                  <strong>Archivo procesado: {parsedData.fileName}</strong>
                </div>
                <span className="parsed-count-badge">
                  {parsedData.count} personas inscritas detectadas
                </span>
              </div>

              <div className="parsed-preview-body">
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#475569' }}>
                  Columna de documento identificada automáticamente: <strong>"{parsedData.detectedColumn}"</strong>
                </p>
                <div className="parsed-sample-chips">
                  <span className="sample-label">Muestra de documentos:</span>
                  {parsedData.sample.map(doc => (
                    <span key={doc} className="sample-doc-chip">{doc}</span>
                  ))}
                  {parsedData.count > parsedData.sample.length && (
                    <span className="sample-more-chip">+{parsedData.count - parsedData.sample.length} más</span>
                  )}
                </div>
              </div>

              <div className="parsed-preview-actions">
                <button
                  type="button"
                  className="btn-primary-action btn-confirm-save-enrollment"
                  onClick={handleSave}
                  disabled={isProcessing}
                >
                  <CheckCircle2 size={16} />
                  <span>Confirmar y Guardar {parsedData.count} Inscritos en la Nube</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setParsedData(null)}
                  disabled={isProcessing}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pie del modal */}
        <div className="modal-footer">
          <div style={{ fontSize: '0.8rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>🔒 Control de admisión y asistencia institucional</span>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            <span>Cerrar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
