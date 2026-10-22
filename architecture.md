# Apex Chase: Architecture & Technical Design Document

## 0. Status

### Done

- **Application Shell & Viewport Scaffold:** Responsive, mobile-first portrait aspect ratio (`min(100vw, 480px)`) with crisp device-pixel-ratio Canvas scaling and desktop letterboxing.
- **PWA Baseline:** Web App Manifest (`manifest.json`) configured for standalone display, service worker registration, modernized mobile capability meta tags, and `beforeinstallprompt` capture hooks.
- **Local-First Persistence Layer:** Dexie.js (`ApexChaseDB`) initialized with IndexedDB and resilient fallback handling for restricted or sandboxed iframe environments, providing `runs` and `settings` tables.
- **Color Palette System Bridge:** Dynamic CSS token mapping binding triad themes to Canvas rendering contexts (`surface-base`, `surface-road`, `accent-primary`, `accent-warning`, `accent-danger`, `neutral-secondary`, and `ui-overlay`).
- **Game State Machine:** Discrete states (`IDLE` / Attract Mode, `PLAYING`, `GAME_OVER`) with an attract overlay, start triggers, and live telemetry HUD (speed, gear, distance, FPS).
- **Vehicle Transmission & Physics Model:** Two-speed transmission model (snappy low-gear grip vs. high-gear drift and top speed), lateral inertia, and shoulder drag penalties.
- **Dual-Mode Input Controller:** Desktop keyboard mapping (`WASD` / Arrows, `Shift` / `Space`) and mobile touch input deck (touch steer zone, gear toggle button).
- **Analytic Road Baseline:** Migration away from high-frequency point wiggles to continuous, long-wavelength road segment travel.

### TODO

- **Road Engine Curve Extrusion:** Complete the parametric normal ribbon extrusion model in `src/game/road.ts` and `src/game/renderer.ts` to ensure mathematically uniform road width, clean curve transitions, and stable boundary checks without edge pinching.
- **Curvature Difficulty Calibration:** Narrow road width to ~50% canvas width and increase lateral curve amplitude so turns demand deliberate, sustained steering.
- **Primary Combat Subsystem:** Forward twin machine guns, fixed-size projectile pooling, firing cooldowns, and collision raycasts.
- **Armory Hauler (Supply Rig):** Moving supply truck spawn schedule, rear-docking ramp alignment trigger, and docking state animation.
- **Sub-Weapon Arsenal:** Weapon inventory state and activation mechanics for rear defense (Oil Slick, Smoke Screen) and forward hazards (Missiles).
- **Traffic & Hostile AI Pipeline:** Procedural spawning and pathing for neutral civilian vehicles (with score freeze penalties on impact), Enforcer ramming AI, and Razorback lateral-slashing AI.
- **Terrain Shifts & Environmental Mechanics:** Dynamic surface state transitions (wet/icy asphalt with reduced lateral traction, or boathouse water transitions).
- **Procedural Web Audio Engine:** Synthesis loops using Web Audio API for engine hum, transmission shifts, gunfire, and siren cues without external asset bloat.
- **Telemetry Dashboard & Run Summaries:** End-of-run summaries writing directly to Dexie.js, accompanied by a local leaderboard view.

---

## 1. System Overview & Technology Stack

Apex Chase is a top-down, vertically scrolling vehicular combat PWA engineered for high performance on mobile devices and modern desktop browsers without relying on heavy third-party game engines.

| Layer                     | Technology                           | Architecture Rationale                                                                        |
| ------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| **Runtime & Build**       | Vite + TypeScript                    | Strict typing, near-instant HMR, minimal production bundle footprint.                         |
| **Renderer**              | HTML5 Canvas 2D Context              | Hardware-accelerated 2D pipeline avoiding WebGL/3D scene graph overhead and battery drain.    |
| **Persistence**           | Dexie.js (IndexedDB)                 | Fully local-first storage for telemetry, settings, and run statistics with memory fallback.   |
| **Application Packaging** | Service Worker + Web Manifest        | Offline installation, standalone mobile viewport execution, and cache management.             |
| **Design Tokens**         | Color Palette System (CSS Variables) | Contrast-driven semantic triad mapping for clear threat, player, and utility differentiation. |

---

## 2. Directory Layout & Module Boundaries

The project enforces strict separation between application lifecycle, game loop state, rendering routines, and offline persistence.

```text
src/
├── db/
│   ├── index.ts              # Dexie.js instance, table definitions, and fallback storage
│   └── telemetry.ts          # Run logging, metrics calculation, and record retrieval
├── game/
│   ├── entities/
│   │   ├── player.ts         # Player car state, transmission, and bounds clamping
│   │   ├── vehicle.ts        # Base class for moving highway entities
│   │   ├── traffic.ts        # Civilian vehicle pathing and logic (Planned)
│   │   ├── enemies.ts        # Enforcer and Razorback behavior routines (Planned)
│   │   └── hauler.ts         # Armory Hauler docking logic (Planned)
│   ├── systems/
│   │   ├── collision.ts      # Spatial hash and bounding-box intersection checks
│   │   ├── combat.ts         # Projectile pools, firing rates, and hit registration (Planned)
│   │   ├── audio.ts          # Web Audio procedural sound synthesis (Planned)
│   │   └── input.ts          # Normalization for desktop keyboard and mobile touch deck
│   ├── engine.ts             # Primary RAF tick, state machine, and fixed-timestep updates
│   ├── road.ts               # Spline tracking, curve segmentation, and normal extrusion
│   └── renderer.ts           # Canvas drawing passes (background, road, shadows, entities, HUD)
├── theme/
│   └── tokens.ts             # CSS token reader mapping palette variables to Canvas fills
├── main.ts                   # Bootstrapping, DOM canvas mount, PWA event registration
└── index.html                # PWA metadata, container scaffolding, and initial loading UI

```

---

## 3. Core Subsystems

### A. Persistence & Local-First Telemetry (`src/db/`)

- **Database Identity:** `ApexChaseDB` running on Dexie.js.
- **Resilience Layer:** If IndexedDB is blocked by iframe sandboxes (`SecurityError`) or private browsing restrictions, an internal storage adapter activates an in-memory fallback to avoid application halts.
- **Schema Design:**
- `runs`: Keyed on `++id, timestamp, score, distance`. Records metrics including civilian collisions, neutralized hostiles, dockings, and highest gear achieved.
- `settings`: Keyed on `key`. Stores user options such as input sensitivity, sound volume, and active color theme overrides.

### B. Rendering & Theming Engine (`src/game/renderer.ts`, `src/theme/tokens.ts`)

- **Canvas Calibration:** Operates on a virtual coordinate space scaled against `window.devicePixelRatio`.
- **Token Extraction:** Evaluates computed CSS custom properties from the DOM root once at start (and on theme change events) to supply hex/rgba values directly to the Canvas 2D context.
- **Semantic Palette Allocation:**
- `surface-base`: Off-road terrain and UI backgrounds.
- `surface-road`: Asphalt fill, shoulders, and lane dividers.
- `accent-primary`: Player Interceptor chassis.
- `accent-warning`: Armory Hauler (utility and power-up target).
- `accent-danger`: Hostile combatants and projectile hazards.
- `neutral-secondary`: Neutral highway traffic.
- `ui-overlay`: HUD text, gear badges, and warning indicators.

### C. Road Geometry & Normal Ribbon Extrusion (`src/game/road.ts`)

- **Spine Definition:** The road center is generated as a continuous parametric function over travel distance, organizing sections into long straightaways and sweeping left/right curves.
- **Extrusion Pipeline:**

1. For discrete vertical scan steps down the viewport, sample center coordinate $C(t) = (x(t), y(t))$.
2. Compute tangent vector $T(t)$ and derive perpendicular unit normal $N(t)$.
3. Extrapolate left curb $C(t) - N(t) \cdot (W / 2)$ and right curb $C(t) + N(t) \cdot (W / 2)$.
4. Construct a closed polygon tracing upward along left curb vertices, bridging across the top, and returning down right curb vertices.

- **Boundary Evaluation:** Cross-checks player lateral position against the extruded road width at the player's specific $y$ coordinate to calculate off-road drag and steering resistance.

### D. Transmission, Physics & Input Deck (`src/game/entities/player.ts`, `src/game/systems/input.ts`)

- **Transmission States:**
- `LOW` Gear: Rapid acceleration, low top speed, tight lateral tracking.
- `HIGH` Gear: Gradual torque ramp, high velocity ceiling, expanded turn inertia.

- **Input Unification:** Unified event broker translating inputs into an internal vector:
- Lateral steering: $x \in [-1.0, 1.0]$.
- Longitudinal throttle/brake: $y \in [-1.0, 1.0]$.
- Discrete actions: Gear Shift toggle, Primary Fire, Sub-Weapon Fire.

- **Control Modes:** Simultaneous desktop key listener (preventing browser scroll defaults on Arrow/Space keys) and transparent mobile touch control zones.

---

## 4. Planned Subsystems & Execution Roadmap

### Combat & Docking Subsystem

- **Weapon Pooling:** Fixed memory allocations (pre-instantiated arrays) for bullets and surface hazards to prevent garbage collection frame drops during combat.
- **Docking Sequence:** The Armory Hauler matches player speed when summoned; aligning the player vehicle with the rear entry ramp locks lateral controls, plays a boarding animation, and refills special munitions.

### Traffic & Hostile AI Pipeline

- **Civilian Logic:** Predictable forward velocities; switching lanes only under defined obstacle criteria. Destroying a civilian penalizes the player by temporarily freezing score progression.
- **Hostile Behaviors:**
- _Enforcer:_ Attempts lateral proximity matches followed by aggressive sideway ramming to push the player into the shoulder.
- _Razorback:_ Closes distance alongside the player to deploy tire-slashing wheel spikes.

### Audio Pipeline

- **Procedural Synthesis:** Web Audio API nodes (`OscillatorNode`, `BiquadFilterNode`, and noise buffers) generating dynamic engine frequencies tied to speed, crunchy gunfire impacts, and retro warning chimes without external asset requests.
