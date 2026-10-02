// @ts-check
/**
 * Small DOM bridge between the 3D objects and native disclosure widgets.
 * The details elements remain fully usable without JavaScript or WebGL.
 */
export class SemanticPortfolioController {
    constructor() {
        /** @type {((name: string, control: HTMLElement) => void) | null} */ this.activationHandler = null;
        /** @type {(() => void) | null} */ this.closeHandler = null;
        /** @type {HTMLDetailsElement | null} */ this.activeDetails = null;
        /** @type {HTMLElement | null} */ this.lastInvokingControl = null;
        this._pendingName = '';
        /** @type {HTMLElement | null} */ this.portfolioStatus = document.getElementById('portfolio-status');
        const accessibilityToggle = document.getElementById('accessibility-toggle');
        /** @type {HTMLButtonElement | null} */ this.accessibilityToggle = accessibilityToggle instanceof HTMLButtonElement
            ? accessibilityToggle
            : null;
        if (this.accessibilityToggle) {
            this.accessibilityToggle.textContent = 'Open accessible view';
            this.accessibilityToggle.setAttribute('aria-controls', 'portfolio-content');
        }
        /** @type {HTMLElement | null} */ this.portfolioContent = document.getElementById('portfolio-content');
        this.init();
    }

    init() {
        document.querySelectorAll('[data-portfolio-object]').forEach((element) => {
            if (!(element instanceof HTMLElement)) return;
            element.addEventListener('click', () => {
                const name = element.dataset.portfolioObject || '';
                const details = element.closest('details');

                // Keep the browser's native disclosure toggle. Its `toggle`
                // event below synchronizes the camera after the new state lands.
                if (details instanceof HTMLDetailsElement && !details.open) {
                    this.lastInvokingControl = element;
                    this._pendingName = name;
                }
            });
        });

        document.querySelectorAll('.portfolio-item').forEach((element) => {
            if (!(element instanceof HTMLDetailsElement)) return;
            element.addEventListener('toggle', () => {
                if (element.open) {
                    if (this.activeDetails && this.activeDetails !== element) this.activeDetails.open = false;
                    this.activeDetails = element;
                    if (!document.body.classList.contains('accessibility-open')) {
                        document.body.classList.add('selection-open');
                    }
                    const name = element.id.replace(/^portfolio-item-/, '');
                    const summary = element.querySelector('summary');
                    if (name && this._pendingName === name && summary instanceof HTMLElement) {
                        this.activationHandler?.(name, summary);
                    }
                    this._pendingName = '';
                } else if (this.activeDetails === element) {
                    this.closeDetails();
                }
            });
        });

        const initiallyOpen = Array.from(document.querySelectorAll('.portfolio-item'))
            .filter((element) => element instanceof HTMLDetailsElement && element.open);
        const lastOpen = initiallyOpen[initiallyOpen.length - 1];
        this.activeDetails = lastOpen instanceof HTMLDetailsElement ? lastOpen : null;
        initiallyOpen.slice(0, -1).forEach((details) => {
            if (details instanceof HTMLDetailsElement) details.open = false;
        });
        const initialSummary = this.activeDetails?.querySelector('summary');
        this.lastInvokingControl = initialSummary instanceof HTMLElement ? initialSummary : null;

        this.accessibilityToggle?.addEventListener('click', () => {
            this.setAccessibilityView(!document.body.classList.contains('accessibility-open'));
        });

        // Keep the skip link useful when the alternate view is hidden by the
        // visual experience. Without JavaScript, its native anchor behavior
        // still lands on the semantic portfolio below the scene.
        document.querySelector('.skip-link')?.addEventListener('click', (event) => {
            if (document.body.classList.contains('js-enabled')) {
                event.preventDefault();
                this.setAccessibilityView(true);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (this.activeDetails?.open) {
                event.preventDefault();
                this.closeDetails();
                return;
            }
            if (document.body.classList.contains('accessibility-open')) {
                event.preventDefault();
                this.setAccessibilityView(false);
            }
        });
    }

    /** @param {boolean} open */
    setAccessibilityView(open) {
        if (!this.accessibilityToggle) return;

        document.body.classList.toggle('accessibility-open', open);
        if (open) document.body.classList.remove('selection-open');
        else if (this.activeDetails?.open) document.body.classList.add('selection-open');
        document.dispatchEvent(new CustomEvent('portfolio-view-change', { detail: { accessible: open } }));
        this.accessibilityToggle.setAttribute('aria-expanded', String(open));
        this.accessibilityToggle.textContent = open ? 'Close accessible view' : 'Open accessible view';

        if (open) {
            this.portfolioContent?.focus({ preventScroll: true });
            return;
        }

        this.accessibilityToggle.focus();
    }

    /** @param {(name: string, control: HTMLElement) => void} handler */
    setActivationHandler(handler) {
        this.activationHandler = handler;
    }

    /** @param {() => void} handler */
    setCloseHandler(handler) {
        this.closeHandler = handler;
    }

    /** @param {string} name @param {HTMLElement} [control] */
    openDetails(name, control) {
        const details = document.getElementById(`portfolio-item-${name}`);
        if (!(details instanceof HTMLDetailsElement)) return;

        if (this.activeDetails && this.activeDetails !== details) {
            this.activeDetails.open = false;
        }

        const summary = details.querySelector('summary');
        if (!(summary instanceof HTMLElement)) return;

        details.open = true;
        this.activeDetails = details;
        this.lastInvokingControl = control || this.accessibilityToggle || summary;
        if (!document.body.classList.contains('accessibility-open')) {
            document.body.classList.add('selection-open');
        }
        if (this.portfolioStatus) this.portfolioStatus.textContent = `Opened ${summary.textContent || 'portfolio'} details.`;

        if (!control || control !== summary) {
            details.scrollIntoView({ block: 'nearest' });
            summary.focus();
        }
    }

    closeDetails() {
        if (!this.activeDetails) return;

        const invokingControl = this.lastInvokingControl;
        const details = this.activeDetails;
        if (details.open) details.open = false;
        this.activeDetails = null;
        this.lastInvokingControl = null;
        document.body.classList.remove('selection-open');
        if (this.portfolioStatus) this.portfolioStatus.textContent = 'Portfolio details closed.';

        this.closeHandler?.();
        const restoreTarget = document.body.classList.contains('visual-open')
            && !document.body.classList.contains('accessibility-open')
            ? this.accessibilityToggle || invokingControl
            : invokingControl;
        if (restoreTarget?.isConnected) restoreTarget.focus();
    }
}
