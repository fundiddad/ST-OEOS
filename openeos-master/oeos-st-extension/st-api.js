// Abstraction layer for all direct interactions with SillyTavern's core APIs (World Info, EventSource, etc.).

import { eventSource } from '../../../../../SillyTavern-release/public/scripts/script.js';
import { saveWorldInfo, loadWorldInfo } from '../../../../../SillyTavern-release/public/scripts/world-info.js';

/**
 * Saves content to a World Info entry.
 * @param {string} name - The name of the World Info entry.
 * @param {string} content - The content to save.
 */
export async function saveWi(name, content) {
    await saveWorldInfo(name, content, true);
}

/**
 * Loads content from a World Info entry.
 * @param {string} name - The name of the World Info entry.
 * @returns {Promise<string>} - The content of the World Info entry.
 */
export async function loadWi(name) {
    return await loadWorldInfo(name);
}

/**
 * Listens for the completion of an AI response.
 * @param {function} callback - The function to execute when the AI response is complete.
 */
export function listenToAiResponse(callback) {
    eventSource.on('chat_completion_stream_finish', callback);
}
