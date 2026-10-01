(function() {
    if (
        (!window.location.hostname.includes('39chan') && !window.location.hostname.includes('localhost') && window.location.protocol !== 'file:') ||
        
        window.__wm ||
        
        window.location.pathname.startsWith('/web/') ||
        
        window.location.hostname.includes('archive.org') ||
        window.location.hostname.includes('archive.is')
    ) {
        return; 
    }

    if (localStorage.getItem('verification')) return;

    const style = document.createElement('style');
    style.textContent = `
        /* Overlay container */
        #age-gate-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(10, 10, 10, 0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 999999;
            font-family: Verdana, Geneva, Tahoma, sans-serif;
        }

        .age-gate-modal {
            background-color: #181818;
            border: 1px solid #333;
            max-width: 420px;
            width: 90%;
            text-align: center;
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.6);
        }

        .age-gate-title {
            background-color: #181818;
            border-bottom: 1px solid #333;
            padding: 6px 10px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
            color: #ddd;
            text-align: left;
        }

        .age-gate-body {
            padding: 25px 30px 30px;
        }

        .age-gate-logo {
            display: block;
            max-width: 200px;
            width: 100%;
            height: auto;
            margin: 0 auto 18px;
        }

        .age-gate-modal p {
            color: #ddd;
            font-size: 11px;
            line-height: 1.6;
            margin-bottom: 20px;
        }

        .age-gate-modal p strong {
            color: #ff009c;
        }

        /* Buttons */
        .age-gate-btns {
            display: flex;
            gap: 10px;
            justify-content: center;
        }

        .age-btn {
            padding: 10px 20px;
            border: 1px solid transparent;
            cursor: pointer;
            font-weight: bold;
            text-transform: uppercase;
            font-family: Verdana, Geneva, Tahoma, sans-serif;
            font-size: 10px;
            letter-spacing: 0.5px;
        }

        .age-confirm {
            background: transparent;
            border-color: #ff009c;
            color: #ff009c;
        }

        .age-confirm:hover:not(:disabled) {
            background: #ff009c;
            color: #181818;
        }

        .age-confirm:disabled {
            border-color: #333;
            color: #999;
            cursor: not-allowed;
        }

        .age-exit {
            background: transparent;
            border-color: #333;
            color: #999;
        }

        .age-exit:hover {
            border-color: #999;
            color: #ddd;
        }

        .age-gate-blur {
            filter: blur(20px) !important;
            pointer-events: none !important;
            user-select: none !important;
        }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'age-gate-overlay';
    overlay.innerHTML = `
        <div class="age-gate-modal">
            <div class="age-gate-title">Are you 18+?</div>
            <div class="age-gate-body">
                <img src="/items/stoprightthere.png" class="age-gate-logo">
                <p>
                    We support open discussion, therefore some threads may contain mature or explicit content. By entering, you confirm that you are <strong>18+</strong> and acknowledge that <strong>we are not responsible</strong> for user-generated content or opinions posted on this site. For more information visit our FAQ or Rules page.
                </p>
                </p>
                <div class="age-gate-btns">
                    <button class="age-btn age-confirm" id="age-gate-yes" disabled>I Understand (5)</button>
                    <button class="age-btn age-exit" id="age-gate-no">Leave</button>
                </div>
            </div>
        </div>
    `;

    document.addEventListener('DOMContentLoaded', function() {
        const wrapper = document.querySelector('.site-wrapper');
        
        if (wrapper) wrapper.classList.add('age-gate-blur');
        
        document.body.appendChild(overlay);

        const enterBtn = document.getElementById('age-gate-yes');
        let timeLeft = 5;

        const countdownTimer = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                enterBtn.textContent = `I Understand (${timeLeft})`;
            } else {
                clearInterval(countdownTimer);
                enterBtn.textContent = 'I Understand';
                enterBtn.disabled = false;
            }
        }, 1000);

        enterBtn.addEventListener('click', function() {
            localStorage.setItem('verification', 'true');
            overlay.remove();
            if (wrapper) wrapper.classList.remove('age-gate-blur');
        });

        document.getElementById('age-gate-no').addEventListener('click', function() {
            window.location.href = "https://www.google.com";
        });
    });
})();