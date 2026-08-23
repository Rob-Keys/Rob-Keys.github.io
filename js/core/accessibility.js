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
        /** @type {HTMLElement | null} */ this.portfolioStatus = document.getElementById('portfolio-status');
        const accessibilityToggle = document.getElementById('accessibility-toggle');
        /** @type {HTMLButtonElement | null} */ this.accessibilityToggle = accessibilityToggle instanceof HTMLButtonElement
            ? accessibilityToggle
            : null;
        /** @type {HTMLElement | null} */ this.portfolioContent = document.getElementById('portfolio-content');
        this.init();
    }

    init() {
        document.querySelectorAll('[data-portfolio-object]').forEach((element) => {
            if (!(element instanceof HTMLElement)) return;
            element.addEventListener('click', (event) => {
                const name = element.dataset.portfolioObject || '';
                const details = element.closest('details');

                if (this.activationHandler) {
                    event.preventDefault();
                    this.activationHandler(name, element);
                    return;
                }

                if (details instanceof HTMLDetailsElement) {
                    if (this.activeDetails && this.activeDetails !== details) {
                        this.activeDetails.open = false;
                    }
                    this.activeDetails = details;
                    this.lastInvokingControl = element;
                }
            });
        });

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
            if (document.body.classList.contains('accessibility-open')) {
                event.preventDefault();
                this.setAccessibilityView(false);
                return;
            }
            if (!this.activeDetails?.open) return;
            event.preventDefault();
            this.closeDetails();
        });
    }

    /** @param {boolean} open */
    setAccessibilityView(open) {
        if (!this.accessibilityToggle) return;

        document.body.classList.toggle('accessibility-open', open);
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
        this.lastInvokingControl = control || summary;
        if (this.portfolioStatus) this.portfolioStatus.textContent = `Opened ${summary.textContent || 'portfolio'} details.`;

        if (!control || control !== summary) {
            details.scrollIntoView({ block: 'nearest' });
            summary.focus();
        }
    }

    closeDetails() {
        if (!this.activeDetails?.open) return;

        const invokingControl = this.lastInvokingControl;
        this.activeDetails.open = false;
        this.activeDetails = null;
        this.lastInvokingControl = null;
        if (this.portfolioStatus) this.portfolioStatus.textContent = 'Portfolio details closed.';

        this.closeHandler?.();
        if (invokingControl?.isConnected) invokingControl.focus();
    }
}
