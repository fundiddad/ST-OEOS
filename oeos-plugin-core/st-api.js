// Abstraction layer for all direct interactions with SillyTavern's core APIs (World Info, EventSource, etc.).

import { eventSource } from '../../../../script.js';
import { saveWorldInfo, loadWorldInfo, updateWorldInfoList } from '../../../world-info.js';
import { getPresetManager } from '../../../preset-manager.js';

/**
 * Saves content to a World Info entry.
 * @param {string} name - The name of the World Info entry.
 * @param {object} content - The content to save (World Info JSON object).
 */
export async function saveWi(name, content) {
    try {
        if (!name || typeof name !== 'string') {
            throw new Error('Invalid World Info entry name');
        }
        if (content === null || content === undefined) {
            content = '';
        }
        await saveWorldInfo(name, content, true);
        // 刷新 World Info 列表，使新创建的文件立即显示在UI中
        await updateWorldInfoList();
    } catch (error) {
        console.error(`[OEOS] Failed to save World Info entry "${name}":`, error);
        throw error;
    }
}

/**
 * Loads content from a World Info entry.
 * @param {string} name - The name of the World Info entry.
 * @returns {Promise<object>} - The World Info JSON object.
 */
export async function loadWi(name) {
    try {
        if (!name || typeof name !== 'string') {
            throw new Error('Invalid World Info entry name');
        }
        const content = await loadWorldInfo(name);
        return content;
    } catch (error) {
        console.error(`[OEOS] Failed to load World Info entry "${name}":`, error);
        throw error;
    }
}

/**
 * Listens for the completion of an AI response.
 * @param {function} callback - The function to execute when the AI response is complete.
 */
export function listenToAiResponse(callback) {
    eventSource.on('chat_completion_stream_finish', callback);
}

/**
 * 获取 PresetManager 实例（安全方式）
 * @returns {object|null} - PresetManager 实例，如果获取失败则返回 null
 */
function getPresetManagerSafe() {
    try {
        return getPresetManager('openai');
    } catch (error) {
        console.warn('[OEOS] 无法获取 PresetManager:', error);
        return null;
    }
}

/**
 * 深拷贝对象
 * @param {any} value - 要拷贝的值
 * @returns {any} - 拷贝后的值
 */
function deepClone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (e) {
            console.warn('[OEOS] structuredClone 失败，使用 JSON 方式:', e);
        }
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (e) {
        console.warn('[OEOS] JSON 深拷贝失败:', e);
        return value;
    }
}

/**
 * 获取预设文件的快照（source 和 clone）
 * @param {object} manager - PresetManager 实例
 * @param {string} name - 预设文件名称
 * @returns {{source: object|null, clone: object|null}} - 预设文件的原始对象和克隆对象
 */
function getPresetSnapshot(manager, name) {
    if (!manager || !name) {
        return { source: null, clone: null };
    }

    let source = null;
    try {
        if (typeof manager.getCompletionPresetByName === 'function') {
            source = manager.getCompletionPresetByName(name) || null;
        }
    } catch (e) {
        console.warn('[OEOS] getCompletionPresetByName 失败:', e);
    }

    if (!source) {
        try {
            source = manager.getPresetSettings?.(name) || null;
        } catch (e) {
            console.warn('[OEOS] getPresetSettings 失败:', e);
            source = null;
        }
    }

    if (!source) {
        return { source: null, clone: null };
    }

    return { source, clone: deepClone(source) };
}

/**
 * 同步目标对象到源对象
 * @param {object} target - 目标对象（会被修改）
 * @param {object} source - 源对象
 */
function syncTarget(target, source) {
    if (!target || !source) return;

    // 删除 target 中不存在于 source 的属性
    Object.keys(target).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(source, key)) {
            delete target[key];
        }
    });

    // 将 source 的所有属性复制到 target
    Object.assign(target, source);
}

/**
 * 读取预设文件内容
 * @param {string} presetName - 预设文件名称（不含扩展名）
 * @returns {Promise<object|null>} - 预设文件的 JSON 对象（克隆），如果不存在则返回 null
 */
export async function loadPreset(presetName) {
    try {
        const manager = getPresetManagerSafe();
        if (!manager) {
            console.warn('[OEOS] PresetManager 不可用，无法读取预设文件');
            return null;
        }

        const { clone } = getPresetSnapshot(manager, presetName);
        if (!clone) {
            console.warn(`[OEOS] 预设文件 "${presetName}" 不存在`);
            return null;
        }

        return clone;
    } catch (error) {
        console.error(`[OEOS] 读取预设文件 "${presetName}" 失败:`, error);
        return null;
    }
}

/**
 * 保存预设文件内容
 * @param {string} presetName - 预设文件名称（不含扩展名）
 * @param {object} presetData - 预设文件的 JSON 对象（会被克隆）
 * @returns {Promise<boolean>} - 是否保存成功
 */
export async function savePreset(presetName, presetData) {
    try {
        const manager = getPresetManagerSafe();
        if (!manager) {
            console.warn('[OEOS] PresetManager 不可用，无法保存预设文件');
            return false;
        }

        const { source } = getPresetSnapshot(manager, presetName);
        if (!source) {
            console.warn(`[OEOS] 预设文件 "${presetName}" 不存在，无法保存`);
            return false;
        }

        // 克隆 presetData 以避免修改原始对象
        const clone = deepClone(presetData);

        // 保存预设文件（skipUpdate: true 避免触发不必要的更新）
        await manager.savePreset(presetName, clone, { skipUpdate: true });

        // 同步 source 对象，使其与 clone 保持一致
        syncTarget(source, clone);

        console.info(`[OEOS] 预设文件 "${presetName}" 保存成功`);
        return true;
    } catch (error) {
        console.error(`[OEOS] 保存预设文件 "${presetName}" 失败:`, error);
        return false;
    }
}

/**
 * 获取预设文件的原始对象（可以直接修改）
 * @param {string} presetName - 预设文件名称（不含扩展名）
 * @returns {object|null} - 预设文件的原始对象，如果不存在则返回 null
 */
export function getPresetByName(presetName) {
    try {
        const manager = getPresetManagerSafe();
        if (!manager) {
            console.warn('[OEOS] PresetManager 不可用');
            return null;
        }

        const { source } = getPresetSnapshot(manager, presetName);
        return source;
    } catch (error) {
        console.error(`[OEOS] 获取预设文件 "${presetName}" 失败:`, error);
        return null;
    }
}

/**
 * 直接保存预设文件（不克隆，直接保存原始对象）
 * @param {string} presetName - 预设文件名称（不含扩展名）
 * @param {object} presetSource - 预设文件的原始对象
 * @returns {Promise<boolean>} - 是否保存成功
 */
export async function savePresetDirect(presetName, presetSource) {
    try {
        const manager = getPresetManagerSafe();
        if (!manager) {
            console.warn('[OEOS] PresetManager 不可用，无法保存预设文件');
            return false;
        }

        // 直接保存原始对象（skipUpdate: true 避免触发不必要的更新）
        await manager.savePreset(presetName, presetSource, { skipUpdate: true });

        console.info(`[OEOS] 预设文件 "${presetName}" 保存成功`);
        return true;
    } catch (error) {
        console.error(`[OEOS] 保存预设文件 "${presetName}" 失败:`, error);
        return false;
    }
}

/**
 * 导出 getPresetManagerSafe 供外部使用
 */
export { getPresetManagerSafe };

