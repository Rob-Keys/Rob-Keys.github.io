# Hyper-Realism Plan

Goal: make the 3D desk scene read as a photograph of a real desk while holding 60 fps on a mid-range laptop and 30+ fps on landscape mobile. Each phase stands alone; agents can execute phases in order, and tasks within a phase in any order unless a dependency is noted.

## Ground rules for every task

- Read `CLAUDE.md` first. All info stays on 3D object textures/materials — no HTML overlays.
- No build step. Everything ships as static files; Three.js is r128 via the vendor bundles in `js/vendor/`. Do not upgrade Three.js unless executing Phase 6, which handles it explicitly.
- After any visual change: run the `/verify` skill (start the preview server, reload, wait ~2s, screenshot) and compare against the previous state. After any code change: `npm run check`.
- Perf budget per change: no more than +2 ms frame time at 1.5x pixel ratio desktop, no more than +8 MB texture memory. Measure with the browser tools (`javascript_tool` reading `renderer.info`) before and after.
- Reuse geometries and materials. New repeated objects use `THREE.InstancedMesh`. Static objects get `matrixAutoUpdate = false` after positioning.
- Keep the existing factory pattern (`origins` table, `userData` name/label, `interactiveObjects` push).

## Phase 1 — Edge fidelity (the biggest single realism win)

Nothing in the real world has a mathematically sharp edge. Every primitive box in the scene catches no highlight on its corners, which reads as CG instantly.

1.1 Add a shared `createBeveledBox(width, height, depth, bevelRadius, segments)` helper to `js/systems/utils.js` built on `ExtrudeGeometry` with a rounded-rect shape, or a rounded-box BufferGeometry generator. Cache by dimension key so identical boxes share one geometry. Bevel radius guidance: 1–2 mm scene scale for metal/plastic edges (desk is ~4 units wide, so ~0.005 units).

1.2 Replace `BoxGeometry` with the beveled helper on the most visible objects, in this order: desk top and legs (`furniture.js`), monitor body and stand (`technology.js`), keyboard case and keycaps (`technology.js`), laptop body (`technology.js`), shelf (`furniture.js`), books (`shelf-objects.js`), notebook (`desk-objects.js`), diploma and vinyl frames (`wall-objects.js`).

1.3 Keycaps specifically: real keycaps have a top smaller than the base (draft angle) and a slight top dish. Approximate with a tapered extrude or a scaled-top beveled box. Keep them instanced — one geometry, one `InstancedMesh` per row height.

Acceptance: screenshot at the default camera angle shows a thin highlight line along desk, monitor, and keyboard edges. Triangle count from `renderer.info.render.triangles` stays under 2x the pre-change count.

## Phase 2 — Material realism

Uniform roughness is the second-loudest CG tell. Real surfaces have smudges, wear, and micro-variation.

2.1 Add a procedural roughness-variation generator to `js/systems/utils.js`: a small canvas (256px) filled with low-frequency noise, returned as a texture. Use it as `roughnessMap` on the plastics and metals in `MATERIALS` (`config.js` presets get an optional `roughnessVariation` flag; factories apply the shared texture). One shared texture for the whole scene — vary `roughness` base value per material, not the map.

2.2 Screens: add a subtle fingerprint/smudge layer. Generate a canvas texture with a few faint radial smears, apply as `roughnessMap` on the monitor and laptop screen glass (`MATERIALS.screenGlass`, used in `technology.js`). When the screen is dark the smudges catch the env map; that is the realistic behavior we want.

2.3 Convert the most prominent plastics (monitor bezel, keyboard case, mouse) from `MeshStandardMaterial` to `MeshPhysicalMaterial` with low clearcoat (0.1–0.25, clearcoatRoughness 0.5+). Budget note: physical material costs more per pixel — apply only to these three objects and re-measure frame time.

2.4 Fabric/paper: notebook pages and book covers get a slight `normalScale`-driven paper grain (tiny canvas normal texture, shared). Terracotta pot gets roughness variation from 2.1.

2.5 Metal wear: desk lamp and monitor stand get slightly lower roughness on edges. Cheapest approach: rely on the beveled edges from Phase 1 catching the env map; only add an edge-wear texture if a screenshot comparison shows it is still flat.

Acceptance: screenshots zoomed on monitor and keyboard show non-uniform specular response. `npm run check` passes (canvas contexts guarded with `if (!ctx) throw`).

## Phase 3 — Lighting and shadow depth

3.1 Contact shadows / baked AO. SSAO at half resolution misses fine contact darkening. Add per-object contact patches: a shared radial-gradient canvas texture on a small plane under each desk object (keyboard, mouse, laptop, lamp, coffee mug, clock, notebook, plant pot), `MeshBasicMaterial` with `transparent: true`, multiply-style dark color, `depthWrite: false`, `renderOrder` set to draw before the object. This is the standard cheap grounding trick and costs near nothing.

3.2 Raise SSAO quality only if 3.1 leaves gaps: try full-resolution SSAO behind a config flag in `PORTFOLIO_CONFIG.rendering` and measure. Keep half-res as the default if frame cost exceeds budget.

3.3 Light bleed from screens: the monitor already has bounce fill (`rim` light). Verify the laptop screen also casts a faint cool `PointLight` (distance ~2, decay 2, intensity ~0.05) when its screen content lands (existing TODO). Register it through `addEmissiveLight`.

3.4 Lamp pool: confirm the desk lamp spot produces a visible warm pool with soft penumbra on the desk texture. Tune `penumbra` toward 0.6+ and shadow `radius` (already 4) so the pool edge is soft. Screenshot before/after.

3.5 Dust in light: a very sparse `THREE.Points` cloud (200–400 points, additive, near-zero opacity, slow drift in `updateAnimations`) inside the lamp and window light cones. Behind a config flag; disable on mobile (`window.innerWidth < 768` at init). This sells atmosphere cheaply but must stay subtle — if a screenshot makes it noticeable at a glance, halve the opacity.

Acceptance: objects no longer look like they float; screenshot at grazing angle shows contact darkening under keyboard and mug.

## Phase 4 — Image quality (anti-aliasing and final grade)

The composer path currently has no AA at all. Aliased edges undermine everything above.

4.1 Add an FXAA pass as the last pass of the final composer in `scene.js` (`setupPostProcessing`). The FXAA shader for r128 ships with the examples; add it to `vendor-postfx.js` the same way the other passes were bundled. Set its resolution uniform in `onWindowResize` too. FXAA at 1.5x pixel ratio is nearly free and removes the crawling edges.

4.2 Subtle film grain + vignette: a tiny ShaderPass after FXAA — animated noise at ~0.015 amplitude and a vignette darkening ~0.15 at corners. Real photos have both; this masks banding in the dark background. Keep amplitudes in `PORTFOLIO_CONFIG.rendering` so they are tunable.

4.3 Verify tone mapping headroom: after all lighting changes, sweep `toneMappingExposure` ±0.1 in the browser console and pick the value where the wall texture shows detail but the monitor glow still blooms. Update the constant and its comment in `scene.js`.

Acceptance: screenshot edges show no visible stair-stepping at 100% zoom; frame time increase from 4.1+4.2 combined under 1 ms.

## Phase 5 — Object-level upgrades (existing TODOs, realism-ordered)

Each is an independent task in its named factory file.

5.1 Mouse (`technology.js`): replace the current shape with a lathe/extrude-based ergonomic shell — wider at the palm, tapered front, split by a seam line, scroll wheel recessed. Beveled edges per Phase 1, clearcoat per Phase 2.3.

5.2 Books (`shelf-objects.js`): larger, spines facing the camera, canvas-texture spine titles (real book typography: small, varied fonts and colors), slight random lean and depth offsets — uniformity is the tell. Instance the page-block geometry.

5.3 Diploma (`wall-objects.js`): match real UVA diploma proportions and layout on the canvas texture; add glass front (thin `MeshPhysicalMaterial` plane, transmission if r128 quality suffices, otherwise low-opacity clearcoat plane) so it catches window light.

5.4 Laptop screen (`monitor-renderer.js` or `technology.js`): render real content (terminal or editor mock) to a canvas texture; add the emissive bounce light from 3.3.

5.5 Tidbyt on shelf (`shelf-objects.js`): small beveled box, wood-tone front, emissive LED-matrix canvas texture (coarse pixel grid) on bloom layer 1.

5.6 Coffee: liquid surface gets a dark `MeshPhysicalMaterial` disc with high clearcoat; verify the steam animation still reads.

Acceptance per task: `/verify` screenshot of the object close-up (use the existing zoom interaction) looks plausible at zoom distance.

## Phase 6 — Optional: Three.js upgrade (only if a maintainer approves)

r128 (mid-2021) predates the improved transmission, color management, and better AO options. Upgrading to a current release would unlock quality but touches every file (`outputEncoding` → `outputColorSpace`, examples restructure, vendor bundles rebuilt). Treat as its own project: branch, regenerate `js/vendor/*` bundles, fix API breaks flagged by `npm run check`, re-verify every screenshot. Do not fold this into any other phase.

## Verification matrix (run after each phase)

| Check | How |
|---|---|
| Visual | `/verify` skill: default view + zoomed monitor + zoomed keyboard screenshots |
| Types/lint | `npm run check` |
| Frame cost | `javascript_tool`: sample `performance.now()` deltas across ~120 frames, report average |
| GPU load | `renderer.info.render.triangles`, `.calls`, `renderer.info.memory` |
| Mobile | `resize_window` preset mobile (landscape), screenshot, confirm no regression |
| Console | `read_console_messages` — zero new errors or warnings |
