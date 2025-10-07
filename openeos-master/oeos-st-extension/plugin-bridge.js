// Creates the global 'window.stOeosPlugin' object, providing a clean API for the OEOS player to interact with the plugin.

import { updateStateEntry, updatePageEntry } from './game-state.js';
import { recalculateDynamicContext } from './context-engine.js';
import { loadWi, saveWi } from './st-api.js';

const WI_ENTRIES = [
    'WI-OEOS-Pages',
    'WI-OEOS-State',
    'WI-OEOS-Graph',
    'WI-OEOS-Abstracts',
    'WI-OEOS-DynamicContext'
];

/**
 * Initializes the World Info entries required for the OEOS game.
 * Creates them if they don't exist.
 */
async function initGameData() {
    console.log('[OEOS] Initializing game data...');
    for (const entryName of WI_ENTRIES) {
        let content = await loadWi(entryName);
        if (content === null || content === undefined) {
            console.log(`[OEOS] Creating World Info entry: ${entryName}`);
            await saveWi(entryName, '');
        }
    }
    // Ensure a default start page exists
    let pagesContent = await loadWi('WI-OEOS-Pages');
    if (!pagesContent.includes('<oeos page id="start">')) {
        const startPage = '<oeos page id="start">\n- say: "The adventure begins..."\n- choice:\n  - "Explore the forest":\n    - goto: forest\n  - "Visit the village":\n    - goto: village\n</oeos page>';
        await saveWi('WI-OEOS-Pages', pagesContent + startPage);
        const startAbstract = 'start: The adventure begins...;\n';
        const abstracts = await loadWi('WI-OEOS-Abstracts');
        await saveWi('WI-OEOS-Abstracts', abstracts + startAbstract);
    }
     const startState = 'start(initialized:1)';
     await saveWi('WI-OEOS-State', startState);

    console.log('[OEOS] Game data initialized.');
}


/**
 * Retrieves the OEOScript source for a specific page ID.
 * @param {string} pageId - The ID of the page to retrieve.
 * @returns {Promise<string|null>} - The OEOScript content or null if not found.
 */
async function getPage(pageId) {
    const pagesContent = await loadWi('WI-OEOS-Pages');
    const regex = new RegExp(`<oeos page id="${pageId}">([\\s\\S]*?)<\\/oeos page>`, 'i');
    const match = pagesContent.match(regex);
    return match ? match[1].trim() : null;
}

/**
 * Handles the state update from the OEOS player and triggers context recalculation.
 * @param {object} newState - The new state from the player.
 */
async function updateState(newState) {
    await updateStateEntry(newState);
    await recalculateDynamicContext();
}


// Create the global bridge object
window.stOeosPlugin = {
    initGameData,
    getPage,
    updateState,
    updatePage: updatePageEntry, // Directly expose the function
};

console.log('[OEOS] Plugin bridge initialized.');
