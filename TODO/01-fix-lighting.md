# Fix the Lighting via Human Review

The current lighting setup needs a human eye pass to identify what looks off. Load the scene in the browser, look at each area, and decide what to adjust.

## Approach

Open the site and review lighting quality across all objects and angles. Take notes on specific issues (too dark, too bright, wrong color temperature, harsh shadows, missed areas, etc.) before touching any code.

## Known Context

- Low ambient (0.08), emissive objects as primary sources
- Post-processing bloom: strength 0.3, radius 0.4, threshold 0.7
- SpotLight/PointLight with decay: 2 for realistic falloff
- Files: `js/systems/lighting.js`

## Don't over-engineer

- Don't restructure the lighting system — just tune values.
- Don't add new light types without a clear reason from the review.
- One pass: identify the biggest problems and fix those, not everything.
