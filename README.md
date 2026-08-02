# LibroLibre — Fases 1 a 6

Lector de libros y cómics offline-first (HTML5 + CSS3 + JavaScript vanilla,
preparado para empaquetar con Apache Cordova).

## Generar la APK (GitHub Actions)

Este repo ya viene armado como proyecto Cordova (`config.xml`, `package.json`,
código de la app dentro de `www/`). Cada vez que subís cambios a la rama `main`,
el workflow `.github/workflows/build-apk.yml` compila automáticamente una APK.

Para bajarla:
1. En GitHub, entrá a la pestaña **Actions** del repositorio.
2. Abrí la ejecución más reciente de **"Build APK"** (ícono verde ✓ = terminó bien).
3. Al final de la página, en **Artifacts**, vas a ver **`LibroLibre-apk`** — descargalo
   (te baja un `.zip` que adentro tiene el `app-debug.apk`).
4. Pasá ese `.apk` a tu celular e instalalo (Android te va a pedir habilitar
   "instalar apps de fuentes desconocidas" la primera vez).

También podés lanzar el build a mano sin subir cambios: **Actions → Build APK →
Run workflow**.

> Es una APK de **debug**, sin firmar — perfecta para instalar y probar en tu
> propio teléfono. Para publicarla en Google Play hace falta firmarla con un
> keystore de release, que es un paso aparte (dejalo para más adelante si
> llegás a necesitarlo).

## Qué incluye hasta ahora

**Fase 1 — Arquitectura y biblioteca**
- Arquitectura modular: `css/`, `js/modules/{database,library,components,settings,reader}`.
- Sistema de diseño propio "Purple Neon" (glassmorphism + neumorphism oscuro) con 5 temas:
  Purple Neon (por defecto), AMOLED, Sepia, Papel y Cyber.
- Base de datos (`js/modules/database/db.js`): wrapper de IndexedDB con stores para
  libros, marcadores, notas, configuración, historial, categorías y archivos.
- Biblioteca funcional: vista grid/lista, buscador, filtro por categoría y estado,
  orden (recientes/título/autor/progreso), tamaño de portada ajustable, favoritos.
- Pantallas: Inicio, Biblioteca, Recientes, Favoritos, Categorías, Colecciones (placeholder),
  Estadísticas, Configuración, Acerca de.
- Exportación de notas, marcadores y configuración a JSON.

**Fase 2 — Lector PDF (nuevo)**
- Motor propio sobre **PDF.js 4.10** (bundle local en `assets/vendor/pdfjs/`, 100% offline,
  incluye cmaps y fuentes estándar — sin CDN).
- Al importar un PDF se cuenta el número real de páginas y se genera una portada
  renderizando la primera página (ya no es solo metadata: el archivo completo se
  guarda en IndexedDB, store `files`).
- Lector con: zoom in/out y doble toque/doble clic para zoom rápido, scroll vertical
  continuo y modo horizontal por página, miniaturas (carga perezosa), ir a página,
  buscar texto con resaltado y salto de resultado, rotación 90°, pantalla completa,
  marcadores con lista lateral, y progreso de lectura que se guarda solo y recuerda
  la última página al reabrir el libro.
- Gestión de memoria: en modo vertical solo se mantienen renderizadas ~6 páginas a la vez.

**Fase 3 — Lector EPUB (nuevo)**
- Motor propio sobre **epub.js 0.3.93** + **JSZip 3.10** (bundles UMD locales en
  `js/vendor/`, cargados como `<script>` clásicos antes del módulo principal —
  100% offline, sin CDN).
- Al importar un EPUB se extraen título, autor y portada reales (`book.coverUrl()`)
  y se cuenta el número de capítulos.
- Lector con paginación reflow (columnas), tabla de contenidos navegable con capítulo
  activo resaltado, panel de tipografía (familia, tamaño, interlineado, márgenes,
  alineación izquierda/justificado), búsqueda de texto capítulo por capítulo con
  salto a la posición exacta (CFI), marcadores, pantalla completa, navegación con
  flechas del teclado y por zonas táctiles a los costados, y progreso por
  porcentaje real (se indexan ubicaciones en segundo plano con `book.locations`)
  que recuerda automáticamente el CFI de la última página leída.
- El shell visual (`.reader-screen/.reader-toolbar/.reader-panel`) se reutiliza
  del lector PDF; cada formato solo aporta su propio "engine".

**Fase 4 — Lector de cómics CBZ/CBR (nuevo)**
- **CBZ**: extracción de páginas con JSZip (perezosa, se descomprime cada imagen
  solo cuando se necesita).
- **CBR**: descompresor RAR puro-JS local (`js/vendor/unrarjs/`, adaptado del
  paquete `unrar.js`/bitjs, sin dependencias nativas ni WASM). Soporta RAR 2.0/2.9
  —la inmensa mayoría de `.cbr` en circulación—; RAR5 no está soportado y se
  informa con un error claro en vez de fallar en silencio.
- Al importar se cuentan las páginas reales y se usa la primera como portada.
- Mismo motor de lectura que el visor de imágenes: scroll vertical continuo u
  horizontal por página, **doble página** (modo cómic clásico), zoom con doble
  toque, miniaturas, marcadores, pantalla completa y progreso que recuerda la
  última página.
- Los tres lectores (PDF, EPUB, CBZ/CBR) comparten el mismo shell visual —
  toolbar, panel lateral, temas— así que la experiencia es consistente en
  toda la app.

**Fase 5 — Notas (nuevo)**
- Pestaña "Notas" agregada al panel lateral de los tres lectores (PDF, EPUB, CBZ/CBR).
- Notas con título, contenido, color (5 colores) y la página/posición donde se
  crearon (número de página o CFI de EPUB); click en una nota salta directo ahí.
- Alta y edición mediante un modal reutilizable; borrado con confirmación visual (toast).
- Todo persistido en el store `notes` de IndexedDB (ya existía desde la Fase 1,
  ahora tiene interfaz real).

**Fase 6 — Estadísticas avanzadas (nuevo)**
- Tracker de tiempo de lectura real (`js/modules/reader/readingSession.js`),
  compartido por los tres lectores: mide tiempo activo, se pausa solo si la
  pestaña/app pierde foco, y descarta aperturas accidentales de menos de 4s.
- Pantalla "Estadísticas" ampliada: tiempo total de lectura, racha de días
  consecutivos (🔥), minutos de los últimos 30 días, gráfico de barras de la
  semana (7 días, hecho a mano en CSS/JS, sin librería de gráficos) y el
  libro con más tiempo acumulado.
- El widget de inicio ahora muestra la racha de días en vez del dato de
  formato más usado (que ya vive en la pantalla de Estadísticas).

## Qué falta (fuera del alcance original, ideas para seguir)

1. Colecciones personalizadas (agrupar libros manualmente más allá de categoría).
2. Empaquetado final con Apache Cordova (`config.xml`, iconos y splash reales,
   ajustes de `AndroidManifest` para permisos de almacenamiento).

## Cómo probarlo

Es una PWA sin build step. Sirve la carpeta con cualquier servidor estático
(los módulos ES6 requieren `http://`, no `file://`):

```bash
cd librolibre
python3 -m http.server 8080
# abre http://localhost:8080
```

Importa un PDF, EPUB, CBZ o CBR real desde el botón "Importar" y ábrelo desde
la biblioteca o el inicio para probar cada lector.

## Notas técnicas

- Sin frameworks (sin React/Angular/Vue/Bootstrap/Tailwind/jQuery), tal como se pidió.
- PDF.js corre en su propio Web Worker (`pdf.worker.min.mjs`) para no bloquear la interfaz.
- Las fuentes de interfaz (`Inter`, `SF Pro Display`) usan fallback a fuentes de sistema;
  para Cordova offline real, agrega los `.woff2` a `assets/fonts/` y decláralos con
  `@font-face` en `css/tokens.css`.
- `js/modules/components/modal.js` es un componente genérico listo para los diálogos
  de notas de la próxima fase.
- El shell del lector (`.reader-screen`, `.reader-toolbar`, `.reader-panel`) está
  pensado para ser reutilizado por los lectores EPUB, CBZ y CBR: solo cambia el
  "engine" que renderiza el contenido dentro de `.reader-body`.
