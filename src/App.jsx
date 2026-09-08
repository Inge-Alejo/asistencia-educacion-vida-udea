import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import AttendeeView from './components/AttendeeView';
import AdminPanel from './components/AdminPanel';
import QRProjectionModal from './components/QRProjectionModal';
import EventModal from './components/EventModal';
import AdminAuthModal from './components/AdminAuthModal';
import {
  initStorage,
  getEvents,
  saveEvent,
  getAttendance,
  getQuestions,
  getEvaluations,
  getSatisfaction
} from './services/storage';
import { isAdminAuthenticated, logoutAdmin } from './services/auth';

export default function App() {
  const [events, setEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [currentView, setCurrentView] = useState('attendee'); // 'attendee' | 'admin'
  const [isAdmin, setIsAdmin] = useState(false);

  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Estados de datos para el evento actual
  const [asistencias, setAsistencias] = useState([]);
  const [preguntas, setPreguntas] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [satisfaccion, setSatisfaccion] = useState([]);

  // Cargar datos iniciales e interpretar parámetros URL (del escaneo del código QR)
  useEffect(() => {
    initStorage();
    const loadedEvents = getEvents();
    setEvents(loadedEvents);

    const authActive = isAdminAuthenticated();
    setIsAdmin(authActive);

    // Leer parámetros de la URL: ?evento=EVT-MED-01&view=attendee
    const params = new URLSearchParams(window.location.search);
    const urlEventId = params.get('evento');
    const urlView = params.get('view');

    if (urlView === 'admin') {
      if (authActive) {
        setCurrentView('admin');
      } else {
        setCurrentView('attendee');
        setIsAuthModalOpen(true);
      }
    } else {
      setCurrentView('attendee');
    }

    if (urlEventId) {
      const match = loadedEvents.find(e => e.id === urlEventId);
      if (match) {
        setCurrentEvent(match);
      } else if (loadedEvents.length > 0) {
        setCurrentEvent(loadedEvents[0]);
      }
    } else if (loadedEvents.length > 0) {
      setCurrentEvent(loadedEvents[0]);
    }
  }, []);

  // Recargar datos reactivos del evento activo
  const refreshEventData = () => {
    if (!currentEvent) return;
    setAsistencias(getAttendance(currentEvent.id));
    setPreguntas(getQuestions(currentEvent.id));
    setEvaluaciones(getEvaluations(currentEvent.id));
    setSatisfaccion(getSatisfaction(currentEvent.id));
  };

  useEffect(() => {
    refreshEventData();
  }, [currentEvent]);

  // Manejar creación o edición de evento
  const handleSaveEvent = (eventData) => {
    saveEvent(eventData);
    const updated = getEvents();
    setEvents(updated);
    setCurrentEvent(eventData);
    refreshEventData();
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

  return (
    <div className="udea-app-root">
      <Header
        currentView={currentView}
        onNavigateView={handleNavigateView}
        currentEvent={currentEvent}
        events={events}
        onSelectEvent={setCurrentEvent}
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
              onOpenNewEventModal={() => setIsEventModalOpen(true)}
              onDataUpdated={refreshEventData}
              onLogout={handleLogout}
            />
          )
        ) : (
          <div className="empty-state-banner">
            <h2>No se ha seleccionado ningún evento</h2>
            <p>Seleccione o cree un nuevo evento académico para continuar.</p>
            <button className="btn-primary-action" onClick={() => setIsEventModalOpen(true)}>
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
      />

      {/* Modal de Creación / Configuración de Evento */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
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
            <p className="footer-addr">Calle 67 # 53 - 108, Medellín, Colombia • Tel: +57 (604) 219 6000</p>
          </div>
          <div className="footer-meta">
            <span className="secure-badge">🔒 Acceso Administrativo Protegido con Cifrado SHA-256</span>
            <span className="version-tag">Versión 2.1 Web • Costo $0 Cloud</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
