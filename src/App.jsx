import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import AttendeeView from './components/AttendeeView';
import AdminPanel from './components/AdminPanel';
import QRProjectionModal from './components/QRProjectionModal';
import EventModal from './components/EventModal';
import AdminAuthModal from './components/AdminAuthModal';
import VerificationView from './components/VerificationView';
import {
  initStorage,
  getEvents,
  saveEvent,
  deleteEvent,
  getAttendance,
  getQuestions,
  getEvaluations,
  getSatisfaction,
  subscribeToEventData,
  subscribeToEvents
} from './services/storage';
import { isAdminAuthenticated, logoutAdmin } from './services/auth';

export default function App() {
  const [events, setEvents] = useState(() => {
    initStorage();
    return getEvents();
  });

  const [isAdmin, setIsAdmin] = useState(() => isAdminAuthenticated());

  const [currentEvent, setCurrentEvent] = useState(() => {
    const loaded = getEvents();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlEventId = params.get('evento');
      if (urlEventId) {
        const match = loaded.find(e => e.id === urlEventId);
        if (match) return match;
      }
    }
    return loaded[0] || null;
  });

  const [currentView, setCurrentView] = useState(() => {
    if (typeof window === 'undefined') return 'attendee';
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'admin' && isAdminAuthenticated() ? 'admin' : 'attendee';
  });

  // Parámetros de verificación cuando se escanea el QR de una escarapela
  const [verificationParams, setVerificationParams] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const verifyId = params.get('verificar') || params.get('verify') || params.get('credencial');
    if (!verifyId) return null;
    return {
      comprobanteId: verifyId,
      token: params.get('token') || ''
    };
  });

  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'admin' && !isAdminAuthenticated();
  });

  const currentEventId = currentEvent?.id || '';

  // Sincronización en tiempo real de eventos multi-dispositivo (Firestore + LocalStorage)
  useEffect(() => {
    const unsub = subscribeToEvents((cloudOrLocalEvents) => {
      if (cloudOrLocalEvents && cloudOrLocalEvents.length > 0) {
        setEvents(cloudOrLocalEvents);
        setCurrentEvent((prev) => {
          if (!prev) return cloudOrLocalEvents[0];
          const found = cloudOrLocalEvents.find(e => e.id === prev.id);
          return found || cloudOrLocalEvents[0];
        });
      }
    });
    return () => unsub();
  }, []);

  // Estados de datos para el evento actual
  const [asistencias, setAsistencias] = useState(() => currentEventId ? getAttendance(currentEventId) : []);
  const [preguntas, setPreguntas] = useState(() => currentEventId ? getQuestions(currentEventId) : []);
  const [evaluaciones, setEvaluaciones] = useState(() => currentEventId ? getEvaluations(currentEventId) : []);
  const [satisfaccion, setSatisfaccion] = useState(() => currentEventId ? getSatisfaction(currentEventId) : []);

  // Recargar datos reactivos del evento activo
  const refreshEventData = useCallback(() => {
    if (!currentEventId) return;
    setAsistencias(getAttendance(currentEventId));
    setPreguntas(getQuestions(currentEventId));
    setEvaluaciones(getEvaluations(currentEventId));
    setSatisfaccion(getSatisfaction(currentEventId));
  }, [currentEventId]);

  useEffect(() => {
    if (!currentEventId) return;
    const unsubscribe = subscribeToEventData(currentEventId, () => {
      refreshEventData();
    });
    return () => unsubscribe();
  }, [currentEventId, refreshEventData]);

  const handleSelectEvent = (event) => {
    setCurrentEvent(event);
    if (event?.id) {
      setAsistencias(getAttendance(event.id));
      setPreguntas(getQuestions(event.id));
      setEvaluaciones(getEvaluations(event.id));
      setSatisfaccion(getSatisfaction(event.id));
    } else {
      setAsistencias([]);
      setPreguntas([]);
      setEvaluaciones([]);
      setSatisfaccion([]);
    }
  };

  const handleOpenNewEvent = () => {
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleOpenEditEvent = (evtToEdit) => {
    setEditingEvent(evtToEdit || currentEvent);
    setIsEventModalOpen(true);
  };

  // Manejar creación o edición de evento
  const handleSaveEvent = async (eventData) => {
    await saveEvent(eventData);
    const updated = getEvents();
    setEvents(updated);
    setCurrentEvent(eventData);
    if (eventData?.id) {
      setAsistencias(getAttendance(eventData.id));
      setPreguntas(getQuestions(eventData.id));
      setEvaluaciones(getEvaluations(eventData.id));
      setSatisfaccion(getSatisfaction(eventData.id));
    }
    setIsEventModalOpen(false);
    setEditingEvent(null);
  };

  // Manejar eliminación del evento actual
  const handleDeleteCurrentEvent = async () => {
    if (!currentEvent) return;
    const confirmMessage = `¿Está seguro de que desea eliminar permanentemente el evento "${currentEvent.titulo}"?\n\nEsta acción purgará de forma irreversible todas las asistencias registradas, preguntas de los participantes, calificaciones de ponentes y métricas asociadas.`;
    if (window.confirm(confirmMessage)) {
      await deleteEvent(currentEvent.id);
      const updated = getEvents();
      setEvents(updated);
      if (updated.length > 0) {
        handleSelectEvent(updated[0]);
      } else {
        handleSelectEvent(null);
      }
    }
  };

  // Navegación segura entre vistas
  const handleNavigateView = (viewName) => {
    if (viewName === 'admin') {
      if (isAdminAuthenticated()) {
        setIsAdmin(true);
        setCurrentView('admin');
      } else {
        setIsAuthModalOpen(true);
      }
    } else {
      setCurrentView('attendee');
    }
  };

  // Manejar éxito en login administrativo
  const handleAuthSuccess = () => {
    setIsAdmin(true);
    setIsAuthModalOpen(false);
    setCurrentView('admin');
  };

  // Manejar cierre de sesión administrativa
  const handleLogout = () => {
    logoutAdmin();
    setIsAdmin(false);
    setCurrentView('attendee');
  };

  // Si se está verificando una escarapela escaneada desde un celular
  if (verificationParams) {
    return (
      <VerificationView
        comprobanteId={verificationParams.comprobanteId}
        tokenSeguridad={verificationParams.token}
        onVolver={() => {
          setVerificationParams(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('verificar');
          url.searchParams.delete('verify');
          url.searchParams.delete('credencial');
          url.searchParams.delete('token');
          const cleanSearch = url.searchParams.toString();
          window.history.pushState({}, '', url.pathname + (cleanSearch ? `?${cleanSearch}` : ''));
        }}
      />
    );
  }

  return (
    <div className="udea-app-root">
      <Header
        currentView={currentView}
        onNavigateView={handleNavigateView}
        currentEvent={currentEvent}
        events={events}
        onSelectEvent={handleSelectEvent}
        onOpenQRModal={() => setIsQRModalOpen(true)}
        isAdmin={isAdmin}
        onLogoutAdmin={handleLogout}
      />

      <main className="container main-content-wrapper">
        {currentEvent ? (
          currentView === 'attendee' ? (
            <AttendeeView
              evento={currentEvent}
              asistencias={asistencias}
              preguntas={preguntas}
              evaluaciones={evaluaciones}
              onDataUpdated={refreshEventData}
            />
          ) : (
            <AdminPanel
              evento={currentEvent}
              asistencias={asistencias}
              preguntas={preguntas}
              evaluaciones={evaluaciones}
              satisfaccion={satisfaccion}
              onOpenQRModal={() => setIsQRModalOpen(true)}
              onOpenNewEventModal={handleOpenNewEvent}
              onOpenEditEventModal={handleOpenEditEvent}
              onDeleteEvent={handleDeleteCurrentEvent}
              onDataUpdated={refreshEventData}
              onLogout={handleLogout}
            />
          )
        ) : (
          <div className="empty-state-banner">
            <h2>No se ha seleccionado ningún evento</h2>
            <p>Seleccione o cree un nuevo evento académico para continuar.</p>
            <button className="btn-primary-action" onClick={handleOpenNewEvent}>
              Crear Primer Evento
            </button>
          </div>
        )}
      </main>

      {/* Modal de Proyección del Código QR */}
      <QRProjectionModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        evento={currentEvent}
        asistencias={asistencias}
      />

      {/* Modal de Creación / Configuración de Evento */}
      <EventModal
        key={editingEvent?.id || (isEventModalOpen ? 'create-new-evt' : 'closed-evt')}
        isOpen={isEventModalOpen}
        initialEvent={editingEvent}
        onClose={() => {
          setIsEventModalOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleSaveEvent}
      />

      {/* Modal de Autenticación Administrativa */}
      <AdminAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Pie de Página Institucional UdeA */}
      <footer className="udea-footer">
        <div className="container footer-content">
          <div className="footer-brand">
            <span className="footer-inst">Universidad de Antioquia</span>
            <span className="footer-fac">Facultad de Medicina • Educación a lo Largo de la Vida</span>
            <p className="footer-addr">Cra. 51D # 62 - 29, Medellín, Colombia (Área de la Salud) • Tel: +57 (604) 219 6000</p>
          </div>
          <div className="footer-meta">
            <span className="secure-badge">🔒 Acceso Administrativo Protegido</span>
            <span className="version-tag">Versión 2.1 Web Institucional</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
