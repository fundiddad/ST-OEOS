// SillyTavern-release/public/scripts/extensions/third-party/oeos/ui.js

let isAppLoaded = false;
const extensionName = "OEOS Interface";
const extensionFolderPath = `scripts/extensions/third-party/oeos-st-extension`;
const extensionUrl = `/${extensionFolderPath}`;

/**
 * Function to dynamically load scripts.
 * @param {string} src The script source URL.
 * @returns {Promise<void>}
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = (err) => {
            console.error(`Failed to load script: ${src}`, err);
            reject(err);
        };
        document.head.appendChild(script);
    });
}

/**
 * Injects the OEOS button and panel, and sets up the swapping logic.
 */
export function injectAndSetupSwapper() {
    const sheld = document.getElementById('sheld');
    const chat = document.getElementById('chat');
    if (!sheld || !chat) {
        console.error(`${extensionName}: #sheld or #chat not found.`);
        return;
    }

    // 1. Create OEOS UI Container and place it right after the chat element.
    const oeosMainContainer = document.createElement('div');
    oeosMainContainer.id = 'oeos-main-container';
    Object.assign(oeosMainContainer.style, {
        display: 'none', // Hidden by default
        flexGrow: '1',   // Will take up available space like #chat does
        flexDirection: 'column',
        overflow: 'hidden',
    });

    const appRoot = document.createElement('div');
    appRoot.id = 'app'; // 修正：改为 'app' 以匹配 Vue 挂载点
    appRoot.style.height = '100%';
    appRoot.style.width = '100%';
    appRoot.style.backgroundColor = '#1e1e1e';
    oeosMainContainer.appendChild(appRoot);
    chat.parentNode.insertBefore(oeosMainContainer, chat.nextSibling);

    // 2. Create and inject the rocket icon button
    const leftSendForm = document.getElementById('leftSendForm');
    const optionsButton = document.getElementById('options_button');
    if (!leftSendForm || !optionsButton) {
        console.error(`${extensionName}: #leftSendForm or #options_button not found.`);
        return;
    }

    const toggleButton = document.createElement('div');
    toggleButton.id = 'toggle_oeos_button';
    toggleButton.className = 'fa-solid fa-rocket fa-fw interactable';
    toggleButton.title = 'Toggle OEOS Interface';
    optionsButton.parentNode.insertBefore(toggleButton, optionsButton.nextSibling);

    // 3. Implement click-to-swap logic
    toggleButton.addEventListener('click', () => {
        const chatContainer = document.getElementById('chat');
        const oeosContainer = document.getElementById('oeos-main-container');
        const isOeosVisible = oeosContainer.style.display === 'flex';

        if (isOeosVisible) {
            oeosContainer.style.display = 'none';
            chatContainer.style.display = '';
        } else {
            chatContainer.style.display = 'none';
            oeosContainer.style.display = 'flex';

            if (!isAppLoaded) {
                console.log(`${extensionName}: First open, loading Vue app...`);
                loadScript(`${extensionUrl}/js/app.js`).catch(err => {
                    console.error(`${extensionName}: Vue app failed to load.`, err);
                });
                isAppLoaded = true;
            }
        }
    });

    console.log(`${extensionName}: OEOS swapper injected successfully.`);
}

