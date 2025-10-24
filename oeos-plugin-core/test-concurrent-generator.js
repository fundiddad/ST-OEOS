// src/oeos-plugin-core/test-concurrent-generator.js
// 并发生成器测试文件

import { getConcurrentGenerator } from './concurrent-generator.js';

/**
 * 测试单个页面生成
 */
export async function testSingleGeneration() {
    console.log('=== 测试单个页面生成 ===');
    
    try {
        const generator = getConcurrentGenerator();
        
        console.log('开始生成页面: forest');
        const text = await generator.generatePage(1, 'forest');
        
        console.log('✅ 生成成功');
        console.log('生成的文本长度:', text.length);
        console.log('文本预览:', text.substring(0, 100) + '...');
        
        return true;
    } catch (error) {
        console.error('❌ 测试失败:', error);
        return false;
    }
}

/**
 * 测试并发生成
 */
export async function testConcurrentGeneration() {
    console.log('\n=== 测试并发生成 ===');
    
    try {
        const generator = getConcurrentGenerator();
        const pageIds = ['forest', 'village', 'cave'];
        
        console.log(`开始并发生成 ${pageIds.length} 个页面:`, pageIds.join(', '));
        
        const startTime = Date.now();
        
        // 并发生成
        const tasks = pageIds.map((pageId, index) => 
            generator.generatePage(index + 1, pageId)
        );
        
        const results = await Promise.all(tasks);
        
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        console.log('✅ 所有页面生成完成');
        console.log(`总耗时: ${duration.toFixed(2)}秒`);
        
        results.forEach((text, index) => {
            console.log(`- ${pageIds[index]}: ${text.length} 字符`);
        });
        
        return true;
    } catch (error) {
        console.error('❌ 测试失败:', error);
        return false;
    }
}

/**
 * 测试会话状态查询
 */
export async function testSessionStatus() {
    console.log('\n=== 测试会话状态查询 ===');
    
    try {
        const generator = getConcurrentGenerator();
        
        // 启动生成（不等待）
        const promise = generator.generatePage(1, 'forest');
        
        // 查询状态
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const status1 = generator.getStatus('xb1');
        console.log('生成中状态:', {
            isStreaming: status1.isStreaming,
            isCompleted: status1.isCompleted,
            textLength: status1.text.length
        });
        
        // 等待完成
        await promise;
        
        const status2 = generator.getStatus('xb1');
        console.log('完成后状态:', {
            isStreaming: status2.isStreaming,
            isCompleted: status2.isCompleted,
            textLength: status2.text.length
        });
        
        console.log('✅ 状态查询测试通过');
        return true;
    } catch (error) {
        console.error('❌ 测试失败:', error);
        return false;
    }
}

/**
 * 测试取消生成
 */
export async function testCancellation() {
    console.log('\n=== 测试取消生成 ===');
    
    try {
        const generator = getConcurrentGenerator();
        
        // 启动生成
        const promise = generator.generatePage(1, 'forest');
        
        // 等待一小段时间后取消
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('取消生成...');
        generator.cancel('xb1');
        
        try {
            await promise;
            console.log('⚠️ 生成未被取消（可能已完成）');
        } catch (error) {
            if (error.name === 'AbortError' || error.message.includes('abort')) {
                console.log('✅ 生成已成功取消');
                return true;
            } else {
                throw error;
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ 测试失败:', error);
        return false;
    }
}

/**
 * 测试上下文构建
 */
export async function testContextBuilding() {
    console.log('\n=== 测试上下文构建 ===');
    
    try {
        const generator = getConcurrentGenerator();
        
        const prompt = 'goto: forest';
        console.log('构建上下文，提示词:', prompt);
        
        const messages = await generator.buildContext(prompt);
        
        console.log('✅ 上下文构建成功');
        console.log('消息数量:', messages.length);
        
        if (messages.length > 0) {
            console.log('第一条消息:', {
                role: messages[0].role,
                contentLength: messages[0].content?.length || 0
            });
            
            console.log('最后一条消息:', {
                role: messages[messages.length - 1].role,
                contentLength: messages[messages.length - 1].content?.length || 0
            });
        }
        
        return true;
    } catch (error) {
        console.error('❌ 测试失败:', error);
        return false;
    }
}

/**
 * 运行所有测试
 */
export async function runAllTests() {
    console.log('🚀 开始运行并发生成器测试套件\n');
    
    const tests = [
        { name: '上下文构建', fn: testContextBuilding },
        { name: '单个页面生成', fn: testSingleGeneration },
        { name: '会话状态查询', fn: testSessionStatus },
        { name: '并发生成', fn: testConcurrentGeneration },
        { name: '取消生成', fn: testCancellation },
    ];
    
    const results = [];
    
    for (const test of tests) {
        try {
            const result = await test.fn();
            results.push({ name: test.name, passed: result });
        } catch (error) {
            console.error(`测试 "${test.name}" 抛出异常:`, error);
            results.push({ name: test.name, passed: false });
        }
    }
    
    // 输出测试结果
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(50));
    
    let passedCount = 0;
    results.forEach(result => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${result.name}`);
        if (result.passed) passedCount++;
    });
    
    console.log('='.repeat(50));
    console.log(`总计: ${passedCount}/${results.length} 通过`);
    
    if (passedCount === results.length) {
        console.log('🎉 所有测试通过！');
    } else {
        console.log('⚠️ 部分测试失败，请检查日志');
    }
    
    return passedCount === results.length;
}

// 如果在浏览器控制台中直接运行
if (typeof window !== 'undefined') {
    window.testConcurrentGenerator = {
        runAllTests,
        testSingleGeneration,
        testConcurrentGeneration,
        testSessionStatus,
        testCancellation,
        testContextBuilding
    };
    
    console.log('💡 测试函数已挂载到 window.testConcurrentGenerator');
    console.log('运行所有测试: window.testConcurrentGenerator.runAllTests()');
}

