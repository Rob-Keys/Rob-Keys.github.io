# 3D Interactive Desk Portfolio

An interactive 3D portfolio built with Three.js. Selectable desk objects connect to professional background, skills, and projects, while a semantic HTML portfolio keeps every topic available to keyboard and screen-reader users. The renderer prefers WebGPU and falls back to Three.js' WebGL2 backend when WebGPU is unavailable.

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
| Left click | Select and zoom into a selectable object |
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

## Portfolio Topics and Scene Props

These topics are all available in the semantic portfolio. The monitor, laptop,
diploma frame, notebook, and Tidbyt have selectable 3D props; the remaining
props are decorative in the current scene.

| Topic | Scene prop |
|-------|------------|
| About me | Monitor — selectable |
| Work experience | Laptop — selectable |
| Education | Diploma frame — selectable |
| Personal projects | Notebook — selectable |
| Daily dashboard | Tidbyt — selectable |
| Knowledge base | Books — decorative |
| Work-life balance | Plant — decorative |
| Music and creativity | Vinyl — decorative |
| Skills | Keyboard — decorative |
| Navigation and tools | Mouse — decorative |
| Time management | Clock — decorative |
| What drives me | Coffee — decorative |
| Contact and documents | Desk lamp — decorative |

## Customization

The semantic HTML in `index.html` is the accessible source of truth. The
monitor-specific canvas copy lives in `js/config/content.js`; scene settings
(camera, lighting, animations) are in `js/config/config.js`.

## Project Structure

- `index.html`, `lost.html` — semantic portfolio and renderer-failure page
- `js/boot.js` — browser entry point; `js/core/` owns scene startup,
  accessibility, interaction, and rendering
- `js/config/` — scene settings and canvas-rendered monitor copy
- `js/factories/` — furniture, technology, and scene props
- `js/systems/` — lighting and shared rendering utilities
- `css/styles.css`, `assets/`, `types/` — styling, visual assets, and local
  TypeScript declarations
- `vite.config.mjs`, `package.json`, `.github/workflows/` — build and deploy
  configuration

## Deployment

`prod` is a separate branch with an unrelated commit history. It holds only
the Vite production output at the repository root plus `wrangler.jsonc`;
Cloudflare Workers Builds reads that branch and serves the root configured in
`wrangler.jsonc`.

Merges to `main` publish automatically. To publish another ref manually:

1. Go to the **Actions** tab → **Deploy to prod** → **Run workflow**.
2. Set the optional `ref` input to the branch or commit to publish (defaults to `main`).

The workflow (`.github/workflows/deploy-prod.yml`) checks out the selected
source ref, runs `npm ci` and `npm run build`, copies `dist/` to the root of a
`prod` worktree, and commits/pushes it if anything changed. Automatic runs
skip publication when their source commit is no longer the current `main` tip;
manual runs can intentionally publish historical refs.

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

## Project guidance

This README is the starting point for setup, user controls, deployment, and
accessibility. [CLAUDE.md](CLAUDE.md) contains contributor conventions and
architecture notes. The [Claude visual-verification workflow](.claude/skills/verify/SKILL.md)
contains browser-check procedures.

## License

MIT — see [LICENSE](LICENSE).
