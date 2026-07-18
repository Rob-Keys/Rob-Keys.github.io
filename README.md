# 3D Interactive Desk Portfolio

An interactive 3D portfolio built with Three.js. A desk environment where each object reveals professional background, skills, and projects.

## Quick Start

No build step. Requires a local HTTP server (ES6 modules won't load from `file://`).

```bash
npx http-server /path/to/3D-personal-site -p 8000 --cors
```

Open `http://localhost:8000`.

> Use `npx http-server` with an absolute path — `python3 -m http.server` fails in some environments where the shell's working directory is unavailable.

## Controls

| Input | Action |
|-------|--------|
| Left click | Select and zoom into object |
| Right click + drag | Rotate camera |
| Scroll wheel | Zoom in/out |
| X / ESC | Close panel and zoom out |

## Interactive Objects

| Object | Content |
|--------|---------|
| Monitor | Overview |
| Laptop | Featured projects |
| Picture frame | Diploma |
| Notebook | Current projects |

## Customization

All portfolio content lives in `js/config/content.js`. Scene settings (camera, lighting, animations) are in `js/config/config.js`.

## Project Structure

```
3D-personal-site/
├── index.html
├── css/styles.css
├── js/
│   ├── core/           # main.js, scene.js, interactions.js
│   ├── config/         # config.js, content.js
│   ├── systems/        # lighting.js, utils.js
│   └── factories/      # objects.js, furniture.js, technology.js,
│                       # desk-objects.js, wall-objects.js,
│                       # shelf-objects.js, monitor-renderer.js
└── assets/
    ├── images/
    └── textures/
```

## Dependencies

All loaded via CDN in `index.html` — no package.json:

- Three.js r128
- GSAP 3.12.2
- Three.js addons: OrbitControls, RGBELoader, RectAreaLightUniformsLib, EffectComposer, UnrealBloomPass, OutlinePass

## License

MIT — see [LICENSE](LICENSE).
