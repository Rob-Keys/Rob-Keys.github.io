# Clean Up Floating Artifacts

Some objects appear to float above the surfaces they should rest on. Find them and fix their Y positions so everything sits flush against the desk, floor, or shelf it belongs on.

## Approach

Walk the scene visually and identify any mesh that appears to hover. Cross-reference with the origin values in each factory file and correct the Y offset.

## Files to Check

- `js/factories/desk-objects.js` — items on the desk surface
- `js/factories/shelf-objects.js` — items on the shelf
- `js/factories/furniture.js` — furniture legs, base contact points
- `js/factories/technology.js` — monitors, peripherals

## Don't over-engineer

- Don't refactor origin storage — just fix the numbers.
- Don't adjust objects that look correct; only touch the floaters.
