import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import Header from './components/Header';
import AttendeeView from './components/AttendeeView';
import AdminPanel from './components/AdminPanel';
import QRProjectionModal from './components/QRProjectionModal';
import EventModal from './components/EventModal';
import AdminAuthModal from './components/AdminAuthModal';
import VerificationView from './components/VerificationView';
import InstitutionalLanding from './components/InstitutionalLanding';
import EventLoadingScreen from './components/EventLoadingScreen';
import EventClosedScreen from './components/EventClosedScreen';
import {
  initStorage,
  getEvents,
  saveEvent,
  deleteEvent,
  getAttendance,
  getMealDeliveries,
  getQuestions,
  getEvaluations,
  getSatisfaction,
  subscribeToEventData,
  subscribeToEvents,
  fetchEventByIdDirect
} from './services/storage';
import { checkEventDayStatus, getColombiaLocalDateStr } from './services/networkTime';
import { isAdminAuthenticated, logoutAdmin } from './services/auth';

export default function App() {
  const [events, setEvents] = useState(() => {
    initStorage();
    return getEvents();
  });

  const [isAdmin, setIsAdmin] = useState(() => isAdminAuthenticated());

  // Parámetro de evento en la URL (?evento=ID)
  const [urlEventId, setUrlEventId] = useState(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('evento');
  });

  // Estado de carga directa del evento escaneado
  const [isLoadingEvent, setIsLoadingEvent] = useState(() => Boolean(urlEventId));
  const [eventNotFound, setEventNotFound] = useState(false);

  // Inicialización de evento activo SIN fallback arbitrario a eventos demo
  const [currentEvent, setCurrentEvent] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get('evento');
      if (targetId) {
        const loaded = getEvents();
        const match = loaded.find(e => e.id === targetId);
        if (match) return match;
        // Si no está en memoria local inmediata, se devuelve null y se activa la carga directa
        return null;
      }
    }
    return null; // Si no hay parámetro de evento, el portal predeterminado institucional toma el control
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

  // Carga directa e inmediata por ID para asistentes que escanean código QR
  useEffect(() => {
    if (!urlEventId) {
      setIsLoadingEvent(false);
      return;
    }

    let isMounted = true;
    setIsLoadingEvent(true);
    setEventNotFound(false);

    fetchEventByIdDirect(urlEventId).then((found) => {
      if (!isMounted) return;
      if (found) {
        setCurrentEvent(found);
        setEventNotFound(false);
      } else {
        setEventNotFound(true);
      }
      setIsLoadingEvent(false);
    }).catch((err) => {
      if (!isMounted) return;
      console.warn('Error resolviendo evento directo:', err);
      setEventNotFound(true);
      setIsLoadingEvent(false);
    });

    return () => {
      isMounted = false;
    };
  }, [urlEventId]);

  const currentEventId = currentEvent?.id || '';

  // Sincronización en tiempo real de eventos multi-dispositivo (Firestore + LocalStorage)
  useEffect(() => {
    const unsub = subscribeToEvents((cloudOrLocalEvents) => {
      if (cloudOrLocalEvents && cloudOrLocalEvents.length > 0) {
        setEvents(cloudOrLocalEvents);
        setCurrentEvent((prev) => {
          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const targetUrlId = params.get('evento');
            if (targetUrlId) {
              const urlMatch = cloudOrLocalEvents.find(e => e.id === targetUrlId);
              if (urlMatch) return urlMatch;
            }
          }
          if (prev) {
            const found = cloudOrLocalEvents.find(e => e.id === prev.id);
            return found || prev;
          }
          return null;
        });
      }
    });
    return () => unsub();
  }, []);

  // Estados de datos para el evento actual
  const [asistencias, setAsistencias] = useState(() => currentEventId ? getAttendance(currentEventId) : []);
  const [entregasComidas, setEntregasComidas] = useState(() => currentEventId ? getMealDeliveries(currentEventId) : []);
  const [preguntas, setPreguntas] = useState(() => currentEventId ? getQuestions(currentEventId) : []);
  const [evaluaciones, setEvaluaciones] = useState(() => currentEventId ? getEvaluations(currentEventId) : []);
  const [satisfaccion, setSatisfaccion] = useState(() => currentEventId ? getSatisfaction(currentEventId) : []);

  // Recargar datos reactivos del evento activo
  const refreshEventData = useCallback(() => {
    if (!currentEventId) return;
    setAsistencias(getAttendance(currentEventId));
    setEntregasComidas(getMealDeliveries(currentEventId));
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
    setUrlEventId(event?.id || null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (event?.id) {
        url.searchParams.set('evento', event.id);
      } else {
        url.searchParams.delete('evento');
      }
      window.history.replaceState({}, '', url.toString());
    }
    if (event?.id) {
      setAsistencias(getAttendance(event.id));
      setEntregasComidas(getMealDeliveries(event.id));
      setPreguntas(getQuestions(event.id));
      setEvaluaciones(getEvaluations(event.id));
      setSatisfaccion(getSatisfaction(event.id));
    } else {
      setAsistencias([]);
      setEntregasComidas([]);
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
      setEntregasComidas(getMealDeliveries(eventData.id));
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
        {currentView === 'admin' ? (
          currentEvent ? (
            <AdminPanel
              evento={currentEvent}
              events={events}
              onSelectEvent={handleSelectEvent}
              asistencias={asistencias}
              entregasComidas={entregasComidas}
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
          ) : (
            <div className="empty-state-banner">
              <h2>Panel de Administración de Eventos Académicos</h2>
              <p>Seleccione un evento de la lista o cree un nuevo evento académico para comenzar.</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
                <button className="btn-primary-action" onClick={handleOpenNewEvent}>
                  Crear Nuevo Evento
                </button>
                {events.length > 0 && (
                  <button className="btn-secondary" onClick={() => handleSelectEvent(events[0])}>
                    Ver Primer Evento Registrado
                  </button>
                )}
              </div>
            </div>
          )
        ) : (
          /* VISTA ASISTENTE / PÚBLICA */
          isLoadingEvent ? (
            <EventLoadingScreen
              message="Cargando evento académico..."
              subtitle="Verificando el enlace oficial de la Facultad de Medicina UdeA"
            />
          ) : eventNotFound ? (
            <div className="event-not-found-card animated-step">
              <div className="not-found-icon-wrap">
                <AlertCircle size={36} />
              </div>
              <h2>Evento no encontrado</h2>
              <p>
                No encontramos ningún evento registrado con el código <strong>{urlEventId}</strong>.
                Es posible que el enlace esté incompleto o que el evento haya sido retirado por los organizadores.
              </p>
              <button
                type="button"
                className="btn-primary-action"
                onClick={() => handleSelectEvent(null)}
              >
                Ir al Portal Institucional de Eventos
              </button>
            </div>
          ) : currentEvent ? (
            /* CONTROL DE CICLO DE VIDA: Activo hoy vs. Culminado al día siguiente */
            (() => {
              const todayStr = getColombiaLocalDateStr();
              const dayStatus = checkEventDayStatus(currentEvent, todayStr);
              const isPastDay = Boolean(dayStatus.esDespuesDeFecha);
              const hasRegisteredSession = typeof window !== 'undefined' && Boolean(
                localStorage.getItem(`udea_session_attendee_${currentEvent.id}`)
              );

              // Si el día del evento ya pasó y el usuario NO tiene un registro previo en este dispositivo
              if (isPastDay && !hasRegisteredSession) {
                return (
                  <EventClosedScreen
                    evento={currentEvent}
                    onGoHome={() => handleSelectEvent(null)}
                    onViewBadgeIfRegistered={() => {}}
                  />
                );
              }

              return (
                <AttendeeView
                  evento={currentEvent}
                  asistencias={asistencias}
                  preguntas={preguntas}
                  evaluaciones={evaluaciones}
                  onDataUpdated={refreshEventData}
                />
              );
            })()
          ) : (
            /* PORTAL INSTITUCIONAL PREDETERMINADO UDEA */
            <InstitutionalLanding
              events={events}
              onSelectEvent={handleSelectEvent}
              onOpenAdminLogin={() => {
                if (isAdmin) {
                  setCurrentView('admin');
                } else {
                  setIsAuthModalOpen(true);
                }
              }}
              isAdmin={isAdmin}
            />
          )
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
            <span className="secure-badge">
              <ShieldCheck size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Acceso Administrativo Protegido
            </span>
            <span className="version-tag">Versión 2.1 Web Institucional</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
