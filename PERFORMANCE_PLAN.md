# Performance Optimization Plan

Aggressive performance work for the 3D desk portfolio. Goal: hold 60 fps on mid-range hardware and reach a stable 30+ fps on mobile, without giving up the realism work from the last three phases. Every step lists the file it touches and how to verify it.

## Where the frame time goes today

Measured from the code, the per-frame pipeline in `js/core/scene.js` `render()` is:

1. **Bloom composer** — RenderPass of the emissive layer + UnrealBloomPass at half resolution.
2. **Main composer** — full-scene RenderPass, then **SSAOPass** (which internally re-renders the whole scene twice more for its normal and depth targets in r128), then the combine pass, OutlinePass (disabled), FXAA, and the grain/vignette pass.

That is roughly four full-scene geometry submissions plus five full-screen shader passes, every frame, even when nothing on screen has changed. On top of that:

- **~17 lights** in `js/systems/lighting.js` (`setupLights()` plus per-object emissive lights). Three.js r128 is a forward renderer: every fragment of every mesh evaluates every light. This is almost certainly the largest single GPU cost after SSAO.
- **Three PCFSoft shadow maps at 2048px** (window directional, ceiling main, desk lamp). Map generation is frozen after first render (`freezeShadowMap()` — good), but sampling three soft-filtered 2048 maps per fragment still costs on every frame.
- **No idle detection.** The scene is static except dust drift, film grain, coffee steam, glare uniform copies, and a once-per-minute clock redraw, yet the full pipeline runs at display refresh forever.
- **`vendor-core.js` is 1.0 MB** on the critical path. Assets total 1.9 MB (fine), env.hdr is 97 KB (fine).

Already done, no action needed: shadow map freezing, half-resolution bloom/SSAO targets, pixel ratio caps (1.5 desktop / 1.0 mobile), emissive-layer-only bloom, keycap instancing, canvas-texture throttling on the clock, lazy postfx bundle, `matrixAutoUpdate = false` on statics.

---

## Phase 0 — Baseline measurement

No optimization without numbers. Do this first and re-run after every phase.

- Add a dev-only frame profiler behind a query flag (`?perf=1`): rolling-average frame time, `renderer.info.render.calls`, `renderer.info.render.triangles`, and `renderer.info.programs.length`, drawn to a corner canvas (no HTML overlay per project rules, but a debug flag view is exempt from the portfolio-content rule — if that feels wrong, log to console at 1 Hz instead).
- Record baselines in this file: desktop (native, Chrome), desktop with 6x CPU throttle, and an iPhone/Android via remote debugging.
- Capture one Chrome performance trace and note the GPU time split between the SSAO pass and everything else.

**Files:** `js/core/main.js` (flag parsing, stats loop), `js/systems/utils.js` (profiler helper).
**Done when:** baseline numbers are written into the table at the bottom of this file.

## Phase 1 — Stop rendering when nothing changes ✅ Done

Biggest win, zero visual cost. The scene is idle most of the time.

1. **Dirty-flag render loop.** In `js/core/main.js`, track a `needsRender` flag. Set it from: OrbitControls `change` event, GSAP zoom animations (`js/core/interactions.js`), outline hover state changes, clock redraws, and the 1 Hz day/night update. Damping means controls settle a few frames after input stops — keep rendering while `controls.update()` returns true or for ~500 ms after the last change event.
2. **Idle frame rate floor.** Grain, dust, and steam are ambient effects; render them at a reduced cadence when idle (e.g. 30 fps via elapsed-time gate in `animate()`) and full rate during interaction. Test whether grain at 30 fps is visibly steppy; if so, drop idle cadence to whatever looks continuous.
3. **Skip the bloom composer when static.** The emissive layer only changes when a screen texture updates (clock once a minute, monitor content on zoom). Cache the bloom render target and re-run the bloom composer only when a `bloomDirty` flag is set. Camera movement also requires a re-render since bloom is view-dependent — fold that into the same flag as step 1.
4. **Pause entirely when hidden.** Stop the loop on `document.visibilitychange` and resume on return.

**Files:** `js/core/main.js`, `js/core/scene.js`, `js/core/interactions.js`.
**Done when:** GPU usage near zero when idle; no visible hitch when interaction resumes.

## Phase 2 — Kill or replace SSAO ✅ Done

SSAOPass is the most expensive pass in the chain (two extra full-scene renders plus a large-kernel blur) for a subtle low-frequency effect.

1. Measure its cost in isolation (toggle it off, compare frame time from Phase 0 tooling).
2. Replace it with **baked ambient occlusion**: the scene is static, so darkening at contact points can live in the materials. Options, in order of preference:
   - Cheap radial gradient "contact shadow" textures under objects (the config already has `enableContactShadows` — extend that approach to cover what SSAO was adding).
   - Vertex-baked AO on the large surfaces (desk top near object bases, wall behind shelf) computed once at build time.
3. Delete the SSAOPass and its resize handling. If a static bake genuinely can't match it, keep SSAO but render it once into a cached target (the AO term barely changes with camera for this framing) — measure both before choosing.

**Status:** Contact-shadow bakes (`addContactShadow()`) were already in place under the desk objects, laptop, mug, and shelf items, so option 1 covers the SSAO removal directly — SSAOPass and its resize handling were deleted from `scene.js`, dropping two full-scene re-renders per frame with no visible change at the default camera.

**Files:** `js/core/scene.js`, `js/factories/*.js` for bakes, `js/config/config.js`.
**Done when:** frame time drops measurably with no visible loss at the default camera; screenshot A/B kept for the record.

## Phase 3 — Light consolidation ✅ Done

Seventeen lights is aggressive for a forward renderer. Many are dim single-purpose fills that can merge.

1. **Merge the bounce constellation.** `lampShadeGlow`, `deskBounce`, `roomBounce`, `ceilingBounce`, `roomFill`, `backWallWash`, `laptopBounce` are seven point lights approximating global illumination. Target: replace at least four of them with (a) a slightly retuned ambient/hemisphere pair and (b) baked emissive/lightmap tints on the surfaces they were washing (back wall, ceiling, desk underside shadows). Keep the ones that create visible color contrast: monitor bounce (cool) and desk lamp (warm) are the realism anchors.
2. **Audit per-object emissive lights** registered through `addEmissiveLight()` — count them, and cap or merge (e.g. one light per screen, none for LEDs; LEDs read fine as pure emissive material with bloom).
3. **Shadow map budget.** Drop the desk lamp map 2048 → 1024 (tight cone, small coverage — resolution is wasted) and test the ceiling spot at 1024. Keep the fitted directional at 2048 since `fitMainShadowToScene()` already uses its texels well.
4. Retune `toneMappingExposure` and the day/night keyframe scaling in `updateDayNightCycle()` after removals so overall brightness matches the current look. Update the hardcoded intensities there (`28.0`, `18.0`) to read from config so retuning stays in one place.

**Files:** `js/systems/lighting.js`, `js/config/config.js`, factories that call `addEmissiveLight`.
**Done when:** light count ≤ 10, screenshot A/B against current build is acceptable, measurable fragment-cost drop on mobile.

**Status:** `setupLights()` is down to 10 lights (from 15): removed `backWallWash`, `roomFill`, `roomBounce`, `ceilingBounce`, and a stale static `laptopBounce` that duplicated the correctly-positioned emissive light `technology.js` already registers via `addEmissiveLight()` for the laptop screen. Their contribution was folded into the day/night ambient/hemisphere floors, a small `wallFill` bump, and a baked emissive tint on the back wall material (`furniture.js` `createWall()`). Ceiling and desk-lamp shadow maps dropped to 1024 (`SHADOW_CONFIG.ceiling`/`.lamp`); ceiling intensities and night boosts now live in `LIGHTING_CONFIG.ceiling` instead of inline literals.

## Phase 4 — Pass merging and pipeline trims ✅ Done

1. **Merge combine + FXAA + grain/vignette into fewer passes.** Each ShaderPass is a full-screen render target swap. The combine shader can take the bloom texture, apply vignette, and add grain in one pass; FXAA must run on the composited image before grain, so the practical merge is combine+FXAA staying separate but grain/vignette folding into the combine pass with FXAA last — or move to a single composite shader that does combine → FXAA → grade in one program. Target: 5 full-screen passes → 3.
2. **OutlinePass replacement.** It is disabled by default but when hover-enabled it does internal depth/mask scene re-renders and still dims the scene (known TODO in CLAUDE.md). Replace it with a cheap custom rim/edge pass on the hovered object only, or a scaled-mesh backface outline (draw the hovered group again, slightly inflated, in flat red, no extra scene renders). This deletes the dimming bug and the cost together.
3. **Verify no accidental transparent overdraw** — glare materials are additive-transparent planes over every screen; confirm they are small and few (they are per-screen, so likely fine — just check `renderer.info` draw calls before/after).

**Files:** `js/core/scene.js`, `js/core/interactions.js`, `js/vendor/vendor-postfx.js` (OutlinePass can be dropped from the bundle when replaced).
**Done when:** pass count reduced, outline works without dimming, TODO removed from CLAUDE.md.

**Status:** Full-screen shader passes cut from 4 to 2 (`combine` and `grain`/`vignette` merged into one `gradePass`, run after `fxaaPass` reordered ahead of it instead of after — RenderPass isn't counted as it submits geometry, not a full-screen quad). `OutlinePass` removed entirely from `scene.js`: the hint-glow highlight is now a real inflated-backface mesh per interactive object (`InteractionManager.initHintOutline()` in `interactions.js`), drawn in the normal scene pass with no extra scene re-renders and no dimming. `vendor-postfx.js` itself is untouched (still parses `OutlinePass`/`SSAOPass`, just unused) — trimming the vendor bundle is Phase 5 territory. Glare overdraw checked: additive-transparent planes are one per screen (monitor, laptop), consistent with the existing convention, no change needed.

## Phase 5 — Load time

1. **Trim `vendor-core.js` (1.0 MB).** It is the full Three.js build plus addons. Options: switch to the official minified r128 build if not already, and strip addons that moved to `vendor-postfx.js` or are unused. Measure parse time before deciding how far to go — Cloudflare serves brotli, so wire size is likely ~250 KB already; the parse cost is the real target.
2. **Preload hints.** `<link rel="preload">` for `env.hdr`, floor textures, and `vendor-core.js` in `index.html` so the loading screen ends sooner.
3. **Defer below-the-fold textures.** Vinyl covers (450 KB combined, `kanye.webp` + `mt_joy.webp` are the heavy ones) and the diploma are wall objects behind the initial camera; load them after first render instead of gating the loading screen on them — move their loads off the shared `loadingManager` onto a post-reveal loader. Re-compress `mt_joy.webp` (231 KB) and `kanye.webp` (160 KB) toward the ~60 KB the others hit.
4. **Shader warm-up.** The first render already compiles shaders behind the loading screen; after Phase 3's light changes, confirm `renderer.compile()` or the existing forced render still covers every material so there is no first-interaction hitch.

**Files:** `index.html`, `js/core/scene.js`, `js/factories/wall-objects.js`, asset re-exports.
**Done when:** loading-screen-to-interactive time measured before/after; target 30%+ reduction on throttled 4G.

## Phase 6 — Adaptive quality

Safety net so weak devices degrade gracefully instead of chugging.

1. **Startup tier detection:** use the Phase 0 profiler for the first ~60 frames after reveal; if average frame time exceeds ~20 ms, step down a quality tier.
2. **Tiers** (all values into `PORTFOLIO_CONFIG.rendering`): High = current. Medium = no dust, grain amplitude 0, desk-lamp shadow off, pixel ratio cap 1.25. Low = additionally drop bloom to quarter resolution, pixel ratio 1.0, single shadow map (directional only).
3. **Dynamic resolution during interaction:** optionally drop `postProcessResolutionScale` and pixel ratio one notch while the camera is moving and restore on settle — measure whether Phase 1 + tiering already makes this unnecessary before building it.

**Files:** `js/config/config.js` (tier tables — keep frozen-object convention), `js/core/scene.js`, `js/core/main.js`.
**Done when:** a 6x-CPU-throttled Chrome session settles into a lower tier automatically and stays interactive.

---

## Order and expected payoff

| Phase | Effort | Expected win |
|---|---|---|
| 0 Baseline | Small | Enables everything else |
| 1 Render-on-demand | Small | Idle GPU ~0; battery and fan win, largest real-world impact |
| 2 SSAO removal | Medium | Likely 30–50% of active GPU frame time |
| 3 Light consolidation | Medium | Large fragment-cost cut, biggest mobile win |
| 4 Pass merging + outline | Medium | Moderate; also fixes the dimming bug |
| 5 Load time | Small | Faster first paint, smaller transfer |
| 6 Adaptive tiers | Medium | Resilience on weak devices |

Phases 1–3 are the aggressive core; stop and re-measure after each. Run `npm run check` and `/verify` (screenshot comparison at the default camera, plus one zoomed monitor view) after every phase. Keep before/after screenshots in the scratchpad, not the repo.

## Baseline numbers (fill in during Phase 0)

| Metric | Desktop | Desktop 6x throttle | Mobile |
|---|---|---|---|
| Avg frame time (idle) | | | |
| Avg frame time (orbiting) | | | |
| Draw calls | | | |
| Triangles | | | |
| Load → interactive | | | |
