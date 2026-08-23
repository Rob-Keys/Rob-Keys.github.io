# 3D Scene Realism and Performance Plan

## Goal

Make the desk scene feel hyper-realistic while preserving fast startup, smooth interaction, and a sensible mobile fallback.

The scene is already performance-conscious: it uses shared materials, merged geometry, instanced leaves and books, deferred wall-art textures, WebGPU with WebGL fallback, and relatively small WebP assets.

## Guiding principles

- Prioritize lighting, roughness, normals, bevels, contact shadows, and imperfections over raw texture resolution.
- Use small seamless texture sets plus procedural variation instead of large unique images.
- Use SVG or canvas textures for printed graphics, labels, certificates, album art, and screens—not as a universal replacement for photorealistic materials.
- Share materials and textures wherever possible.
- Instance repeated objects and merge small static parts.
- Bake or approximate static lighting when it produces the same visual result as dynamic lights.
- Load high-detail or non-critical assets progressively.
- Keep quality tiers for mobile and slower GPUs.

## Object-by-object recommendations

| Object | Realism direction | Performance direction |
|---|---|---|
| Room walls | Add subtle plaster color and roughness variation; break up perfectly uniform corners and surfaces. | Keep one shared low-resolution plaster material; use baked or emissive fill instead of extra bounce lights. |
| Ceiling and baseboards | Add tiny bevels and slightly different roughness from the walls. | Keep simple background geometry. |
| Floor | Add directional wood grain, plank seams, roughness variation, and stronger desk contact shadows. | Use one tileable compressed material set; avoid unique floor geometry. |
| Desk | Improve wood grain direction, edge wear, scratches, darkened edges, and uneven roughness. | Share one wood texture set and procedural variation; retain beveled geometry and merged legs. |
| Wall shelf | Add edge wear, slight sag or imperfection, wood grain, and believable metal reflections. | Keep brackets and screws merged; share the wood material with the desk. |
| Monitor | Improve bezel micro-scratches, screen-glass reflection, edge bevels, and display brightness. | Keep the screen as one canvas texture; avoid expensive display shadows and reflections. |
| Monitor stand | Add coated-metal roughness, rubber feet, and contact shadows. | Keep buttons, joints, and feet merged with simple cylinders. |
| Laptop | Add anodized-metal variation, hinge detail, key gaps, and a less-perfect screen reflection. | Keep keys merged or instanced; use one small canvas texture for the screen. |
| Keyboard | Add subtle key-height variation, legends, tiny gaps, and a worn spacebar. | Continue instancing keys; use one legend atlas and a few shared materials. |
| Mouse | Add soft plastic sheen, seam detail, scroll-wheel texture, and a faint contact shadow. | Keep the low-poly shell; high geometry has little payoff at this scale. |
| Digital clock | Add a translucent display cover, slight glass reflection, and softer LED bloom. | Keep canvas-rendered digits; use emissive color instead of a dedicated light. |
| Coffee mug | Add ceramic glaze variation, darker interior, rim thickness, coffee meniscus, and contact shadow. | Keep steam as a few low-cost wisps; avoid volumetric steam or fluid simulation. |
| Coffee | Add subtle reflection and an irregular meniscus. | Use a simple physical material; no fluid simulation is needed. |
| Notebook | Add cloth or paper cover texture, page thickness variation, curled corners, and softer paper roughness. | Keep text as a canvas texture and share one paper normal map. |
| Desk lamp | Improve metal roughness, shade thickness, reflector behavior, cable, and switch detail. | Use one shadow-casting spotlight; avoid multiple overlapping shadow lights. |
| Plant pot | Add porous terracotta variation, darker damp soil, and an irregular rim. | Keep the pot low-poly and reuse the roughness variation texture. |
| Plant leaves and vines | Add translucent edges, varied greens, imperfect curvature, and subtle vein detail. | Continue instancing leaves; prefer alpha-tested or opaque cards over many transparent materials. |
| Books | Add paper or cloth roughness, uneven page blocks, spine wear, and varied labels. | Keep instanced page blocks, canvas spine labels, and one shared paper grain texture. |
| Tidbyt/display gadget | Add plastic shell sheen, tiny bevels, screen diffuser, and softer pixel display behavior. | Keep the canvas-rendered pixel screen and simple beveled enclosure. |
| Diploma | Add paper fibers, slight thickness, frame wear, and controlled glass reflections. | Keep the certificate as an SVG texture and defer its loading. |
| Vinyl album covers | Add cardboard thickness, paper sheen, cover wear, and slightly imperfect spacing. | Keep four small deferred textures; avoid high-resolution art maps. |
| Wall picture light | Add warmer brass or paint variation and a convincing reflector. | Use one narrow spotlight or emissive strip; do not add another shadow map. |
| Dust particles | Keep them subtle and atmospheric rather than prominent. | Make particle count adaptive or disable it on mobile. |
| Interaction outlines | Replace the strong red outlines with a subtle hover/focus-only highlight so realism is not interrupted. | Prefer a lightweight rim or screen-space highlight over persistent outline geometry. |

## Priority order

### Phase 1: Highest visual return

1. Improve desk wood grain, edge wear, and roughness variation.
2. Improve monitor and laptop screen reflections and brightness.
3. Add plant leaf translucency and material variation.
4. Strengthen believable contact shadows beneath desk objects.
5. Reduce uniformity in the wall and floor materials.
6. Make interaction outlines subtler and state-dependent.

### Phase 2: Secondary prop detail

1. Improve keyboard key variation and legends.
2. Improve laptop hinges and anodized metal.
3. Improve notebook pages and cover material.
4. Improve mug glaze, coffee surface, and steam.
5. Improve lamp shade, reflector, and metal finish.
6. Add book, diploma, vinyl, and clock micro-details.

### Phase 3: Optimization pass

1. Audit draw calls, shader variants, shadow-map cost, and GPU memory.
2. Convert the largest repeating material sets to GPU-compressed KTX2/Basis textures if worthwhile.
3. Add texture resolution tiers for desktop, tablet, and mobile.
4. Confirm that deferred assets do not cause visible popping during interaction.
5. Keep static geometry transforms frozen where appropriate.
6. Measure with real devices rather than optimizing only from asset file size.

## Texture strategy

- Use color, normal, and roughness maps selectively. Roughness and normal variation often contribute more to realism than a very large color map.
- Use procedural shader noise to hide tiling and add low-cost variation in scale, color, and roughness.
- Use canvas textures for UI screens, clock digits, book spines, and other readable content.
- Use SVG for crisp flat artwork such as the diploma, labels, and simple decals.
- Consider KTX2/Basis GPU compression for larger final texture sets; WebP download size does not equal decoded GPU memory usage.
- Keep maps low resolution when the object is small on screen and stream higher-quality versions only for close inspection.

## Success criteria

- The desk, walls, and hero objects read as physical materials without relying on large unique textures.
- No visible texture pop-in during the initial reveal or object inspection.
- Interaction remains smooth while orbiting and zooming.
- Mobile devices receive reduced shadows, particles, post-processing, and texture resolution.
- The scene remains visually believable even when texture detail is reduced.
- Accessibility and the semantic fallback remain unaffected.
