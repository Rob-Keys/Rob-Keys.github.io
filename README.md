# 3D Interactive Desk Portfolio

An interactive 3D portfolio built with Three.js. A desk environment where each object reveals professional background, skills, and projects. The renderer prefers WebGPU and falls back to Three.js' WebGL2 backend when WebGPU is unavailable.

## Quick Start

Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

Create and preview the production bundle with:

```bash
npm run build
npm run preview
```

## Controls

| Input | Action |
|-------|--------|
| Left click | Select and zoom into object |
| Right click + drag | Rotate camera |
| Scroll wheel | Zoom in/out |
| Tab | Move through semantic portfolio controls |
| Enter / Space | Open the focused portfolio topic |
| Escape | Close details and restore focus |

The visual portfolio stays full-screen on normal load. Use the **Open accessible
view** control to switch to the semantic portfolio, which is fully usable with
keyboard navigation and screen readers. It is also shown directly when
WebGL/WebGPU is unavailable, and remains available without JavaScript.
The dismissible interaction guide explains the keyboard, pointer, touch, and
fallback paths.

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

`prod` is a separate branch with an unrelated commit history — it holds only
the Vite production output plus `wrangler.jsonc`. Cloudflare Pages watches
`prod` and rebuilds on every push to it.

There's no pull-request step. To publish:

1. Merge your changes into `main` (or whatever ref you want to ship).
2. Go to the **Actions** tab → **Deploy to prod** → **Run workflow**.
3. Optionally override the `ref` input (defaults to `main`).

The workflow (`.github/workflows/deploy-prod.yml`) checks out that ref, runs
`npm ci` and `npm run build`, copies `dist/` into a `prod` worktree, and
commits/pushes straight to `prod` if anything changed.

## Dependencies

The production site is bundled by Vite 8 using the matching packages in
`package.json`:

- Three.js 0.185.1 with `WebGPURenderer`, TSL, and WebGPU-compatible addons
- GSAP 3.15.0
- Vite 8 with its Rolldown production bundler
- `npm run check` for type checking and linting

## Accessibility verification

Run `npm run check`, then verify keyboard navigation with Tab, Shift+Tab,
Enter, Space, and Escape. Check the page at 200% and 400% zoom, enable
`prefers-reduced-motion`, test a narrow viewport, and force WebGL/WebGPU to
fail to confirm the semantic portfolio remains available. Use a screen reader
to confirm the landmarks, topic names, detail heading, live status, and focus
restoration.

WebGPU post-processing uses TSL MRT bloom plus a procedural grain/vignette
composite; the semantic fallback in `index.html` is revealed if both GPU
backends fail.

## License

MIT — see [LICENSE](LICENSE).
