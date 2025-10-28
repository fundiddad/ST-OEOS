/**
 * 测试并发生成器 V2
 * 
 * 使用方法：
 * 1. 在浏览器控制台中运行此文件
 * 2. 调用 testConcurrentV2() 函数
 */

import { getConcurrentGeneratorV2 } from './concurrent-generator-v2.js';

/**
 * 测试单个页面生成
 */
async function testSinglePage() {
    console.log('=== 测试单个页面生成 ===');
    
    const generator = getConcurrentGeneratorV2();
    
    try {
        const text = await generator.generatePage(1, 'test_page_1');
        console.log('✅ 生成成功！');
        console.log('生成的文本:', text);
        console.log('文本长度:', text.length);
    } catch (error) {
        console.error('❌ 生成失败:', error);
    }
}

/**
 * 测试并发生成（3个页面同时生成）
 */
async function testConcurrentPages() {
    console.log('=== 测试并发生成（3个页面） ===');
    
    const generator = getConcurrentGeneratorV2();
    
    const tasks = [
        generator.generatePage(1, 'page_a'),
        generator.generatePage(2, 'page_b'),
        generator.generatePage(3, 'page_c')
    ];
    
    try {
        const results = await Promise.all(tasks);
        console.log('✅ 所有页面生成成功！');
        results.forEach((text, index) => {
            console.log(`页面 ${index + 1} 长度:`, text.length);
        });
    } catch (error) {
        console.error('❌ 生成失败:', error);
    }
}

/**
 * 测试取消生成
 */
async function testCancelGeneration() {
    console.log('=== 测试取消生成 ===');
    
    const generator = getConcurrentGeneratorV2();
    
    // 开始生成
    const promise = generator.generatePage(1, 'test_cancel');
    
    // 1秒后取消
    setTimeout(() => {
        console.log('取消生成...');
        generator.cancelGeneration(1);
    }, 1000);
    
    try {
        await promise;
        console.log('✅ 生成完成（未被取消）');
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('✅ 生成已取消');
        } else {
            console.error('❌ 生成失败:', error);
        }
    }
}

/**
 * 测试会话状态查询
 */
async function testSessionStatus() {
    console.log('=== 测试会话状态查询 ===');
    
    const generator = getConcurrentGeneratorV2();
    
    // 开始生成
    const promise = generator.generatePage(1, 'test_status');
    
    // 每500ms查询一次状态
    const interval = setInterval(() => {
        const status = generator.getSessionStatus(1);
        console.log('会话状态:', status);
    }, 500);
    
    try {
        await promise;
        clearInterval(interval);
        console.log('✅ 生成完成');
        console.log('最终状态:', generator.getSessionStatus(1));
    } catch (error) {
        clearInterval(interval);
        console.error('❌ 生成失败:', error);
    }
}

/**
 * 主测试函数
 */
export async function testConcurrentV2() {
    console.log('🚀 开始测试并发生成器 V2');
    console.log('');
    
    // 测试1: 单个页面生成
    await testSinglePage();
    console.log('');
    
    // 等待2秒
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 测试2: 并发生成
    await testConcurrentPages();
    console.log('');
    
    // 等待2秒
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 测试3: 取消生成
    await testCancelGeneration();
    console.log('');
    
    // 等待2秒
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 测试4: 会话状态查询
    await testSessionStatus();
    console.log('');
    
    console.log('✅ 所有测试完成！');
}

// 导出到全局，方便在控制台调用
if (typeof window !== 'undefined') {
    window.testConcurrentV2 = testConcurrentV2;
    window.testSinglePage = testSinglePage;
    window.testConcurrentPages = testConcurrentPages;
    window.testCancelGeneration = testCancelGeneration;
    window.testSessionStatus = testSessionStatus;
    
    console.log('✅ 测试函数已加载到全局:');
    console.log('  - testConcurrentV2()      // 运行所有测试');
    console.log('  - testSinglePage()        // 测试单个页面');
    console.log('  - testConcurrentPages()   // 测试并发生成');
    console.log('  - testCancelGeneration()  // 测试取消生成');
    console.log('  - testSessionStatus()     // 测试状态查询');
}

