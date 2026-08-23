// @ts-check
/**
 * Cached canvas renderer for the portfolio page shown on the main monitor.
 *
 * The browser chrome and the long page are rasterized once. Scrolling only
 * composites a clipped slice of the page, which keeps interaction inexpensive
 * while still allowing the screen to feel like a real browser viewport.
 */

import { MONITOR_CONTENT } from '../config/content.js';

const LOGICAL_WIDTH = 1280;
const LOGICAL_VISIBLE_HEIGHT = 560;
const DEVICE_WIDTH = 1024;
const DEVICE_HEIGHT = 512;
const PAGE_MARGIN = 72;
const PAGE_WIDTH = LOGICAL_WIDTH - (PAGE_MARGIN * 2);
const FONT_STACK = 'Arial, Helvetica, sans-serif';

/**
 * MonitorRenderer handles all canvas-based rendering for the main monitor.
 */
export class MonitorRenderer {
    constructor() {
        /** @type {HTMLCanvasElement | null} */ this.canvas = null;
        /** @type {CanvasRenderingContext2D | null} */ this.ctx = null;
        /** @type {HTMLCanvasElement | null} */ this.chromeCanvas = null;
        /** @type {HTMLCanvasElement | null} */ this.contentCanvas = null;
        this.chromeHeightLogical = 0;
        this.chromeHeightDevice = 0;
        this.contentHeightLogical = 0;
        this.maxScrollOffset = 0;
        this.deviceWidth = DEVICE_WIDTH;
        this.deviceHeight = DEVICE_HEIGHT;
        this.logicalWidth = LOGICAL_WIDTH;
        this.logicalVisibleHeight = LOGICAL_VISIBLE_HEIGHT;
    }

    /** Build the static browser chrome and the complete page exactly once. */
    _build() {
        if (this.canvas) return;

        const scaleX = this.deviceWidth / this.logicalWidth;
        const scaleY = this.deviceHeight / this.logicalVisibleHeight;
        const scratch = document.createElement('canvas');
        scratch.width = this.deviceWidth;
        scratch.height = this.deviceHeight;
        const scratchCtx = scratch.getContext('2d');
        if (!scratchCtx) throw new Error('Failed to get 2D context for monitor canvas');

        scratchCtx.scale(scaleX, scaleY);
        this.chromeHeightLogical = this._renderBrowserChrome(scratchCtx);

        this.chromeHeightDevice = Math.ceil(this.chromeHeightLogical * scaleY);
        this.chromeCanvas = document.createElement('canvas');
        this.chromeCanvas.width = this.deviceWidth;
        this.chromeCanvas.height = this.chromeHeightDevice;
        const chromeCtx = this.chromeCanvas.getContext('2d');
        if (!chromeCtx) throw new Error('Failed to get 2D context for monitor canvas');
        chromeCtx.scale(scaleX, scaleY);
        this._renderBrowserChrome(chromeCtx);

        scratchCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
        const contentHeightLogical = this._renderContent(scratchCtx);
        this.contentHeightLogical = contentHeightLogical;
        this.maxScrollOffset = Math.max(
            0,
            contentHeightLogical - (this.logicalVisibleHeight - this.chromeHeightLogical)
        );
        const contentHeightDevice = Math.ceil(contentHeightLogical * scaleY) + 24;
        this.contentCanvas = document.createElement('canvas');
        this.contentCanvas.width = this.deviceWidth;
        this.contentCanvas.height = contentHeightDevice;
        const contentCtx = this.contentCanvas.getContext('2d');
        if (!contentCtx) throw new Error('Failed to get 2D context for monitor canvas');
        contentCtx.fillStyle = '#f7f7f5';
        contentCtx.fillRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
        contentCtx.scale(scaleX, scaleY);
        this._renderContent(contentCtx);

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.deviceWidth;
        this.canvas.height = this.deviceHeight;
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) throw new Error('Failed to get 2D context for monitor canvas');
    }

    /**
     * Composite a viewport of the page into the reusable output canvas.
     * @param {number} scrollOffset Current scroll position in logical pixels.
     * @returns {HTMLCanvasElement} The rendered monitor canvas.
     */
    createMonitorCanvas(scrollOffset) {
        this._build();

        const { ctx, canvas, chromeCanvas, contentCanvas } = this;
        if (!ctx || !canvas || !chromeCanvas || !contentCanvas) {
            throw new Error('MonitorRenderer._build() did not initialize its canvases');
        }

        const scaleY = this.deviceHeight / this.logicalVisibleHeight;
        const deviceScrollOffset = Math.max(0, Math.min(this.maxScrollOffset, scrollOffset)) * scaleY;
        const contentAreaHeight = this.deviceHeight - this.chromeHeightDevice;

        ctx.fillStyle = '#f7f7f5';
        ctx.fillRect(0, 0, this.deviceWidth, this.deviceHeight);
        ctx.drawImage(chromeCanvas, 0, 0);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, this.chromeHeightDevice, this.deviceWidth, contentAreaHeight);
        ctx.clip();
        ctx.drawImage(
            contentCanvas,
            0, deviceScrollOffset, this.deviceWidth, contentAreaHeight,
            0, this.chromeHeightDevice, this.deviceWidth, contentAreaHeight
        );
        ctx.restore();

        ctx.save();
        ctx.scale(this.deviceWidth / this.logicalWidth, scaleY);
        this._renderScrollbar(
            ctx,
            scrollOffset,
            this.chromeHeightLogical,
            this.logicalVisibleHeight - this.chromeHeightLogical,
            this.maxScrollOffset
        );
        ctx.restore();

        return canvas;
    }

    /**
     * Draw a compact desktop browser frame with a title bar, tab, address bar,
     * navigation controls, and a few small details that make the viewport feel
     * like a real browser instead of a generic UI panel.
     * @param {CanvasRenderingContext2D} ctx
     * @returns {number} Browser chrome height in logical pixels.
     */
    _renderBrowserChrome(ctx) {
        const titleBarHeight = 30;
        const tabBarHeight = 32;
        const addressBarHeight = 40;
        const chromeHeight = titleBarHeight + tabBarHeight + addressBarHeight;

        ctx.fillStyle = '#d9dde3';
        ctx.fillRect(0, 0, LOGICAL_WIDTH, titleBarHeight);
        ctx.fillStyle = '#c9ced6';
        ctx.fillRect(0, titleBarHeight, LOGICAL_WIDTH, tabBarHeight);

        const lightColors = ['#ff5f57', '#febc2e', '#28c840'];
        lightColors.forEach((color, index) => {
            const x = 24 + (index * 25);
            ctx.beginPath();
            ctx.arc(x, titleBarHeight / 2, 6.5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        ctx.fillStyle = '#737982';
        ctx.font = `12px ${FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.fillText('Rob Keys — Portfolio', LOGICAL_WIDTH / 2, 19);

        const tabX = 86;
        const tabY = titleBarHeight + 4;
        const tabWidth = 294;
        ctx.fillStyle = '#f7f7f8';
        this._roundRect(ctx, tabX, tabY, tabWidth, tabBarHeight - 2, [8, 8, 0, 0]);
        ctx.fill();
        this._drawFavicon(ctx, tabX + 18, tabY + 13, 5);
        ctx.fillStyle = '#32363c';
        ctx.font = `13px ${FONT_STACK}`;
        ctx.textAlign = 'left';
        ctx.fillText('Rob Keys — Portfolio', tabX + 32, tabY + 18);
        ctx.strokeStyle = '#9ba1aa';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tabX + tabWidth - 22, tabY + 10);
        ctx.lineTo(tabX + tabWidth - 14, tabY + 18);
        ctx.moveTo(tabX + tabWidth - 14, tabY + 10);
        ctx.lineTo(tabX + tabWidth - 22, tabY + 18);
        ctx.stroke();
        ctx.fillStyle = '#656b74';
        ctx.font = `20px ${FONT_STACK}`;
        ctx.fillText('+', tabX + tabWidth + 22, tabY + 18);

        const addressY = titleBarHeight + tabBarHeight;
        ctx.fillStyle = '#f7f7f8';
        ctx.fillRect(0, addressY, LOGICAL_WIDTH, addressBarHeight);
        ctx.strokeStyle = '#d0d3d8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, addressY + addressBarHeight - 0.5);
        ctx.lineTo(LOGICAL_WIDTH, addressY + addressBarHeight - 0.5);
        ctx.stroke();

        this._drawBackForwardReload(ctx, addressY + addressBarHeight / 2);
        const pillX = 148;
        const pillWidth = LOGICAL_WIDTH - pillX - 72;
        ctx.fillStyle = '#e9ecf0';
        this._roundRect(ctx, pillX, addressY + 7, pillWidth, addressBarHeight - 14, 15);
        ctx.fill();
        this._drawLock(ctx, pillX + 20, addressY + addressBarHeight / 2);
        ctx.fillStyle = '#434951';
        ctx.font = `13px ${FONT_STACK}`;
        ctx.fillText('robkeys.dev', pillX + 38, addressY + 25);
        ctx.fillStyle = '#7b828b';
        ctx.font = `14px ${FONT_STACK}`;
        ctx.fillText('⋮', LOGICAL_WIDTH - 32, addressY + 25);

        return chromeHeight;
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} radius */
    _drawFavicon(ctx, x, y, radius) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#bc7c42';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(7, radius + 2)}px ${FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.fillText('R', x, y + 3);
        ctx.textAlign = 'left';
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} y */
    _drawBackForwardReload(ctx, y) {
        ctx.strokeStyle = '#626a74';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const drawChevron = (x, direction) => {
            ctx.beginPath();
            ctx.moveTo(x + direction * 5, y - 6);
            ctx.lineTo(x - direction * 4, y);
            ctx.lineTo(x + direction * 5, y + 6);
            ctx.stroke();
        };
        drawChevron(29, -1);
        drawChevron(63, 1);
        ctx.beginPath();
        ctx.arc(98, y, 8, 0.25, Math.PI * 1.72);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(104, y - 6);
        ctx.lineTo(105, y - 1);
        ctx.lineTo(100, y - 2);
        ctx.stroke();
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y */
    _drawLock(ctx, x, y) {
        ctx.strokeStyle = '#68717b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y - 3, 4.5, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#68717b';
        this._roundRect(ctx, x - 5.5, y - 3, 11, 8, 2);
        ctx.fill();
    }

    /**
     * Draw the long portfolio page. The layout is intentionally compact so the
     * first viewport has a convincing hero, while the remaining sections reward
     * scrolling without making the page look like a text dump.
     * @param {CanvasRenderingContext2D} ctx
     * @returns {number} Final logical y position used to size the page canvas.
     */
    _renderContent(ctx) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f7f7f5';
        ctx.fillRect(0, 0, LOGICAL_WIDTH, 3200);

        let y = 42;
        this._drawPageHeader(ctx, y);
        y = 106;
        y = this._drawHero(ctx, y);
        y += 48;
        y = this._drawSectionIntro(ctx, 'What I bring', 'A practical toolkit for building dependable products.', y);
        y += 22;
        y = this._drawStrengthCards(ctx, y);
        y += 58;
        y = this._drawAboutPanel(ctx, y);
        y += 58;
        y = this._drawExperiencePanel(ctx, y);
        y += 58;
        y = this._drawEducationPanel(ctx, y);
        y += 58;
        y = this._drawContactPanel(ctx, y);
        return y + 52;
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} y */
    _drawPageHeader(ctx, y) {
        ctx.fillStyle = '#1e252c';
        ctx.font = `bold 17px ${FONT_STACK}`;
        ctx.fillText('ROB KEYS', PAGE_MARGIN, y);
        ctx.fillStyle = '#b6763f';
        ctx.fillRect(PAGE_MARGIN, y + 12, 34, 3);
        ctx.fillStyle = '#737b82';
        ctx.font = `14px ${FONT_STACK}`;
        ctx.textAlign = 'right';
        ctx.fillText('ABOUT   WORK   CONTACT', LOGICAL_WIDTH - PAGE_MARGIN, y);
        ctx.textAlign = 'left';
        ctx.strokeStyle = '#d9d9d4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAGE_MARGIN, y + 28);
        ctx.lineTo(LOGICAL_WIDTH - PAGE_MARGIN, y + 28);
        ctx.stroke();
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} startY */
    _drawHero(ctx, startY) {
        const cardX = 892;
        const cardY = startY + 18;
        const cardW = 316;
        const cardH = 184;

        ctx.fillStyle = '#b6763f';
        ctx.font = `bold 14px ${FONT_STACK}`;
        ctx.fillText('SOFTWARE ENGINEER / CLOUD SYSTEMS', PAGE_MARGIN, startY);
        ctx.fillStyle = '#1d252c';
        ctx.font = `bold 68px ${FONT_STACK}`;
        ctx.fillText('Rob Keys', PAGE_MARGIN, startY + 78);
        ctx.fillStyle = '#4d565d';
        ctx.font = `25px ${FONT_STACK}`;
        this._wrapText(ctx, 'Building calm systems for complex worlds.', PAGE_MARGIN, startY + 116, 720, 32);
        ctx.fillStyle = '#667079';
        ctx.font = `16px ${FONT_STACK}`;
        this._wrapText(
            ctx,
            'Software Development Engineer at Amazon Web Services, focused on scalable systems and thoughtful user experiences.',
            PAGE_MARGIN,
            startY + 174,
            710,
            23
        );

        ctx.fillStyle = '#26313a';
        this._roundRect(ctx, cardX, cardY, cardW, cardH, 10);
        ctx.fill();
        ctx.fillStyle = '#f4eee6';
        ctx.font = `bold 12px ${FONT_STACK}`;
        ctx.fillText('CURRENTLY EXPLORING', cardX + 24, cardY + 28);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 27px ${FONT_STACK}`;
        ctx.fillText('Reliable by design.', cardX + 24, cardY + 70);
        ctx.fillStyle = '#c4d0d7';
        ctx.font = `15px ${FONT_STACK}`;
        this._wrapText(ctx, 'Distributed systems, cloud architecture, and human-scale interfaces.', cardX + 24, cardY + 100, cardW - 48, 22);
        ctx.fillStyle = '#c88a53';
        ctx.fillRect(cardX + 24, cardY + 150, 46, 3);
        ctx.fillStyle = '#aebbc3';
        ctx.font = `12px ${FONT_STACK}`;
        ctx.fillText('AVAILABLE FOR GOOD PROBLEMS', cardX + 84, cardY + 155);

        return Math.max(startY + 208, cardY + cardH);
    }

    /** @param {CanvasRenderingContext2D} ctx @param {string} eyebrow @param {string} title @param {number} y */
    _drawSectionIntro(ctx, eyebrow, title, y) {
        ctx.fillStyle = '#b6763f';
        ctx.font = `bold 13px ${FONT_STACK}`;
        ctx.fillText(eyebrow.toUpperCase(), PAGE_MARGIN, y);
        ctx.fillStyle = '#20282f';
        ctx.font = `bold 32px ${FONT_STACK}`;
        ctx.fillText(title, PAGE_MARGIN, y + 40);
        return y + 40;
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} y */
    _drawStrengthCards(ctx, y) {
        const gap = 18;
        const cardW = (PAGE_WIDTH - (gap * 2)) / 3;
        const cards = [
            ['01', 'Cloud architecture', 'Scalable services, clear boundaries, and systems that hold up under pressure.'],
            ['02', 'Distributed thinking', 'A strong foundation in algorithms, consensus, and practical trade-offs.'],
            ['03', 'Security mindset', 'Privacy-aware software shaped by curiosity, care, and contextual thinking.']
        ];

        cards.forEach(([number, title, description], index) => {
            const x = PAGE_MARGIN + (index * (cardW + gap));
            ctx.fillStyle = '#ffffff';
            this._roundRect(ctx, x, y, cardW, 174, 9);
            ctx.fill();
            ctx.strokeStyle = '#d9dcd8';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = '#b6763f';
            ctx.font = `bold 13px ${FONT_STACK}`;
            ctx.fillText(number, x + 20, y + 28);
            ctx.fillStyle = '#273139';
            ctx.font = `bold 21px ${FONT_STACK}`;
            this._wrapText(ctx, title, x + 20, y + 66, cardW - 40, 25);
            ctx.fillStyle = '#69737a';
            ctx.font = `15px ${FONT_STACK}`;
            this._wrapText(ctx, description, x + 20, y + 108, cardW - 40, 21);
        });
        return y + 174;
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} y */
    _drawAboutPanel(ctx, y) {
        const height = 238;
        this._drawPanel(ctx, y, height);
        this._drawPanelLabel(ctx, 'ABOUT ME', y);
        ctx.fillStyle = '#20282f';
        ctx.font = `bold 29px ${FONT_STACK}`;
        ctx.fillText('A builder who likes the details.', PAGE_MARGIN + 28, y + 64);
        ctx.fillStyle = '#59646c';
        ctx.font = `17px ${FONT_STACK}`;
        this._wrapText(
            ctx,
            `Hi! I'm a ${MONITOR_CONTENT.profileSummary.toLowerCase()} I graduated from UVA with a B.S. in Computer Science, maintaining a 4.0 GPA while completing my degree in just three years.`,
            PAGE_MARGIN + 28,
            y + 104,
            690,
            25
        );
        this._drawMetric(ctx, LOGICAL_WIDTH - PAGE_MARGIN - 300, y + 48, '4.0', 'GPA');
        this._drawMetric(ctx, LOGICAL_WIDTH - PAGE_MARGIN - 150, y + 48, '3 yrs', 'TO DEGREE');
        return y + height;
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} y */
    _drawExperiencePanel(ctx, y) {
        const height = 246;
        this._drawPanel(ctx, y, height);
        this._drawPanelLabel(ctx, 'EXPERIENCE', y);
        ctx.fillStyle = '#20282f';
        ctx.font = `bold 25px ${FONT_STACK}`;
        ctx.fillText(MONITOR_CONTENT.company, PAGE_MARGIN + 28, y + 70);
        ctx.fillStyle = '#b6763f';
        ctx.font = `bold 14px ${FONT_STACK}`;
        ctx.fillText('SOFTWARE DEVELOPMENT ENGINEER  ·  2026 — PRESENT', PAGE_MARGIN + 28, y + 99);
        ctx.fillStyle = '#59646c';
        ctx.font = `17px ${FONT_STACK}`;
        this._wrapText(ctx, 'Building scalable cloud infrastructure and services that power businesses worldwide.', PAGE_MARGIN + 28, y + 140, 740, 25);
        ctx.fillStyle = '#edf0ed';
        this._roundRect(ctx, LOGICAL_WIDTH - PAGE_MARGIN - 300, y + 45, 300, 152, 8);
        ctx.fill();
        ctx.fillStyle = '#66727a';
        ctx.font = `bold 12px ${FONT_STACK}`;
        ctx.fillText('WORKING PRINCIPLES', LOGICAL_WIDTH - PAGE_MARGIN - 276, y + 73);
        ctx.fillStyle = '#26323a';
        ctx.font = `bold 17px ${FONT_STACK}`;
        ['Make it legible.', 'Leave it stronger.', 'Keep learning.'].forEach((text, index) => {
            ctx.fillText(text, LOGICAL_WIDTH - PAGE_MARGIN - 276, y + 106 + (index * 25));
        });
        return y + height;
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} y */
    _drawEducationPanel(ctx, y) {
        const height = 228;
        this._drawPanel(ctx, y, height);
        this._drawPanelLabel(ctx, 'EDUCATION', y);
        ctx.fillStyle = '#20282f';
        ctx.font = `bold 25px ${FONT_STACK}`;
        ctx.fillText('University of Virginia', PAGE_MARGIN + 28, y + 72);
        ctx.fillStyle = '#b6763f';
        ctx.font = `bold 14px ${FONT_STACK}`;
        ctx.fillText('B.S. COMPUTER SCIENCE', PAGE_MARGIN + 28, y + 100);
        const bullets = MONITOR_CONTENT.educationBullets;
        bullets.forEach((item, index) => {
            const x = 620 + ((index % 2) * 250);
            const bulletY = y + 72 + (Math.floor(index / 2) * 46);
            ctx.fillStyle = '#b6763f';
            ctx.beginPath();
            ctx.arc(x, bulletY - 5, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#59646c';
            ctx.font = `15px ${FONT_STACK}`;
            this._wrapText(ctx, item, x + 14, bulletY, 205, 20);
        });
        return y + height;
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} y */
    _drawContactPanel(ctx, y) {
        const height = 182;
        ctx.fillStyle = '#b6763f';
        this._roundRect(ctx, PAGE_MARGIN, y, PAGE_WIDTH, height, 10);
        ctx.fill();
        ctx.fillStyle = '#fff9f1';
        ctx.font = `bold 13px ${FONT_STACK}`;
        ctx.fillText('GET IN TOUCH', PAGE_MARGIN + 28, y + 35);
        ctx.font = `bold 31px ${FONT_STACK}`;
        ctx.fillText('Have a good problem?', PAGE_MARGIN + 28, y + 84);
        ctx.fillStyle = '#fff3e4';
        ctx.font = `17px ${FONT_STACK}`;
        ctx.fillText('rob_keys@outlook.com', PAGE_MARGIN + 28, y + 124);
        ctx.textAlign = 'right';
        ctx.font = `bold 14px ${FONT_STACK}`;
        ctx.fillText('robkeys.dev  ↗', LOGICAL_WIDTH - PAGE_MARGIN - 28, y + 124);
        ctx.textAlign = 'left';
        return y + height;
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} y @param {number} height */
    _drawPanel(ctx, y, height) {
        ctx.fillStyle = '#ffffff';
        this._roundRect(ctx, PAGE_MARGIN, y, PAGE_WIDTH, height, 10);
        ctx.fill();
        ctx.strokeStyle = '#d9dcd8';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    /** @param {CanvasRenderingContext2D} ctx @param {string} label @param {number} y */
    _drawPanelLabel(ctx, label, y) {
        ctx.fillStyle = '#b6763f';
        ctx.font = `bold 13px ${FONT_STACK}`;
        ctx.fillText(label, PAGE_MARGIN + 28, y + 30);
        ctx.strokeStyle = '#eceeea';
        ctx.beginPath();
        ctx.moveTo(PAGE_MARGIN + 28, y + 42);
        ctx.lineTo(LOGICAL_WIDTH - PAGE_MARGIN - 28, y + 42);
        ctx.stroke();
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {string} value @param {string} label */
    _drawMetric(ctx, x, y, value, label) {
        ctx.fillStyle = '#b6763f';
        ctx.font = `bold 31px ${FONT_STACK}`;
        ctx.fillText(value, x, y + 32);
        ctx.fillStyle = '#8a9297';
        ctx.font = `bold 11px ${FONT_STACK}`;
        ctx.fillText(label, x, y + 53);
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} scrollOffset @param {number} chromeHeight @param {number} contentHeight @param {number} maxScroll */
    _renderScrollbar(ctx, scrollOffset, chromeHeight, contentHeight, maxScroll) {
        const barWidth = 7;
        const barHeight = 56;
        const travel = Math.max(0, contentHeight - barHeight);
        const barY = chromeHeight + (maxScroll === 0 ? 0 : (Math.max(0, Math.min(maxScroll, scrollOffset)) / maxScroll) * travel);
        ctx.fillStyle = 'rgba(43, 51, 58, 0.24)';
        this._roundRect(ctx, LOGICAL_WIDTH - 14, barY, barWidth, barHeight, 4);
        ctx.fill();
    }

    /**
     * Return the exact scroll range for the currently rendered page.
     * @returns {number} Maximum scroll offset in logical pixels.
     */
    getMaxScrollOffset() {
        this._build();
        return this.maxScrollOffset;
    }

    /**
     * Build a rounded rectangle path; the caller fills or strokes it.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number|number[]} radius
     */
    _roundRect(ctx, x, y, width, height, radius) {
        const radii = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
        ctx.beginPath();
        ctx.moveTo(x + radii[0], y);
        ctx.lineTo(x + width - radii[1], y);
        ctx.arcTo(x + width, y, x + width, y + radii[1], radii[1]);
        ctx.lineTo(x + width, y + height - radii[2]);
        ctx.arcTo(x + width, y + height, x + width - radii[2], y + height, radii[2]);
        ctx.lineTo(x + radii[3], y + height);
        ctx.arcTo(x, y + height, x, y + height - radii[3], radii[3]);
        ctx.lineTo(x, y + radii[0]);
        ctx.arcTo(x, y, x + radii[0], y, radii[0]);
        ctx.closePath();
    }

    /**
     * Wrap text at word boundaries without changing the current font.
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @param {number} maxWidth
     * @param {number} lineHeight
     * @returns {number} Baseline after the final line.
     */
    _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(/\s+/);
        let line = '';
        let currentY = y;
        words.forEach((word, index) => {
            const candidate = line ? `${line} ${word}` : word;
            if (ctx.measureText(candidate).width > maxWidth && line) {
                ctx.fillText(line, x, currentY);
                line = word;
                currentY += lineHeight;
            } else {
                line = candidate;
            }
            if (index === words.length - 1 && line) ctx.fillText(line, x, currentY);
        });
        return currentY;
    }
}
