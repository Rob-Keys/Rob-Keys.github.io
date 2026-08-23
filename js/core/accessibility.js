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

        document.getElementById('dismiss-instructions')?.addEventListener('click', () => {
            document.getElementById('instructions')?.setAttribute('hidden', '');
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (!this.activeDetails?.open) return;
            event.preventDefault();
            this.closeDetails();
        });
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
