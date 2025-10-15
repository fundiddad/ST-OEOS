// Main entry point for the OEOS AI-driven plugin. Imports and initializes all other modules.

import { injectAndSetupSwapper } from './ui.js';
import './plugin-bridge.js';

// Self-executing function to initialize the plugin
(function () {
     console.log('[OEOS] Main plugin module loaded.');

    injectAndSetupSwapper();
})();
