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
    // 复制 #chat 的计算样式以确保完全一致
    const chatStyles = window.getComputedStyle(chat);

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
    Object.assign(appRoot.style, {
        width: '100%',
        height: '100%',
        backgroundColor: '#1e1e1e',
    });
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
    toggleButton.title = 'OEOS Menu';
    optionsButton.parentNode.insertBefore(toggleButton, optionsButton.nextSibling);

    // 3. 创建二级菜单（使用 SillyTavern 原生样式）
    const oeosMenu = document.createElement('div');
    oeosMenu.id = 'oeos-menu';
    oeosMenu.style.cssText = `
        display: none;
        position: absolute;
        background-color: var(--SmartThemeBlurTintColor);
        border: 1px solid var(--SmartThemeBorderColor);
        border-radius: 10px;
        box-shadow: 0 0 20px var(--black70a);
        z-index: 10000;
        min-width: 180px;
        padding: 10px;
        gap: 5px;
        flex-direction: column;
    `;

    // 菜单项：返回角色选择
    const menuItemReturn = document.createElement('div');
    menuItemReturn.className = 'menu_button menu_button_icon';
    menuItemReturn.innerHTML = '<i class="fa-solid fa-users fa-fw"></i><span>返回角色选择</span>';
    menuItemReturn.addEventListener('click', () => {
        oeosMenu.style.display = 'none';
        if (window.oeosVueApp && window.oeosVueApp.returnToCharacterSelection) {
            window.oeosVueApp.returnToCharacterSelection();
        } else {
            console.warn('[OEOS] Vue app not ready yet');
        }
    });

    // 菜单项：关闭OEOS
    const menuItemClose = document.createElement('div');
    menuItemClose.className = 'menu_button menu_button_icon';
    menuItemClose.innerHTML = '<i class="fa-solid fa-times-circle fa-fw"></i><span>关闭OEOS</span>';
    menuItemClose.addEventListener('click', () => {
        oeosMenu.style.display = 'none';

        // 先返回角色选择界面（清理游戏状态，停止播放器）
        if (window.oeosVueApp && window.oeosVueApp.returnToCharacterSelection) {
            window.oeosVueApp.returnToCharacterSelection();
        } else {
            console.warn('[OEOS] Vue app not ready yet');
        }

        // 短暂延迟后执行彻底关闭操作（确保 Vue 完成状态更新和组件卸载）
        // 延迟时间很短，用户不会看到角色选择界面的闪现
        setTimeout(() => {
            if (window.oeosVueApp && window.oeosVueApp.closeOEOS) {
                window.oeosVueApp.closeOEOS();
            } else {
                console.warn('[OEOS] Vue app not ready for close');
            }
        }, 50);
    });

    oeosMenu.appendChild(menuItemReturn);
    oeosMenu.appendChild(menuItemClose);
    document.body.appendChild(oeosMenu);

    // 4. 火箭按钮点击显示/隐藏菜单
    toggleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const chatContainer = document.getElementById('chat');
        const oeosContainer = document.getElementById('oeos-main-container');
        const isOeosVisible = oeosContainer.style.display === 'flex';

        if (isOeosVisible) {
            // OEOS已打开，显示菜单
            const rect = toggleButton.getBoundingClientRect();
            // 计算菜单高度（如果菜单还没显示过，先临时显示来获取高度）
            const wasHidden = oeosMenu.style.display === 'none';
            if (wasHidden) {
                oeosMenu.style.visibility = 'hidden';
                oeosMenu.style.display = 'block';
            }
            const menuHeight = oeosMenu.offsetHeight;
            if (wasHidden) {
                oeosMenu.style.display = 'none';
                oeosMenu.style.visibility = 'visible';
            }

            // 菜单显示在按钮上方
            oeosMenu.style.left = `${rect.left}px`;
            oeosMenu.style.top = `${rect.top - menuHeight - 5}px`;
            oeosMenu.style.display = oeosMenu.style.display === 'block' ? 'none' : 'block';
        } else {
            // OEOS未打开，直接打开OEOS
            chatContainer.style.display = 'none';
            oeosContainer.style.display = 'flex';

            if (!isAppLoaded) {
                console.log(`${extensionName}: First open, loading Vue app...`);
                // 暂时屏蔽全局 window.Vue，避免第三方库基于 window.Vue 的自动安装逻辑
                const __oeos_prev_global_vue__ = window.Vue;
                try {
                    window.Vue = undefined;
                } catch (e) {
                    // 某些环境下 window.Vue 可能是只读，忽略
                }

                loadScript(`${extensionUrl}/js/app.js`)
                    .catch(err => {
                        console.error(`${extensionName}: Vue app failed to load.`, err);
                    })
                    .finally(() => {
                        // 还原原始的全局 Vue 引用（如果有）
                        try {
                            window.Vue = __oeos_prev_global_vue__;
                        } catch (e) {}
                    });
                isAppLoaded = true;
            }
        }
    });

    // 5. 点击其他地方关闭菜单
    document.addEventListener('click', (e) => {
        if (!oeosMenu.contains(e.target) && e.target !== toggleButton) {
            oeosMenu.style.display = 'none';
        }
    });

    // 6. 监听来自Vue应用的销毁请求（彻底关闭OEOS）
    window.addEventListener('oeos-destroy-request', () => {
        // 1. 销毁 Vue 实例
        if (window.oeosVueInstance) {
            window.oeosVueInstance.$destroy();
            window.oeosVueInstance = null;
        }

        // 2. 清空挂载点
        const appRoot = document.getElementById('app');
        if (appRoot) {
            appRoot.innerHTML = '';
        }

        // 3. 隐藏 OEOS 容器
        const chatContainer = document.getElementById('chat');
        const oeosContainer = document.getElementById('oeos-main-container');
        oeosContainer.style.display = 'none';
        chatContainer.style.display = '';

        // 4. 重置加载标志，下次打开时重新加载
        isAppLoaded = false;

        // 5. 清空 oeosVueApp 引用
        window.oeosVueApp = null;

        console.log(`${extensionName}: OEOS destroyed successfully.`);
    });

    console.log(`${extensionName}: OEOS swapper injected successfully.`);
}

