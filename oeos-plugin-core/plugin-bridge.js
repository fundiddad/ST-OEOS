// 使用 ES6 模块导出，不使用 window 对象

import { updatePageEntry } from './game-state.js';

import { loadWi, saveWi, listenToAiResponse, getPresetByName, savePresetDirect } from './st-api.js';
import {
    enableChatHistory,
    disableChatHistory,
    toggleChatHistory,
    isChatHistoryEnabled,
    getChatHistoryStatus,
    waitForPromptManager,
    enableChatHistorySilent,
    disableChatHistorySilent
} from './chat-history-control.js';

import {
    OEOS_PRESET_NAME,
    getActivePresetName,
    switchPresetTo,
    saveLastPreset,
    restoreLastPreset
} from './preset-switcher.js';
import { ElementDataManager } from './element-data-manager.js';

// Manager registry by worldInfoName
const _oeosManagers = new Map();
function getManager(worldInfoName) {
    if (!_oeosManagers.has(worldInfoName)) {
        _oeosManagers.set(worldInfoName, new ElementDataManager(worldInfoName));
    }
    return _oeosManagers.get(worldInfoName);
}
// 导入 SillyTavern 核心模块
import { characters, this_chid, chat, eventSource, event_types, getRequestHeaders, selectCharacterById } from '../../../../script.js';





// 在角色切换或应用启动后，仅切换 chatHistory 开关（不改变其他 Prompt 预设）
(function setupChatHistoryAutoToggle() {
    try {
        const applyToggle = async (idLike) => {
            const selectedId = Number(idLike ?? this_chid);
            const isOEOS = await isOEOSCharacter(selectedId);
            if (isOEOS) {
                // Remember current preset and switch to OEOS preset
                const currentPreset = getActivePresetName();
                if (currentPreset && currentPreset !== OEOS_PRESET_NAME) {
                    saveLastPreset(selectedId, currentPreset);
                }
                if (currentPreset !== OEOS_PRESET_NAME) {
                    await switchPresetTo(OEOS_PRESET_NAME);
                }
                // Disable chat history silently for OEOS
                disableChatHistorySilent();
            } else {
                // Restore last preset for this character if any
                await restoreLastPreset(selectedId);
                // Enable chat history back for non-OEOS
                enableChatHistorySilent();
            }
        };

        // 2) 聊天切换（包括启动完成后的自动触发）
        eventSource.on(event_types.CHAT_CHANGED, async () => {
            await applyToggle(this_chid);
        });
        // 4) 立即兜底一次（注册监听后可能错过早期事件）
        setTimeout(() => { applyToggle(this_chid); }, 0);
    } catch (err) {
        console.warn('[OEOS] setupChatHistoryAutoToggle 失败：', err);
    }
})();



/**
 * 从角色专属的 World Info 中获取指定页面的 OEOScript 内容
 * @param {string} pageId - 页面 ID
 * @returns {Promise<string|null>} - OEOScript 内容或 null（如果未找到）
 */
async function getPage(pageId) {
    try {
        // 获取当前角色的 World Info 名称
        const char = getCurrentCharacter();
        if (!char) {
            console.warn('[OEOS] 没有选中的角色');
            return null;
        }

        const worldInfoName = char.data?.extensions?.world;
        if (!worldInfoName) {
             console.warn('[OEOS] 角色没有绑定 World Info');
            return null;
        }

        // 加载角色专属的 World Info
        const worldInfo = await loadWi(worldInfoName);
        if (!worldInfo || !worldInfo.entries) {
            console.warn('[OEOS] World Info 不存在或为空');
            return null;
        }

        // 查找 Pages 条目
        let pagesEntry = null;
        for (const entry of Object.values(worldInfo.entries)) {
            if (entry.comment === 'Pages') {
                pagesEntry = entry;
                break;
            }
        }

        if (!pagesEntry || !pagesEntry.content) {
            console.warn('[OEOS] Pages 条目不存在或为空');
            return null;
        }

        // 从 Pages 内容中提取指定页面
        // 格式：纯 OEOScript v4 代码，用 "> pageId" 分隔
        // 示例：
        // > start
        //   say "欢迎..."
        // ---
        // > forest
        //   say "森林..."
        // ---
        // 格式：纯 OEOScript v4 代码，用 "> pageId" 和---分隔
        // 示例：
        // > start
        //   say "欢迎..."
        // ---
        // > forest
        //   say "森林..."
        // ---

        // 使用正则提取从 "> pageId" 到下一个 "---" 或文件末尾的内容
        const regex = new RegExp(`^>\\s*${pageId}\\s*\\r?\\n([\\s\\S]*?)(?=\\n---\\s*\\r?\\n|\\n---\\s*$|$)`, 'im');
        const match = pagesEntry.content.match(regex);

        if (match) {
            // 返回页面内容，包含 "> pageId" 行
            return `> ${pageId}\n${match[1].trim()}`;
        }

        // 页面未找到，返回占位符页面
        console.info(`[OEOS] 页面 '${pageId}' 未找到，返回占位符页面`);
        return createPlaceholderPage(pageId);
    } catch (error) {
        console.error(`[OEOS] 获取页面 ${pageId} 失败:`, error);
        return null;
    }
}

/**
 * 创建占位符页面（当页面缺失时）
 * @param {string} pageId - 页面 ID
 * @returns {string} - 占位符页面的 OEOScript 内容
 */
function createPlaceholderPage(pageId) {
    // 返回一个简单的占位符页面，显示"正在生成..."
    return `- say: "正在生成页面 '${pageId}'，请稍候..."\n- say: "AI 正在为您创建这个页面的内容。"`;
}

/**
 * 处理来自 OEOS 播放器的状态更新并触发上下文重新计算
 * @param {object} newState - 新状态 { pageId: 'A1', variables: { hp: 90 } }
 */
async function updateState(newState) {
    try {
        const char = getCurrentCharacter();
        if (!char) throw new Error('没有选中的角色');
        const worldInfoName = char.data?.extensions?.world;
        if (!worldInfoName) throw new Error('角色没有绑定 World Info');

        const mgr = getManager(worldInfoName);
        // ensure baseline loaded from WI before updating
        await mgr.loadFromWiAndChat([]);
        mgr.updateState(newState.pageId, newState.variables || {});
        // debounce sync
        mgr.scheduleSync(() => mgr.syncAll());
    } catch (error) {
        console.error('[OEOS] 更新状态失败:', error);
        console.error(`[OEOS] 更新状态失败: ${error.message}`);
    }
}

/**
 * 更新预设文件中指定提示词的 XML 标签内容
 * @param {string} presetName - 预设文件名称
 * @param {string} promptIdentifier - 提示词的 identifier
 * @param {string} tagName - XML 标签名称
 * @param {string} newContent - 新的标签内容
 * @returns {Promise<boolean>} - 是否更新成功
 */
async function updatePresetPromptContent(presetName, promptIdentifier, tagName, newContent) {
    try {
        console.info(`[OEOS] 开始同步 <${tagName}> 到预设文件 "${presetName}"`);

        // 获取预设文件的原始对象（可以直接修改）
        const preset = getPresetByName(presetName);
        if (!preset) {
            console.warn(`[OEOS] 预设文件 "${presetName}" 不存在，跳过同步`);
            return false;
        }

        if (!preset.prompts || !Array.isArray(preset.prompts)) {
            console.warn(`[OEOS] 预设文件 "${presetName}" 格式错误：缺少 prompts 数组`);
            return false;
        }

        const prompt = preset.prompts.find(p => p.identifier === promptIdentifier);
        if (!prompt) {
            console.warn(`[OEOS] 在预设文件中未找到 identifier 为 "${promptIdentifier}" 的提示词`);
            return false;
        }

        // 使用正则表达式替换 XML 标签内容
        const tagRegex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
        const match = prompt.content.match(tagRegex);

        if (match) {
            // 替换标签内容
            const newTagContent = `<${tagName}>\n${newContent}\n</${tagName}>`;
            prompt.content = prompt.content.replace(tagRegex, newTagContent);
        } else {
            console.warn(`[OEOS] 在提示词中未找到 <${tagName}> 标签`);
            return false;
        }

        // 保存预设文件
        await savePresetDirect(presetName, preset);

        console.info(`[OEOS] 已成功同步 <${tagName}> 到预设文件`);
        return true;
    } catch (error) {
        console.error(`[OEOS] 同步 <${tagName}> 到预设文件失败:`, error);
        return false;
    }
}


/**
 * 进入游戏时从聊天记录初始化游戏数据
 * 提取 AI 输出的 <Pages> 和 <summary> 标签内容
 * @param {string} worldInfoName - 角色专属的 World Info 名称
 */
export async function initializeGameDataFromChat(worldInfoName) {
    try {
        console.info('[OEOS] 正在从聊天记录初始化游戏数据...');

        // 获取聊天记录
        if (!chat || chat.length === 0) {
            console.info('[OEOS] 聊天记录为空，跳过初始化');
            return;
        }

        // 提取 AI 输出的 <Pages> 和 <summary> 标签
        const pages = extractPagesFromChat(chat);
        const summaries = extractSummaryFromChat(chat);

        if (pages.length === 0 && summaries.length === 0) {
            console.info('[OEOS] 聊天记录中没有找到 OEOS 数据');
            return;
        }

        // 加载 World Info
        let worldInfo = await loadWi(worldInfoName);
        if (!worldInfo || !worldInfo.entries) {
            console.warn('[OEOS] World Info 文件不存在或格式错误');
            return;
        }

        // 使用 updatePageEntry 来更新每个页面（这样会自动更新 Graph）
        for (const { pageId, content } of pages) {
            // 查找对应的摘要
            const summary = summaries.find(s => s.pageId === pageId);
            const abstract = summary ? summary.abstract : `页面 ${pageId}`;

            // 调用 updatePageEntry 来更新页面、摘要和图谱
            await updatePageEntry(worldInfoName, pageId, content, abstract);
            console.info(`[OEOS] 初始化页面: ${pageId}`);
        }

        // 处理没有对应页面的摘要
        const worldInfoAfterPages = await loadWi(worldInfoName);
        if (worldInfoAfterPages && worldInfoAfterPages.entries) {
            let summaryEntry = null;
            for (const entry of Object.values(worldInfoAfterPages.entries)) {
                if (entry.comment === 'summary') {
                    summaryEntry = entry;
                    break;
                }
            }

            if (summaryEntry) {
                for (const { pageId, abstract } of summaries) {
                    // 检查是否已经在 updatePageEntry 中添加过
                    const summaryRegex = new RegExp(`^${pageId}\\s*:`, 'm');
                    if (!summaryRegex.test(summaryEntry.content)) {
                        summaryEntry.content += `${pageId}: ${abstract};\n`;
                        console.info(`[OEOS] 添加独立摘要: ${pageId}`);
                    }
                }
                await saveWi(worldInfoName, worldInfoAfterPages);
            }
        }

        console.info(`[OEOS] 已从聊天记录初始化 ${pages.length} 个页面和 ${summaries.length} 个摘要`);
    } catch (error) {
        console.error('[OEOS] 从聊天记录初始化游戏数据失败:', error);
        console.error(`[OEOS] 初始化失败: ${error.message}`);
    }
}


/**
 * 检查角色是否为 OEOS 支持角色
 * @param {number} charIndex 角色索引
 * @returns {Promise<boolean>} 是否为 OEOS 角色
 */
export async function isOEOSCharacter(charIndex) {
    try {
        const char = characters[charIndex];
        if (!char) return false;

        // 检查角色是否有绑定的 World Info
        const worldInfoName = char.data?.extensions?.world;
        if (!worldInfoName) return false;

        // 加载角色的 World Info
        const worldInfo = await loadWi(worldInfoName);
        if (!worldInfo || !worldInfo.entries) return false;

        // 检查是否包含 OEOS-character 标记条目
        // 注意：SillyTavern 的 World Info 条目使用 'key' 而不是 'keys'
        for (const entry of Object.values(worldInfo.entries)) {
            const keys = entry.key || entry.keys || [];
            if (Array.isArray(keys) && keys.includes('OEOS-character')) {
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error(`[OEOS] Error checking OEOS character:`, error);
        return false;
    }
}

/**
 * 获取所有可用角色列表（包含 OEOS 状态）
 * @returns {Promise<Array>} 角色列表
 */
export async function getCharacters() {
    const charList = [];

    for (let index = 0; index < characters.length; index++) {
        const char = characters[index];
        const isOEOS = await isOEOSCharacter(index);

        charList.push({
            index: index,
            name: char.name,
            avatar: char.avatar,
            description: char.description,
            personality: char.personality,
            scenario: char.scenario,
            chat_size: char.chat_size,
            date_last_chat: char.date_last_chat,
            isOEOS: isOEOS,  // 新增：是否为 OEOS 角色
            worldInfo: char.data?.extensions?.world || null,  // 新增：World Info 名称
        });
    }

    return charList;
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

// 新方案：不再需要正则表达式处理
// 已移除 addOEOSRegexToCharacter 函数

/**
 * 为角色启用 OEOS 支持
 * @param {number} charIndex 角色索引
 * @returns {Promise<void>}
 */
export async function enableOEOSForCharacter(charIndex) {
    try {
        console.info(`[OEOS] 正在为角色启用 OEOS...`);

        const char = characters[charIndex];
        if (!char) {
            throw new Error('角色不存在');
        }

        // 1. 检查角色是否已有 World Info
        let worldInfoName = char.data?.extensions?.world;

        if (!worldInfoName) {
            // 创建新的 World Info 文件，使用角色名称
            worldInfoName = `${char.name}-OEOS`;

            // 创建空的 World Info 文件
            await saveWi(worldInfoName, { entries: {} });

            // 将 World Info 绑定到角色
            // 注意：这里需要使用 SillyTavern 的 API 来修改角色数据
            if (!char.data) char.data = {};
            if (!char.data.extensions) char.data.extensions = {};
            char.data.extensions.world = worldInfoName;

            // 保存角色数据到服务器
            const saveDataRequest = {
                avatar: char.avatar,
                data: {
                    extensions: {
                        world: worldInfoName,
                    },
                },
            };

            const response = await fetch('/api/characters/merge-attributes', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify(saveDataRequest),
            });

            if (!response.ok) {
                throw new Error('Failed to save character data');
            }

            console.info(`[OEOS] 已为角色创建 World Info: ${worldInfoName}`);
        }

        // 2. 在 World Info 中添加 OEOS-character 标记条目
        let worldInfo = await loadWi(worldInfoName);
        if (!worldInfo || !worldInfo.entries) {
            worldInfo = { entries: {} };
        }

        // 检查是否已存在 OEOS-character 标记条目
        // 注意：检测时使用 key 字段（SillyTavern 标准字段名）
        let hasOEOSMarker = false;
        for (const entry of Object.values(worldInfo.entries)) {
            const keys = entry.key || [];
            if (Array.isArray(keys) && keys.includes('OEOS-character')) {
                hasOEOSMarker = true;
                break;
            }
        }

        if (!hasOEOSMarker) {
            // 创建 OEOS-character 标记条目
            // 此条目仅用于标识角色为 OEOS 角色，不会被激活，不包含内容
            const uid = Date.now();
            worldInfo.entries[uid] = {
                uid: uid,
                key: ['OEOS-character'],  // 仅用于标识
                keysecondary: [],
                comment: 'OEOS Character Marker - Do not delete',
                content: '',  // 无内容
                constant: false,  // 不永久激活
                vectorized: false,
                selective: false,
                selectiveLogic: 0,
                addMemo: false,
                order: 0,
                position: 0,
                disable: true,  // 禁用此条目，不会被激活
                excludeRecursion: false,
                preventRecursion: false,
                probability: 100,
                useProbability: true,
                depth: 4,
                group: '',
                groupOverride: false,
                groupWeight: 100,
                scanDepth: null,
                caseSensitive: null,
                matchWholeWords: null,
                useGroupScoring: null,
                automationId: '',
                role: null,
                sticky: 0,
                cooldown: 0,
                delay: 0,
                displayIndex: Object.keys(worldInfo.entries).length,
            };

            await saveWi(worldInfoName, worldInfo);
            console.info(`[OEOS] 已为角色添加 OEOS 标记`);
        }

        // 3. 新方案：不再需要正则表达式处理

        // 4. 不在此处直接修改 chatHistory，改为在角色切换事件中按需自动切换。
        //    这样可以确保仅在当前 OEOS 角色激活时禁用，其它角色不受影响。

        // 5. 启用 OEOS 当下，尝试切换到 OEOS 专用预设（记住当前预设，避免丢失）
        try {
            const currentPreset = getActivePresetName();
            if (currentPreset && currentPreset !== OEOS_PRESET_NAME) {
                saveLastPreset(charIndex, currentPreset);
            }
            if (currentPreset !== OEOS_PRESET_NAME) {
                await switchPresetTo(OEOS_PRESET_NAME);
            }
        } catch (e) {
            console.warn('[OEOS] 切换到 OEOS 预设失败（启用时）:', e);
        }

        console.info(`[OEOS] 角色 ${char.name} 已启用 OEOS 支持`);
    } catch (error) {
        console.error(`[OEOS] 启用 OEOS 失败: ${error.message}`);
        console.error('[OEOS] Error enabling OEOS for character:', error);
        throw error;
    }
}

/**
 * 绑定选定的角色到游戏
 * @param {number} charIndex 角色索引
 */
export async function bindCharacter(charIndex) {
    try {
        // console.info(`[OEOS] 正在绑定角色...`);

        const character = characters[charIndex];
        if (!character) {
            throw new Error('角色不存在');
        }

        // 获取角色专属的 World Info 名称
        const worldInfoName = character.data?.extensions?.world;
        if (!worldInfoName) {
            throw new Error('角色没有绑定 World Info，请先启用 OEOS');
        }

        // 0. 如有必要，先切换到该角色，确保 this_chid 和 chat 数组正确加载
        if (String(this_chid) !== String(charIndex)) {
            console.info(`[OEOS] 正在切换到角色 ${character.name}...`);
            await selectCharacterById(charIndex, { switchMenu: false });
            // 等待 chat 数组加载完成
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 1. 初始化游戏数据条目（Pages、State、Graph、Abstracts、DynamicContext）
        await initializeGameDataEntries(worldInfoName);

        // 2. 从聊天记录初始化游戏数据（V2）
        await initializeGameDataFromChatV2(worldInfoName);

        // 3. 激活角色的 World Info
        await activateCharacterWorldInfo(worldInfoName);

        // 4. 激活角色的正则表达式
        activateCharacterRegex(charIndex);

        // 5. 监听 AI 回复事件（V2）
        setupAIResponseListener(worldInfoName);

        // 6. 不在此处直接修改 chatHistory，改为在角色切换事件中按需自动切换。
        //    这样可以确保仅在当前 OEOS 角色激活时禁用，其它角色不受影响。

        // console.info(`[OEOS] 角色 ${character.name} 绑定成功`);
    } catch (error) {
        console.error(`[OEOS] 绑定角色失败: ${error.message}`);
        throw error;
    }
}

/**
 * 设置 AI 回复监听器
 * @param {string} worldInfoName - 角色专属的 World Info 名称
 */
function setupAIResponseListener(worldInfoName) {
    listenToAiResponse(async () => {
        try {
            if (!chat || chat.length === 0) return;
            const lastMessage = chat[chat.length - 1];
            if (!lastMessage || !lastMessage.mes || lastMessage.is_user) return;
            await updateGameDataFromAIResponseV2(worldInfoName, lastMessage.mes);
        } catch (error) {
            console.error('[OEOS] AI 回复处理失败:', error);
        }
    });
    console.info('[OEOS] AI 回复监听器已设置');
}

/**
 * 在角色专属的 World Info 中初始化游戏数据条目
 * @param {string} worldInfoName 角色专属的 World Info 名称
 */
async function initializeGameDataEntries(worldInfoName) {
    // 加载角色专属的 World Info
    let worldInfo = await loadWi(worldInfoName);
    if (!worldInfo || !worldInfo.entries) {
        worldInfo = { entries: {} };
    }

    // 定义需要创建的游戏数据条目
    // 新方案：所有节点仅用于数据存储，不激活
    const gameDataEntries = [
        {
            comment: 'Pages',
            key: ['pages'],
            content: '',
            description: '页面数据库 - 存储该角色游戏的所有 OEOScript 页面（仅存储，不激活）'
        },
        {
            comment: 'State',
            key: ['state'],
            content: '',
            description: '游戏状态 - 当前页面、变量、历史路径（仅存储，不激活）'
        },
        {
            comment: 'Graph',
            key: ['graph'],
            content: '',
            description: '页面关系图 - 页面之间的分支结构（仅存储，不激活）'
        },
        {
            comment: 'summary',
            key: ['summary'],
            content: '',
            description: '页面摘要 - 用于 Token 优化（仅存储，不激活）'
        },
        {
            comment: 'Dynamic-Context',
            key: ['dynamic-context'],
            content: '',
            description: '动态上下文 - 根据游戏状态计算的上下文（仅存储，不激活）'
        }
    ];

    let createdCount = 0;

    // 检查并创建每个条目
    for (const entryDef of gameDataEntries) {
        // 检查是否已存在该条目
        let exists = false;
        for (const entry of Object.values(worldInfo.entries)) {
            if (entry.comment === entryDef.comment) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            const uid = Date.now() + createdCount;

            // 新方案：所有节点都不激活，仅用于数据存储
            // constant: false - 不永久激活
            // disable: true - 禁用激活

            worldInfo.entries[uid] = {
                uid: uid,
                key: entryDef.key,
                keysecondary: [],
                comment: entryDef.comment,
                content: entryDef.content,
                constant: false,  // 所有节点都不永久激活
                vectorized: false,
                selective: false,
                selectiveLogic: 0,
                addMemo: false,
                order: 0,
                position: 0,
                disable: true,  // 所有节点都禁用
                excludeRecursion: false,
                preventRecursion: false,
                probability: 100,
                useProbability: true,
                depth: 4,
                group: '',
                groupOverride: false,
                groupWeight: 100,
                scanDepth: null,
                caseSensitive: null,
                matchWholeWords: null,
                useGroupScoring: null,
                automationId: '',
                role: null,
                sticky: 0,
                cooldown: 0,
                delay: 0,
                displayIndex: Object.keys(worldInfo.entries).length,
            };
            createdCount++;
        }
    }

    if (createdCount > 0) {
        await saveWi(worldInfoName, worldInfo);
        // console.info(`[OEOS] 已在 ${worldInfoName} 中创建 ${createdCount} 个游戏数据条目`);
    } else {
        // console.info(`[OEOS] ${worldInfoName} 中的游戏数据条目已存在`);
    }
}

/**
 * 激活角色的 World Info
 */
async function activateCharacterWorldInfo(worldInfoName) {
    // 注意：这里需要访问 selected_world_info，可能需要从其他模块导入
    // 暂时使用简单实现
    console.info(`[OEOS] 激活 World Info: ${worldInfoName}`);
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
        console.info(`[OEOS] 激活角色正则表达式: ${char.name}`);
    }
}
// V2 implementations based on ElementDataManager (non-breaking: only wired in export map)
async function initializeGameDataFromChatV2(worldInfoName) {
    try {
        const mgr = getManager(worldInfoName);
        await mgr.loadFromWiAndChat(chat || []);
        await mgr.syncAll();
        console.info('[OEOS] 初始化完成（元素数据对象）');
    } catch (e) {
        console.error('[OEOS] 初始化(元素数据)失败:', e);
    }
}

async function updateGameDataFromAIResponseV2(worldInfoName, aiMessage) {
    try {
        const pages = extractPagesFromChat([{ mes: aiMessage }]);
        const summaries = extractSummaryFromChat([{ mes: aiMessage }]);
        if (pages.length === 0 && summaries.length === 0) return;
        const mgr = getManager(worldInfoName);
        await mgr.loadFromWiAndChat([]);
        for (const { pageId, content } of pages) {
            const s = summaries.find(x => x.pageId === pageId);
            mgr.updatePage(pageId, content, s?.abstract);
        }
        for (const { pageId, abstract } of summaries) {
            if (!pages.find(p => p.pageId === pageId)) mgr.updatePage(pageId, undefined, abstract);
        }
        mgr.scheduleSync(() => mgr.syncAll());
    } catch (e) {
        console.error('[OEOS] AI 回复更新(元素数据)失败:', e);
    }
}


// 使用 ES6 模块导出，不使用 window 对象
export {

    getPage,
    updateState,
    updatePageEntry as updatePage,
};


// 额外暴露给全局，供外部（如 Vue 应用）调用
if (!window.oeosApi) {
    window.oeosApi = {};
}
Object.assign(window.oeosApi, {

    getPage,
    updateState,
    updatePage: updatePageEntry,
    getCharacters,
    getCurrentCharacter,
    getCharacterWorldInfo,
    getCharacterRegexScripts,
    bindCharacter,
    isOEOSCharacter,                    // 检查是否为 OEOS 角色
    enableOEOSForCharacter,             // 启用 OEOS 支持
    // V2（元素数据对象实现，稳定路径）
    initializeGameDataFromChatV2,
    updateGameDataFromAIResponseV2,
    // 聊天历史控制
    enableChatHistory,                  // 启用聊天历史（显示提示）
    disableChatHistory,                 // 禁用聊天历史（显示提示）
    toggleChatHistory,                  // 切换聊天历史状态
    isChatHistoryEnabled,               // 检查聊天历史是否启用
    getChatHistoryStatus,               // 获取聊天历史状态信息
    waitForPromptManager,               // 等待 Prompt Manager 初始化
    enableChatHistorySilent,            // 启用聊天历史（静默模式）
    disableChatHistorySilent,           // 禁用聊天历史（静默模式）

    // 调试专用
    _getManager: () => { // 获取当前角色的 ElementDataManager 实例
        const char = getCurrentCharacter();
        if (!char?.data?.extensions?.world) {
            console.warn('当前角色未绑定 World Info，无法获取 Manager');
            return null;
        }
        return getManager(char.data.extensions.world);
    },
});
