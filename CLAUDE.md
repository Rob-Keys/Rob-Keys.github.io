# 3D Portfolio - CLAUDE.md

Three.js interactive desk portfolio. The 3D scene is the visual layer; the
semantic portfolio in `index.html` is the accessible source of truth and must
remain usable without WebGL/WebGPU.

## Dev Server

Install dependencies and use Vite for local development:
```
npm install
npm run dev
```

Create a production bundle with `npm run build` and serve it locally with
`npm run preview`. Vite resolves the Three.js and GSAP packages from
`node_modules`; the deployed site no longer uses a browser import map.

### Preview server

Run the Vite development server so package imports resolve:
```sh
npm run dev
```
Open the URL printed by Vite, normally `http://localhost:5173`. See
`.claude/skills/verify/SKILL.md` for the browser-check procedure.

## Visual Verification

After making changes, use the browser preview to inspect both the 3D scene and
the semantic portfolio. Follow `.claude/skills/verify/SKILL.md` for the manual
checks and allow a few seconds for the Three.js scene to initialize.

## Quality Checks

Run before committing to catch type and lint errors:
```
npm run check        # tsc --noEmit && eslint js/
npm run typecheck    # tsc --noEmit only
npm run lint         # eslint js/ only
```

**Type checking** uses `// @ts-check` + JSDoc annotations throughout `js/`. Three.js 0.185 ships its own types; the small `types/three-addons.d.ts` file contains only project globals.

**Key conventions:**
- All `canvas.getContext('2d')` calls must be followed by an `if (!ctx) throw` guard
- Config constants in `config.js` are frozen (`Object.freeze`) — mutations throw at runtime
- Use `assert(condition, message)` from `js/systems/utils.js` for factory invariants
- New factory class fields that hold nullable Three.js objects must have JSDoc `@type` annotations
- Unused callback params must use `_` prefix (e.g. `forEach((item, _index) => ...)`)

## Dependencies

Runtime dependencies are bundled by Vite 8 from the versions declared in
`package.json`. The application uses Three.js 0.185's `WebGPURenderer` with
its WebGL2 backend fallback, TSL nodes for post-processing and glare, and the
modern `three/addons/` modules.

## File Structure

| Path | Purpose |
|------|---------|
| `index.html`, `lost.html` | Semantic portfolio and renderer-failure page |
| `js/boot.js` | Browser entry point and deferred scene startup |
| `js/core/` | Scene setup, renderer lifecycle, post-processing, interactions, and semantic controls |
| `js/config/` | Technical settings (`config.js`), monitor canvas copy (`content.js`) |
| `js/systems/` | Lighting system + day/night cycle (`lighting.js`), shared utilities (`utils.js`) |
| `js/factories/` | 3D object creation, including `objects.js` (orchestrator), `keycap-legends.js`, and the furniture, technology, and prop factories |
| `assets/textures/` | PBR textures (wood, wall) in WebP |
| `assets/images/` | Vinyl album art in WebP |
| `types/` | Project-local TypeScript declarations |

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
    constructor() {
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
        return group;
    }
}
```

### Key Constraints
- `mesh.castShadow = mesh.receiveShadow = true` on all visible meshes
- Screen illumination uses emissive materials plus point/spot bounce lights; `RectAreaLight` is intentionally avoided because its optional LTC textures were not reliable across the WebGPU fallback path.
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

The main scene pipeline is `js/core/postprocessing-webgpu.js`: TSL MRT captures scene color and emissive output, then applies bloom, film grain, and vignette before presenting the final node.

## Lighting

- Low ambient (0.08), emissive objects as primary light sources
- Post-processing bloom: strength 0.3, radius 0.4, threshold 0.7
- `SpotLight`/`PointLight` with `decay: 2` for realistic falloff

## Hint-glow outline

Interactive objects get an immediate hover outline via an inflated-backface mesh per object — see `InteractionManager.initHintOutline()` in `js/core/interactions.js`. This replaced `THREE.OutlinePass`, which dimmed the whole scene whenever enabled: its internal depth/mask scene re-renders temporarily altered scene background, clear color, and object visibility, and no overlay-material fix could prevent that (only overriding its `render()` or dropping the pass could). The current approach draws real geometry in the normal scene pass instead, so there's no separate pass and no dimming.

## Mobile

- The scene supports portrait and landscape orientations and pointer/touch input.
- Coarse-pointer devices start with a lower rendering-quality tier and use
  mobile-specific pixel-ratio and shadow settings; contact shadows and dust
  particles are omitted to reduce GPU work.
- The semantic portfolio remains available on mobile and does not depend on the
  3D renderer.

## Testing

Run `npm run check`, then manually test keyboard-only navigation, Escape focus
restoration, 200% and 400% zoom, reduced motion, narrow viewports, and the
semantic fallback with WebGL/WebGPU unavailable. No test framework is present.
