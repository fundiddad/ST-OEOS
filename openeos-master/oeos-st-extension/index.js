// Main entry point for the OEOS AI-driven plugin. Imports and initializes all other modules.

import './plugin-bridge.js';
import { listenToAiResponse } from './st-api.js';
import { updatePageEntry } from './game-state.js';
import { chat } from '../../../../../SillyTavern-release/public/scripts/script.js';

/**
 * Handles the AI's final response, parsing it for OEOS content.
 * @param {object} data - The event data from the AI response.
 */
function handleAiResponse(data) {
    // The last message in the chat array is the one we just received.
    const lastMessage = chat[chat.length - 1];
    if (!lastMessage || !lastMessage.mes) {
        return;
    }

    const aiResponseText = lastMessage.mes;

    // Regex to capture the page id, its content, and the abstract.
    const pageRegex = /<oeos page id="([^"]+)">([\s\S]*?)<\/oeos page>[\s\S]*?<oeos abstract>([\s\S]*?)<\/oeos abstract>/im;
    const match = aiResponseText.match(pageRegex);

    if (match) {
        const [, id, content, abstract] = match;
        console.log(`[OEOS] New page captured: ${id}`);

        // 1. Update World Info with the new page data.
        // We don't need to wait for this to complete.
        window.stOeosPlugin.updatePage(id.trim(), content.trim(), abstract.trim());

        // 2. Modify the message displayed in the chat to be just the pretty abstract.
        const formattedAbstract = `**${id.trim().toUpperCase()}**: ${abstract.trim()}`;
        lastMessage.mes = formattedAbstract;

        // Note: We are directly modifying the `chat` array object.
        // SillyTavern's UI will reflect this change automatically.
    }
}


// Self-executing function to initialize the plugin
(function () {
    console.log('[OEOS] Main plugin module loaded.');
    // Start listening for AI responses.
    listenToAiResponse(handleAiResponse);
})();
