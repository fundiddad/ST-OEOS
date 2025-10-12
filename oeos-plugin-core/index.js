// Main entry point for the OEOS AI-driven plugin. Imports and initializes all other modules.

import { injectAndSetupSwapper } from './ui.js';
import './plugin-bridge.js';

// Self-executing function to initialize the plugin
(function () {
    // toastr.success('[OEOS] Main plugin module loaded.');
    // AI 回复监听已在 plugin-bridge.js 中设置
    // Setup the UI components.
    injectAndSetupSwapper();
})();
