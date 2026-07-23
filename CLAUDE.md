# 3D Portfolio - CLAUDE.md

Three.js interactive desk portfolio. Info displayed via textures/materials on 3D objects -- **NO HTML overlays/popups**.

## Dev Server

No build step. Serve with any static HTTP server. Use `npx http-server` with an absolute path — `python3 -m http.server` fails in environments where the shell's working directory is unavailable (e.g. Claude Code preview server):
```
npx http-server /Users/robkeys/Documents/code/Personal/rob_website/3D-personal-site -p 8000 --cors
```
Open `http://localhost:8000`. Must use a server (ES6 modules require it).

### Claude Code preview server

Use `.claude/launch.json` at the repo root with `npx` and an absolute path argument:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "3D Personal Site",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["http-server", "/Users/robkeys/Documents/code/Personal/rob_website/3D-personal-site", "-p", "8000", "--cors"],
      "port": 8000
    }
  ]
}
```
Do not use `python3 -m http.server` or `bash -c "cd ... &&"` — both fail because pyenv's shell init calls `getcwd` before the `cd` runs.

## Visual Verification

After making changes, use the in-app browser tools to see the result:

```
preview_start { name: "3D Personal Site" }   // starts the server
navigate { url: "http://localhost:8000" }     // reload after edits
computer { action: "screenshot" }             // capture what's visible
```

Wait ~2 seconds after load before screenshotting — Three.js needs time to initialize. See `.claude/skills/verify/SKILL.md` for the full verification workflow (invokable via `/verify`).

## Quality Checks

Run before committing to catch type and lint errors:
```
npm run check        # tsc --noEmit && eslint js/
npm run typecheck    # tsc --noEmit only
npm run lint         # eslint js/ only
```

**Type checking** uses `// @ts-check` + JSDoc annotations throughout `js/`. `@types/three@0.128.0` provides core Three.js types; CDN add-ons (OrbitControls, EffectComposer, etc.) are declared in `types/three-addons.d.ts`.

**Key conventions:**
- All `canvas.getContext('2d')` calls must be followed by an `if (!ctx) throw` guard
- Config constants in `config.js` are frozen (`Object.freeze`) — mutations throw at runtime
- Use `assert(condition, message)` from `js/systems/utils.js` for factory invariants
- New factory class fields that hold nullable Three.js objects must have JSDoc `@type` annotations
- Unused callback params must use `_` prefix (e.g. `forEach((item, _index) => ...)`)

## Dependencies

Self-hosted, minified vendor bundles in `js/vendor/` (no CDN, no build step for the served files):
- `vendor-core.js`: Three.js r128, GSAP 3.12.2, and the addons OrbitControls, RGBELoader, RectAreaLightUniformsLib, BufferGeometryUtils
- `vendor-postfx.js`: EffectComposer, RenderPass, ShaderPass, UnrealBloomPass (lazy-loaded from `scene.js` after the first render; `OutlinePass`/`SSAOPass` were removed, see Phase 4/5 in PERFORMANCE_PLAN.md)

## File Structure

| Directory | Purpose |
|-----------|---------|
| `js/core/` | Entry point (`main.js`), scene setup (`scene.js`), user interactions (`interactions.js`) |
| `js/config/` | Technical settings (`config.js`), portfolio content text (`content.js`) |
| `js/systems/` | Lighting system + day/night cycle (`lighting.js`), shared utilities (`utils.js`) |
| `js/factories/` | 3D object creation: `objects.js` (orchestrator), `furniture.js`, `technology.js`, `desk-objects.js`, `wall-objects.js`, `shelf-objects.js`, `monitor-renderer.js` |
| `assets/textures/` | PBR textures (wood, wall) in WebP |
| `assets/images/` | Vinyl album art in WebP |

## Code Style

- 4-space indent, single quotes, semicolons required
- `PascalCase` classes, `camelCase` functions/vars, `UPPER_SNAKE` constants, `_prefix` private
- ES6+: `const`/`let` only, arrow functions, destructuring, async/await
- Named exports preferred: `export { Thing }`

## Three.js Patterns

### Object Creation
```javascript
const group = new THREE.Group();
const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.3 }));
mesh.castShadow = mesh.receiveShadow = true;
group.add(mesh);
group.userData = { name: 'id', label: 'Display Name' };
this.interactiveObjects.push(group);
```

### Factory Pattern (all files in `js/factories/`)
```javascript
export class ExampleFactory {
    constructor(scene) {
        this.scene = scene;
        this.interactiveObjects = [];
        this.origins = {
            myObject: { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0 }
        };
    }
    createMyObject() {
        const group = new THREE.Group();
        const origin = this.origins.myObject;
        // Build meshes, add to group...
        group.position.set(origin.x, origin.y, origin.z);
        group.rotation.set(origin.rotationX, origin.rotationY, origin.rotationZ);
        group.userData = { name: 'id', label: 'Display Name' };
        this.interactiveObjects.push(group);
        return group;
    }
}
```

### Key Constraints
- `mesh.castShadow = mesh.receiveShadow = true` on all visible meshes
- `RectAreaLight` for screens requires `RectAreaLightUniformsLib.init()` first
- Reuse geometries/materials across similar objects
- `camera.far` set to 50 to prevent clipping on steep angles
- Static objects: `object.matrixAutoUpdate = false` after positioning
- Dispose unused: `geometry.dispose()`, `material.dispose()`, `texture.dispose()`

## Performance

### Loading
- Defer non-visible objects; prioritize above-fold content
- Use `THREE.LOD` for distant objects with simpler geometry
- Texture compression: WebP, power-of-2 dimensions, appropriate resolution
- `THREE.InstancedMesh` for repeated objects

### Rendering
```javascript
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

## Lighting

- Low ambient (0.08), emissive objects as primary light sources
- Post-processing bloom: strength 0.3, radius 0.4, threshold 0.7
- `SpotLight`/`PointLight` with `decay: 2` for realistic falloff

## Hint-glow outline

Interactive objects get a hint outline (fades in after `HINT_DELAY` of no clicks) via an inflated-backface mesh per object — see `InteractionManager.initHintOutline()` in `js/core/interactions.js`. This replaced `THREE.OutlinePass`, which dimmed the whole scene whenever enabled: its internal depth/mask scene re-renders temporarily altered scene background, clear color, and object visibility, and no overlay-material fix could prevent that (only overriding its `render()` or dropping the pass could). The current approach draws real geometry in the normal scene pass instead, so there's no separate pass and no dimming.

## Mobile

- Portrait orientation shows a CSS overlay prompting the user to rotate to landscape (no JS needed -- pure media query)
- No mobile-specific camera/controls adjustments; landscape mobile gets the same experience as desktop
- The overlay is in `index.html` (`#rotate-overlay`) and styled in `css/styles.css`

## Testing

Manual only -- open in browser with WebGL. No test framework.
