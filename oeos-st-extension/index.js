// Main entry point for the OEOS AI-driven plugin. Imports and initializes all other modules.

import { injectAndSetupSwapper } from './ui.js';
import { loadOEOSTranslations } from './i18n-loader.js';
import './plugin-bridge.js';

// Self-executing function to initialize the plugin
(async function () {
     console.log('[OEOS] Main plugin module loaded.');

    // 加载翻译文件
    await loadOEOSTranslations();

    injectAndSetupSwapper();
})();
