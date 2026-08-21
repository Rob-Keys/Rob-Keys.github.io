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
const LANDSCAPE_AXIS_THRESHOLD = 45;

/**
 * @param {DeviceOrientationEvent} event
 * @returns {boolean}
 */
function isPhysicallyLandscape(event) {
    const beta = event.beta;
    const gamma = event.gamma;

    if (beta === null && gamma === null) return false;

    // Depending on the browser/device coordinate system, rotating a phone
    // can move either beta or gamma. Checking only gamma misses the common
    // case where beta moves from roughly +/-90 degrees to roughly 0 degrees.
    return (gamma !== null && Math.abs(gamma) > LANDSCAPE_AXIS_THRESHOLD)
        || (beta !== null && Math.abs(beta) < LANDSCAPE_AXIS_THRESHOLD);
}

/** @param {DeviceOrientationEvent} event */
function handleOrientation(event) {
    document.body.classList.toggle(LANDSCAPE_UNLOCK_CLASS, isPhysicallyLandscape(event));
}

function attachOrientationListener() {
    window.addEventListener('deviceorientation', handleOrientation);

    // These events cover normal browser orientation changes. The sensor
    // listener above is still needed when the OS keeps the viewport locked in
    // portrait, which is why this is a fallback rather than the only check.
    const updateViewportOrientation = () => {
        const isLandscape = window.matchMedia('(orientation: landscape)').matches;
        document.body.classList.toggle(LANDSCAPE_UNLOCK_CLASS, isLandscape);
    };
    window.addEventListener('orientationchange', updateViewportOrientation);
    window.addEventListener('resize', updateViewportOrientation);
    updateViewportOrientation();
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
