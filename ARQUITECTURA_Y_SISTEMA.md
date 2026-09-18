# Sistema Integral de Registro de Asistencia, Escarapela Digital y Gestión Académica en Tiempo Real
## Universidad de Antioquia • Facultad de Medicina • Educación a lo Largo de la Vida

---

## 1. Resumen Ejecutivo y Objetivos

El **Sistema Integral de Registro de Asistencia y Escarapela Digital** es una plataforma web progresiva (PWA) de nivel institucional desarrollada para la **Facultad de Medicina de la Universidad de Antioquia**. Su propósito es sustituir de forma integral las listas de asistencia en papel y los procesos lentos de acreditación física en auditorios, simposios, congresos médicos y jornadas académicas de **Educación a lo Largo de la Vida**.

### Objetivos Clave:
1. **Cero Filas y Cero Papel:** Registro autónomo por parte de los asistentes desde su propio celular mediante escaneo de código QR en pantalla o entrada directa.
2. **Validación Satelital y Presencial:** Geocercas geográficas con sensor GPS satelital que calculan la distancia métrica respecto a la sede de la Facultad de Medicina (Área de la Salud, Medellín).
3. **Escarapela Digital Criptográfica:** Credencial móvil instantánea protegida por firma criptográfica HMAC-SHA256 con código QR de verificación rápida para control de acceso en auditorio.
4. **Interacción Académica Bidireccional:** Preguntas en vivo (Live Q&A) a ponentes con control anti-spam, evaluación de conferencistas y encuestas de satisfacción o Microsoft Forms.
5. **Nube en Tiempo Real y Multi-dispositivo:** Base de datos distribuida en Google Cloud Firestore con sincronización inmediata entre computadores del panel administrativo, dispositivos móviles de logística y teléfonos de los asistentes.
6. **Cumplimiento Estricto de Habeas Data:** Resguardo de datos personales conforme a la **Ley Estatutaria 1581 de 2012** de la República de Colombia.

---

## 2. Arquitectura de Software

La plataforma implementa un patrón arquitectónico moderno de **Single Page Application (SPA)** desacoplada con backend **Serverless en la Nube**, estructurado en capas limpias e independientes:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN (CLIENTE)                       │
│  React 19 • Vite • CSS Vanilla Modular Institucional • Lucide Icons     │
│  ┌─────────────────────────────┐       ┌─────────────────────────────┐  │
│  │   Portal del Asistente      │       │   Panel de Administración   │  │
│  │  - GPS Satelital (Paso 1)   │       │  - Métricas de Aforo en Vivo│  │
│  │  - Formulario / Validación  │       │  - Carga Masiva Excel/CSV   │  │
│  │  - Escarapela Digital QR    │       │  - Alta Manual Excepciones  │  │
│  │  - Preguntas en Vivo (Q&A)  │       │  - Proyector QR Pantalla    │  │
│  │  - Calificación de Ponentes │       │  - Escáner Óptico Cámaras   │  │
│  │  - Encuesta Satisfacción    │       │  - Exportación XLSX Oficial │  │
│  └──────────────┬──────────────┘       └──────────────┬──────────────┘  │
└─────────────────┼─────────────────────────────────────┼─────────────────┘
                  │                                     │
                  ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CAPA DE SERVICIOS Y LÓGICA LOCAL                     │
│  - sanitizer.js (DOMPurify, ofuscación de nombres y correos)            │
│  - networkTime.js (Sincronización con Hora Legal de Colombia)           │
│  - enrollmentService.js (Validación de inscritos O(1) con Set)          │
│  - storage.js (Abstracción CRUD, firma HMAC, fallback localStorage)     │
└─────────────────┬─────────────────────────────────────┬─────────────────┘
                  │                                     │
                  ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              CAPA DE NUBE Y PERSISTENCIA (GOOGLE CLOUD)                 │
│  Cloud Firestore NoSQL (Multi-región) • Sincronización WebSockets       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Colecciones: eventos | asistencias | verificaciones | preguntas  │  │
│  │              evaluaciones | satisfaccion | inscritos              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  Reglas de Seguridad: firestore.rules (Bloqueo de accesos no autorizados)│
│  Respaldo Local: IndexedDB Offline Cache + LocalStorage Sessions        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Componentes Principales:
- **Frontend SPA:** Construido sobre React 19 y empaquetado con Vite, garantizando renderizado de alto rendimiento sin sobrecarga de frameworks pesados.
- **Backend as a Service (BaaS):** Google Cloud Firestore proporciona autenticación delegada, sincronización reactiva en tiempo real mediante WebSockets (`onSnapshot`) y escalabilidad automática para miles de usuarios concurrentes.
- **Offline-First Storage:** Persistencia local híbrida usando `IndexedDB` para Cloud Firestore y `localStorage` con aislamiento de claves por evento (`udea_session_attendee_${eventoId}`).

---

## 3. Modelo de Bases de Datos (Cloud Firestore)

La base de datos sigue el modelo **NoSQL orientado a documentos**, organizado en colecciones optimizadas para lecturas y escrituras atómicas de alta frecuencia:

### 3.1. Colección `eventos/{eventoId}`
Almacena la metadata del evento académico, configuración de jornadas, ponentes y lista de inscritos.
```json
{
  "id": "EVT-MED-01",
  "titulo": "Simposio de Innovación en Educación Médica",
  "fecha": "2026-09-15",
  "horaInicio": "08:00",
  "horaFin": "17:00",
  "lugar": "Auditorio Principal - Facultad de Medicina",
  "esMultidia": true,
  "diasConfig": [
    { "diaNumero": 1, "fecha": "2026-09-15", "horaInicio": "08:00", "horaFin": "17:00" },
    { "diaNumero": 2, "fecha": "2026-09-16", "horaInicio": "08:00", "horaFin": "17:00" }
  ],
  "habilitarPlacaVehiculo": true,
  "microsoftFormsUrl": "",
  "ponentes": [
    { "id": "P1", "nombre": "Dr. Alejandro Gómez", "temaPonencia": "Nuevas Metodologías Clínicas" }
  ],
  "inscritosData": ["1037654321", "98765432", "1020304050"]
}
```

### 3.2. Colección `asistencias/{asistenciaId}`
Contiene los registros individuales de asistencia firmados con fecha institucional y trazabilidad geográfica.
```json
{
  "id": "ATT-1789694200123",
  "eventoId": "EVT-MED-01",
  "diaNumero": 1,
  "fechaDia": "2026-09-15",
  "fechaVerificadaInternet": true,
  "fuenteTiempo": "Servidor Oficial Colombia",
  "tipoDocumento": "CC",
  "documento": "1037654321",
  "nombreCompleto": "Juan Pérez",
  "correo": "juan.perez@udea.edu.co",
  "telefono": "3001234567",
  "vinculacion": "Estudiante Posgrado",
  "placaVehiculo": "KMW452",
  "habeasDataAceptado": true,
  "fechaHabeasData": "2026-09-15T08:15:30.000Z",
  "geolocalizacion": {
    "latitud": 6.261341,
    "longitud": -75.566464,
    "precisionMetros": 12,
    "distanciaSedeMetros": 18,
    "esPresencial": true
  }
}
```

### 3.3. Colección `verificaciones/{asistenciaId}`
Colección pública optimizada para la verificación de escarapelas digitales. Ofusca los datos sensibles para cumplir con la Ley 1581 (Habeas Data):
```json
{
  "id": "ATT-1789694200123",
  "eventoId": "EVT-MED-01",
  "nombreCompleto": "Juan Pérez",
  "documentoMasked": "1037****21",
  "tokenSeguridad": "a7f3d...hmac256...",
  "esPresencial": true,
  "fechaRegistro": "15/9/2026, 8:15:30 a. m."
}
```

### 3.4. Colección `preguntas/{preguntaId}`
Muro de interacción en vivo para el auditorio y los conferencistas.
```json
{
  "id": "Q-1789694300456",
  "eventoId": "EVT-MED-01",
  "ponenteId": "P1",
  "autor": "Dr. Martínez",
  "esAnonimo": false,
  "pregunta": "¿Qué impacto tiene este enfoque en la práctica rural?",
  "respondida": false,
  "destacada": true,
  "fechaEnvio": "2026-09-15T08:30:00.000Z"
}
```

### 3.5. Colección `evaluaciones/{evalId}` y `satisfaccion/{satId}`
Métricas cuantitativas académicas por ponente (escala 1 a 5 estrellas) y encuesta de calidad logística / NPS institucional.

---

## 4. Seguridad, Criptografía y Cumplimiento de Habeas Data

### 4.1. Protección de Datos Personales (Ley 1581 de 2012)
- **Autorización Previa y Expresa:** El asistente debe marcar la casilla obligatoria de Habeas Data donde autoriza explícitamente a la Universidad de Antioquia para el tratamiento de sus datos con fines de registro y certificación.
- **Aislamiento de Colecciones:** La colección `/asistencias` tiene bloqueada la lectura pública (`allow read: if request.auth != null;`). Ningún asistente puede ver, consultar o extraer la lista de cédulas, teléfonos o correos de los demás participantes.
- **Verificación Pública Desacoplada:** El escaneo del QR consulta la colección `/verificaciones`, la cual solo expone el nombre, comprobante, estado presencial y el documento ofuscado.

### 4.2. Firma Digital Anti-Falsificación (HMAC-SHA256)
- Cada credencial generada calcula un token criptográfico:
  $$\text{Token} = \text{HMAC-SHA256}(\text{documento} + \text{eventoId} + \text{idComprobante}, \text{saltSecret})$$
- Cualquier intento de modificar la URL del código QR o clonar la escarapela digital resulta en una firma inválida al ser inspeccionada por los lectores de control de acceso.

### 4.3. Desafío de Identidad y Anti-Suplantación
- Si un usuario ingresa desde un computador o navegador nuevo digitando un documento que ya tiene registros en el evento:
  1. El sistema no permite alterar el nombre registrado inicialmente (validación con distancia de Levenshtein / similitud fonética).
  2. Activa un **desafío de identidad por correo**, exigiendo que el usuario confirme su correo registrado para poder autocompletar o acceder a la sesión.

### 4.4. Sanitización contra Inyecciones (XSS / Injection Defense)
- Todos los textos libres (nombres, preguntas al ponente, sugerencias) son procesados por `DOMPurify.sanitize()` antes de ingresar al estado o transmitirse a la base de datos, eliminando scripts, etiquetas maliciosas o cargas ejecutables.

---

## 5. Experiencia de Usuario: El Flujo en 5 Etapas

El portal del asistente está estructurado como un flujo secuencial guiado:

1. **Etapa 1 - Verificación de Ubicación Satelital GPS:**
   - Activa el sensor de geolocalización satelital del navegador.
   - Calcula la distancia con el algoritmo de Haversine respecto a la coordenada oficial de la Facultad de Medicina (`6.261341, -75.566464`).
   - Si la precisión o distancia están dentro del radio de 300 metros, califica automáticamente como *Asistencia Presencial*. Si es mayor, registra como *Remoto* sin bloquear al usuario.
2. **Etapa 2 - Datos de Asistencia y Validación Oficial:**
   - Selección de tipo de documento (CC, TI, CE, Pasaporte) y número.
   - Validación instantánea contra la lista oficial de inscritos (whitelist).
   - Datos de contacto, vinculación institucional y placa vehicular opcional para parqueadero.
3. **Etapa 3 - Escarapela Digital y Preguntas en Vivo:**
   - Muestra el comprobante con nombre de la persona y botón de acceso a la **Escarapela Digital**.
   - Muro en tiempo real para formular preguntas o casos clínicos a los ponentes con opción anónima y protección anti-spam (cooldown de 20 segundos).
   - Botón directo de **«Realizar nuevo registro»** para registrar a un colega desde el mismo dispositivo.
4. **Etapa 4 - Calificación Dinámica de Ponentes:**
   - Evaluación individual por conferencista evaluando dominio del tema, claridad pedagógica y aplicabilidad práctica.
5. **Etapa 5 - Encuesta de Satisfacción General / Microsoft Forms:**
   - Cumplimiento de objetivos, organización logística, Net Promoter Score (NPS) y sugerencias abiertas.

---

## 6. Rendimiento, Alta Disponibilidad y Resiliencia

1. **Tiempo de Carga Inmediato:** El empaquetador Vite compila los módulos en chunks segregados:
   - `vendor-react`: 182 kB
   - `vendor-firebase`: 461 kB
   - `vendor-xlsx`: 419 kB
   - `vendor-dompurify`: 27 kB
   - `vendor-icons`: 28 kB
   - CSS comprimido: 19.8 kB
   - Tiempo de arranque en frío: **< 650 ms**.
2. **Búsqueda en Tiempo Constante $O(1)$:** Las listas de inscritos cargadas desde archivos Excel (hasta decenas de miles de filas) se convierten en memoria a un `Set` hash indexado, garantizando que la validación mientras el usuario teclea su documento tome **0 milisegundos**.
3. **Resiliencia ante Cortes de Conexión:** Si el auditorio pierde temporalmente la conexión WiFi o señal celular, la persistencia en `IndexedDB` retiene los datos y los sincroniza automáticamente con Firestore tan pronto se recupera la red.

---

## 7. Entregables Generados

- **Presentación Ejecutiva (.pptx):** `presentacion_proyecto_udea_medicina.pptx` (9 diapositivas corporativas de alta definición con la identidad visual UdeA).
- **Documento Técnico de Arquitectura (.md):** `ARQUITECTURA_Y_SISTEMA.md` (Este documento, integrado en la raíz del proyecto).
- **Código Fuente en Producción:** Repositorio en GitHub `Inge-Alejo/asistencia-educacion-vida-udea` en rama `main`.
