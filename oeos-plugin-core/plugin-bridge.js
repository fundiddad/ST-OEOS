// 使用 ES6 模块导出，不使用 window 对象

import { updateStateEntry, updatePageEntry } from './game-state.js';
import { recalculateDynamicContext } from './context-engine.js';
import { loadWi, saveWi, listenToAiResponse } from './st-api.js';

// 导入 SillyTavern 核心模块
import { characters, this_chid, chat, eventSource, event_types, saveSettingsDebounced, getRequestHeaders } from '../../../../script.js';


/**
 * 注意：不再使用全局的 World Info 文件
 * 每个角色有自己的 World Info 文件（如 test1-OEOS.json）
 * 该文件包含多个条目（entries）
 */

/**
 * 初始化游戏数据（已废弃）
 * 注意：此函数已废弃，不应再使用
 * 游戏数据应该存储在角色专属的 World Info 中
 */
async function initGameData() {
    // 此函数已废弃
    console.warn('[OEOS] initGameData 已废弃，请使用 enableOEOSForCharacter');
}


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

        // 查找 OEOS-Pages 条目
        let pagesEntry = null;
        for (const entry of Object.values(worldInfo.entries)) {
            if (entry.comment === 'OEOS-Pages') {
                pagesEntry = entry;
                break;
            }
        }

        if (!pagesEntry || !pagesEntry.content) {
            console.warn('[OEOS] OEOS-Pages 条目不存在或为空');
            return null;
        }

        // 从 OEOS-Pages 内容中提取指定页面
        // 格式：纯 OEOScript v4 代码，用 "> pageId" 分隔
        // 示例：
        // > start
        //   say "欢迎..."
        //
        // > forest
        //   say "森林..."

        // 使用正则提取从 "> pageId" 到下一个 "> " 或文件末尾的内容
        const regex = new RegExp(`> ${pageId}\\n([\\s\\S]*?)(?=\\n> |$)`, 'i');
        const match = pagesEntry.content.match(regex);

        if (match) {
            // 返回页面内容，包含 "> pageId" 行
            return `> ${pageId}\n${match[1].trim()}`;
        }

        // 页面未找到，返回占位符页面
        console.log(`[OEOS] 页面 '${pageId}' 未找到，返回占位符页面`);
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
        // 获取当前角色的 World Info 名称
        const char = getCurrentCharacter();
        if (!char) {
            throw new Error('没有选中的角色');
        }

        const worldInfoName = char.data?.extensions?.world;
        if (!worldInfoName) {
            throw new Error('角色没有绑定 World Info');
        }

        // 更新状态条目
        await updateStateEntry(worldInfoName, newState);

        // 重新计算动态上下文
        await recalculateDynamicContext(worldInfoName);
    } catch (error) {
        console.error('[OEOS] 更新状态失败:', error);
        toastr.error(`[OEOS] 更新状态失败: ${error.message}`);
    }
}

/**
 * 从聊天记录中提取所有 <oeos page> 标签
 * 注意：<oeos page> 标签无 id 属性，一个标签内可能包含多个页面
 * @param {Array} chatArray - SillyTavern 的 chat 数组
 * @returns {Array} - 提取的页面数组 [{ pageId, content }, ...]
 */
function extractPagesFromChat(chatArray) {
    const pages = [];
    // 修正：<oeos page> 标签无 id 属性
    const pageBlockRegex = /<oeos page>([\s\S]*?)<\/oeos page>/gi;

    for (const message of chatArray) {
        if (!message.mes) continue;

        let blockMatch;
        // 提取每个 <oeos page>...</oeos page> 块
        while ((blockMatch = pageBlockRegex.exec(message.mes)) !== null) {
            const blockContent = blockMatch[1].trim();

            // 从块内容中提取各个页面（用 "> pageId" 分隔）
            // 匹配 "> pageId" 开头的页面
            const pageRegex = /> (\w+)\n([\s\S]*?)(?=\n> |\n*$)/g;
            let pageMatch;

            while ((pageMatch = pageRegex.exec(blockContent)) !== null) {
                const pageId = pageMatch[1];
                const content = pageMatch[2].trim();
                pages.push({ pageId, content });
            }
        }
    }

    console.log(`[OEOS] 从聊天记录中提取了 ${pages.length} 个页面`);
    return pages;
}

/**
 * 从聊天记录中提取所有 <OEOS-Abstracts> 标签
 * @param {Array} chatArray - SillyTavern 的 chat 数组
 * @returns {Array} - 提取的摘要数组 [{ pageId, abstract }, ...]
 */
function extractAbstractsFromChat(chatArray) {
    const abstracts = [];
    const abstractRegex = /<OEOS-Abstracts>([\s\S]*?)<\/OEOS-Abstracts>/gi;
    const abstractLineRegex = /([^:]+):\s*([^;]+);/g;

    for (const message of chatArray) {
        if (!message.mes) continue;

        let match;
        while ((match = abstractRegex.exec(message.mes)) !== null) {
            const abstractBlock = match[1];

            let lineMatch;
            while ((lineMatch = abstractLineRegex.exec(abstractBlock)) !== null) {
                const pageId = lineMatch[1].trim();
                const abstract = lineMatch[2].trim();
                abstracts.push({ pageId, abstract });
            }
        }
    }

    console.log(`[OEOS] 从聊天记录中提取了 ${abstracts.length} 个摘要`);
    return abstracts;
}

/**
 * 进入游戏时遍历聊天记录初始化游戏数据
 * @param {string} worldInfoName - 角色专属的 World Info 名称
 */
export async function initializeGameDataFromChat(worldInfoName) {
    try {
        toastr.info('[OEOS] 正在从聊天记录初始化游戏数据...');

        // 获取聊天记录
        if (!chat || chat.length === 0) {
            console.log('[OEOS] 聊天记录为空，跳过初始化');
            return;
        }

        // 提取页面和摘要
        const pages = extractPagesFromChat(chat);
        const abstracts = extractAbstractsFromChat(chat);

        if (pages.length === 0 && abstracts.length === 0) {
            console.log('[OEOS] 聊天记录中没有找到 OEOS 数据');
            return;
        }

        // 加载 World Info
        let worldInfo = await loadWi(worldInfoName);
        if (!worldInfo || !worldInfo.entries) {
            worldInfo = { entries: {} };
        }

        // 查找条目
        let pagesEntry = null;
        let abstractsEntry = null;

        for (const entry of Object.values(worldInfo.entries)) {
            if (entry.comment === 'OEOS-Pages') {
                pagesEntry = entry;
            } else if (entry.comment === 'OEOS-Abstracts') {
                abstractsEntry = entry;
            }
        }

        if (!pagesEntry || !abstractsEntry) {
            throw new Error('OEOS 条目不存在，请先绑定角色');
        }

        // 更新 OEOS-Pages
        // 格式：纯 OEOScript v4 代码，用 "> pageId" 分隔
        for (const { pageId, content } of pages) {
            // 确保内容以 "> pageId" 开头
            let pageContent = content.trim();
            if (!pageContent.startsWith(`> ${pageId}`)) {
                pageContent = `> ${pageId}\n${pageContent}`;
            }

            const pageBlock = `${pageContent}\n\n`;
            const pageRegex = new RegExp(`> ${pageId}\\n[\\s\\S]*?(?=\\n> |$)`, 'i');

            if (pageRegex.test(pagesEntry.content)) {
                // 页面已存在，跳过
                continue;
            } else {
                // 添加新页面
                pagesEntry.content += pageBlock;
            }
        }

        // 更新 OEOS-Abstracts
        for (const { pageId, abstract } of abstracts) {
            const abstractLine = `${pageId}: ${abstract};`;
            const abstractRegex = new RegExp(`${pageId}:.*?;`, 'g');

            if (abstractRegex.test(abstractsEntry.content)) {
                // 摘要已存在，跳过
                continue;
            } else {
                // 添加新摘要
                abstractsEntry.content += `\n${abstractLine}`;
            }
        }

        // 保存更新后的 World Info
        await saveWi(worldInfoName, worldInfo);

        toastr.success(`[OEOS] 已从聊天记录初始化 ${pages.length} 个页面和 ${abstracts.length} 个摘要`);
    } catch (error) {
        console.error('[OEOS] 从聊天记录初始化游戏数据失败:', error);
        toastr.error(`[OEOS] 初始化失败: ${error.message}`);
    }
}

/**
 * AI 回复后更新游戏数据
 * @param {string} worldInfoName - 角色专属的 World Info 名称
 * @param {string} aiMessage - AI 的回复消息
 */
export async function updateGameDataFromAIResponse(worldInfoName, aiMessage) {
    try {
        // 提取页面
        const pages = extractPagesFromChat([{ mes: aiMessage }]);
        const abstracts = extractAbstractsFromChat([{ mes: aiMessage }]);

        if (pages.length === 0 && abstracts.length === 0) {
            // 没有 OEOS 数据，跳过
            return;
        }

        console.log(`[OEOS] AI 回复中包含 ${pages.length} 个页面和 ${abstracts.length} 个摘要`);

        // 更新每个页面
        for (const { pageId, content } of pages) {
            const abstract = abstracts.find(a => a.pageId === pageId)?.abstract || '';
            await updatePageEntry(worldInfoName, pageId, content, abstract);
        }

        // 重新计算动态上下文
        await recalculateDynamicContext(worldInfoName);

        toastr.success(`[OEOS] 已更新 ${pages.length} 个页面`);
    } catch (error) {
        console.error('[OEOS] 更新游戏数据失败:', error);
        toastr.error(`[OEOS] 更新失败: ${error.message}`);
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

/**
 * 为角色添加 OEOS 正则表达式规则
 * @param {number} charIndex 角色索引
 * @returns {Promise<void>}
 */
async function addOEOSRegexToCharacter(charIndex) {
    try {
        const char = characters[charIndex];
        if (!char) {
            throw new Error('角色不存在');
        }

        // 初始化 regex_scripts 数组
        if (!char.data) char.data = {};
        if (!char.data.extensions) char.data.extensions = {};
        if (!char.data.extensions.regex_scripts) {
            char.data.extensions.regex_scripts = [];
        }

        // 检查是否已存在 OEOS 正则表达式
        const existingRegex = char.data.extensions.regex_scripts.find(
            script => script.scriptName === 'OEOS-Filter'
        );

        if (existingRegex) {
            console.log('[OEOS] OEOS 正则表达式已存在');
            return;
        }

        // 添加 OEOS 正则表达式规则
        // 目的：提取 <OEOS-Abstracts> 标签并替换消息显示
        const oeosRegex = {
            id: `oeos-${Date.now()}`,
            scriptName: 'OEOS-Filter',
            // 匹配整个消息，捕获 <OEOS-Abstracts> 之前、之中、之后的内容
            findRegex: '/([\\s\\S]*)<OEOS-Abstracts>([\\s\\S]*?)<\\/OEOS-Abstracts>([\\s\\S]*)/gs',
            // 替换为：Abstracts 内容
            // 这样可以移除 <OEOS-Abstracts> 标签，但保留其内容
            replaceString: '$2',
            trimStrings: [],
            placement: [2],  // AI_OUTPUT
            disabled: false,
            markdownOnly: false,
            promptOnly: false,
            runOnEdit: true,
            substituteRegex: 0,
            minDepth: null,
            maxDepth: null
        };

        char.data.extensions.regex_scripts.push(oeosRegex);

        // 保存角色数据到服务器
        const saveDataRequest = {
            avatar: char.avatar,
            data: {
                extensions: {
                    regex_scripts: char.data.extensions.regex_scripts,
                },
            },
        };

        const response = await fetch('/api/characters/merge-attributes', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(saveDataRequest),
        });

        if (!response.ok) {
            throw new Error('Failed to save character regex scripts');
        }

        toastr.success('[OEOS] 已为角色添加 OEOS 正则表达式');
        console.log('[OEOS] OEOS 正则表达式已添加:', oeosRegex);
    } catch (error) {
        console.error('[OEOS] 添加正则表达式失败:', error);
        toastr.error(`[OEOS] 添加正则表达式失败: ${error.message}`);
        throw error;
    }
}

/**
 * 为角色启用 OEOS 支持
 * @param {number} charIndex 角色索引
 * @returns {Promise<void>}
 */
export async function enableOEOSForCharacter(charIndex) {
    try {
        toastr.info(`[OEOS] 正在为角色启用 OEOS...`);

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

            toastr.success(`[OEOS] 已为角色创建 World Info: ${worldInfoName}`);
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
            toastr.success(`[OEOS] 已为角色添加 OEOS 标记`);
        }

        // 3. 为角色添加 OEOS 正则表达式规则
        await addOEOSRegexToCharacter(charIndex);

        toastr.success(`[OEOS] 角色 ${char.name} 已启用 OEOS 支持`);
    } catch (error) {
        toastr.error(`[OEOS] 启用 OEOS 失败: ${error.message}`);
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
        toastr.info(`[OEOS] 正在绑定角色...`);

        const character = characters[charIndex];
        if (!character) {
            throw new Error('角色不存在');
        }

        // 获取角色专属的 World Info 名称
        const worldInfoName = character.data?.extensions?.world;
        if (!worldInfoName) {
            throw new Error('角色没有绑定 World Info，请先启用 OEOS');
        }

        // 1. 初始化游戏数据条目（Pages、State、Graph、Abstracts、DynamicContext）
        await initializeGameDataEntries(worldInfoName);

        // 2. 从聊天记录初始化游戏数据
        await initializeGameDataFromChat(worldInfoName);

        // 3. 激活角色的 World Info
        await activateCharacterWorldInfo(worldInfoName);

        // 4. 激活角色的正则表达式
        activateCharacterRegex(charIndex);

        // 5. 监听 AI 回复事件
        setupAIResponseListener(worldInfoName);

        toastr.success(`[OEOS] 角色 ${character.name} 绑定成功`);
    } catch (error) {
        toastr.error(`[OEOS] 绑定角色失败: ${error.message}`);
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
            // 获取最新的 AI 消息
            if (!chat || chat.length === 0) return;

            const lastMessage = chat[chat.length - 1];
            if (!lastMessage || !lastMessage.mes || lastMessage.is_user) return;

            // 更新游戏数据
            await updateGameDataFromAIResponse(worldInfoName, lastMessage.mes);
        } catch (error) {
            console.error('[OEOS] AI 回复处理失败:', error);
        }
    });

    console.log('[OEOS] AI 回复监听器已设置');
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
    const gameDataEntries = [
        {
            comment: 'OEOS-Pages',
            key: ['oeos-pages', 'pages'],
            content: '',
            description: '页面数据库 - 存储该角色游戏的所有 OEOScript 页面'
        },
        {
            comment: 'OEOS-State',
            key: ['oeos-state', 'state'],
            content: '',
            description: '游戏状态 - 当前页面、变量、历史路径'
        },
        {
            comment: 'OEOS-Graph',
            key: ['oeos-graph', 'graph'],
            content: '',
            description: '页面关系图 - 页面之间的分支结构'
        },
        {
            comment: 'OEOS-Abstracts',
            key: ['oeos-abstracts', 'abstracts'],
            content: '',
            description: '页面摘要 - 用于 Token 优化'
        },
        {
            comment: 'OEOS-DynamicContext',
            key: ['oeos-dynamic-context', 'dynamic-context'],
            content: '',
            description: '动态上下文 - 根据游戏状态计算的上下文'
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
            worldInfo.entries[uid] = {
                uid: uid,
                key: entryDef.key,
                keysecondary: [],
                comment: entryDef.comment,
                content: entryDef.content,
                constant: false,
                vectorized: false,
                selective: false,
                selectiveLogic: 0,
                addMemo: false,
                order: 0,
                position: 0,
                disable: true,  // 默认禁用，由游戏逻辑控制何时激活
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
        toastr.success(`[OEOS] 已在 ${worldInfoName} 中创建 ${createdCount} 个游戏数据条目`);
    } else {
        toastr.info(`[OEOS] ${worldInfoName} 中的游戏数据条目已存在`);
    }
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

// 使用 ES6 模块导出，不使用 window 对象
export {
    initGameData,
    getPage,
    updateState,
    updatePageEntry as updatePage,
};


// 额外暴露给全局，供外部（如 Vue 应用）调用
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
    isOEOSCharacter,                    // 检查是否为 OEOS 角色
    enableOEOSForCharacter,             // 启用 OEOS 支持
    initializeGameDataFromChat,         // 从聊天记录初始化游戏数据
    updateGameDataFromAIResponse,       // AI 回复后更新游戏数据
});
