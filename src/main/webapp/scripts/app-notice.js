(function () {
    'use strict';

    const STYLE_ID = 'rd-app-notice-styles';
    const OVERLAY_ID = 'rdAppNoticeOverlay';

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .rd-notice-overlay {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                background: rgba(8, 10, 16, 0.58);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                z-index: 9999;
                animation: rdFadeIn .2s ease-out;
            }
            .rd-notice-window {
                width: min(560px, 96vw);
                border-radius: 18px;
                overflow: hidden;
                background: #ffffff;
                border: 1px solid rgba(196, 30, 58, 0.22);
                box-shadow: 0 24px 65px rgba(0, 0, 0, 0.35);
                transform: translateY(8px) scale(0.98);
                animation: rdPopIn .22s ease-out forwards;
            }
            .rd-notice-head {
                background: linear-gradient(135deg, #c41e3a 0%, #8b0000 100%);
                color: #fff;
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 16px 20px;
                font-weight: 700;
                font-size: 1.05rem;
                letter-spacing: 0.2px;
            }
            .rd-notice-icon {
                width: 32px;
                height: 32px;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.18);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 1rem;
            }
            .rd-notice-body {
                padding: 20px;
                color: #1f2937;
                line-height: 1.6;
                font-size: 1rem;
            }
            .rd-notice-foot {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding: 0 20px 20px;
            }
            .rd-notice-btn {
                border: none;
                border-radius: 10px;
                padding: 11px 20px;
                font-size: 0.92rem;
                font-weight: 700;
                color: #fff;
                background: linear-gradient(135deg, #c41e3a 0%, #8b0000 100%);
                box-shadow: 0 8px 20px rgba(196, 30, 58, 0.35);
                cursor: pointer;
                transition: transform .12s ease, box-shadow .12s ease;
            }
            .rd-notice-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 10px 24px rgba(196, 30, 58, 0.42);
            }
            .rd-notice-btn:active {
                transform: translateY(0);
            }
            .rd-notice-btn-secondary {
                background: #e5e7eb;
                color: #1f2937;
                box-shadow: none;
            }
            .rd-notice-btn-secondary:hover {
                background: #d1d5db;
                transform: translateY(-1px);
                box-shadow: none;
            }
            @keyframes rdFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes rdPopIn {
                from { opacity: 0; transform: translateY(8px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
        `;

        document.head.appendChild(style);
    }

    function closeNotice(onConfirm) {
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) overlay.remove();
        if (typeof onConfirm === 'function') onConfirm();
    }

    function show(message, options) {
        ensureStyles();

        const current = document.getElementById(OVERLAY_ID);
        if (current) current.remove();

        const opts = options || {};
        const title = opts.title || 'Red Damien APS';
        const buttonText = opts.buttonText || 'Continue';
        const showSecondaryButton = !!opts.secondaryButtonText;
        const secondaryButtonText = opts.secondaryButtonText || 'Cancel';
        const onConfirm = opts.onConfirm;
        const onSecondary = opts.onSecondary;

        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'rd-notice-overlay';
        overlay.innerHTML = `
            <div class="rd-notice-window" role="dialog" aria-modal="true" aria-label="${title}">
                <div class="rd-notice-head">
                    <span class="rd-notice-icon">🎬</span>
                    <span>${title}</span>
                </div>
                <div class="rd-notice-body"></div>
                <div class="rd-notice-foot">
                    ${showSecondaryButton ? `<button type="button" class="rd-notice-btn rd-notice-btn-secondary">${secondaryButtonText}</button>` : ''}
                    <button type="button" class="rd-notice-btn">${buttonText}</button>
                </div>
            </div>
        `;

        overlay.querySelector('.rd-notice-body').textContent = message;

        const confirmBtn = overlay.querySelector('.rd-notice-btn');
        confirmBtn.addEventListener('click', function () {
            closeNotice(onConfirm);
        });

        const secondaryBtn = overlay.querySelector('.rd-notice-btn-secondary');
        if (secondaryBtn) {
            secondaryBtn.addEventListener('click', function () {
                closeNotice(onSecondary);
            });
        }

        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) {
                closeNotice(onConfirm);
            }
        });

        document.body.appendChild(overlay);
    }

    function confirm(message, options) {
        const opts = options || {};
        show(message, {
            title: opts.title || 'Please Confirm',
            buttonText: opts.confirmText || 'Confirm',
            secondaryButtonText: opts.cancelText || 'Cancel',
            onConfirm: opts.onConfirm,
            onSecondary: opts.onCancel
        });
    }

    function installAlertOverride() {
        if (window.__rdAlertOverridden) return;
        window.__rdAlertOverridden = true;

        const nativeAlert = window.alert ? window.alert.bind(window) : null;

        window.alert = function (message) {
            try {
                show(String(message || ''), {
                    title: 'Notice',
                    buttonText: 'OK'
                });
            } catch (error) {
                if (nativeAlert) nativeAlert(message);
            }
        };
    }

    installAlertOverride();

    window.AppNotice = { show, confirm };
})();
