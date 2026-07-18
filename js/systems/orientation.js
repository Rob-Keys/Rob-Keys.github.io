// @ts-check
/**
 * Detects physical device rotation even when the OS has orientation lock
 * enabled, so the mobile rotate-overlay can dismiss itself without waiting
 * for the user to actually unlock rotation. `orientation: portrait` media
 * queries reflect the browser's locked rendering, not the device's real
 * tilt -- DeviceOrientationEvent reads the accelerometer directly and is
 * unaffected by the lock.
 */

const LANDSCAPE_UNLOCK_CLASS = 'physical-landscape';
const NEEDS_PERMISSION_CLASS = 'needs-orientation-permission';
const GAMMA_LANDSCAPE_THRESHOLD = 45;

/**
 * @param {DeviceOrientationEvent} event
 * @returns {boolean}
 */
function isPhysicallyLandscape(event) {
    if (event.gamma === null) return false;
    return Math.abs(event.gamma) > GAMMA_LANDSCAPE_THRESHOLD;
}

/** @param {DeviceOrientationEvent} event */
function handleOrientation(event) {
    document.body.classList.toggle(LANDSCAPE_UNLOCK_CLASS, isPhysicallyLandscape(event));
}

function attachOrientationListener() {
    window.addEventListener('deviceorientation', handleOrientation);
}

/** iOS 13+ requires an explicit, gesture-triggered permission grant before
 * DeviceOrientationEvent fires; other platforms expose the API directly. */
function needsIOSPermission() {
    const DOE = /** @type {any} */ (window).DeviceOrientationEvent;
    return typeof DOE !== 'undefined' && typeof DOE.requestPermission === 'function';
}

/**
 * Wires up physical-orientation detection for the rotate overlay. Safe to
 * call on desktop or where DeviceOrientationEvent is unsupported -- it's a
 * no-op there and the overlay falls back to its plain CSS media query.
 */
export function initOrientationDetection() {
    const overlay = document.getElementById('rotate-overlay');
    if (!overlay) return;

    if (!needsIOSPermission()) {
        attachOrientationListener();
        return;
    }

    const enableButton = document.getElementById('enable-rotation-check');
    if (!enableButton) return;

    document.body.classList.add(NEEDS_PERMISSION_CLASS);

    enableButton.addEventListener('click', async () => {
        const DOE = /** @type {any} */ (window).DeviceOrientationEvent;
        try {
            const result = await DOE.requestPermission();
            if (result === 'granted') {
                attachOrientationListener();
                document.body.classList.remove(NEEDS_PERMISSION_CLASS);
            }
        } catch {
            // Permission API rejected or unavailable -- overlay stays CSS-only.
        }
    });
}
