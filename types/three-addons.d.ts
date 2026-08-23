/**
 * Project-local declarations only. Three.js 0.185 ships the add-on and TSL
 * declarations used by this project; this file intentionally contains no
 * legacy renderer or post-processing globals.
 */

declare global {
    interface Window {
        Portfolio3D: unknown;
        _portfolio: unknown;
    }
}

export {};
