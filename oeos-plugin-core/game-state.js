// Manages the game state by reading from and writing to the dedicated World Info entries.

import { saveWi, loadWi } from './st-api.js';
import OEOSV4Parser from './v4-parser.js';

/**
 * 更新角色专属 World Info 中的页面条目
 * @param {string} worldInfoName - 角色专属的 World Info 名称（如 "test1-OEOS"）
 * @param {string} pageId - 页面 ID
 * @param {string} content - OEOScript v4 内容（不包含 <oeos page> 标签）
 * @param {string} abstract - 页面摘要
 */
export async function updatePageEntry(worldInfoName, pageId, content, abstract) {
    try {
        // 加载角色专属的 World Info
        let worldInfo = await loadWi(worldInfoName);
        if (!worldInfo || !worldInfo.entries) {
            worldInfo = { entries: {} };
        }

        // 1. 更新 OEOS-Pages 条目
        // 查找 OEOS-Pages 条目
        let pagesEntry = null;
        for (const entry of Object.values(worldInfo.entries)) {
            if (entry.comment === 'OEOS-Pages') {
                pagesEntry = entry;
                break;
            }
        }

        if (!pagesEntry) {
            throw new Error('OEOS-Pages 条目不存在，请先绑定角色');
        }

        // 修正：直接存储纯 OEOScript v4 代码，不添加任何 XML 标签
        // 格式：多个页面直接拼接，用 "> pageId" 分隔
        // 示例：
        // > start
        //   say "欢迎..."
        //
        // > forest
        //   say "森林..."

        // 确保内容以 "> pageId" 开头
        let pageContent = content.trim();
        if (!pageContent.startsWith(`> ${pageId}`)) {
            pageContent = `> ${pageId}\n${pageContent}`;
        }

        // 添加两个换行符作为页面分隔
        const pageBlock = `${pageContent}\n\n`;

        // 检查页面是否已存在（使用 "> pageId" 作为标识）
        const pageRegex = new RegExp(`> ${pageId}\\n[\\s\\S]*?(?=\\n> |$)`, 'i');
        if (pageRegex.test(pagesEntry.content)) {
            // 替换现有页面
            pagesEntry.content = pagesEntry.content.replace(pageRegex, pageBlock.trim());
        } else {
            // 添加新页面
            pagesEntry.content += pageBlock;
        }

        // 2. 更新 OEOS-Abstracts 条目
        let abstractsEntry = null;
        for (const entry of Object.values(worldInfo.entries)) {
            if (entry.comment === 'OEOS-Abstracts') {
                abstractsEntry = entry;
                break;
            }
        }

        if (!abstractsEntry) {
            throw new Error('OEOS-Abstracts 条目不存在，请先绑定角色');
        }

        // 修正：摘要格式为 "pageId: abstract;"
        const abstractLine = `${pageId}: ${abstract};`;
        const abstractRegex = new RegExp(`${pageId}:.*?;`, 'g');
        if (abstractRegex.test(abstractsEntry.content)) {
            // 替换现有摘要
            abstractsEntry.content = abstractsEntry.content.replace(abstractRegex, abstractLine);
        } else {
            // 添加新摘要
            abstractsEntry.content += `\n${abstractLine}`;
        }

        // 3. 更新 OEOS-Graph 条目
        try {
            const pageJson = OEOSV4Parser.toV1(content);
            const gotos = findGotosInCommands(pageJson.pages[Object.keys(pageJson.pages)[0]]);

            let graphEntry = null;
            for (const entry of Object.values(worldInfo.entries)) {
                if (entry.comment === 'OEOS-Graph') {
                    graphEntry = entry;
                    break;
                }
            }

            if (!graphEntry) {
                throw new Error('OEOS-Graph 条目不存在，请先绑定角色');
            }

            if (gotos.length > 0) {
                // 修正：图谱格式为 "pageId > child1, child2;"
                const graphLine = `${pageId} > ${gotos.join(', ')};`;
                const graphRegex = new RegExp(`${pageId} >.*?;`, 'g');
                if (graphRegex.test(graphEntry.content)) {
                    // 替换现有图谱
                    graphEntry.content = graphEntry.content.replace(graphRegex, graphLine);
                } else {
                    // 添加新图谱
                    graphEntry.content += `\n${graphLine}`;
                }
            }
        } catch (e) {
            console.error(`[OEOS] 解析 goto 命令失败:`, e);
            toastr.warning(`[OEOS] 无法提取页面 '${pageId}' 的跳转关系: ${e.message}`);
        }

        // 保存更新后的 World Info
        await saveWi(worldInfoName, worldInfo);

        toastr.success(`[OEOS] 页面 '${pageId}' 已更新到 ${worldInfoName}`);
    } catch (error) {
        console.error(`[OEOS] 更新页面条目 ${pageId} 失败:`, error);
        toastr.error(`[OEOS] 更新页面 '${pageId}' 失败: ${error.message}`);
        throw error;
    }
}

/**
 * Recursively finds all goto targets in a command list.
 * @param {Array<Object>} commands - The list of commands to search through.
 * @returns {Array<string>} - A list of unique goto targets.
 */
function findGotosInCommands(commands) {
    let targets = [];
    if (!commands) return targets;

    for (const command of commands) {
        const commandType = Object.keys(command)[0];
        const commandData = command[commandType];

        if (commandType === 'goto') {
            targets.push(commandData.target);
        }
        // Recursively search in nested commands (if, choice options, etc.)
        if (commandData.commands) {
            targets = targets.concat(findGotosInCommands(commandData.commands));
        }
        if (commandData.elseCommands) {
            targets = targets.concat(findGotosInCommands(commandData.elseCommands));
        }
        if (commandData.options) {
            for (const option of commandData.options) {
                if (option.commands) {
                    targets = targets.concat(findGotosInCommands(option.commands));
                }
            }
        }
    }
    // Return unique targets
    return [...new Set(targets)];
}


/**
 * 更新角色专属 World Info 中的状态条目
 * @param {string} worldInfoName - 角色专属的 World Info 名称
 * @param {object} newState - 新状态 { pageId: 'A1', variables: { hp: 90 } }
 */
export async function updateStateEntry(worldInfoName, newState) {
    try {
        // 加载角色专属的 World Info
        let worldInfo = await loadWi(worldInfoName);
        if (!worldInfo || !worldInfo.entries) {
            worldInfo = { entries: {} };
        }

        // 查找 OEOS-State 条目
        let stateEntry = null;
        for (const entry of Object.values(worldInfo.entries)) {
            if (entry.comment === 'OEOS-State') {
                stateEntry = entry;
                break;
            }
        }

        if (!stateEntry) {
            throw new Error('OEOS-State 条目不存在，请先绑定角色');
        }

        // 修正：变量记录格式为 (key1:value1,key2:value2)
        const variablesString = Object.keys(newState.variables || {}).length > 0
            ? `(${Object.entries(newState.variables || {})
                .map(([key, value]) => `${key}:${value}`)
                .join(',')})`
            : '';

        // 修正：状态格式为 " > pageId(variables)"
        const newStateString = ` > ${newState.pageId}${variablesString}`;

        // 追加到现有状态
        stateEntry.content += newStateString;

        // 保存更新后的 World Info
        await saveWi(worldInfoName, worldInfo);

        console.log(`[OEOS] 状态已更新: ${newStateString}`);
    } catch (error) {
        console.error(`[OEOS] 更新状态条目失败:`, error);
        toastr.error(`[OEOS] 更新状态失败: ${error.message}`);
        throw error;
    }
}

