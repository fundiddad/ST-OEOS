// Manages the game state by reading from and writing to the dedicated World Info entries.

import { saveWi, loadWi, getPresetByName, savePresetDirect } from './st-api.js';




/**
 * 更新预设文件中指定提示词的 XML 标签内容
 * @param {string} presetName - 预设文件名称
 * @param {string} promptIdentifier - 提示词的 identifier
 * @param {string} tagName - XML 标签名称（如 'Graph', 'State', 'Dynamic-Context'）
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

        // 查找对应的提示词
        if (!preset.prompts || !Array.isArray(preset.prompts)) {
            console.warn(`[OEOS] 预设文件 "${presetName}" 格式错误：缺少 prompts 数组`);
            return false;
        }

        const prompt = preset.prompts.find(p => p.identifier === promptIdentifier);
        if (!prompt) {
            console.warn(`[OEOS] 在预设文件中未找到 identifier 为 "${promptIdentifier}" 的提示词`);
            return false;
        }

        console.info(`[OEOS] 找到提示词 "${prompt.name}"，当前内容长度: ${prompt.content.length}`);
        console.info(`[OEOS] 新内容长度: ${newContent.length}`);

        // 更新 content 中的 XML 标签内容
        // 保留原有的换行符格式
        const tagRegex = new RegExp(`(<${tagName}>)[\\s\\S]*?(<\\/${tagName}>)`, 'i');
        const replacement = `$1\n${newContent}\n$2`;

        if (tagRegex.test(prompt.content)) {
            const oldContent = prompt.content;
            prompt.content = prompt.content.replace(tagRegex, replacement);
            console.info(`[OEOS] 已替换 <${tagName}> 标签内容`);
            console.info(`[OEOS] 替换前长度: ${oldContent.length}, 替换后长度: ${prompt.content.length}`);
        } else {
            console.warn(`[OEOS] 提示词中未找到 <${tagName}> 标签，跳过更新`);
            console.warn(`[OEOS] 提示词内容: ${prompt.content.substring(0, 200)}...`);
            return false;
        }

        // 直接保存预设文件（不克隆，因为我们已经修改了原始对象）
        await savePresetDirect(presetName, preset);
        console.info(`[OEOS] 已成功同步 <${tagName}> 到预设文件`);
        return true;
    } catch (error) {
        console.error(`[OEOS] 更新预设文件失败:`, error);
        return false;
    }
}

/**
 * 更新角色专属 World Info 中的页面条目
 * @param {string} worldInfoName - 角色专属的 World Info 名称（如 "test1-OEOS"）
 * @param {string} pageId - 页面 ID
 * @param {string} content - OEOScript v4 内容（不包含 <Pages> 标签）
 * @param {string} abstract - 页面摘要
 */
export async function updatePageEntry(worldInfoName, pageId, content, abstract) {
    try {
        // 加载角色专属的 World Info
        let worldInfo = await loadWi(worldInfoName);
        if (!worldInfo || !worldInfo.entries) {
            worldInfo = { entries: {} };
        }

        // 1. 更新 Pages 条目
        // 查找 Pages 条目
        let pagesEntry = null;
        for (const entry of Object.values(worldInfo.entries)) {
            if (entry.comment === 'Pages') {
                pagesEntry = entry;
                break;
            }
        }

        if (!pagesEntry) {
            throw new Error('Pages 条目不存在，请先绑定角色');
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

        // 2. 更新 summary 条目
        let abstractsEntry = null;
        for (const entry of Object.values(worldInfo.entries)) {
            if (entry.comment === 'summary') {
                abstractsEntry = entry;
                break;
            }
        }

        if (!abstractsEntry) {
            throw new Error('summary 条目不存在，请先绑定角色');
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

        // 3. 更新 Graph 条目
        try {
            console.log(`[OEOS] 开始提取页面 '${pageId}' 的 goto 命令`);
            console.log(`[OEOS] 页面内容长度: ${content.length} 字符`);

            // 使用正则表达式直接提取 goto 目标，不依赖解析器
            const gotos = extractGotoTargets(content);
            console.log(`[OEOS] 提取到的 goto 目标:`, gotos);

            let graphEntry = null;
            for (const entry of Object.values(worldInfo.entries)) {
                if (entry.comment === 'Graph') {
                    graphEntry = entry;
                    break;
                }
            }

            if (!graphEntry) {
                throw new Error('Graph 条目不存在，请先绑定角色');
            }

            if (gotos.length > 0) {
                // 图谱格式：pageId > child1, child2;
                const graphLine = `${pageId} > ${gotos.join(', ')};`;
                console.log(`[OEOS] 生成的图谱行: ${graphLine}`);

                // 检查是否已存在该页面的图谱
                const graphRegex = new RegExp(`^${pageId}\\s*>.*?;`, 'm');
                if (graphRegex.test(graphEntry.content)) {
                    // 替换现有图谱
                    graphEntry.content = graphEntry.content.replace(graphRegex, graphLine);
                    console.log(`[OEOS] 替换了页面 '${pageId}' 的图谱`);
                } else {
                    // 添加新图谱
                    graphEntry.content += `${graphLine}\n`;
                    console.log(`[OEOS] 添加了页面 '${pageId}' 的图谱`);
                }
            } else {
                console.log(`[OEOS] 页面 '${pageId}' 没有 goto 命令，跳过图谱更新`);
            }
        } catch (e) {
            console.error(`[OEOS] 提取 goto 命令失败:`, e);
            console.error(`[OEOS] 错误堆栈:`, e.stack);
            toastr.warning(`[OEOS] 无法提取页面 '${pageId}' 的跳转关系: ${e.message}`);
        }

        // 保存更新后的 World Info
        await saveWi(worldInfoName, worldInfo);

        // 同步 Graph 到预设文件
        let graphEntry = null;
        let summaryEntry = null;
        for (const entry of Object.values(worldInfo.entries)) {
            if (entry.comment === 'Graph') {
                graphEntry = entry;
            } else if (entry.comment === 'summary') {
                summaryEntry = entry;
            }
        }

        if (graphEntry) {
            await updatePresetPromptContent(
                '小猫之神-oeos',
                '492188e4-a606-41ae-94ea-d8977c9151b5',
                'Graph',
                graphEntry.content
            );
        }

        // 同步 summary 到预设文件
        if (summaryEntry) {
            await updatePresetPromptContent(
                '小猫之神-oeos',
                'cd7528e9-3f8a-4f89-9605-9925a9ec2c76',
                'summary',
                summaryEntry.content
            );
        }

        toastr.success(`[OEOS] 页面 '${pageId}' 已更新到 ${worldInfoName}`);
    } catch (error) {
        console.error(`[OEOS] 更新页面条目 ${pageId} 失败:`, error);
        toastr.error(`[OEOS] 更新页面 '${pageId}' 失败: ${error.message}`);
        throw error;
    }
}

/**
 * 从 OEOScript v4 代码中提取所有 goto 目标
 * 使用正则表达式直接提取，不依赖解析器
 * @param {string} content - OEOScript v4 代码
 * @returns {Array<string>} - 提取到的 goto 目标列表（去重）
 */
function extractGotoTargets(content) {
    const targets = [];

    // 匹配所有 goto 命令
    // 格式1: goto target
    // 格式2: -> goto target
    // 格式3: choice 选项中的 -> goto target
    const gotoRegex = /(?:->)?\s*goto\s+(\w+)/g;

    let match;
    while ((match = gotoRegex.exec(content)) !== null) {
        targets.push(match[1]);
    }

    // 返回去重后的目标列表
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

        // 查找 State 条目
        let stateEntry = null;
        for (const entry of Object.values(worldInfo.entries)) {
            if (entry.comment === 'State') {
                stateEntry = entry;
                break;
            }
        }

        if (!stateEntry) {
            throw new Error('State 条目不存在，请先绑定角色');
        }

        // 修正：变量记录格式为 (key1:value1,key2:value2)
        // 即使没有变量也要添加空括号，以便 parseStatePath 正确解析
        const variablesString = Object.keys(newState.variables || {}).length > 0
            ? Object.entries(newState.variables || {})
                .map(([key, value]) => `${key}:${value}`)
                .join(',')
            : '';

        // 修正：状态格式为 " > pageId(variables)" 或 " > pageId()" 如果没有变量
        const newStateString = ` > ${newState.pageId}(${variablesString})`;

        // 检查是否与最后一个状态完全相同（包括变量），避免重复追加
        // 这样可以支持同一页面但变量不同的情况，如 D(hp:100) > D(hp:80)
        const currentContent = stateEntry.content.trim();
        if (currentContent) {
            // 匹配所有的 " > pageId(...)" 格式
            const stateMatches = currentContent.match(/>\s*\w+\s*\([^)]*\)/g);
            if (stateMatches && stateMatches.length > 0) {
                // 获取最后一个完整状态（包括变量）
                const lastState = stateMatches[stateMatches.length - 1].trim();
                const newStateTrimmed = newStateString.trim();

                // 比较完整的状态字符串（页面ID + 变量）
                if (lastState === newStateTrimmed) {
                    console.log(`[OEOS] 跳过完全相同的状态: ${newStateTrimmed}`);
                    return; // 如果与最后一个状态完全相同，不追加
                }
            }
        }

        // 追加到现有状态
        stateEntry.content += newStateString;

        // 保存更新后的 World Info
        await saveWi(worldInfoName, worldInfo);

        // 同步 State 到预设文件
        await updatePresetPromptContent(
            '小猫之神-oeos',
            '817f9ecc-ebad-42d5-a551-6c316caa1224',
            'State',
            stateEntry.content
        );

        console.log(`[OEOS] 状态已更新: ${newStateString}`);
    } catch (error) {
        console.error(`[OEOS] 更新状态条目失败:`, error);
        toastr.error(`[OEOS] 更新状态失败: ${error.message}`);
        throw error;
    }
}

