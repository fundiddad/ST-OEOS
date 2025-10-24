# 🐛 预生成系统Bug修复

## 问题描述

预生成系统启动后出现错误：
```
TypeError: executeSlashCommandsWithOptions is not a function
```

## 根本原因

尝试通过导入 `executeSlashCommandsWithOptions` 来执行斜杠命令，但这个函数的导入方式不正确。

## 解决方案

**直接调用 LittleWhiteBox API**，而不是尝试执行斜杠命令字符串。

### 修改前（错误的方式）

```javascript
async executeGeneration(slotId, pageId) {
    const command = `/xbgenraw id=${slotId} as=system goto: ${pageId}`;
    const sessionId = await this.executeSTscript(command);
    await this.waitForGenerationComplete(`xb${slotId}`);
}

async executeSTscript(command) {
    // 尝试多种方式执行斜杠命令字符串
    const { executeSlashCommandsWithOptions } = await import('../../../../script.js');
    return await executeSlashCommandsWithOptions(command, {});
}
```

### 修改后（正确的方式）

```javascript
async executeGeneration(slotId, pageId) {
    // 检查LittleWhiteBox是否可用
    if (typeof window === 'undefined' || !window.streaming) {
        throw new Error('LittleWhiteBox插件未加载');
    }
    
    // 构建参数
    const args = {
        id: slotId,
        as: 'system'
    };
    const prompt = `goto: ${pageId}`;
    
    // 直接调用LittleWhiteBox API
    const sessionId = await window.streaming.xbgenrawCommand(args, prompt);
    console.log(`[OEOS-Pregen] 页面 ${pageId} 开始生成 (会话: ${sessionId})`);
    
    // 等待生成完成
    await this.waitForGenerationComplete(sessionId);
    
    console.log(`[OEOS-Pregen] 页面 ${pageId} 生成完成`);
}
```

## 修改的文件

1. ✅ `src/oeos-plugin-core/pregeneration.js` (第148-176行)
2. ✅ `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/pregeneration.js` (第148-176行)

## 关键改进

1. **直接API调用**：使用 `window.streaming.xbgenrawCommand(args, prompt)` 而不是执行斜杠命令字符串
2. **正确的参数格式**：
   - `args`: `{ id: slotId, as: 'system' }`
   - `prompt`: `goto: ${pageId}`
3. **删除了不必要的代码**：移除了 `executeSTscript()` 方法及其3种失败的方案
4. **更好的错误处理**：检查 `window.streaming` 是否存在

## 测试步骤

1. 刷新浏览器页面（Ctrl+F5 或 Cmd+Shift+R）
2. 打开浏览器控制台（F12）
3. 观察日志输出，应该看到：
   ```
   [OEOS-Pregen] 预生成系统已启动
   [OEOS-Pregen] 页面变更: null -> start
   [OEOS-Pregen] 开始预生成，当前页面: start
   [OEOS-Pregen] 第一层缺失页面: xxx, yyy
   [OEOS-Pregen] 页面 xxx 开始生成 (会话: xb1)
   ```

## 预期结果

- ✅ 不再出现 `executeSlashCommandsWithOptions is not a function` 错误
- ✅ 预生成系统正常启动
- ✅ 页面生成请求成功发送到LittleWhiteBox
- ✅ AI开始生成页面内容

## 后续优化

如果仍然有问题，可能需要检查：
1. LittleWhiteBox插件是否已正确加载
2. `window.streaming` 对象是否存在
3. AI API配置是否正确
4. 预设是否已激活

---

**修复时间**: 2025-10-24
**修复人**: AI Assistant
**状态**: ✅ 已修复

