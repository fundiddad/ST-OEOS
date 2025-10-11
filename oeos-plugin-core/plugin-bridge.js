// ✅ 使用 ES6 模块导出，不使用 window 对象

import { updateStateEntry, updatePageEntry } from './game-state.js';
import { recalculateDynamicContext } from './context-engine.js';
import { loadWi, saveWi } from './st-api.js';

// ✅ 导入 SillyTavern 核心模块
import { characters, this_chid, chat, eventSource, event_types } from '../../../../script.js';
import { saveSettingsDebounced } from '../../../extensions.js';

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
 * NOTE: World Info in ST is user-specific, not global.
 */
async function initGameData() {
    try {
        toastr.info('[OEOS] Initializing game data...');

        // Check if SillyTavern is ready
        if (typeof saveWorldInfo === 'undefined' || typeof loadWorldInfo === 'undefined') {
            throw new Error('SillyTavern World Info API not available');
        }

        // Check if user is logged in (World Info requires user context)
        if (typeof window.this_chid === 'undefined' && typeof characters === 'undefined') {
            toastr.warning('[OEOS] No active character found. Some features may not work correctly.');
        }

        // Create entries sequentially to avoid race conditions
        for (const entryName of WI_ENTRIES) {
            try {
                let content = await loadWi(entryName);
                if (content === null || content === undefined) {
                    toastr.info(`[OEOS] Creating World Info entry: ${entryName}`);
                    await saveWi(entryName, { entries: {} }); // World Info expects entries object
                    // Verify the entry was created
                    const verifyContent = await loadWi(entryName);
                    if (verifyContent === null || verifyContent === undefined) {
                        throw new Error(`Failed to create World Info entry: ${entryName}`);
                    }
                    toastr.success(`[OEOS] World Info entry created: ${entryName}`);
                } else {
                    toastr.info(`[OEOS] World Info entry already exists: ${entryName}`);
                }
            } catch (entryError) {
                toastr.error(`[OEOS] Error processing entry ${entryName}: ${entryError.message}`);
                console.error(`[OEOS] Failed to process ${entryName}:`, entryError);
                // Continue with other entries instead of failing completely
            }
        }

        // Ensure a default start page exists
        try {
            let pagesEntry = await loadWi('WI-OEOS-Pages');
            if (!pagesEntry || !pagesEntry.entries) {
                pagesEntry = { entries: {} };
            }

            const startPageContent = '<oeos page id="start">\n- say: "The adventure begins..."\n- choice:\n  - "Explore the forest":\n    - goto: forest\n  - "Visit the village":\n    - goto: village\n</oeos page>';

            // Check if start page already exists in entries
            const existingStartEntry = Object.values(pagesEntry.entries).find(entry =>
                entry.content && entry.content.includes('<oeos page id="start">')
            );

            if (!existingStartEntry) {
                // Create start page as a proper World Info entry
                const startEntry = {
                    uid: Date.now(), // Unique ID
                    keys: ["start", "adventure", "begin"],
                    content: startPageContent,
                    constant: false,
                    order: 0,
                    enabled: true,
                    probability: 100,
                    position: 0,
                    role: 0 // system role
                };

                pagesEntry.entries[startEntry.uid] = startEntry;
                await saveWi('WI-OEOS-Pages', pagesEntry);
                toastr.success('[OEOS] Start page created in World Info');
            }

            // Create abstracts entry
            let abstractsEntry = await loadWi('WI-OEOS-Abstracts');
            if (!abstractsEntry || !abstractsEntry.entries) {
                abstractsEntry = { entries: {} };
            }

            const abstractContent = 'start: The adventure begins...;';
            const abstractEntry = {
                uid: Date.now() + 1,
                keys: ["start", "abstract"],
                content: abstractContent,
                constant: false,
                order: 1,
                enabled: true,
                probability: 100,
                position: 0,
                role: 0
            };

            abstractsEntry.entries[abstractEntry.uid] = abstractEntry;
            await saveWi('WI-OEOS-Abstracts', abstractsEntry);

            // Create state entry
            let stateEntry = await loadWi('WI-OEOS-State');
            if (!stateEntry || !stateEntry.entries) {
                stateEntry = { entries: {} };
            }

            const stateContent = 'start(initialized:1)';
            const stateUid = Date.now() + 2;
            stateEntry.entries[stateUid] = {
                uid: stateUid,
                keys: ["state", "current"],
                content: stateContent,
                constant: false,
                order: 2,
                enabled: true,
                probability: 100,
                position: 0,
                role: 0
            };
            await saveWi('WI-OEOS-State', stateEntry);

        } catch (pageError) {
            toastr.error(`[OEOS] Error creating default pages: ${pageError.message}`);
            console.error('[OEOS] Page creation error:', pageError);
            throw pageError;
        }

        toastr.success('[OEOS] Game data initialized successfully for current user.');
    } catch (error) {
        toastr.error(`[OEOS] Failed to initialize game data: ${error.message}`);
        console.error('[OEOS] initGameData error:', error);
        throw error;
    }
}


/**
 * Retrieves the OEOScript source for a specific page ID.
 * @param {string} pageId - The ID of the page to retrieve.
 * @returns {Promise<string|null>} - The OEOScript content or null if not found.
 */
async function getPage(pageId) {
    try {
        const pagesEntry = await loadWi('WI-OEOS-Pages');
        if (!pagesEntry || !pagesEntry.entries) {
            return null;
        }

        // Search through all entries for the page content
        for (const entry of Object.values(pagesEntry.entries)) {
            if (entry.content) {
                const regex = new RegExp(`<oeos page id="${pageId}">([\\s\\S]*?)<\\/oeos page>`, 'i');
                const match = entry.content.match(regex);
                if (match) {
                    return match[1].trim();
                }
            }
        }
        return null;
    } catch (error) {
        console.error(`[OEOS] Error getting page ${pageId}:`, error);
        return null;
    }
}

/**
 * Handles the state update from the OEOS player and triggers context recalculation.
 * @param {object} newState - The new state from the player.
 */
async function updateState(newState) {
    await updateStateEntry(newState);
    await recalculateDynamicContext();
}

/**
 * 获取所有可用角色列表
 * @returns {Array} 角色列表
 */
export function getCharacters() {
    return characters.map((char, index) => ({
        index: index,
        name: char.name,
        avatar: char.avatar,
        description: char.description,
        personality: char.personality,
        scenario: char.scenario,
        chat_size: char.chat_size,
        date_last_chat: char.date_last_chat,
    }));
}

/**
 * 获取当前选中的角色
 * @returns {object|null} 当前角色对象
 */
export function getCurrentCharacter() {
    if (this_chid === undefined) return null;
    return characters[this_chid];
}

/**
 * 获取指定角色的 World Info 名称
 * @param {number} charIndex 角色索引
 * @returns {string|null} World Info 名称
 */
export function getCharacterWorldInfo(charIndex) {
    const char = characters[charIndex];
    return char?.data?.extensions?.world || null;
}

/**
 * 获取指定角色的正则表达式脚本
 * @param {number} charIndex 角色索引
 * @returns {Array} 正则脚本数组
 */
export function getCharacterRegexScripts(charIndex) {
    const char = characters[charIndex];
    return char?.data?.extensions?.regex_scripts || [];
}

/**
 * 绑定选定的角色到游戏
 * @param {number} charIndex 角色索引
 */
export async function bindCharacter(charIndex) {
    try {
        toastr.info(`[OEOS] 正在绑定角色...`);

        const character = characters[charIndex];
        if (!character) {
            throw new Error('角色不存在');
        }

        // 1. 创建角色上下文 World Info 条目
        await createCharacterContextEntry(character);

        // 2. 如果角色有关联的 World Info，将其激活
        const worldInfoName = character.data?.extensions?.world;
        if (worldInfoName) {
            await activateCharacterWorldInfo(worldInfoName);
        }

        // 3. 创建聊天历史上下文
        await createChatHistoryContext(chat);

        // 4. 激活角色的正则表达式
        activateCharacterRegex(charIndex);

        toastr.success(`[OEOS] 角色 ${character.name} 绑定成功`);
    } catch (error) {
        toastr.error(`[OEOS] 绑定角色失败: ${error.message}`);
        throw error;
    }
}

/**
 * 创建角色上下文条目
 */
async function createCharacterContextEntry(character) {
    let contextEntry = await loadWi('WI-OEOS-CharacterContext');
    if (!contextEntry || !contextEntry.entries) {
        contextEntry = { entries: {} };
    }

    const content = `角色: ${character.name}\n描述: ${character.description}\n性格: ${character.personality}\n场景: ${character.scenario}`;

    const uid = Date.now();
    contextEntry.entries[uid] = {
        uid: uid,
        keys: ["character", "context"],
        content: content,
        constant: true,  // 永久激活
        order: 0,
        enabled: true,
        probability: 100,
        position: 0,
        role: 0
    };

    await saveWi('WI-OEOS-CharacterContext', contextEntry);
}

/**
 * 激活角色的 World Info
 */
async function activateCharacterWorldInfo(worldInfoName) {
    // 注意：这里需要访问 selected_world_info，可能需要从其他模块导入
    // 暂时使用简单实现
    toastr.info(`[OEOS] 激活 World Info: ${worldInfoName}`);
}

/**
 * 创建聊天历史上下文
 */
async function createChatHistoryContext(chatHistory) {
    // 获取最近 20 条消息
    const recentChat = chatHistory.slice(-20);
    const summary = recentChat.map(msg =>
        `${msg.is_user ? 'User' : 'Character'}: ${msg.mes}`
    ).join('\n');

    let contextEntry = await loadWi('WI-OEOS-ChatHistory');
    if (!contextEntry || !contextEntry.entries) {
        contextEntry = { entries: {} };
    }

    const uid = Date.now() + 1;
    contextEntry.entries[uid] = {
        uid: uid,
        keys: ["history", "chat"],
        content: `最近对话:\n${summary}`,
        constant: false,
        order: 1,
        enabled: true,
        probability: 100,
        position: 0,
        role: 0
    };

    await saveWi('WI-OEOS-ChatHistory', contextEntry);
}

/**
 * 激活角色的正则表达式脚本
 * @param {number} charIndex 角色索引
 */
function activateCharacterRegex(charIndex) {
    // 注意：这里需要访问 extension_settings，可能需要从其他模块导入
    // 暂时使用简单实现
    const char = characters[charIndex];
    if (char) {
        toastr.info(`[OEOS] 激活角色正则表达式: ${char.name}`);
    }
}

// ✅ 使用 ES6 模块导出，不使用 window 对象
export {
    initGameData,
    getPage,
    updateState,
    updatePageEntry as updatePage,
};

toastr.success('[OEOS] Plugin bridge initialized.');

// ✅ 额外暴露给全局，供外部（如 Vue 应用）调用
if (!window.oeosApi) {
    window.oeosApi = {};
}
Object.assign(window.oeosApi, {
    initGameData,
    getPage,
    updateState,
    updatePage: updatePageEntry,
    getCharacters,
    getCurrentCharacter,
    getCharacterWorldInfo,
    getCharacterRegexScripts,
    bindCharacter,
});
