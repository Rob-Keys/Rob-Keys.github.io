# Realism & Performance Plan — Round 2

Follow-up audit after PERFORMANCE_PLAN.md (Phases 1–7, all complete). That work cut the pipeline to two full-screen passes, removed SSAO/OutlinePass, added render-on-demand, and measured a desktop baseline of **258 draw calls / 50.8k triangles / ~1.8 ms per render()**. This plan lists what's still on the table, ordered by impact. Each item stands alone — implement in any order within a priority band, but do P0 first: several of them are bugs that silently defeat optimizations the previous plan already paid for.

**Workflow for every item:** run `npm run check`, verify visually with `/verify` (screenshot at default camera plus one zoomed view), and use the `?perf=1` profiler (draw calls, frame ms) for before/after numbers. Keep A/B screenshots in the scratchpad, not the repo.

---

## P0 — Bugs that undermine existing systems

### P0-1. Quality-tier pixel-ratio changes never reach the composers

**Problem:** `applyQualityTier()` ([scene.js:163](js/core/scene.js:163)) calls `renderer.setPixelRatio()`, but r128's `EffectComposer` caches the renderer's pixel ratio at construction time. Neither `this.composer` nor the FXAA resolution uniform is updated, so after a tier step-down the main composer keeps rendering its internal targets at the old (higher) resolution. The medium/low tiers' main perf lever — fewer pixels — is largely a no-op. `onWindowResize()` ([scene.js:515](js/core/scene.js:515)) has the same staleness if `getMaxPixelRatio()` changes across a resize.

**Fix:** in both places, after `renderer.setPixelRatio(ratio)`, call `composer.setPixelRatio(ratio)` and `composer.setSize(window.innerWidth, window.innerHeight)`, and recompute the FXAA `resolution` uniform (same math already in `onWindowResize`).

**Impact:** makes Phase 6 tiering actually work — the difference between a slow phone chugging and recovering. **Effort:** small. **Verify:** force `applyQualityTier('low')` from the console, confirm `composer.renderTarget1.width` shrinks and frame ms drops.

### P0-2. Mobile detection checks portrait width on a landscape-forced site

**Problem:** every mobile check is `window.innerWidth < 768` — `getMaxPixelRatio()` ([scene.js:147](js/core/scene.js:147)), dust creation ([scene.js:481](js/core/scene.js:481)), shadow map sizing ([lighting.js:135](js/systems/lighting.js:135)). But the site forces landscape on phones (`#rotate-overlay`), and a phone in landscape reports `innerWidth` of ~800–900. Result: real phones get the **desktop** pixel-ratio cap (1.5 instead of 1.0 — 2.25× the fragments through the whole postfx chain), dust particles enabled, and the desktop shadow config. The mobile branches almost never run on the devices they were written for.

**Fix:** one shared `isMobileDevice()` helper in `js/systems/utils.js` using capabilities, not viewport width: `matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0`, or `Math.min(innerWidth, innerHeight) < 768`. Use it at all three call sites. While there: `SHADOW_CONFIG.mobile.mapSize` is 2048 — identical to desktop ([config.js:26](js/config/config.js:26)) — so the mobile shadow branch does nothing; set it to 1024 or delete the branch.

**Impact:** the single biggest mobile-perf item in this plan. **Effort:** small. **Verify:** device-emulation landscape viewport → confirm pixel ratio 1.0 and no dust cloud.

### P0-3. Fitted sun-shadow frustum covers the whole 50-unit room — a resolution regression

**Problem:** `fitMainShadowToScene()` ([lighting.js:520](js/systems/lighting.js:520)) fits the 2048px directional shadow map to `Box3().setFromObject(scene)`, which includes the 50-unit-wide wall ([furniture.js:213](js/factories/furniture.js:213)) and the 50×50 floor ([scene.js:448](js/core/scene.js:448)). That spreads 2048 texels across 50+ units (~40 texels/unit). The hand-tuned frustum it replaced was 20 units wide (~102 texels/unit) — the "fit" made sun shadows ~2.5× blockier.

**Fix:** fit to a curated box instead of the whole scene: either union only the desk-area objects (skip meshes flagged `userData.excludeFromShadowFit` on the wall/floor/ceiling), or clamp the fitted extents to the previous hand-tuned bounds. The wall and floor only *receive* shadows near the desk anyway.

**Impact:** visibly crisper sun shadows on every desk object; zero runtime cost. **Effort:** small. **Verify:** A/B screenshot of keyboard/mug shadow edges.

### P0-4. The hover light can never turn on, but still forces full-rate bloom re-renders

**Problem:** `createHoverLight()` sets `visible = false` ([interactions.js:60](js/core/interactions.js:60)) and `updateHoverLight()` ([interactions.js:147](js/core/interactions.js:147)) never sets it back to `true` — the light has never illuminated anything. Yet every mousemove over an interactive object calls `requestRender(true)` ([interactions.js:168](js/core/interactions.js:168)), waking the full pipeline (bloom included) at display rate for zero visual change. `hideHoverLight()` does the same while "fading" an invisible light.

**Fix:** decide the feature's fate. Recommended: delete the hover light entirely (cursor change is the surviving affordance) and only `requestRender` when the cursor state actually flips. If the glow is wanted, set `visible = true`, make the intensity ramp time-based instead of per-event, and keep the render requests.

**Impact:** idle GPU stays idle while the user mouses around; removes a dead light and per-event churn. **Effort:** small.

### P0-5. `shadow.radius` does nothing under PCFSoftShadowMap

**Problem:** the renderer uses `PCFSoftShadowMap` ([scene.js:214](js/core/scene.js:214)), but in r128 the PCF-soft shader path uses a fixed kernel and ignores `shadow.radius`. All the tuned radii — main 2, lamp 4, ceiling 3 ([config.js:24](js/config/config.js:24), [lighting.js:211](js/systems/lighting.js:211)) — are dead values. The penumbra look that was "tuned" in Phase 3 never actually changed.

**Fix:** either (a) switch to `THREE.VSMShadowMap`, where radius drives a real blur pass in r128, and retune bias/radius (VSM also softens contact-hardening nicely, but watch for light bleeding), or (b) accept PCF-soft's fixed kernel and delete the radius fields so nobody tunes dead config again.

**Impact:** honest, tunable shadow softness — a realism control that currently doesn't exist. **Effort:** medium (retuning). **Verify:** A/B of lamp-cone shadow edges under both types.

---

## P1 — Large performance wins

### P1-1. The shelf plant is ~127 draw calls — half the scene's total

**Problem:** `createShelfPlant()` ([shelf-objects.js:164](js/factories/shelf-objects.js:164)) builds 11 tube vines, 56 leaves, and 56 node spheres as individual meshes. Worse, every leaf gets a **unique** `ExtrudeGeometry` (`createHeartLeaf(scale)` bakes scale into vertices) and a **unique** material (`createLeafMaterial()` per leaf). That's ~127 meshes/materials for one decoration — against a measured scene total of 258 draw calls.

**Fix:**
- One unit leaf geometry; one `InstancedMesh` of 56 instances with per-instance matrix (position/rotation/scale) and `instanceColor` for the HSL variation (supported in r128 via `setColorAt`). Two instanced meshes if the new-growth material really needs distinct roughness.
- Merge all 56 nodes into one geometry (`mergeBufferGeometries`, the codebase's established pattern).
- Merge the 11 tapered vine tubes into one geometry (same material already).

**Bonus realism fix:** leaf scale/rotation use `Math.random()`, so the plant reshuffles on every page load. Switch to the deterministic `jitter(seed)` the books already use ([shelf-objects.js:87](js/factories/shelf-objects.js:87)).

**Impact:** ~127 calls → ~6; scene total drops ~45%. Biggest draw-call win available. **Effort:** medium. **Verify:** `?perf=1` draw-call count; screenshot to confirm the plant still reads as a pothos.

### P1-2. Wall textures decode to 4096×4096 — ~256 MB of VRAM for a background wall

**Problem:** `plastered_wall_04_{diff,nor_gl,rough}` are all 4096² ([furniture.js:19](js/factories/furniture.js:19)). Decoded RGBA that's ~64 MB *each* before mipmaps (~85 MB with), ~256 MB total — plus a long decode/upload stall on weak devices. The wood set was already downsized to 1K (`_4k_1k` suffix); the wall never got the same treatment. At `repeat: 10×4` on a wall viewed from 3+ units, 1K is indistinguishable.

**Fix:** re-export all three at 1024² (e.g. `sips -Z 1024` or the pipeline used for the wood set), update `TEXTURE_CONFIG.wall.files`. While touching it, fix tile aspect: the wall face is 50×8 units with repeat 10×4 → each tile is stretched 2.5:1. Use ~25×4 (or 12×2 at 1K) for square texels; the shared roughness-variation approach and viewing distance hide the extra repetition.

**Impact:** ~240 MB VRAM freed, faster first render on mobile, correct texture aspect. **Effort:** small. **Verify:** screenshot A/B of the wall at default camera and zoomed.

### P1-3. One physical desk lamp is lit by five lights and two shadow-casting spotlights

**Problem:** `lighting.js` creates `deskLamp` (spot, 1024 shadow map, [lighting.js:229](js/systems/lighting.js:229)), `lampShadeGlow` ([244](js/systems/lighting.js:244)), and `deskBounce` ([251](js/systems/lighting.js:251)). Then `createDeskLamp()` in desk-objects.js adds its **own** shadow-casting spotlight ([desk-objects.js:518](js/factories/desk-objects.js:518)) plus a `warmFillLight` point ([534](js/factories/desk-objects.js:534)). Five lights and two 1024 shadow maps model one lamp; the scene carries **four** shadow maps total, not the three the previous plan assumed. Phase 6's tier system only toggles `lights.deskLamp` — the factory's duplicate spotlight keeps casting shadows even at low tier.

**Fix:** delete the factory spotlight + warmFillLight and retune the lighting.js trio (or vice versa — keep whichever aim looks better on the notebook). Re-check the tier toggle covers the survivor.

**Impact:** −2 lights, −1 shadow map, per-fragment lighting cost down scene-wide; fixes the tier leak. **Effort:** small-medium (retune). **Verify:** A/B of notebook/desk illumination; count `scene` lights in console.

### P1-4. Three RectAreaLights — the most expensive light type in the scene

**Problem:** monitor screen ([technology.js:209](js/factories/technology.js:209)), laptop screen ([technology.js:869](js/factories/technology.js:869)), diploma art light ([wall-objects.js:325](js/factories/wall-objects.js:325)). RectAreaLight LTC evaluation is by far the priciest per-fragment light in a forward renderer, and every `MeshStandardMaterial` fragment pays for all three.

**Fix, in order of safety:**
1. Diploma art light → narrow SpotLight. On a flat wall/frame the wash is nearly identical, at a fraction of the cost.
2. Laptop screen → delete the RectAreaLight; the screen already has emissive + bloom + a registered bounce PointLight ([technology.js:885](js/factories/technology.js:885)). The soft keyboard glow is what the bounce light provides.
3. Keep the monitor RectAreaLight — it's the hero screen-glow realism cue.

**Impact:** major fragment-cost cut, biggest on mobile. **Effort:** small per light. **Verify:** A/B screenshots (diploma wash, laptop keys), frame ms on a throttled session.

### P1-5. Monitor scroll rebuilds and re-uploads the entire screen every wheel tick

**Problem:** each wheel event → `createMonitorCanvas()` allocates a **new** 1024×512 canvas, redraws browser chrome + all seven content sections, uploads the full texture, and regenerates mipmaps ([interactions.js:390](js/core/interactions.js:390), [monitor-renderer.js:22](js/factories/monitor-renderer.js:22)).

**Fix:** render page content **once** into a tall offscreen canvas (1024×~2560). Then either:
- per scroll, `drawImage` the visible slice into one reused screen canvas (cheap blit, one upload), or
- cleaner: make the content a 1024×2048 texture and scroll with `texture.offset.y` — zero canvas work and zero uploads per tick; draw the static browser chrome on a separate thin quad above the content area.

**Impact:** scrolling goes from jank-prone (especially mobile) to effectively free. **Effort:** medium. **Verify:** scroll while watching `?perf=1` frame ms.

---

## P2 — Realism improvements

### P2-1. No anisotropic filtering on the floor, desk, or wall

**Problem:** only canvas textures set anisotropy ([technology.js:133](js/factories/technology.js:133), [wall-objects.js:248](js/factories/wall-objects.js:248)). The floor maps ([scene.js:440](js/core/scene.js:440)) and every wood/wall map loaded through `furniture.js` default to 1 — so the two largest surfaces in frame, both viewed at grazing angles, blur into mush a few units out.

**Fix:** `texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())` in `createFloor()` and `furniture.js:_loadTexture()`. (Pass the renderer or hardcode 8 — r128 clamps at upload.)

**Impact:** among the most visible realism wins available, for a few percent texturing cost. **Effort:** trivial. **Verify:** screenshot the floor/desk receding toward the wall.

### P2-2. The environment map is 256×128

**Problem:** `env.hdr`'s header reads `-Y 128 +X 256` (an ffmpeg/lavc export). Every reflection in the scene — screen glass, chrome lamp stem, clearcoat coffee surface, metals — mirrors a 32-kilopixel world. The PMREM chain can't invent detail that was never there; sharp clearcoat reflections look like colored fog.

**Fix:** re-export the HDRI at 1024×512 (typically 200–500 KB, still preloaded). If file size matters more than reflection crispness, 512×256 is a middle ground.

**Impact:** noticeably more convincing glass/chrome/liquid, the surfaces the realism phases invested in. **Effort:** small (asset swap). **Verify:** coffee meniscus and screen-glass reflections A/B.

### P2-3. The room has no ceiling and no side walls

**Problem:** `createCeiling()` and `createSideWalls()` exist ([furniture.js:230](js/factories/furniture.js:230)) but are commented out in the build list ([objects.js:51](js/factories/objects.js:51)). With pan enabled and maxDistance 10, users can see void above the back wall and past the floor edges; the ceiling spotlights hang from nothing.

**Fix:** re-enable them. If they were disabled because they occlude the orbiting camera: put the room shell on `THREE.BackSide` materials (interior-only rendering — walls between camera and scene become invisible), or tighten `maxPolarAngle`/pan limits instead. If a deliberate decision keeps them out, delete the dead factory code and note why.

**Impact:** closes the biggest "this is a diorama, not a room" tell; 3 cheap meshes. **Effort:** small-medium (camera testing). **Verify:** orbit to extremes, screenshot.

### P2-4. The monitor shows different content before and after the first scroll

**Problem:** `createMonitor()` hand-draws a chrome-less static page ([technology.js:68](js/factories/technology.js:68)); the first wheel tick swaps in `MonitorRenderer`'s full browser-window rendering — the screen visibly changes design. The copy is also maintained in two places (three counting unused `CONTENT_DATA`).

**Fix:** initial texture = `monitorRenderer.createMonitorCanvas(0)`; delete the bespoke drawing in `createMonitor()`. One content source. (Pairs naturally with P1-5.)

**Impact:** consistency + ~60 lines deleted. **Effort:** small.

### P2-5. Hint glow is disabled by a debug value

**Problem:** `HINT_DELAY = 999999; // Temporarily extended for lighting calibration` ([interactions.js:47](js/core/interactions.js:47)). The inflated-backface outline system built to replace OutlinePass never fires for real users.

**Fix:** restore the intended 5000 ms (make it a named constant in config).

### P2-6. Steam wisps leak GPU geometry and churn allocations forever

**Problem:** when a wisp's lifetime ends, it's removed and a brand-new mesh + geometry + material is allocated ([desk-objects.js:294](js/factories/desk-objects.js:294), [356](js/factories/desk-objects.js:356)) — and the old geometry is **never disposed**. r128's `WebGLGeometries` holds GL buffers until `dispose()`, so buffers accumulate for the whole session (~6 planes every few seconds, unbounded). `children.filter()` also allocates every animation tick.

**Fix:** pool the 6 wisps — on expiry, reset position/opacity/lifetime/scale in place. No allocation, no dispose bookkeeping, no leak. Cache the wisp array instead of filtering per tick.

**Impact:** removes a slow leak and idle-time GC churn. **Effort:** small.

### P2-7. Album art wraps around the vinyl sleeves' beveled edges

**Problem:** each cover applies the album texture to the whole `createBeveledBox` ([wall-objects.js:369](js/factories/wall-objects.js:369)); ExtrudeGeometry side UVs smear the artwork's edge pixels around the bevel.

**Fix:** material array like the monitor screen — art on the front face group, flat cardboard color on sides/back. **Effort:** small.

### P2-8. Worn-wood desk has a factory clearcoat

**Problem:** `_createTexturedMaterial` applies `clearcoat: 0.4` to everything ([furniture.js:128](js/factories/furniture.js:128)); the wall override comment already calls out how wrong that default is for matte surfaces. A *worn* oak desk with 0.4 clearcoat reads as a lacquered conference table.

**Fix:** make clearcoat a parameter; try 0.1 / clearcoatRoughness 0.5 for the desk, 0 for shelf wood. Taste call — A/B it.

### P2-9. Keycaps have no legends (optional polish)

Blank white keys are the last prop-tell on the keyboard up close. Cheapest path with the existing single-draw-call instancing: bake one legend atlas texture and give instances per-key UV offsets via an instanced attribute + small `onBeforeCompile` patch. Medium effort, only worth it because the keyboard invites zooming.

---

## P3 — Load time, deploy, dead weight

### P3-1. No cache headers on the Cloudflare deploy

`wrangler.jsonc` serves the raw directory with no `_headers` file. Add one: long-lived `Cache-Control: public, max-age=31536000, immutable` for `/assets/*` and `/js/vendor/*` (rename-on-change assets), short/revalidate for HTML and `js/` app modules (the `?v=2` query on main.js is the existing bust mechanism). Also `nodejs_compat` is unnecessary for a static-asset worker. Repeat-visit loads drop to near zero.

### P3-2. Dead assets and dead code

- `assets/images/ProfilePic.webp` (36 KB) — referenced nowhere.
- `assets/textures/plastered_wall_04_disp_4k.webp` (39 KB) — never loaded (`TEXTURE_CONFIG.wall.files` has no disp entry).
- `CONTENT_DATA` / `SHARED_CONTENT` ([content.js](js/config/content.js), 267 lines) — exported, re-exported, used by nothing. Either make it MonitorRenderer's single content source (see P2-4) or delete it.
- `#info-panel`, `#close-btn` ([index.html:24](index.html:24)) and their CSS — leftovers from the pre-"no HTML overlays" design; no JS references them.
- Factory-level `interactiveObjects` arrays — every factory pushes to its own list, but only `ObjectFactory`'s flag-driven list reaches the InteractionManager. Two parallel systems; delete the vestigial one.
- `furniture.js:_loadTexture` sets `sRGBEncoding` on normal and roughness maps ([furniture.js:68](js/factories/furniture.js:68)). Inert in r128 (those slots ignore encoding) but wrong on its face and a trap for a future Three upgrade, where color-space handling is stricter. Set sRGB on the diffuse only.
- `createCeiling`/`createSideWalls` if P2-3 resolves against them.

### P3-3. Desk wood pops in after the reveal

The furniture textures deliberately bypass the loading manager, but the desk fills the first frame — the placeholder→wood swap is visible right after the fade. Cheapest fix: add `<link rel="preload">` hints for the three `wood_table_worn_*` files so they're usually in cache before the reveal finishes; keep the progressive fallback for slow networks.

---

## P4 — Strategic / longer-horizon

### P4-1. Deep-idle state

The loop never drops below 30 fps because grain/dust/steam always animate. After ~60 s without interaction, step ambient cadence to ~10 fps (or pause dust/steam and let clock/day-night drive renders). Battery/thermals win for tabbed-but-visible sessions; must not feel frozen — test grain steppiness at 10 fps.

### P4-2. Tier detection is blind to GPU-bound devices

`_sampleQualityTier` times `render()` on the CPU ([main.js:211](js/core/main.js:211)); a GPU-bound phone can post fast CPU numbers while missing vsync. Supplement with rAF-to-rAF deltas during interaction windows (only while `interacting` is true, to avoid misreading the deliberate 30 fps idle throttle) and step down when the *frame interval* budget is blown.

### P4-3. Three.js r128 → modern (r160+)

The big unlock, priced honestly: real transmission glass for the diploma pane (currently faked, noted at [wall-objects.js:265](js/factories/wall-objects.js:265)), multisampled composer targets (delete FXAA), correct color management, better PMREM quality, and `shadow.radius`/VSM improvements. Cost: r128→r160 spans the `outputEncoding`→`outputColorSpace` migration, `physicallyCorrectLights`→`useLegacyLights` removal (all light intensities need retuning in physical units), addon module restructuring, and a vendor-bundle rebuild. Do it as its own project with screenshot parity gates, or explicitly decide r128 is the permanent floor and record that in CLAUDE.md.

---

## Suggested order and expected payoff

| Item | Effort | Win |
|---|---|---|
| P0-2 mobile detection | S | Largest mobile perf fix (pixel ratio 1.5→1.0 on phones) |
| P0-1 tier→composer plumbing | S | Makes existing tiering real |
| P0-4 hover-light dead feature | S | Idle stays idle under mouse movement |
| P0-3 shadow-fit regression | S | Visibly sharper sun shadows |
| P1-2 wall textures 4K→1K | S | ~240 MB VRAM, faster mobile start |
| P1-1 plant instancing | M | ~45% of scene draw calls |
| P1-3 lamp light consolidation | S-M | −2 lights, −1 shadow map |
| P1-4 RectAreaLight reduction | S | Big fragment-cost cut |
| P2-1 anisotropy | XS | Most visible realism-per-line-changed |
| P2-2 env.hdr 256→1024 | S | Convincing reflections |
| P1-5 + P2-4 monitor scroll/content | M | Free scrolling + consistent screen |
| P0-5 shadow radius honesty | M | Tunable penumbra |
| P2-3 room enclosure | S-M | Closes the diorama tell |
| P2-5..P2-8, P3-* | S each | Polish, leaks, load time, dead weight |
| P4-* | L | Battery, robustness, realism ceiling |

Re-measure with `?perf=1` after each P0/P1 item and append numbers here, per the Phase 0/7 convention in PERFORMANCE_PLAN.md.
