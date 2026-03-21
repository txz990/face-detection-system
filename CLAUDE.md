# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Face Feature Detection System** - A Vue3 + MediaPipe web application for detecting and measuring facial landmarks in images. Users can upload photos, the system detects 468 facial keypoints, and displays measurements with four different visualization modes.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server on http://localhost:5173 (auto-opens)
npm run build        # Build for production to dist/
npm run preview      # Preview production build locally
```

## Project Structure

```
src/
├── main.js              # Vue app entry point
├── App.vue              # Main component (2-panel layout)
└── utils/
    └── faceDetector.js  # MediaPipe face detection logic
index.html              # HTML entry point
vite.config.js          # Vite build configuration
```

## Architecture

### Component Structure (App.vue)

Single-page application with **two-panel layout**:

**Left Panel:**
- Image upload with drag-drop support (`handleDrop`, `processFile`)
- Preview with "replace image" overlay
- Detection button with loading state
- Model loading status and error handling

**Right Panel:**
- Detection result image with annotation canvas
- Switchable measurement modes (buttons: all, third, five-eyes, keypoints)
- Data analysis card with 6 data sections showing measurements

### Face Detection Flow (faceDetector.js)

1. **Initialize**: `initializeFaceDetector()` loads MediaPipe FaceLandmarker model from CDN
   - Vision library: `@mediapipe/tasks-vision@latest/wasm`
   - Model asset: `face_landmarker.task` (float16, latest)
   - Configured for single face (numFaces: 1) in IMAGE mode

2. **Detect**: `detectFaceInImage(imageUrl, measurementMode)` processes image
   - Loads image via Image API
   - Calls `faceLandmarker.detect(img)` to get 468 3D landmarks
   - Creates canvas with original image
   - Calls `drawLandmarks()` to annotate based on mode
   - Returns canvas as data URL and landmark measurements

3. **Draw**: `drawLandmarks()` annotates canvas based on measurement mode
   - **all**: Face outline + eyes + mouth + three-thirds + five-eyes + keypoint labels
   - **third**: Three-thirds horizontal divisions with measurements
   - **five-eyes**: Vertical divisions for five-eye proportions
   - **keypoints**: Only keypoint circles and their measurements
   - All modes use dashed/solid lines and labeled boxes with measurements

### Face Landmark Indices

MediaPipe uses 468 landmarks with specific indices for different features:

- **FACE_OVAL** (36 points): Outline of face
- **LEFT_EYE** (16 points): Left eye contour
- **RIGHT_EYE** (16 points): Right eye contour
- **LIPS** (10 points): Mouth outline
- **Key single points**:
  - 1: Nose tip
  - 10: Forehead center
  - 13: Mouth top center
  - 14: Mouth bottom center
  - 33: Left eye outer corner
  - 105: Left eyebrow outer corner
  - 130: Left eye inner corner
  - 152: Chin tip
  - 162: Face left (cheekbone)
  - 263: Right eye inner corner
  - 291: Mouth right corner
  - 327: Nose right
  - 362: Right eye outer corner
  - 389: Face right (cheekbone)

### Measurement Calculations

`calculateFaceMeasurements()` computes:
- **Face dimensions**: Height (forehead to chin), width (left to right cheekbone)
- **Three-thirds ratios**: Upper (forehead area), middle (eyes to nose), lower (nose to chin)
- **Eye measurements**: Width of each eye, distance between eyes, height of each eye
- **Nose measurements**: Width, height
- **Mouth measurements**: Width, height
- **Keypoint coordinates**: X, Y positions for left eye, right eye, nose, mouth

All coordinates are normalized (0-1) by MediaPipe and scaled to image dimensions in pixels.

## Data Flow

```
User uploads image
  ↓
ImageUrl stored in ref (imageUrl)
  ↓
[Click "Start Detection"]
  ↓
detectFaceInImage(imageUrl, currentMeasurementMode)
  ↓
Face landmarks detected + Canvas annotated
  ↓
resultImageData and faceData refs updated
  ↓
UI renders result image + data sections
```

Switching measurement modes re-runs detection with different `measurementMode` parameter, keeping landmarks the same but changing visualization.

## UI/UX Patterns

- **Card-based layout**: `.panel-card` with headers, content, shadows
- **Color palette**: Uses CSS variables (--primary: #6366f1, --accent: #10b981, etc.)
- **Responsive**: Max-width 1200px, flex-column on mobile (<1024px)
- **Animations**:
  - Loading: spinning loader, pulsing indicator
  - Empty state: floating face illustration
  - Hover: translate, shadow, color change effects
- **Status feedback**:
  - Model loading hint (yellow)
  - Error hint (red)
  - Loading spinner on button
- **Data grid**: `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))` for responsive cards

## Important Implementation Details

1. **Canvas annotation**: Measurements are drawn on a new canvas created in `detectFaceInImage()`, not manipulating original image
2. **Coordinate scaling**: MediaPipe returns normalized coordinates (0-1), multiply by image width/height to get pixel coordinates
3. **Text boundary handling**: Labels adjust position if they would overflow canvas edges (e.g., nose label on right edge moves left)
4. **Drawing order**: Outlines drawn first (dashed), then measurement lines, then keypoint circles with labels on top
5. **Model loading**: First run downloads ~50MB model - show loading state during this time
6. **Single face mode**: Configured for 1 face - if multiple faces detected, only first is processed
7. **No local tests**: No test files or test runner configured - testing is manual via browser

## Vue3 Composition API Patterns

- Uses `<script setup>` syntax
- Refs for reactive state: `ref(null)` for objects/images, `ref(true)` for bools
- Functions defined in script section, called from template with `@click`, `@change`, etc.
- Conditional rendering: `v-if`, `v-else`, `v-for` for data sections
- Class binding: `:class="{ active: condition }"` for active states

## Common Development Tasks

**Adding a new measurement**:
1. Define landmark indices in `faceDetector.js`
2. Add calculation in `calculateFaceMeasurements()`
3. Add data item in App.vue template under appropriate data section
4. Add label and format in `formatLabel()` function

**Changing visualization colors**:
- All canvas drawing colors are in `drawLandmarks()`, `drawThirdRegions()`, `drawFiveEyesRegions()`
- Hex colors (e.g., `#6366f1`) used directly in `ctx.strokeStyle`, `ctx.fillStyle`

**Adjusting layout**:
- CSS variables at top of App.vue `<style scoped>`
- Panel widths: `.left-panel { flex: 0 0 380px }`
- Responsive breakpoints: `@media (max-width: 1024px)` and `(max-width: 640px)`

## Dependencies

- **vue** (^3.4.0): UI framework
- **@mediapipe/tasks-vision**: Face detection model and landmarks
- **vite** (^5.0.0): Build tool
- **@vitejs/plugin-vue**: Vue3 support in Vite

No testing framework, no database, no backend - client-side only.

## Known Constraints

- Requires internet connection for first-time model download
- Works best with clear, front-facing portraits
- Single face detection (ignores additional faces in image)
- All processing happens in browser (no API calls after model loaded)
- Chinese UI language with some emoji labels
