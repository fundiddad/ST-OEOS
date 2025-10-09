// Contains the core logic for dynamically generating the AI's context based on the current game state.

import { saveWi, loadWi } from './st-api.js';

/**
 * Parses the state string into a list of page IDs.
 * e.g., "start(...) > A(hp:100) > B(...)" -> ['start', 'A', 'B']
 * @param {string} stateString - The state string from WI-OEOS-State.
 * @returns {string[]} - An array of page IDs in chronological order.
 */
function parseStatePath(stateString) {
    if (!stateString) return [];
    // Match the page ID part (e.g., "start", "A", "B") from each segment.
    const matches = stateString.match(/(\w+)\s*\(/g) || [];
    // Clean up the matches to get just the ID.
    return matches.map(match => match.replace('(', '').trim());
}

/**
 * Parses the graph string into a Map for easy lookup.
 * e.g., "S > A1, A2; A1 > B1;" -> Map { 'S' => ['A1', 'A2'], 'A1' => ['B1'] }
 * @param {string} graphString - The graph string from WI-OEOS-Graph.
 * @returns {Map<string, string[]>} - A map of page IDs to their children.
 */
function parseGraph(graphString) {
    const graph = new Map();
    if (!graphString) return graph;

    const entries = graphString.split(';').filter(Boolean);
    for (const entry of entries) {
        const [parent, childrenStr] = entry.split('>').map(s => s.trim());
        if (parent && childrenStr) {
            const children = childrenStr.split(',').map(s => s.trim());
            graph.set(parent, children);
        }
    }
    return graph;
}

/**
 * Extracts the full OEOScript source code for a specific page ID from the main pages content.
 * @param {string} pagesContent - The entire content of the WI-OEOS-Pages entry.
 * @param {string} pageId - The ID of the page to extract.
 * @returns {string|null} - The full source code of the page, or null if not found.
 */
function extractPageSource(pagesContent, pageId) {
    // This regex looks for a page block and captures its full content, including the tags.
    const regex = new RegExp(`<oeos page id="${pageId}">[\\s\\S]*?<\\/oeos page>`, 'i');
    const match = pagesContent.match(regex);
    return match ? match[0] : null;
}

/**
 * This is the core engine. It recalculates the dynamic context for the AI
 * based on the player's current position and history.
 */
export async function recalculateDynamicContext() {
    // 1. Get all necessary data
    const [stateContent, graphContent, pagesContent] = await Promise.all([
        loadWi('WI-OEOS-State'),
        loadWi('WI-OEOS-Graph'),
        loadWi('WI-OEOS-Pages')
    ]);

    const statePath = parseStatePath(stateContent);
    const graph = parseGraph(graphContent);

    if (statePath.length === 0) {
        // Not enough data to build a context
        return;
    }

    // 2. Identify "seed" pages
    const currentPageId = statePath[statePath.length - 1];
    const futurePageIds = graph.get(currentPageId) || [];
    const historicalPageIds = statePath.slice(-5); // Last 5 pages including current

    let allRelevantIds = new Set([...futurePageIds, ...historicalPageIds]);

    // 3. Expand historical context
    for (const id of historicalPageIds) {
        const historicalChildren = graph.get(id) || [];
        for (const childId of historicalChildren) {
            allRelevantIds.add(childId);
        }
    }

    // 4. Aggregate, extract, and generate final content
    let finalContentBlock = '';
    for (const id of allRelevantIds) {
        const pageSource = extractPageSource(pagesContent, id);
        if (pageSource) {
            finalContentBlock += pageSource + '\n\n';
        }
    }

    // 5. Save the newly generated context
    await saveWi('WI-OEOS-DynamicContext', finalContentBlock.trim());
    toastr.info(`[OEOS] DynamicContext recalculated for page: ${currentPageId}.`);
    console.log(`[OEOS] DynamicContext recalculated for page: ${currentPageId}.`);
}
