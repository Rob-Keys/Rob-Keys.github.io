# 3D Interactive Desk Portfolio

An interactive 3D portfolio built with Three.js. A desk environment where each object reveals professional background, skills, and projects. The renderer prefers WebGPU and falls back to Three.js' WebGL2 backend when WebGPU is unavailable.

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
| Tab | Move through semantic portfolio controls |
| Enter / Space | Open the focused portfolio topic |
| Escape | Close details and restore focus |

The semantic portfolio content is available below the 3D scene and remains
fully usable when WebGL/WebGPU is unavailable. Use the dismissible interaction
guide for a concise keyboard, pointer, touch, and fallback explanation.

## Interactive Objects

| Object | Content |
|--------|---------|
| Monitor | About me |
| Laptop | Work experience |
| Picture frame | Education |
| Notebook | Personal projects |
| Tidbyt | Daily dashboard |
| Books | Knowledge base |
| Plant | Work-life balance |
| Vinyl | Music and creativity |
| Keyboard | Skills |
| Mouse | Navigation and tools |
| Clock | Time management |
| Coffee | What drives me |
| Desk lamp | Contact and documents |

## Customization

The semantic HTML in `index.html` is the accessible source of truth. The
monitor-specific canvas copy lives in `js/config/content.js`; scene settings
(camera, lighting, animations) are in `js/config/config.js`.

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

## Deployment

`prod` is a separate branch with an unrelated commit history — it holds only the files the site serves at runtime (`index.html`, `favicon.ico`, `lost.html`, `css/`, `js/`, `assets/`), no source tooling, docs, or config. Cloudflare Pages watches `prod` and rebuilds on every push to it.

There's no pull-request step. To publish:

1. Merge your changes into `main` (or whatever ref you want to ship).
2. Go to the **Actions** tab → **Deploy to prod** → **Run workflow**.
3. Optionally override the `ref` input (defaults to `main`).

The workflow (`.github/workflows/deploy-prod.yml`) checks out that ref, copies just the runtime files into a `prod` worktree, and commits/pushes straight to `prod` if anything changed.

## Dependencies

Browser modules are loaded through the import map in `index.html`; the matching
packages in `package.json` are development-time dependencies for type checking:

- Three.js 0.185.1 with `WebGPURenderer`, TSL, and WebGPU-compatible addons
- GSAP 3.15.0
- `npm run check` for type checking and linting

## Accessibility verification

Run `npm run check`, then verify keyboard navigation with Tab, Shift+Tab,
Enter, Space, and Escape. Check the page at 200% and 400% zoom, enable
`prefers-reduced-motion`, test a narrow viewport, and force WebGL/WebGPU to
fail to confirm the semantic portfolio remains available. Use a screen reader
to confirm the landmarks, topic names, detail heading, live status, and focus
restoration.

The site remains build-free for deployment. WebGPU post-processing uses TSL MRT bloom plus a procedural grain/vignette composite; the semantic fallback in `index.html` is revealed if both GPU backends fail.

## License

MIT — see [LICENSE](LICENSE).
