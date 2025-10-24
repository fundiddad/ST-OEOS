// src/oeos-plugin-core/debug-context-comparison.js
// 调试工具：对比并发生成器和SillyTavern正常生成的上下文差异

import { getConcurrentGenerator } from './concurrent-generator.js';
import { eventSource, event_types } from '../../../../script.js';
import { getContext } from '../../../st-context.js';

/**
 * 捕获SillyTavern正常生成的上下文
 * @param {string} prompt - 提示词
 * @returns {Promise<object>} 上下文数据
 */
async function captureNormalContext(prompt) {
    console.log('📊 [调试] 捕获SillyTavern正常生成的上下文...');
    
    let capturedData = null;
    
    const dataListener = (data) => {
        capturedData = data;
        console.log('📊 [调试] 捕获到GENERATE_AFTER_DATA事件');
    };
    
    eventSource.on(event_types.GENERATE_AFTER_DATA, dataListener);
    
    try {
        const context = getContext();
        
        // 使用dryRun=true模拟正常生成
        await context.generate('normal', {
            quiet_prompt: prompt,
            quietToLoud: false,
            skipWIAN: false, // 包含World Info
            force_name2: true
        }, true); // dryRun=true
        
    } finally {
        eventSource.removeListener(event_types.GENERATE_AFTER_DATA, dataListener);
    }
    
    return capturedData;
}

/**
 * 捕获并发生成器构建的上下文
 * @param {string} prompt - 提示词
 * @returns {Promise<Array>} 消息数组
 */
async function captureConcurrentContext(prompt) {
    console.log('📊 [调试] 捕获并发生成器构建的上下文...');
    
    const generator = getConcurrentGenerator();
    const messages = await generator.buildContext(prompt);
    
    return messages;
}

/**
 * 分析消息数组
 * @param {Array} messages - 消息数组
 * @returns {object} 分析结果
 */
function analyzeMessages(messages) {
    if (!Array.isArray(messages)) {
        return {
            valid: false,
            error: '不是有效的消息数组'
        };
    }
    
    const analysis = {
        valid: true,
        totalMessages: messages.length,
        roles: {},
        totalTokens: 0,
        hasWorldInfo: false,
        worldInfoContent: [],
        systemMessages: [],
        userMessages: [],
        assistantMessages: []
    };
    
    messages.forEach((msg, index) => {
        // 统计角色
        if (!analysis.roles[msg.role]) {
            analysis.roles[msg.role] = 0;
        }
        analysis.roles[msg.role]++;
        
        // 估算token数（粗略）
        if (msg.content) {
            analysis.totalTokens += msg.content.length / 4;
        }
        
        // 检查是否包含World Info
        if (msg.content && (
            msg.content.includes('Pages:') ||
            msg.content.includes('Graph:') ||
            msg.content.includes('State:') ||
            msg.content.includes('Dynamic-Context:')
        )) {
            analysis.hasWorldInfo = true;
            analysis.worldInfoContent.push({
                index,
                role: msg.role,
                contentPreview: msg.content.substring(0, 200) + '...'
            });
        }
        
        // 分类消息
        if (msg.role === 'system') {
            analysis.systemMessages.push({
                index,
                contentLength: msg.content?.length || 0,
                preview: msg.content?.substring(0, 100) + '...'
            });
        } else if (msg.role === 'user') {
            analysis.userMessages.push({
                index,
                contentLength: msg.content?.length || 0,
                preview: msg.content?.substring(0, 100) + '...'
            });
        } else if (msg.role === 'assistant') {
            analysis.assistantMessages.push({
                index,
                contentLength: msg.content?.length || 0,
                preview: msg.content?.substring(0, 100) + '...'
            });
        }
    });
    
    return analysis;
}

/**
 * 对比两个上下文
 * @param {object} normalData - 正常生成的上下文数据
 * @param {Array} concurrentMessages - 并发生成器的消息数组
 */
function compareContexts(normalData, concurrentMessages) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 上下文对比分析');
    console.log('='.repeat(80));
    
    // 提取正常生成的消息数组
    let normalMessages = [];
    if (Array.isArray(normalData)) {
        normalMessages = normalData;
    } else if (normalData && typeof normalData === 'object' && Array.isArray(normalData.prompt)) {
        normalMessages = normalData.prompt;
    } else {
        console.error('❌ 无法从正常生成数据中提取消息数组');
        console.log('normalData 结构:', normalData);
        return;
    }
    
    // 分析两个上下文
    const normalAnalysis = analyzeMessages(normalMessages);
    const concurrentAnalysis = analyzeMessages(concurrentMessages);
    
    console.log('\n📋 SillyTavern正常生成:');
    console.log('  消息总数:', normalAnalysis.totalMessages);
    console.log('  角色分布:', normalAnalysis.roles);
    console.log('  估算Token数:', Math.round(normalAnalysis.totalTokens));
    console.log('  包含World Info:', normalAnalysis.hasWorldInfo ? '✅ 是' : '❌ 否');
    
    console.log('\n📋 并发生成器:');
    console.log('  消息总数:', concurrentAnalysis.totalMessages);
    console.log('  角色分布:', concurrentAnalysis.roles);
    console.log('  估算Token数:', Math.round(concurrentAnalysis.totalTokens));
    console.log('  包含World Info:', concurrentAnalysis.hasWorldInfo ? '✅ 是' : '❌ 否');
    
    // 对比差异
    console.log('\n🔍 差异分析:');
    
    const messageDiff = concurrentAnalysis.totalMessages - normalAnalysis.totalMessages;
    if (messageDiff === 0) {
        console.log('  ✅ 消息数量一致');
    } else {
        console.log(`  ⚠️ 消息数量差异: ${messageDiff > 0 ? '+' : ''}${messageDiff}`);
    }
    
    const tokenDiff = Math.round(concurrentAnalysis.totalTokens - normalAnalysis.totalTokens);
    if (Math.abs(tokenDiff) < 10) {
        console.log('  ✅ Token数量基本一致');
    } else {
        console.log(`  ⚠️ Token数量差异: ${tokenDiff > 0 ? '+' : ''}${tokenDiff}`);
    }
    
    if (normalAnalysis.hasWorldInfo === concurrentAnalysis.hasWorldInfo) {
        console.log('  ✅ World Info包含状态一致');
    } else {
        console.log('  ❌ World Info包含状态不一致！');
    }
    
    // 详细对比World Info
    if (normalAnalysis.hasWorldInfo || concurrentAnalysis.hasWorldInfo) {
        console.log('\n📚 World Info详情:');
        
        if (normalAnalysis.worldInfoContent.length > 0) {
            console.log('  正常生成包含World Info的消息:');
            normalAnalysis.worldInfoContent.forEach(wi => {
                console.log(`    - 消息 #${wi.index} (${wi.role}): ${wi.contentPreview}`);
            });
        }
        
        if (concurrentAnalysis.worldInfoContent.length > 0) {
            console.log('  并发生成包含World Info的消息:');
            concurrentAnalysis.worldInfoContent.forEach(wi => {
                console.log(`    - 消息 #${wi.index} (${wi.role}): ${wi.contentPreview}`);
            });
        }
    }
    
    // 逐条对比消息
    console.log('\n📝 逐条消息对比:');
    const maxLen = Math.max(normalMessages.length, concurrentMessages.length);
    let identicalCount = 0;
    let differentCount = 0;
    
    for (let i = 0; i < maxLen; i++) {
        const normal = normalMessages[i];
        const concurrent = concurrentMessages[i];
        
        if (!normal) {
            console.log(`  消息 #${i}: ⚠️ 并发生成器多出一条消息`);
            differentCount++;
        } else if (!concurrent) {
            console.log(`  消息 #${i}: ⚠️ 正常生成多出一条消息`);
            differentCount++;
        } else if (normal.role !== concurrent.role) {
            console.log(`  消息 #${i}: ❌ 角色不同 (${normal.role} vs ${concurrent.role})`);
            differentCount++;
        } else if (normal.content !== concurrent.content) {
            console.log(`  消息 #${i}: ⚠️ 内容不同 (${normal.role})`);
            console.log(`    正常: ${normal.content?.substring(0, 50)}...`);
            console.log(`    并发: ${concurrent.content?.substring(0, 50)}...`);
            differentCount++;
        } else {
            identicalCount++;
        }
    }
    
    console.log(`\n  ✅ 完全相同的消息: ${identicalCount}/${maxLen}`);
    console.log(`  ⚠️ 有差异的消息: ${differentCount}/${maxLen}`);
    
    // 最终结论
    console.log('\n' + '='.repeat(80));
    if (differentCount === 0 && normalAnalysis.hasWorldInfo === concurrentAnalysis.hasWorldInfo) {
        console.log('✅ 结论: 并发生成器构建的上下文与SillyTavern正常生成**完全一致**！');
    } else if (differentCount <= 2) {
        console.log('⚠️ 结论: 并发生成器构建的上下文与SillyTavern正常生成**基本一致**，有轻微差异');
    } else {
        console.log('❌ 结论: 并发生成器构建的上下文与SillyTavern正常生成**存在明显差异**！');
    }
    console.log('='.repeat(80) + '\n');
}

/**
 * 运行完整的对比测试
 * @param {string} prompt - 测试提示词
 */
export async function runContextComparison(prompt = 'goto: forest') {
    console.log('🚀 开始上下文对比测试');
    console.log('测试提示词:', prompt);
    console.log('');
    
    try {
        // 1. 捕获正常生成的上下文
        const normalData = await captureNormalContext(prompt);
        console.log('✅ 正常生成上下文捕获完成');
        
        // 2. 捕获并发生成器的上下文
        const concurrentMessages = await captureConcurrentContext(prompt);
        console.log('✅ 并发生成器上下文捕获完成');
        
        // 3. 对比两个上下文
        compareContexts(normalData, concurrentMessages);
        
        return true;
    } catch (error) {
        console.error('❌ 对比测试失败:', error);
        return false;
    }
}

// 挂载到window供浏览器控制台使用
if (typeof window !== 'undefined') {
    window.debugContextComparison = {
        run: runContextComparison,
        captureNormal: captureNormalContext,
        captureConcurrent: captureConcurrentContext,
        compare: compareContexts
    };
    
    console.log('💡 调试工具已挂载到 window.debugContextComparison');
    console.log('运行对比测试: window.debugContextComparison.run("goto: forest")');
}

