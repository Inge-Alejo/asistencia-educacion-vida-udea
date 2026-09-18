const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

async function createPresentation() {
  const pptx = new pptxgen();

  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Facultad de Medicina - Universidad de Antioquia';
  pptx.company = 'Universidad de Antioquia';
  pptx.title = 'Sistema Integral de Gestión de Asistencia y Escarapela Digital';

  // Paleta Institucional UdeA
  const C_GREEN_DARK = '0F5938';
  const C_GREEN_DEEP = '083D24';
  const C_GREEN_LIGHT = 'E8F5E9';
  const C_GOLD = 'C59B27';
  const C_GOLD_LIGHT = 'FDE68A';
  const C_WHITE = 'FFFFFF';
  const C_TEXT_DARK = '1E293B';
  const C_TEXT_MUTED = '64748B';
  const C_BG_CARD = 'F8FAFC';
  const C_EMERALD = '10B981';

  // =========================================================================
  // SLIDE 1: PORTADA
  // =========================================================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: C_GREEN_DEEP };

    // Barra decorativa dorada
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8, y: 1.2, w: 0.15, h: 4.8,
      fill: { color: C_GOLD }, line: { color: C_GOLD }
    });

    slide.addText('UNIVERSIDAD DE ANTIOQUIA • FACULTAD DE MEDICINA', {
      x: 1.2, y: 1.3, w: 11.5, h: 0.5,
      fontSize: 14, fontFace: 'Arial', color: C_GOLD_LIGHT, bold: true, letterSpacing: 2
    });

    slide.addText('Sistema Integral de Asistencia, Escarapela Digital y Gestión Académica en Tiempo Real', {
      x: 1.2, y: 2.0, w: 11.0, h: 1.8,
      fontSize: 28, fontFace: 'Arial', color: C_WHITE, bold: true, lineSpacingMultiple: 1.15
    });

    slide.addText('Educación a lo Largo de la Vida • Plataforma Cloud Multi-Dispositivo', {
      x: 1.2, y: 3.9, w: 11.0, h: 0.6,
      fontSize: 16, fontFace: 'Arial', color: 'A7F3D0', bold: false
    });

    // Tarjeta inferior con metadatos
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 1.2, y: 4.8, w: 11.0, h: 1.2, rectRadius: 0.1,
      fill: { color: '0A4A2C' }, line: { color: '1A6B43', width: 1.5 }
    });

    slide.addText([
      { text: 'Arquitectura del Software & Modelo de Bases de Datos\n', options: { bold: true, fontSize: 13, color: C_WHITE } },
      { text: 'Tecnologías: React 19 • Cloud Firestore • Web Crypto HMAC • Offline-First PWA • Geolocalización', options: { fontSize: 11, color: 'D1FAE5' } }
    ], { x: 1.5, y: 5.0, w: 10.4, h: 0.8 });
  }

  // =========================================================================
  // SLIDE 2: OBJETIVOS Y VISIÓN GENERAL
  // =========================================================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'F1F5F9' };

    // Cabecera institucional
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: C_GREEN_DARK } });
    slide.addText('1. VISIÓN GENERAL Y OBJETIVOS DEL PROYECTO', {
      x: 0.8, y: 0.25, w: 11.5, h: 0.5,
      fontSize: 20, fontFace: 'Arial', color: C_WHITE, bold: true
    });

    // 3 Tarjetas de Pilares
    const pilares = [
      {
        title: 'Cero Filas y Cero Papel',
        desc: 'Sustitución de planillas impresas por un flujo 100% digital autónomo accesible desde cualquier smartphone mediante escaneo de Código QR institucional.',
        accent: C_GREEN_DARK
      },
      {
        title: 'Acreditación y Trazabilidad',
        desc: 'Certificación de presencia física con geolocalización satelital y emisión instantánea de la Escarapela Digital Oficial protegida con firma criptográfica.',
        accent: C_GOLD
      },
      {
        title: 'Interacción y Datos en Vivo',
        desc: 'Interacción bidireccional en el auditorio: preguntas en vivo a ponentes, calificaciones académicas por conferencia y métricas consolidadas en tiempo real.',
        accent: '0284C7'
      }
    ];

    pilares.forEach((p, idx) => {
      const xPos = 0.8 + idx * 4.0;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: xPos, y: 1.5, w: 3.7, h: 4.8, rectRadius: 0.15,
        fill: { color: C_WHITE }, line: { color: 'CBD5E1', width: 1.5 }
      });
      // Header tarjeta
      slide.addShape(pptx.ShapeType.roundRect, {
        x: xPos, y: 1.5, w: 3.7, h: 0.9, rectRadius: 0.15,
        fill: { color: p.accent }, line: { color: p.accent }
      });
      slide.addText(p.title, {
        x: xPos + 0.2, y: 1.7, w: 3.3, h: 0.5,
        fontSize: 15, fontFace: 'Arial', color: C_WHITE, bold: true, align: 'center'
      });
      slide.addText(p.desc, {
        x: xPos + 0.3, y: 2.7, w: 3.1, h: 3.3,
        fontSize: 13, fontFace: 'Arial', color: C_TEXT_DARK, lineSpacingMultiple: 1.3
      });
    });
  }

  // =========================================================================
  // SLIDE 3: ARQUITECTURA INTEGRAL DEL SISTEMA
  // =========================================================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'F1F5F9' };

    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: C_GREEN_DARK } });
    slide.addText('2. ARQUITECTURA TÉCNICA DEL SOFTWARE', {
      x: 0.8, y: 0.25, w: 11.5, h: 0.5,
      fontSize: 20, fontFace: 'Arial', color: C_WHITE, bold: true
    });

    const capas = [
      {
        nombre: 'Capa Cliente (SPA React 19 + Vite)',
        items: [
          '• Interfaz reactiva adaptativa (Mobile First para asistentes, Desktop para Admin y Proyección).',
          '• Motor de estilos CSS Vanilla optimizado con tokens y temas institucionales UdeA.',
          '• Code Splitting modular (Vendor Chunks) con tiempo de arranque inferior a 650 ms.',
          '• Sanitización estricta con DOMPurify en todos los inputs para erradicar ataques XSS.'
        ]
      },
      {
        nombre: 'Capa de Datos y Nube (Cloud Firestore)',
        items: [
          '• Base de datos NoSQL distribuida multi-región con sincronización WebSocket (onSnapshot).',
          '• Arquitectura Offline-First con caché persistente en IndexedDB ante caídas de red.',
          '• Sincronización multi-dispositivo garantizada en milisegundos para auditorio y administración.',
          '• Reglas de seguridad declarativas (Security Rules) que resguardan el Habeas Data.'
        ]
      },
      {
        nombre: 'Capa de Seguridad, Criptografía y Tiempo Oficial',
        items: [
          '• Firma HMAC-SHA256 con salt dinámico para códigos QR de Escarapelas Digitales.',
          '• Sincronización con la Hora Legal de Colombia vía internet con respaldo en reloj local.',
          '• Algoritmo de Geofencing Haversine para auditorio de Facultad de Medicina (Cra 51D #62-29).',
          '• Verificación O(1) de listas de inscritos precargadas mediante estructuras Hash en memoria.'
        ]
      }
    ];

    capas.forEach((c, idx) => {
      const yPos = 1.4 + idx * 1.7;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.8, y: yPos, w: 11.7, h: 1.5, rectRadius: 0.1,
        fill: { color: C_WHITE }, line: { color: C_GREEN_DARK, width: 1.5 }
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: yPos, w: 0.2, h: 1.5,
        fill: { color: C_GOLD }, line: { color: C_GOLD }
      });
      slide.addText(c.nombre, {
        x: 1.2, y: yPos + 0.1, w: 11.0, h: 0.35,
        fontSize: 14, fontFace: 'Arial', color: C_GREEN_DARK, bold: true
      });
      slide.addText(c.items.join('\n'), {
        x: 1.2, y: yPos + 0.45, w: 11.0, h: 0.95,
        fontSize: 11, fontFace: 'Arial', color: C_TEXT_DARK, lineSpacingMultiple: 1.15
      });
    });
  }

  // =========================================================================
  // SLIDE 4: MODELO DE BASE DE DATOS (CLOUD FIRESTORE)
  // =========================================================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'F1F5F9' };

    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: C_GREEN_DARK } });
    slide.addText('3. MODELO DE DATOS EN LA NUBE (FIRESTORE NoSQL)', {
      x: 0.8, y: 0.25, w: 11.5, h: 0.5,
      fontSize: 20, fontFace: 'Arial', color: C_WHITE, bold: true
    });

    const colecciones = [
      {
        col: 'eventos/{eventoId}',
        desc: 'Catálogo de eventos institucionales, fechas programadas, jornadas multidía, geocercas, lista de ponentes e inscritos.',
        campos: 'id, titulo, fecha, horaInicio, horaFin, lugar, esMultidia, diasConfig, ponentes[], inscritosData[]'
      },
      {
        col: 'asistencias/{asistenciaId}',
        desc: 'Registros oficiales de asistencia firmados. Lectura restringida únicamente a coordinadores académicos.',
        campos: 'eventoId, documento, nombreCompleto, correo, telefono, vinculacion, placaVehiculo, geolocalizacion{}, fechaRegistro'
      },
      {
        col: 'verificaciones/{asistenciaId}',
        desc: 'Colección pública segura para validar autenticidad de la escarapela digital desde lectores externos y cámaras.',
        campos: 'id, eventoId, nombreCompleto, docMasked, tokenSeguridad, esPresencial, fechaVerificacion'
      },
      {
        col: 'preguntas/{preguntaId}',
        desc: 'Canal de preguntas en vivo al moderador y ponentes con control anti-spam y estado de respuesta.',
        campos: 'eventoId, ponenteId, autor, esAnonimo, pregunta, respondida, destacada, fechaEnvio'
      },
      {
        col: 'evaluaciones/{evalId} & satisfaccion',
        desc: 'Retroalimentación académica de conferencistas (estrellas 1-5) y encuesta de calidad logística / NPS.',
        campos: 'eventoId, ponenteId, dominio, claridad, aplicabilidad, cumplimiento, logistica, nps, sugerencias'
      }
    ];

    colecciones.forEach((c, idx) => {
      const yPos = 1.3 + idx * 1.05;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.8, y: yPos, w: 11.7, h: 0.95, rectRadius: 0.08,
        fill: { color: C_WHITE }, line: { color: 'CBD5E1', width: 1 }
      });
      slide.addText(c.col, {
        x: 1.0, y: yPos + 0.1, w: 3.5, h: 0.35,
        fontSize: 12, fontFace: 'Consolas', color: C_GREEN_DARK, bold: true
      });
      slide.addText(c.desc, {
        x: 4.6, y: yPos + 0.1, w: 7.6, h: 0.45,
        fontSize: 11, fontFace: 'Arial', color: C_TEXT_DARK
      });
      slide.addText(`Campos clave: ${c.campos}`, {
        x: 1.0, y: yPos + 0.55, w: 11.2, h: 0.3,
        fontSize: 10, fontFace: 'Arial', color: C_TEXT_MUTED, italic: true
      });
    });
  }

  // =========================================================================
  // SLIDE 5: SEGURIDAD, HABEAS DATA Y CRIPTOGRAFÍA
  // =========================================================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'F1F5F9' };

    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: C_GREEN_DARK } });
    slide.addText('4. SEGURIDAD, CRIPTOGRAFÍA Y HABEAS DATA (LEY 1581)', {
      x: 0.8, y: 0.25, w: 11.5, h: 0.5,
      fontSize: 20, fontFace: 'Arial', color: C_WHITE, bold: true
    });

    const itemsSeguridad = [
      {
        title: 'Protección de Datos Personales (Habeas Data)',
        puntos: [
          '• Cláusula explícita previa y obligatoria de autorización institucional según Ley 1581 de 2012.',
          '• Ningún asistente puede consultar la base de datos de otros participantes.',
          '• Enmascaramiento inteligente de correos y nombres en verificaciones públicas.'
        ]
      },
      {
        title: 'Firma Criptográfica Anti-Falsificación (HMAC-SHA256)',
        puntos: [
          '• Cada código QR de la Escarapela Digital contiene un hash criptográfico sellado.',
          '• Imposibilidad de alterar comprobantes o generar credenciales fraudulentas.',
          '• El escáner valida la firma matemática en milisegundos sin comprometer datos confidenciales.'
        ]
      },
      {
        title: 'Defensa de Identidad y Anti-Suplantación',
        puntos: [
          '• Validación cruzada de identidad: el nombre debe coincidir estrictamente con el registro inicial.',
          '• Desafío de seguridad por correo registrado al acceder desde un nuevo dispositivo o navegador.',
          '• Sanitización profunda de cadenas mediante DOMPurify para prevenir inyecciones SQL/NoSQL/XSS.'
        ]
      },
      {
        title: 'Reglas de Acceso en la Nube (Security Rules)',
        puntos: [
          '• Capa de autorización a nivel de base de datos directamente en Cloud Firestore.',
          '• Bloqueo de consultas globales no autenticadas sobre las listas de asistencia.',
          '• Validación de esquema y tipado estricto en cada escritura para prevenir anomalías de datos.'
        ]
      }
    ];

    itemsSeguridad.forEach((sec, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const xPos = 0.8 + col * 5.9;
      const yPos = 1.35 + row * 2.7;

      slide.addShape(pptx.ShapeType.roundRect, {
        x: xPos, y: yPos, w: 5.7, h: 2.5, rectRadius: 0.12,
        fill: { color: C_WHITE }, line: { color: C_GOLD, width: 1.5 }
      });
      slide.addText(sec.title, {
        x: xPos + 0.3, y: yPos + 0.2, w: 5.1, h: 0.45,
        fontSize: 13, fontFace: 'Arial', color: C_GREEN_DARK, bold: true
      });
      slide.addText(sec.puntos.join('\n'), {
        x: xPos + 0.3, y: yPos + 0.7, w: 5.1, h: 1.65,
        fontSize: 11, fontFace: 'Arial', color: C_TEXT_DARK, lineSpacingMultiple: 1.25
      });
    });
  }

  // =========================================================================
  // SLIDE 6: EXPERIENCIA DEL ASISTENTE (LAS 5 ETAPAS)
  // =========================================================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'F1F5F9' };

    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: C_GREEN_DARK } });
    slide.addText('5. FLUJO SECUENCIAL INTERACTIVO (PORTAL DEL ASISTENTE)', {
      x: 0.8, y: 0.25, w: 11.5, h: 0.5,
      fontSize: 20, fontFace: 'Arial', color: C_WHITE, bold: true
    });

    const etapas = [
      { num: '1', nombre: 'Geolocalización GPS', desc: 'Validación satelital del sensor móvil contra las coordenadas del Auditorio de Medicina.' },
      { num: '2', nombre: 'Datos de Asistencia', desc: 'Cédula, correo, vinculación, placa vehicular opcional y verificación en lista oficial.' },
      { num: '3', nombre: 'Escarapela & Preguntas', desc: 'Credencial QR instantánea con opción de realizar nuevo registro y preguntas en vivo al ponente.' },
      { num: '4', nombre: 'Calificación Ponentes', desc: 'Evaluación académica individual por expositor (dominio, claridad y aplicación práctica).' },
      { num: '5', nombre: 'Satisfacción / Forms', desc: 'Métricas de calidad logística, recomendación institucional NPS o Microsoft Forms.' }
    ];

    etapas.forEach((et, idx) => {
      const xPos = 0.8 + idx * 2.4;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: xPos, y: 1.6, w: 2.25, h: 4.6, rectRadius: 0.15,
        fill: { color: C_WHITE }, line: { color: 'CBD5E1', width: 1.2 }
      });
      // Círculo del paso
      slide.addShape(pptx.ShapeType.ellipse, {
        x: xPos + 0.65, y: 1.9, w: 0.95, h: 0.95,
        fill: { color: C_GREEN_DARK }
      });
      slide.addText(et.num, {
        x: xPos + 0.65, y: 2.1, w: 0.95, h: 0.5,
        fontSize: 18, fontFace: 'Arial', color: C_WHITE, bold: true, align: 'center'
      });
      slide.addText(et.nombre, {
        x: xPos + 0.15, y: 3.1, w: 1.95, h: 0.7,
        fontSize: 13, fontFace: 'Arial', color: C_GREEN_DARK, bold: true, align: 'center'
      });
      slide.addText(et.desc, {
        x: xPos + 0.15, y: 3.9, w: 1.95, h: 2.1,
        fontSize: 11, fontFace: 'Arial', color: C_TEXT_DARK, align: 'center', lineSpacingMultiple: 1.2
      });
    });
  }

  // =========================================================================
  // SLIDE 7: PANEL DE ADMINISTRACIÓN Y CONTROL EN AUDITORIO
  // =========================================================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'F1F5F9' };

    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: C_GREEN_DARK } });
    slide.addText('6. PANEL DE ADMINISTRACIÓN Y CONTROL OPERATIVO', {
      x: 0.8, y: 0.25, w: 11.5, h: 0.5,
      fontSize: 20, fontFace: 'Arial', color: C_WHITE, bold: true
    });

    const adminFeatures = [
      {
        title: 'Carga Inteligente de Inscritos (Excel / CSV)',
        desc: 'Permite subir listados oficiales de inscritos con almacenamiento directo en la nube (Firestore). La whitelist queda activa inmediatamente en todos los dispositivos y celulares conectados.'
      },
      {
        title: 'Alta Manual de Excepciones',
        desc: 'Funcionalidad exclusiva para el administrador que permite autorizar en tiempo real documentos no preinscritos sin necesidad de modificar el archivo base.'
      },
      {
        title: 'Proyección del Código QR en Pantalla Gigante',
        desc: 'Modal a pantalla completa con QR dinámico optimizado para escaneo a distancia desde cualquier rincón del auditorio, facilitando el ingreso rápido masivo.'
      },
      {
        title: 'Escáner Óptico de Acreditación (Check-in)',
        desc: 'Lector de QR integrado mediante cámara web o teléfono de logística para verificar y sellar el ingreso físico de los asistentes en la puerta del evento.'
      },
      {
        title: 'Exportación Consolidada a Excel Oficial',
        desc: 'Generación con 1 clic de hojas de cálculo .xlsx con datos de asistencia, geolocalización, vinculación, fechas y comprobantes listos para entrega académica.'
      }
    ];

    adminFeatures.forEach((feat, idx) => {
      const yPos = 1.35 + idx * 1.05;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.8, y: yPos, w: 11.7, h: 0.95, rectRadius: 0.1,
        fill: { color: C_WHITE }, line: { color: 'E2E8F0', width: 1 }
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: yPos, w: 0.15, h: 0.95,
        fill: { color: C_GOLD }, line: { color: C_GOLD }
      });
      slide.addText(feat.title, {
        x: 1.2, y: yPos + 0.12, w: 4.5, h: 0.35,
        fontSize: 13, fontFace: 'Arial', color: C_GREEN_DARK, bold: true
      });
      slide.addText(feat.desc, {
        x: 5.8, y: yPos + 0.1, w: 6.5, h: 0.75,
        fontSize: 11, fontFace: 'Arial', color: C_TEXT_DARK, lineSpacingMultiple: 1.15
      });
    });
  }

  // =========================================================================
  // SLIDE 8: RENDIMIENTO Y ALTA DISPONIBILIDAD
  // =========================================================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'F1F5F9' };

    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: C_GREEN_DARK } });
    slide.addText('7. RENDIMIENTO, CONCURRENCIA Y RESILIENCIA', {
      x: 0.8, y: 0.25, w: 11.5, h: 0.5,
      fontSize: 20, fontFace: 'Arial', color: C_WHITE, bold: true
    });

    const metrics = [
      { num: '< 650 ms', label: 'Tiempo de Compilación y Arranque', desc: 'Vite optimizado con chunks segregados (React, Firebase, DOMPurify, XLSX).' },
      { num: 'O(1)', label: 'Complejidad Algorítmica', desc: 'Búsqueda instantánea en sets indexados de hasta miles de inscritos sin congelar el hilo UI.' },
      { num: '100%', label: 'Disponibilidad Offline-First', desc: 'Persistencia en caché local IndexedDB que protege la operación ante cortes de WiFi.' },
      { num: '0 ms', label: 'Latencia en Reactividad', desc: 'Subscripción reactiva por WebSockets: sincronización multi-pantalla inmediata.' }
    ];

    metrics.forEach((m, idx) => {
      const xPos = 0.8 + idx * 2.95;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: xPos, y: 1.5, w: 2.8, h: 4.8, rectRadius: 0.15,
        fill: { color: C_WHITE }, line: { color: C_GREEN_DARK, width: 1.5 }
      });
      slide.addText(m.num, {
        x: xPos + 0.1, y: 1.9, w: 2.6, h: 0.8,
        fontSize: 32, fontFace: 'Arial', color: C_GOLD, bold: true, align: 'center'
      });
      slide.addText(m.label, {
        x: xPos + 0.15, y: 2.9, w: 2.5, h: 0.7,
        fontSize: 14, fontFace: 'Arial', color: C_GREEN_DARK, bold: true, align: 'center'
      });
      slide.addText(m.desc, {
        x: xPos + 0.2, y: 3.8, w: 2.4, h: 2.2,
        fontSize: 12, fontFace: 'Arial', color: C_TEXT_DARK, align: 'center', lineSpacingMultiple: 1.25
      });
    });
  }

  // =========================================================================
  // SLIDE 9: CONCLUSIONES Y ROADMAP
  // =========================================================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: C_GREEN_DEEP };

    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8, y: 1.0, w: 0.15, h: 5.0,
      fill: { color: C_GOLD }, line: { color: C_GOLD }
    });

    slide.addText('8. IMPACTO INSTITUCIONAL Y CONCLUSIONES', {
      x: 1.2, y: 1.1, w: 11.0, h: 0.5,
      fontSize: 22, fontFace: 'Arial', color: C_WHITE, bold: true
    });

    const conclusiones = [
      '• Eficiencia Operativa: Eliminación total de cuellos de botella en el acceso a eventos masivos.',
      '• Validez Académica: Certificación verídica de asistencia presencial con trazabilidad GPS y comprobantes únicos.',
      '• Seguridad Institucional: Cumplimiento riguroso de la Ley de Protección de Datos Personales (1581 de 2012).',
      '• Alta Disponibilidad: Plataforma en la nube multi-dispositivo con respaldo resiliente offline.',
      '• Escalabilidad: Modelo aplicable a cualquier facultad o evento institucional de la Universidad de Antioquia.'
    ];

    slide.addText(conclusiones.join('\n\n'), {
      x: 1.2, y: 1.8, w: 11.0, h: 4.2,
      fontSize: 15, fontFace: 'Arial', color: 'E2E8F0', lineSpacingMultiple: 1.2
    });
  }

  const outPath = path.join(__dirname, '..', 'presentacion_proyecto_udea_medicina.pptx');
  await pptx.writeFile({ fileName: outPath });
  console.log('Presentación generada exitosamente en:', outPath);
}

createPresentation().catch(err => {
  console.error('Error generando presentación:', err);
  process.exit(1);
});
