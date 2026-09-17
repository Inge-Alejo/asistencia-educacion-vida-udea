// Servicio de Verificación de Fecha y Hora Oficial vía Internet
// Facultad de Medicina - Universidad de Antioquia
// Zona Horaria Oficial: America/Bogota (UTC-5)
// Garantiza que los asistentes no alteren el reloj de su dispositivo para registrar asistencias fuera de horario o de fecha.

const COLOMBIA_TIMEZONE = 'America/Bogota';

// Caché del offset calculado entre el reloj del dispositivo y la hora real por red
let cachedOffsetMs = 0;
let lastSyncTimestamp = 0;
let isInternetTimeVerified = false;
let syncSource = 'Dispositivo local (Pendiente sincronización)';

/**
 * Obtiene la fecha y hora oficial de Colombia a través de internet con múltiples fuentes de respaldo.
 * @returns {Promise<{ fechaStr: string, horaStr: string, fechaObj: Date, esVerificadaInternet: boolean, fuente: string }>}
 */
export async function getOfficialColombiaTime() {
  const now = Date.now();

  // Si ya sincronizamos en los últimos 10 minutos, reutilizamos el offset calibrado
  if (isInternetTimeVerified && (now - lastSyncTimestamp < 10 * 60 * 1000)) {
    const calibratedDate = new Date(Date.now() + cachedOffsetMs);
    return formatColombiaDateResult(calibratedDate, true, syncSource);
  }

  // 1. Intento primario: WorldTimeAPI (específico para America/Bogota)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch('https://worldtimeapi.org/api/timezone/America/Bogota', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.datetime) {
        const networkDate = new Date(data.datetime);
        cachedOffsetMs = networkDate.getTime() - Date.now();
        lastSyncTimestamp = Date.now();
        isInternetTimeVerified = true;
        syncSource = 'WorldTimeAPI (Hora Legal de Colombia)';
        return formatColombiaDateResult(networkDate, true, syncSource);
      }
    }
  } catch (err) {
    console.warn('Fallo primario de hora por red (WorldTimeAPI), probando respaldo:', err?.message);
  }

  // 2. Intento secundario: TimeAPI.io (respaldo confiable)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch('https://timeapi.io/api/time/current/zone?timeZone=America%2FBogota', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.dateTime) {
        const networkDate = new Date(data.dateTime);
        cachedOffsetMs = networkDate.getTime() - Date.now();
        lastSyncTimestamp = Date.now();
        isInternetTimeVerified = true;
        syncSource = 'TimeAPI.io (América/Bogotá)';
        return formatColombiaDateResult(networkDate, true, syncSource);
      }
    }
  } catch (err) {
    console.warn('Fallo secundario de hora por red (TimeAPI), probando cabecera HTTP:', err?.message);
  }

  // 3. Intento terciario: Cabecera Date de una petición liviana (HEAD a Cloudflare / CDN o mismo host)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(window.location.origin + '/favicon.ico', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeoutId);

    const serverDateHeader = response.headers.get('date');
    if (serverDateHeader) {
      const serverDate = new Date(serverDateHeader);
      cachedOffsetMs = serverDate.getTime() - Date.now();
      lastSyncTimestamp = Date.now();
      isInternetTimeVerified = true;
      syncSource = 'Cabecera Servidor Web (HTTP Date)';
      return formatColombiaDateResult(serverDate, true, syncSource);
    }
  } catch {
    // Si no hay respuesta de cabecera, proceder a contingencia
  }

  // 4. Contingencia segura: reloj del cliente ajustado a la zona horaria de Colombia
  const fallbackDate = new Date(Date.now() + cachedOffsetMs);
  return formatColombiaDateResult(fallbackDate, false, 'Reloj Local del Dispositivo');
}

/**
 * Formatea una fecha dada al huso horario de Colombia (America/Bogota) en formato ISO YYYY-MM-DD y HH:mm
 */
function formatColombiaDateResult(dateObj, verified, source) {
  // Opciones en español Colombia
  const formatterFecha = new Intl.DateTimeFormat('es-CO', {
    timeZone: COLOMBIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const formatterHora = new Intl.DateTimeFormat('es-CO', {
    timeZone: COLOMBIA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatterFecha.formatToParts(dateObj);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  const fechaStr = `${y}-${m}-${d}`;
  const horaStr = formatterHora.format(dateObj);

  return {
    fechaStr,
    horaStr,
    fechaObj: dateObj,
    esVerificadaInternet: verified,
    fuente: source
  };
}

/**
 * Determina los días oficiales de un evento.
 * Si es multidía y tiene `diasEvento` (array de strings YYYY-MM-DD), los retorna.
 * Si tiene fechaInicio y fechaFin, genera los días intermedios.
 * Si es de un solo día, retorna [evento.fecha].
 */
export function getEventDaysList(evento) {
  if (!evento) return [];

  if (Array.isArray(evento.diasEvento) && evento.diasEvento.length > 0) {
    return evento.diasEvento.filter(Boolean).sort();
  }

  if (evento.esMultidia && evento.fechaInicio && evento.fechaFin) {
    const list = [];
    const curr = new Date(evento.fechaInicio + 'T00:00:00');
    const end = new Date(evento.fechaFin + 'T00:00:00');

    // Máximo 15 días consecutivos como medida de seguridad
    let safetyCounter = 0;
    while (curr <= end && safetyCounter < 15) {
      list.push(curr.toISOString().slice(0, 10));
      curr.setDate(curr.getDate() + 1);
      safetyCounter++;
    }
    return list.length > 0 ? list : [evento.fechaInicio];
  }

  return evento.fecha ? [evento.fecha] : [new Date().toISOString().slice(0, 10)];
}

/**
 * Valida si la fecha dada corresponde a un día activo del evento.
 * @param {object} evento
 * @param {string} fechaYMD Formato YYYY-MM-DD
 * @returns {{ esDiaActivo: boolean, diaNumero: number, totalDias: number, fechaDia: string }}
 */
export function checkEventDayStatus(evento, fechaYMD) {
  const days = getEventDaysList(evento);
  const index = days.indexOf(fechaYMD);

  return {
    esDiaActivo: index !== -1,
    diaNumero: index !== -1 ? index + 1 : null,
    totalDias: days.length,
    fechaDia: fechaYMD,
    diasList: days
  };
}
