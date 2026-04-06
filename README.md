<div align="center">
  <img src="https://via.placeholder.com/150/FF2D55/ffffff?text=TransformAI" alt="TransformAI Logo">
  <h1>TransformAI V3.2</h1>
  <p>Tu Coach Virtual impulsado por Inteligencia Artificial con diseño inspirado en Apple Fitness.</p>
</div>

---

## 📌 Visión General
**TransformAI** es una aplicación PWA (Progressive Web App) enfocada en el fitness y la nutrición. A través de un diseño minimalista (Glassmorphism + Dark Mode), la app implementa funciones analíticas con simulaciones de IA para escanear alimentos, calcular métricas de agua, registrar rutinas de gimnasio/casa, y leer los datos de tu Apple Watch de manera completamente dinámica y orientada a la gamificación.

## 🚀 Características Principales

### 🏋️ Entrenamientos Inteligentes
*   **Toggle Gimnasio / En Casa:** Cambia instantáneamente tu rutina de pesas por rutinas focalizadas con peso corporal (Bodyweight).
*   **Gestión Activa:** Completa repeticiones y establece pesos. Incluye sistema **"Progressive Overload"** detectando automáticamente cuando mejoras tu fuerza y ajustando el peso la siguiente vez.
*   **Control Total:** Entrenamientos activos con **cronómetro integrado**. Puedes Pausar, Cancelar o Guardar. También puedes eliminar entrenamientos si los iniciaste por error.

### 🍎 Nutrición Dinámica y Planificación
*   **Calendario Semanal:** Revisa cada comida asignada de la semana y genera automáticamente una **Lista de Compras**.
*   **Alergias e Hidratación:** El generador de dietas filtra alimentos en base a tus alergias indicadas.

### 🤖 Integración simulada con Inteligencia Artificial
*   **Escáner de Comidas:** Sube fotos de tus platos para que la IA simule el cálculo de Proteínas, Carbohidratos, Grasas y Calorías Consumidas.
*   **Detección de Agua:** Sube o toma una foto de tu vaso, y deja que la IA calcule los mililitros y los sume a tu meta del día.
*   **Coach de Progreso:** Analiza fotos de progreso corporal para dar retroalimentación de simetría y añadir ejercicios de corrección a tu rutina actual (como Face Pulls).
*   **OCR Smartwatch:** Sube una foto de los resultados de tu Apple Watch y la app extraerá mediante OCR (Reconocimiento Óptico de Caracteres) tu duración, Calorías quemadas y Ritmo Cardíaco.

### 📊 Dashboard y Anillos de Actividad
Sistema visual en el Home mediante una cuadrícula de 5 Anillos que monitorean métricas claves:
1.  🔥 **Quema Diaria (Calorías del Ejercicio)**
2.  ⚡ **Entrenamientos Semanales**
3.  👟 **Pasos (Steps)**
4.  💧 **Agua**
5.  🥗 **Consumo (Calorías Ingeridas)**

### 🏆 Gamificación y Progresión
*   Rachas de fuego por continuidad en los entrenamientos.
*   Banderas y medallas desbloqueables (1 día, 3 días, Semana Perfecta, Rey de Hierro, etc.).

## 🛠️ Tecnologías Empleadas
Este proyecto está construido en la base sagrada del desarrollo web moderno sin depender de frameworks pesados para su versión de prototipo:
*   **HTML5** (Semántico y Estructurado)
*   **Vanilla CSS3** (Variables CSS, Flexbox, Grid, Animaciones SVG para Anillos)
*   **Vanilla JavaScript (ES6+)** (LocalStorage para persistencia de Estado local, FileReader API, MediaDevices API para Cámara, Modularización simulada).
*   **Tesseract.js** (Soporte pre-descargado para funciones de Reconocimiento Óptico reales si se provee la librería).

## 📥 Instalación

Clona el repositorio o abre los archivos directamente en tu navegador.
Al ser una aplicación basada puramente en el cliente (Frontend-Only PWA), no requieres Node.js ni bases de datos para arrancar el entorno primario:

```bash
git clone https://github.com/tu-usuario/TransformAI.git
cd TransformAI
```
*Puedes desplegar esto en plataformas gratuitas como **GitHub Pages** o **Vercel** usando solo la estructura de la carpeta.*

## 📜 Estructura de Directorios (MVP)

```text
TransformAI/
├── index.html     --> Hub Completo de Interfaces y Modales.
├── styles.css     --> Sistema CSS y variables
├── app.js         --> Toda la Arquitectura de Lógica de Cliente y LocalStorage
├── sw.js          --> Archivo preparatorio para Service Worker (Offline Capabilities)
└── README.md
```

## 🤝 Contribuir
¡Siéntete libre de proponer Pull Requests o Issues para expandir las capacidades de IA y back-end real en una futura versión React Native/Next.js!
