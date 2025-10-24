# 迁移到并发生成器 V2

## ✅ 已完成的修改

### 1. 修改 `pregeneration.js`

**修改内容：**

```diff
// 导入部分
- import { getConcurrentGenerator } from './concurrent-generator.js';
+ import { getConcurrentGeneratorV2 } from './concurrent-generator-v2.js';

// executeGeneration 方法
- const generator = getConcurrentGenerator();
- // 使用新的并发生成器
+ const generator = getConcurrentGeneratorV2();
+ // 使用V2并发生成器（保存到聊天记录并显示在UI）
```

**影响：**
- ✅ 预生成的页面现在会保存到聊天记录
- ✅ 预生成的页面会显示在聊天界面
- ✅ 不会触发发送按钮的"正在请求"状态

---

## 🎯 V2 的新特性

### 1. 保存到聊天记录

现在当预生成系统生成页面时，你会在聊天界面看到：

```
You: goto: forest
Assistant: > forest
  say "你来到了一片茂密的森林..."
  choice "探索森林" goto: deep_forest
  choice "返回" goto: start

You: goto: deep_forest
Assistant: > deep_forest
  say "森林深处传来奇怪的声音..."
  ...
```

### 2. 显示在UI

- 每个生成的页面都会作为一条消息显示在聊天界面
- 用户可以看到完整的生成历史
- 可以回溯查看之前生成的内容

### 3. 不触发发送按钮状态

- 发送按钮不会变为"正在请求"状态
- 用户可以正常使用聊天功能
- 不会干扰用户的正常操作

---

## 📊 行为对比

### V1 行为（旧版本）

```
[用户进入游戏]
→ 预生成系统检测到页面变更
→ 后台生成下一层页面
→ ❌ 聊天界面没有任何显示
→ ❌ 聊天记录中没有保存
→ ⚠️ 发送按钮可能闪烁"正在请求"状态
→ 生成完成，数据保存到World Info
```

### V2 行为（新版本）

```
[用户进入游戏]
→ 预生成系统检测到页面变更
→ 生成下一层页面
→ ✅ 聊天界面显示 "You: goto: pageId"
→ ✅ 聊天界面流式显示AI回复
→ ✅ 聊天记录自动保存
→ ✅ 发送按钮状态不变
→ 生成完成，数据保存到World Info
```

---

## ⚠️ 注意事项

### 1. 聊天历史会快速增长

**问题：**
- 预生成系统会自动生成大量页面
- 每个页面都会保存到聊天记录
- 聊天历史会快速增长

**解决方案：**

**方案A：定期清理聊天记录**
```javascript
// 在适当的时候清理聊天记录
// 例如：每次开始新游戏时
async function startNewGame() {
    // 清空聊天记录
    chat.length = 0;
    await saveChat();
    
    // 开始新游戏
    // ...
}
```

**方案B：限制预生成层数**
```javascript
// 在 pregeneration.js 中
async triggerPregeneration(currentPageId) {
    // 只生成第一层，不生成第二层
    await this.pregenerateLayer1(currentPageId);
    // await this.pregenerateLayer2(currentPageId); // 注释掉
}
```

**方案C：添加用户确认**
```javascript
// 在开始预生成前询问用户
async triggerPregeneration(currentPageId) {
    const confirmed = confirm('是否开始预生成下一层页面？这会在聊天记录中显示。');
    if (!confirmed) return;
    
    // 继续预生成
    // ...
}
```

### 2. UI性能考虑

**问题：**
- 并发生成多个页面时，UI会频繁刷新
- 可能会影响性能

**解决方案：**

**方案A：限制并发数量**
```javascript
// 在 generatePages 方法中
async generatePages(parentPageId, childPageIds) {
    // 限制最多同时生成3个页面（而不是10个）
    const maxConcurrent = 3;
    
    for (let i = 0; i < childPageIds.length && i < maxConcurrent; i++) {
        // ...
    }
}
```

**方案B：批量生成**
```javascript
// 分批生成，每批3个
async generatePages(parentPageId, childPageIds) {
    const batchSize = 3;
    for (let i = 0; i < childPageIds.length; i += batchSize) {
        const batch = childPageIds.slice(i, i + batchSize);
        await this.generateBatch(batch);
    }
}
```

### 3. 错误处理

**问题：**
- 如果生成失败，错误消息也会保存到聊天记录

**解决方案：**

**方案A：捕获错误并删除失败的消息**
```javascript
async executeGeneration(slotId, pageId) {
    const generator = getConcurrentGeneratorV2();
    const session = generator.sessions.get(`xb${slotId}`);
    
    try {
        const text = await generator.generatePage(slotId, pageId);
        return text;
    } catch (error) {
        // 删除失败的消息
        if (session?.userMessageIndex >= 0) {
            chat.splice(session.userMessageIndex, 2); // 删除用户消息和AI消息
            await saveChat();
        }
        throw error;
    }
}
```

**方案B：在AI消息中显示错误**
```javascript
// 在 concurrent-generator-v2.js 的 generatePage 方法中
catch (error) {
    session.isStreaming = false;
    session.error = error;
    
    // 更新AI消息显示错误
    this.updateAIMessage(session.aiMessageIndex, `[生成失败: ${error.message}]`);
    await this.saveChatHistory();
    
    throw error;
}
```

---

## 🔄 回滚到V1

如果你发现V2不适合你的使用场景，可以轻松回滚到V1：

```diff
// 在 pregeneration.js 中
- import { getConcurrentGeneratorV2 } from './concurrent-generator-v2.js';
+ import { getConcurrentGenerator } from './concurrent-generator.js';

- const generator = getConcurrentGeneratorV2();
+ const generator = getConcurrentGenerator();
```

---

## 🚀 测试建议

### 1. 基本功能测试

```javascript
// 在浏览器控制台运行
import { getPregenerationSystem } from './oeos-plugin-core/pregeneration.js';

const pregen = getPregenerationSystem('你的WorldInfo名称');
await pregen.triggerPregeneration('start');
```

**检查：**
- ✅ 聊天界面是否显示生成的消息
- ✅ 聊天记录是否保存
- ✅ 发送按钮状态是否正常

### 2. 并发测试

```javascript
// 测试并发生成多个页面
const pregen = getPregenerationSystem('你的WorldInfo名称');
await pregen.generatePages('start', ['page1', 'page2', 'page3']);
```

**检查：**
- ✅ 多个页面是否同时生成
- ✅ UI是否流畅
- ✅ 所有消息是否正确保存

### 3. 错误处理测试

```javascript
// 测试生成不存在的页面
const pregen = getPregenerationSystem('你的WorldInfo名称');
try {
    await pregen.executeGeneration(1, 'nonexistent_page');
} catch (error) {
    console.log('错误处理正常:', error);
}
```

**检查：**
- ✅ 错误是否被正确捕获
- ✅ 聊天记录是否正常
- ✅ 系统是否能继续运行

---

## 📝 推荐配置

基于你的需求（保存到聊天记录并显示），我推荐以下配置：

### 1. 限制预生成层数

```javascript
// 在 pregeneration.js 的 triggerPregeneration 方法中
async triggerPregeneration(currentPageId) {
    if (this.isGenerating) {
        console.log('[OEOS-Pregen] 已有预生成任务在运行，跳过');
        return;
    }

    this.isGenerating = true;
    try {
        console.log(`[OEOS-Pregen] 开始预生成，当前页面: ${currentPageId}`);
        
        // 只生成第一层（直接子页面）
        await this.pregenerateLayer1(currentPageId);
        
        // 不生成第二层，避免聊天记录过多
        // await this.pregenerateLayer2(currentPageId);
        
        console.log('[OEOS-Pregen] 预生成完成');
    } catch (error) {
        console.error('[OEOS-Pregen] 预生成失败:', error);
    } finally {
        this.isGenerating = false;
    }
}
```

### 2. 限制并发数量

```javascript
// 在 pregeneration.js 的 generatePages 方法中
async generatePages(parentPageId, childPageIds) {
    const tasks = [];
    const sessionIds = [];
    
    // 限制最多同时生成3个页面
    const maxConcurrent = 3;
    
    for (let i = 0; i < childPageIds.length && i < maxConcurrent; i++) {
        const childId = childPageIds[i];
        const slotId = this.allocateSlot();
        
        console.log(`[OEOS-Pregen] 生成页面: ${childId} (槽位: ${slotId})`);
        
        const task = this.executeGeneration(slotId, childId);
        tasks.push(task);
        sessionIds.push(`xb${slotId}`);
    }
    
    // 等待所有生成任务完成
    await Promise.all(tasks);
    
    // 释放槽位
    sessionIds.forEach(id => {
        const slotNum = parseInt(id.replace('xb', ''));
        this.usedSlots.delete(slotNum);
    });
    
    // 等待数据更新
    await this.waitForDataUpdate();
}
```

---

## 🎉 总结

✅ **已完成：**
- 修改 `pregeneration.js` 使用 V2
- 预生成的页面现在会保存到聊天记录
- 预生成的页面会显示在聊天界面
- 不会触发发送按钮状态

⚠️ **需要注意：**
- 聊天历史会快速增长
- 建议限制预生成层数或并发数量
- 建议定期清理聊天记录

🚀 **下一步：**
1. 测试预生成功能
2. 根据实际情况调整配置
3. 如有问题，可以随时回滚到V1

