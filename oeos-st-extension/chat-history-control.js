/**
 * 聊天历史控制模块
 * 提供开启/关闭 chatHistory 在 Prompt Manager 中的功能
 */

import { saveSettingsDebounced } from '../../../../script.js';
import { promptManager } from '../../../../scripts/openai.js';

/**
 * 获取当前的 Prompt Manager 实例
 * @returns {object|null} PromptManager 实例
 */
function getPromptManager() {
    // promptManager 是从 openai.js 导入的模块级变量
    // 在 setupChatCompletionPromptManager() 被调用后会被初始化
    return promptManager || null;
}

/**
 * 等待 Prompt Manager 初始化完成
 * @param {number} maxWaitMs - 最大等待时间（毫秒）
 * @param {number} checkIntervalMs - 检查间隔（毫秒）
 * @returns {Promise<object|null>} PromptManager 实例或 null
 */
export async function waitForPromptManager(maxWaitMs = 5000, checkIntervalMs = 100) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
        const promptManager = getPromptManager();
        if (promptManager) {
            console.log('[OEOS] Prompt Manager 已就绪');
            return promptManager;
        }

        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }

    console.warn('[OEOS] 等待 Prompt Manager 超时');
    return null;
}

/**
 * 获取指定角色的 chatHistory prompt order entry
 * @param {number} characterId - 角色ID
 * @returns {object|null} promptOrderEntry 对象
 */
function ensureCharacterStrategyAndOrder(characterId) {
    const pm = getPromptManager();
    if (!pm || characterId === null || characterId === undefined) return false;
    try {
        const cfg = pm.configuration?.promptOrder || {};
        const dummyId = cfg.dummyId;
        const asStringId = String(characterId);
        if (cfg.strategy !== 'character') {
            // 从全局复制当前顺序到该角色，然后切换为按角色策略
            const globalOrder = pm.getPromptOrderForCharacter({ id: dummyId }) || [];
            pm.configuration.promptOrder.strategy = 'character';
            pm.activeCharacter = { id: asStringId };
            const current = pm.getPromptOrderForCharacter(pm.activeCharacter);
            if ((current?.length || 0) === 0 && (globalOrder?.length || 0) > 0) {
                pm.addPromptOrderForCharacter(pm.activeCharacter, globalOrder);
            }
            pm.saveServiceSettings?.();
            pm.render?.();
        } else {
            // 已是按角色策略：确保该角色有独立的顺序（无则从全局模板复制）
            const targetChar = { id: asStringId };
            const exists = pm.getPromptOrderForCharacter(targetChar);
            if ((exists?.length || 0) === 0) {
                const globalOrder = pm.getPromptOrderForCharacter({ id: dummyId }) || [];
                if ((globalOrder?.length || 0) > 0) {
                    pm.addPromptOrderForCharacter(targetChar, globalOrder);
                    pm.saveServiceSettings?.();
                }
            }
        }
        return true;
    } catch (e) {
        console.warn('[OEOS] 切换为按角色提示顺序失败：', e);
        return false;
    }
}

function getChatHistoryPromptEntry(characterId) {
    const pm = getPromptManager();
    if (!pm) {
        return null;
    }
    try {
        const strategy = pm?.configuration?.promptOrder?.strategy || 'global';
        let character = pm.activeCharacter;
        if (strategy === 'character' && characterId !== null && characterId !== undefined) {
            character = (typeof characterId === 'object' && characterId !== null && 'id' in characterId)
                ? characterId
                : { id: String(characterId) };
        }
        return pm.getPromptOrderEntry(character, 'chatHistory') ?? null;
    } catch (error) {
        console.error('[OEOS] 获取 chatHistory prompt entry 失败:', error);
        return null;
    }
}

/**
 * 检查 chatHistory 是否启用
 * @param {number|null} characterId - 角色ID，null表示当前角色
 * @returns {boolean} true=启用，false=禁用
 */
export function isChatHistoryEnabled(characterId = null) {
    const promptEntry = getChatHistoryPromptEntry(characterId);
    if (!promptEntry) {
        // 如果找不到entry，默认认为是启用的
        return true;
    }
    
    return promptEntry.enabled === true;
}

/**
 * 启用 chatHistory（聊天历史会被发送给AI）
 * @param {number|null} characterId - 角色ID，null表示当前角色
 * @returns {boolean} 是否成功
 */
export function enableChatHistory(characterId = null) {
    const promptManager = getPromptManager();
    if (!promptManager) {
        console.error('[OEOS] 无法访问 Prompt Manager');
        return false;
    }
    
    const promptEntry = getChatHistoryPromptEntry(characterId);
    if (!promptEntry) {
        console.error('[OEOS] 无法找到 chatHistory prompt entry');
        return false;
    }
    
    try {
        promptEntry.enabled = true;
        
        // 保存设置
        saveSettingsDebounced();
        
        // 刷新 UI（如果需要）
        if (promptManager.render) {
            promptManager.render();
        }
        
        console.info('[OEOS] 已启用聊天历史');
        return true;
    } catch (error) {
        console.error('[OEOS] 启用 chatHistory 失败:', error);
        return false;
    }
}

/**
 * 禁用 chatHistory（聊天历史不会被发送给AI）
 * @param {number|null} characterId - 角色ID，null表示当前角色
 * @returns {boolean} 是否成功
 */
export function disableChatHistory(characterId = null) {
    const promptManager = getPromptManager();
    if (!promptManager) {
        console.error('[OEOS] 无法访问 Prompt Manager');
        return false;
    }
    
    const promptEntry = getChatHistoryPromptEntry(characterId);
    if (!promptEntry) {
        console.error('[OEOS] 无法找到 chatHistory prompt entry');
        return false;
    }
    
    try {
        promptEntry.enabled = false;
        
        // 保存设置
        saveSettingsDebounced();
        
        // 刷新 UI（如果需要）
        if (promptManager.render) {
            promptManager.render();
        }
        
        console.info('[OEOS] 已禁用聊天历史');
      
        return true;
    } catch (error) {
        console.error('[OEOS] 禁用 chatHistory 失败:', error);
        
        return false;
    }
}

/**
 * 切换 chatHistory 的启用状态
 * @param {number|null} characterId - 角色ID，null表示当前角色
 * @returns {boolean} 切换后的状态（true=启用，false=禁用）
 */
export function toggleChatHistory(characterId = null) {
    const currentState = isChatHistoryEnabled(characterId);
    
    if (currentState) {
        disableChatHistory(characterId);
        return false;
    } else {
        enableChatHistory(characterId);
        return true;
    }
}

/**
 * 获取 chatHistory 的当前状态信息
 * @param {number|null} characterId - 角色ID，null表示当前角色
 * @returns {object} 状态信息对象
 */
export function getChatHistoryStatus(characterId = null) {
    const promptEntry = getChatHistoryPromptEntry(characterId);
    const enabled = isChatHistoryEnabled(characterId);

    return {
        enabled: enabled,
        available: promptEntry !== null,
        entry: promptEntry,
    };
}

/**
 * 启用 chatHistory（自动模式）
 * 用于自动化操作，成功时显示提示，失败时只记录日志
 * @param {number|null} characterId - 角色ID，null表示当前角色
 * @returns {boolean} 是否成功
 */
export function enableChatHistorySilent(characterId = null) {
    const promptManager = getPromptManager();
    if (!promptManager) {
        console.warn('[OEOS] 无法访问 Prompt Manager，跳过启用 chatHistory');
        return false;
    }

    const promptEntry = getChatHistoryPromptEntry(characterId);
    if (!promptEntry) {
        console.warn('[OEOS] 无法找到 chatHistory prompt entry，跳过启用');
        return false;
    }

    try {
        promptEntry.enabled = true;

        // 保存设置
        saveSettingsDebounced();

        // 刷新 UI（如果需要）
        if (promptManager.render) {
            promptManager.render();
        }

        console.log('[OEOS] chatHistory 已启用（自动模式）');
        return true;
    } catch (error) {
        console.error('[OEOS] 启用 chatHistory 失败:', error);
        return false;
    }
}

/**
 * 禁用 chatHistory（自动模式）
 * 用于自动化操作，成功时显示提示，失败时只记录日志
 * @param {number|null} characterId - 角色ID，null表示当前角色
 * @returns {boolean} 是否成功
 */
export function disableChatHistorySilent(characterId = null) {
    const promptManager = getPromptManager();
    if (!promptManager) {
        console.warn('[OEOS] 无法访问 Prompt Manager，跳过禁用 chatHistory');
        return false;
    }

    const promptEntry = getChatHistoryPromptEntry(characterId);
    if (!promptEntry) {
        console.warn('[OEOS] 无法找到 chatHistory prompt entry，跳过禁用');
        return false;
    }

    try {
        promptEntry.enabled = false;

        // 保存设置
        saveSettingsDebounced();

        // 刷新 UI（如果需要）
        if (promptManager.render) {
            promptManager.render();
        }

    
        console.log('[OEOS] chatHistory 已禁用（自动模式）');
        return true;
    } catch (error) {
        console.error('[OEOS] 禁用 chatHistory 失败:', error);
        return false;
    }
}
