/**
 * 页面解析测试
 * 验证 --- 分隔符的正确处理
 */

// 测试数据：多个页面用 --- 分隔
const testPagesContent = `> start
  say "欢迎来到冒险世界！"
  choice:
    - "进入森林":
      - goto: forest
    - "访问村庄":
      - goto: village
---
> forest
  say "你进入了茂密的森林..."
  choice:
    - "继续探索":
      - goto: deep_forest
    - "返回":
      - goto: start
---
> village
  say "你来到了一个小村庄..."
  choice:
    - "进入酒馆":
      - goto: tavern
    - "返回":
      - goto: start
---`;

/**
 * 测试 1：分割页面
 */
function testPageSplit() {
  console.log('\n=== 测试 1：分割页面 ===');
  const pages = testPagesContent.split(/\n---\n/);
  console.log(`✓ 分割成 ${pages.length} 个页面`);
  
  pages.forEach((page, index) => {
    const trimmed = page.trim();
    if (trimmed) {
      const match = trimmed.match(/^>\s*(\w+)\s*\r?\n([\s\S]*)$/);
      if (match) {
        console.log(`  页面 ${index + 1}: ${match[1]}`);
      }
    }
  });
}

/**
 * 测试 2：提取单个页面
 */
function testExtractPage(pageId) {
  console.log(`\n=== 测试 2：提取页面 '${pageId}' ===`);
  const regex = new RegExp(`^>\\s*${pageId}\\s*\\r?\\n([\\s\\S]*?)(?=\\n---\\s*\\r?\\n|\\n---\\s*$|$)`, 'im');
  const match = testPagesContent.match(regex);
  
  if (match) {
    const content = `> ${pageId}\n${match[1].trim()}`;
    console.log('✓ 页面内容：');
    console.log(content);
  } else {
    console.log('✗ 页面未找到');
  }
}

/**
 * 测试 3：序列化页面
 */
function testSerializePages() {
  console.log('\n=== 测试 3：序列化页面 ===');
  
  const pagesMap = new Map();
  const pages = testPagesContent.split(/\n---\n/);
  
  for (const page of pages) {
    const trimmed = page.trim();
    if (!trimmed) continue;
    
    const match = trimmed.match(/^>\s*(\w+)\s*\r?\n([\s\S]*)$/);
    if (match) {
      const id = match[1].trim();
      const body = match[2].replace(/\s+$/, '');
      pagesMap.set(id, `> ${id}\n${body}`);
    }
  }
  
  // 序列化回去
  const pageContents = [];
  for (const [id, content] of pagesMap.entries()) {
    pageContents.push(content);
  }
  const serialized = pageContents.join('\n---\n');
  
  console.log('✓ 序列化成功');
  console.log(`  页面数量: ${pagesMap.size}`);
  console.log(`  序列化长度: ${serialized.length}`);
  
  // 验证序列化结果
  if (serialized.includes('> start') && serialized.includes('> forest') && serialized.includes('> village')) {
    console.log('✓ 所有页面都被正确序列化');
  }
}

/**
 * 测试 4：处理边界情况
 */
function testEdgeCases() {
  console.log('\n=== 测试 4：边界情况 ===');
  
  // 测试末尾没有 --- 的情况
  const testContent = `> page1
  say "test"
---
> page2
  say "test2"`;
  
  const pages = testContent.split(/\n---\n/);
  console.log(`✓ 末尾无 --- 的情况：分割成 ${pages.length} 个页面`);
  
  // 测试空页面
  const testContent2 = `> page1
  say "test"
---
---
> page2
  say "test2"`;
  
  const pages2 = testContent2.split(/\n---\n/);
  const validPages = pages2.filter(p => p.trim());
  console.log(`✓ 包含空页面的情况：总共 ${pages2.length} 个分割，有效页面 ${validPages.length} 个`);
}

/**
 * 运行所有测试
 */
function runAllTests() {
  console.log('========================================');
  console.log('  页面解析测试套件');
  console.log('========================================');
  
  testPageSplit();
  testExtractPage('start');
  testExtractPage('forest');
  testExtractPage('nonexistent');
  testSerializePages();
  testEdgeCases();
  
  console.log('\n========================================');
  console.log('  所有测试完成');
  console.log('========================================\n');
}

// 如果在 Node.js 环境中运行
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests, testPageSplit, testExtractPage, testSerializePages, testEdgeCases };
}

// 如果直接运行此文件
if (typeof require !== 'undefined' && require.main === module) {
  runAllTests();
}

