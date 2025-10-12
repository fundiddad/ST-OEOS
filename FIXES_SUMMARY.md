# OEOS 标签格式修正总结

## 修正日期
2025-10-12

## 问题描述

### 错误的标签格式（已移除）
```xml
<!-- ❌ 错误：带 id 属性的标签 -->
<oeos page id="start">
  > start
    say "欢迎..."
</oeos page>

<oeos abstract>
  start: Player starts the game;
</oeos abstract>
```

### 正确的标签格式
```xml
<!-- ✅ 正确：无 id 属性的标签 -->
<oeos page>
  > start
    say "欢迎..."
  
  > forest
    say "你进入了森林..."
</oeos page>

<OEOS-Abstracts>
start: Player starts the game;
forest: Player enters forest;
</OEOS-Abstracts>
```

## 关键区别

| 项目 | 错误格式 | 正确格式 |
|------|---------|---------|
| **页面标签** | `<oeos page id="xxx">` | `<oeos page>` |
| **摘要标签** | `<oeos abstract>` | `<OEOS-Abstracts>` |
| **页面分隔** | 每个页面一个标签 | 一个标签包含多个页面 |
| **页面标识** | 通过 `id` 属性 | 通过 `> pageId` 行 |

## 修正的文件

### 1. 代码文件

#### `src/oeos-plugin-core/index.js`
- **修正前**：使用错误的正则表达式 `/<oeos page id="([^"]+)">([\s\S]*?)<\/oeos page>[\s\S]*?<oeos abstract>([\s\S]*?)<\/oeos abstract>/im`
- **修正后**：移除了整个 `handleAiResponse` 函数，因为该功能已在 `plugin-bridge.js` 中正确实现

#### `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/index.js`
- **修正前**：同上
- **修正后**：同上

#### `src/oeos-plugin-core/plugin-bridge.js`
- **修正前**：
  ```javascript
  markdownOnly: false,
  promptOnly: false,
  ```
- **修正后**：
  ```javascript
  markdownOnly: true,  // 影响显示
  promptOnly: true,    // 影响发送给 AI 的 prompt
  ```
- **说明**：这样 JSONL 文件保存完整原始数据，但显示和发送给 AI 的都是过滤后的摘要

#### `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js`
- **修正**：同上

### 2. 文档文件

#### `src/ARCHITECTURE.md`
- **修正内容**：
  1. 更新正则表达式配置说明，添加 `promptOnly` 和 `markdownOnly` 参数
  2. 明确说明短暂性设置（Ephemerality）的作用
  3. 更新配置方式说明

## 正确的实现

### 1. 提取页面（`extractPagesFromChat`）

```javascript
function extractPagesFromChat(chatArray) {
    const pages = [];
    // 正确：<oeos page> 标签无 id 属性
    const pageBlockRegex = /<oeos page>([\s\S]*?)<\/oeos page>/gi;

    for (const message of chatArray) {
        if (!message.mes) continue;

        let blockMatch;
        // 提取每个 <oeos page>...</oeos page> 块
        while ((blockMatch = pageBlockRegex.exec(message.mes)) !== null) {
            const blockContent = blockMatch[1].trim();

            // 从块内容中提取各个页面（用 "> pageId" 分隔）
            const pageRegex = /> (\w+)\n([\s\S]*?)(?=\n> |\n*$)/g;
            let pageMatch;

            while ((pageMatch = pageRegex.exec(blockContent)) !== null) {
                const pageId = pageMatch[1];
                const content = pageMatch[2].trim();
                pages.push({ pageId, content });
            }
        }
    }

    return pages;
}
```

### 2. 提取摘要（`extractAbstractsFromChat`）

```javascript
function extractAbstractsFromChat(chatArray) {
    const abstracts = [];
    // 正确：<OEOS-Abstracts> 标签（注意大小写）
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

    return abstracts;
}
```

### 3. 正则表达式配置

```javascript
const oeosRegex = {
    id: `oeos-${Date.now()}`,
    scriptName: 'OEOS-Filter',
    findRegex: '/([\\s\\S]*)<OEOS-Abstracts>([\\s\\S]*?)<\\/OEOS-Abstracts>([\\s\\S]*)/gs',
    replaceString: '$2',
    trimStrings: [],
    placement: [2],  // AI_OUTPUT
    disabled: false,
    // 重要：两个都设为 true，这样 JSONL 保存完整原始数据
    markdownOnly: true,  // 影响显示
    promptOnly: true,    // 影响发送给 AI 的 prompt
    runOnEdit: true,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null
};
```

## 短暂性（Ephemerality）说明

### 参数含义

- **`promptOnly: false` + `markdownOnly: false`**（默认）
  - ❌ 直接修改 JSONL 文件中的 `mes` 字段
  - ⚠️ 原始数据永久丢失

- **`promptOnly: true` + `markdownOnly: true`**（推荐）
  - ✅ 不修改 JSONL 文件，原始数据保留
  - ✅ 显示和 prompt 都应用正则过滤
  - ✅ 功能正常，但不写入聊天文件

### 效果对比

| 配置 | JSONL 保存 | 屏幕显示 | 发送给 AI | 推荐度 |
|------|-----------|---------|----------|--------|
| **两个都 false** | ❌ 只有摘要 | ✅ 只显示摘要 | ✅ 只发送摘要 | ⭐ 不推荐 |
| **两个都 true** | ✅ 完整原始数据 | ✅ 只显示摘要 | ✅ 只发送摘要 | ⭐⭐⭐ 推荐 |

## 验证方法

### 1. 检查 JSONL 文件
查看 `src/SillyTavern-release/data/default-user/chats/{角色名}/{聊天文件}.jsonl`

**正确的内容应该包含**：
```json
{
  "mes": "<oeos page>\n> start\n  say \"...\"\n</oeos page>\n\n<OEOS-Abstracts>\nstart: ...;\n</OEOS-Abstracts>"
}
```

### 2. 检查 World Info
查看 `src/SillyTavern-release/data/default-user/worlds/{角色名}-OEOS.json`

**OEOS-Pages 条目应该包含**：
```
> start
  say "欢迎..."

> forest
  say "你进入了森林..."
```

**OEOS-Abstracts 条目应该包含**：
```
start: Player starts the game;
forest: Player enters forest;
```

## 注意事项

1. **已有的聊天记录**：如果之前使用了错误的配置（`promptOnly: false`），已保存的 JSONL 文件中只有摘要，无法恢复完整数据
2. **新的聊天记录**：修正后的配置会保存完整的 AI 回复到 JSONL
3. **World Info 提取**：`extractPagesFromChat` 和 `extractAbstractsFromChat` 函数已正确实现，会从 JSONL 中提取完整数据

## 相关文档

- `src/ARCHITECTURE.md` - 架构设计文档（已更新）
- `src/IMPLEMENTATION.md` - 实现计划文档（无需修改，已正确）
- `oeos-commands.v4.md` - OEOScript v4 语法参考

