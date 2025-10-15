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
 * @param {string} pagesContent - The entire content of the OEOS-Pages entry.
 * @param {string} pageId - The ID of the page to extract.
 * @returns {string|null} - The full source code of the page, or null if not found.
 */
function extractPageSource(pagesContent, pageId) {
    // 从纯 OEOScript v4 格式中提取页面
    // 格式：用 "> pageId" 分隔的多个页面
    // 示例：
    // > start
    //   say "欢迎..."
    //
    // > forest
    //   say "森林..."

    const regex = new RegExp(`> ${pageId}\\n([\\s\\S]*?)(?=\\n> |$)`, 'i');
    const match = pagesContent.match(regex);
    if (match) {
        // 返回完整的页面内容，包含 "> pageId" 行
        return `> ${pageId}\n${match[1].trim()}`;
    }
    return null;
}

/**
 * 重新计算动态上下文
 * 基于玩家当前位置和历史记录动态生成 AI 上下文
 * @param {string} worldInfoName - 角色专属的 World Info 名称
 */
export async function recalculateDynamicContext(worldInfoName) {
    try {
        // 1. 加载角色专属的 World Info
        const worldInfo = await loadWi(worldInfoName);
        if (!worldInfo || !worldInfo.entries) {
            console.warn('[OEOS] World Info 不存在或为空');
            return;
        }

        // 2. 查找各个条目
        let stateEntry = null;
        let graphEntry = null;
        let pagesEntry = null;
        let dynamicContextEntry = null;

        for (const entry of Object.values(worldInfo.entries)) {
            if (entry.comment === 'OEOS-State') {
                stateEntry = entry;
            } else if (entry.comment === 'OEOS-Graph') {
                graphEntry = entry;
            } else if (entry.comment === 'OEOS-Pages') {
                pagesEntry = entry;
            } else if (entry.comment === 'OEOS-DynamicContext') {
                dynamicContextEntry = entry;
            }
        }

        if (!stateEntry || !pagesEntry || !dynamicContextEntry) {
            console.warn('[OEOS] 缺少必要的条目');
            return;
        }

        // 3. 解析状态路径和图谱
        const statePath = parseStatePath(stateEntry.content || '');
        const graph = parseGraph(graphEntry?.content || '');

        if (statePath.length === 0) {
            console.log('[OEOS] 状态路径为空，无法计算上下文');
            return;
        }

        // 4. 识别相关页面
        const currentPageId = statePath[statePath.length - 1];
        const futurePageIds = graph.get(currentPageId) || [];
        const historicalPageIds = statePath.slice(-5); // 最近 5 个页面（包括当前页面）

        let allRelevantIds = new Set([...futurePageIds, ...historicalPageIds]);

        // 5. 扩展历史上下文（向后 1 个页面的子页面）
        for (const id of historicalPageIds) {
            const historicalChildren = graph.get(id) || [];
            for (const childId of historicalChildren) {
                allRelevantIds.add(childId);
            }
        }

        // 6. 提取相关页面内容
        let finalContentBlock = '';
        for (const id of allRelevantIds) {
            const pageSource = extractPageSource(pagesEntry.content || '', id);
            if (pageSource) {
                finalContentBlock += pageSource + '\n\n';
            }
        }

        // 7. 更新 OEOS-DynamicContext 条目
        dynamicContextEntry.content = finalContentBlock.trim();

        // 8. 保存更新后的 World Info
        await saveWi(worldInfoName, worldInfo);

        console.log(`[OEOS] 动态上下文已重新计算，当前页面: ${currentPageId}`);
        console.info(`[OEOS] 动态上下文已更新（页面: ${currentPageId}）`);
    } catch (error) {
        console.error('[OEOS] 重新计算动态上下文失败:', error);
        console.error(`[OEOS] 更新动态上下文失败: ${error.message}`);
    }
}

