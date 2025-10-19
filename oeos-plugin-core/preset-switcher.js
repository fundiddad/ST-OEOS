// Handles the logic for automatically switching character presets.

import { getPresetManagerSafe, getPresetByName } from './st-api.js';

const OEOS_PRESET_NAME = '小猫之神-oeos';

// In-memory cache to store the last used preset for each character.
// key: characterId, value: presetName
const lastPresetCache = {};

/**
 * Gets the currently active preset name.
 * Uses SillyTavern PresetManager API instead of poking script settings directly.
 * @returns {string|null} The active preset name or null if not found.
 */
function getActivePresetName() {
    const manager = getPresetManagerSafe();
    try {
        return manager?.getSelectedPresetName?.() ?? null;
    } catch {
        return null;
    }
}

/**
 * Switches the active preset to the given name.
 * Relies on PresetManager.selectPreset rather than mutating script.js settings.
 * @param {string} presetName The name of the preset to switch to.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function switchPresetTo(presetName) {
    const manager = getPresetManagerSafe();
    if (!manager) {
        console.warn('[OEOS] PresetManager not available, cannot switch preset.');
        return false;
    }

    // Check if the preset exists before switching.
    const presetExists = getPresetByName(presetName);
    if (!presetExists) {
        console.warn(`[OEOS] Preset "${presetName}" not found. Cannot switch.`);
        toastr?.warning?.(`OEOS: Preset "${presetName}" not found. Please import it first.`);
        return false;
    }

    try {
        // Find the option value in the select and switch via the manager API
        const optionValue = manager.findPreset?.(presetName);
        if (optionValue === undefined || optionValue === null) {
            throw new Error(`Preset option value for '${presetName}' not found.`);
        }
        manager.selectPreset?.(optionValue);
        console.log(`[OEOS] Switched preset to "${presetName}".`);
        return true;
    } catch (error) {
        console.error(`[OEOS] Failed to switch preset to "${presetName}":`, error);
        return false;
    }
}

/**
 * Saves the last used preset for a character.
 * @param {string|number} characterId The character's ID.
 * @param {string} presetName The name of the preset.
 */
function saveLastPreset(characterId, presetName) {
    if (presetName !== OEOS_PRESET_NAME) {
        lastPresetCache[characterId] = presetName;
        console.log(`[OEOS] Saved last preset for char ${characterId}: "${presetName}"`);
    }
}

/**
 * Restores the last used preset for a character.
 * @param {string|number} characterId The character's ID.
 * @returns {Promise<void>}
 */
async function restoreLastPreset(characterId) {
    const lastPreset = lastPresetCache[characterId];
    const currentPreset = getActivePresetName();

    if (lastPreset && lastPreset !== currentPreset) {
        console.log(`[OEOS] Restoring preset for char ${characterId} to "${lastPreset}"`);
        await switchPresetTo(lastPreset);
    } else {
        console.log(`[OEOS] No preset to restore for char ${characterId} or already correct.`);
    }
}

export {
    OEOS_PRESET_NAME,
    getActivePresetName,
    switchPresetTo,
    saveLastPreset,
    restoreLastPreset
};
