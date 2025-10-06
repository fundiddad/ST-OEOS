// SillyTavern-release/public/scripts/extensions/third-party/oeos/loader.js

import { injectAndSetupSwapper } from './ui.js';

// IIFE to keep scope clean
(function () {
    // Wait for SillyTavern to be ready before injecting our UI
    const readyInterval = setInterval(() => {
        // We check for a known element to ensure the core UI is ready
        if (document.getElementById('chat')) {
            clearInterval(readyInterval);
            injectAndSetupSwapper();
            console.log('OEOS UI loader executed.');
        }
    }, 100);
})();

