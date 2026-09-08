# Sistema de Asistencia, Ponencias y Gestión de Eventos
## Facultad de Medicina — Universidad de Antioquia (UdeA)
### Educación a lo Largo de la Vida

Sistema web integral de asistencia presencial mediante geolocalización satelital (GPS), proyección de código QR único por evento, moderación de preguntas a ponentes en vivo (Q&A), calificación individualizada de conferencistas, encuesta de satisfacción (NPS) y exportación a Microsoft Excel (.xlsx) y Microsoft Forms a **costo $0 en la nube**.

---

## Características Principales

1. **Identidad Visual UdeA Oficial:**
   - Paleta institucional: Verde Bosque UdeA (`#0F5938`), Verde de Acción (`#008744`), Acentos Dorados Heráldicos (`#C59B27`) y Tipografía médica humanista (*Outfit* y *Plus Jakarta Sans*).
2. **Listado de Asistencia y Prevención de Duplicados:**
   - Registro con Cédula, Nombres, Correo, Teléfono y Vinculación Institucional.
   - Emisión de comprobante único de asistencia (`ATT-XXXXX`).
3. **Placa del Vehículo Condicional:**
   - Al crear el evento, el administrador define si se activa la casilla `Habilitar Registro de Placa del Vehículo`.
   - Si está activa, el formulario de asistencia exige la placa para autorización en el parqueadero de la Facultad. Si está inactiva, el campo se oculta por completo.
4. **Proyector de Código QR en Alta Definición:**
   - Modo pantalla gigante para proyectar en el auditorio con instrucciones visuales.
   - Botón de descarga de imagen PNG en alta calidad y botón de impresión de afiche oficial.
5. **Geolocalización GPS Satelital:**
   - Valida la presencia física en el campus de la Facultad de Medicina UdeA (Calle 67 # 53-108, Medellín) calculando la distancia geodésica mediante la fórmula de Haversine.
6. **Muro de Preguntas en Vivo (Live Q&A):**
   - Los participantes seleccionan el ponente y envían preguntas clínicas o teóricas (con opción de anonimato).
   - Panel de moderación en tiempo real para marcar preguntas como "Respondidas", "Destacadas" o eliminarlas.
7. **Calificación Individual de Ponentes:**
   - Generación dinámica de formularios de evaluación para cada conferencista registrado (Dominio temático, Claridad pedagógica y Aplicabilidad médica de 1 a 5 estrellas + comentarios).
8. **Encuesta de Satisfacción General (NPS):**
   - Métricas de satisfacción global y Net Promoter Score (0 a 10).
9. **Exportación a Microsoft Excel (.xlsx) y Conexión con Microsoft Forms:**
   - Descarga inmediata de un libro Excel con 5 hojas detalladas.
   - Compatibilidad de formato con Microsoft Forms y Power BI.

---

## Ejecución en Modo Local

1. Asegúrate de tener Node.js instalado.
2. Abre la terminal en esta carpeta:
   ```bash
   npm install
   npm run dev
   ```
3. Accede en tu navegador a: `http://127.0.0.1:5173/`

---

## Despliegue Gratuito en Vercel ($0 USD)

### Opción 1: Conectando con GitHub (Recomendada)
1. Inicializa el repositorio Git y súbelo a tu cuenta de GitHub:
   ```bash
   git init
   git add .
   git commit -m "Sistema de Asistencia UdeA Medicina v1.0"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/udea-medicina-eventos.git
   git push -u origin main
   ```
2. Ve a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
3. Haz clic en **"Add New..." > "Project"**.
4. Importa el repositorio `udea-medicina-eventos`.
5. Deja la configuración predeterminada (Vite ya está configurado en `vercel.json`).
6. Haz clic en **"Deploy"**. En 45 segundos tu aplicativo estará en línea con dominio propio y certificado HTTPS gratuito (ej: `https://udea-medicina-eventos.vercel.app`).

### Opción 2: Despliegue Directo desde Terminal (Vercel CLI)
```bash
npx vercel
```
Sigue los 3 pasos en consola y tu proyecto estará publicado en segundos.
