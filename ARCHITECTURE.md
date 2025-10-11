# OEOS-SillyTavern 架构设计文档

## 📋 目录

1. [架构概述](#架构概述)
2. [SillyTavern 核心系统](#sillytavern-核心系统)
3. [OEOS 架构](#oeos-架构)
4. [集成架构设计](#集成架构设计)
5. [数据层设计](#数据层设计)
6. [架构演进](#架构演进)
7. [核心原则](#核心原则)

---

## 架构概述

### 系统定位

OEOS-SillyTavern 是一个深度集成的 AI 驱动互动故事系统，将 OEOS 播放器作为 SillyTavern 的前端插件，通过 AI 实时生成 OEOScript v4 格式的故事内容。

### 核心理念

**充分利用 SillyTavern 原生系统**，不重复造轮子：
- ✅ 使用 World Info 存储游戏数据
- ✅ 使用 Prompt Manager 构建 AI 上下文
- ✅ 使用 Regex 系统处理 AI 输出
- ✅ 使用角色卡系统管理角色数据

### 技术栈

- **前端**: Vue.js 2 (OEOS 播放器)
- **后端**: SillyTavern 插件系统 (ES6 模块)
- **数据层**: World Info (JSON)
- **AI 集成**: SillyTavern Prompt Manager + Regex

---

## SillyTavern 核心系统

### 1. 核心控制器 (`script.js`)

**职责**: 应用中心枢纽，管理全局状态和事件总线

**关键导出**:
```javascript
import {
    characters,      // 角色列表数组
    this_chid,       // 当前角色索引
    chat,            // 聊天记录数组
    eventSource,     // 事件总线
    event_types,     // 事件类型枚举
    getRequestHeaders,
    saveChat,
} from '../../../../script.js';
```

**运行环境**:
- ✅ 插件与 ST 在**同一窗口上下文**中运行
- ✅ 可以直接 `import` ST 模块
- ❌ **不需要** `window.parent` 跨窗口通信

### 2. World Info（世界树）系统

#### World Info 分类

**1. 全局 World Info**（用于所有 OEOS 游戏）:
- `WI-OEOS-Pages` - 页面数据库
- `WI-OEOS-State` - 玩家状态和路径
- `WI-OEOS-Graph` - 故事图谱
- `WI-OEOS-Abstracts` - 页面摘要
- `WI-OEOS-DynamicContext` - 动态上下文

**2. 角色专属 World Info** ✨:
- 每个 OEOS 角色都有自己的 World Info 文件（如 `Seraphina-OEOS.json`）
- 通过 `character.data.extensions.world` 绑定到角色
- 包含 `OEOS-character` 标记条目用于识别 OEOS 角色
- 可存储角色特定的游戏数据和设定

**重要原则**：
- ❌ **错误做法**：创建全局 WI 文件存储角色特定数据（如 `WI-OEOS-CharacterContext`）
- ✅ **正确做法**：在角色专属的 World Info 中添加条目

#### 数据结构

```javascript
{
  entries: {
    [uid]: {
      uid: number,           // 唯一标识符
      key: string[],         // 触发关键词（注意：是 key 不是 keys）
      keysecondary: string[], // 次要关键词
      comment: string,       // 条目注释
      content: string,       // 条目内容
      constant: boolean,     // true = 永久激活
      selective: boolean,    // 选择性激活
      order: number,         // 排序优先级
      position: number,      // 插入位置
      role: number,          // 角色类型
      enabled: boolean,      // 是否启用
      probability: number,   // 激活概率
      depth: number,         // 扫描深度
      // ...更多字段
    }
  }
}
```

#### API

```javascript
import { loadWorldInfo, saveWorldInfo } from '../../../world-info.js';

// 加载 World Info
const data = await loadWorldInfo('WI-Name');

// 保存 World Info
await saveWorldInfo('WI-Name', data, immediately);
```

#### 激活机制

- `constant: true` - 永久激活，始终包含在 AI 上下文中
- `key` 匹配 - 当聊天内容包含关键词时激活
- `selected_world_info` - 全局激活的 World Info 列表

#### OEOS 角色标记系统 ✨

**目的**: 区分普通角色和 OEOS 支持的角色

**实现方式**:
1. 在角色的 World Info 中添加 `OEOS-character` 标记条目
2. 通过检查该条目判断角色是否为 OEOS 角色

**标记条目示例**:
```javascript
{
  uid: 1234567890,
  key: ['OEOS-character', 'OEOS', 'interactive'],
  comment: 'OEOS Character Marker',
  content: 'This character is enabled for OEOS interactive gameplay...',
  constant: false,
  selective: true,
  order: 0,
  enabled: true
}
```

**相关 API**:
- `isOEOSCharacter(charIndex)` - 检查角色是否为 OEOS 角色
- `enableOEOSForCharacter(charIndex)` - 为角色启用 OEOS 支持

### 3. 角色卡（Character Card）系统

**核心字段**:
```javascript
{
  name: string,              // 角色名称
  description: string,       // 角色描述
  personality: string,       // 性格特征
  scenario: string,          // 场景设定
  first_mes: string,         // 第一条消息
  mes_example: string,       // 对话示例
  avatar: string,            // 头像文件名
  chat: string,              // 关联的聊天文件
  data: {
    extensions: {
      world: string,         // 关联的 World Info 名称
      regex_scripts: Array   // 角色专属正则表达式
    }
  }
}
```

**访问方式**:
```javascript
import { characters, this_chid } from '../../../../script.js';

// 获取当前角色
const currentChar = characters[this_chid];

// 获取所有角色
const allChars = characters;
```

### 4. 聊天记录系统

**消息结构**:
```javascript
{
  name: string,        // 发送者名称
  is_user: boolean,    // 是否为用户消息
  mes: string,         // 消息内容
  send_date: number,   // 发送时间戳
  extra: object        // 额外数据
}
```

**访问方式**:
```javascript
import { chat } from '../../../../script.js';

// 获取最近 20 条消息
const recentChat = chat.slice(-20);
```

### 5. 正则表达式系统

**应用位置**:
- `USER_INPUT` - 用户输入
- `AI_OUTPUT` - AI 输出
- `SLASH_COMMAND` - 斜杠命令
- `WORLD_INFO` - World Info 内容
- `REASONING` - 推理过程

**API**:
```javascript
import { getRegexedString, regex_placement } from '../../extensions/regex/engine.js';

// 应用正则表达式
const processed = getRegexedString(rawString, regex_placement.AI_OUTPUT, params);
```

**角色正则激活**:
```javascript
import { extension_settings, saveSettingsDebounced } from '../../extensions.js';

// 激活角色正则
if (!extension_settings.character_allowed_regex) {
    extension_settings.character_allowed_regex = [];
}
extension_settings.character_allowed_regex.push(char.avatar);
saveSettingsDebounced();
```

### 6. Prompt Manager 系统

**职责**: 动态构建发送给 AI 的最终提示词

**组成部分**:
1. 系统提示词
2. 角色设定
3. World Info 条目（按 order 排序）
4. 聊天历史
5. 作者笔记
6. 用户输入

**上下文构建流程**:
```
系统提示词 → 角色描述 → World Info (constant=true) →
聊天历史 → World Info (keys 匹配) → 用户输入
```

---

## OEOS 架构

### 1. 页面驱动模型

**核心概念**: 故事被组织成独立的"页面（Page）"，通过 `goto` 命令跳转

**页面结构**:
```
[page id="start"]
  say "欢迎来到冒险世界！"
  choice "进入森林" goto="forest"
  choice "进入城镇" goto="town"
[/page]

[page id="forest"]
  say "你进入了茂密的森林..."
  // ...
[/page]
```

### 2. 编译执行流程

```
OEOScript v4 源码
    ↓
pageCompiler.js 编译
    ↓
JavaScript 代码
    ↓
JS-Interpreter 沙箱执行
    ↓
Vue 组件渲染
```

**关键文件**:
- `src/openeos-master/src/util/pageCompiler.js` - 编译器
- `src/openeos-master/src/interpreter/` - 沙箱解释器
- `src/openeos-master/src/components/` - UI 组件

### 3. Vue 应用结构

```
App.vue (主应用)
  ├── CharacterSelector.vue (角色选择)
  ├── OpenEosPlayer.vue (游戏播放器)
  │   ├── Bubble 组件 (say, choice, prompt)
  │   ├── Media 组件 (image, audio, video)
  │   └── Control 组件 (按钮, 输入框)
  └── Loading.vue (加载动画)
```

---

## 集成架构设计

### 1. 运行环境

```
┌─────────────────────────────────────────────────────────────┐
│                    SillyTavern 窗口                          │
│                                                              │
│  ┌──────────────────────┐         ┌──────────────────────┐ │
│  │  ST 核心             │         │  OEOS 插件           │ │
│  │  (script.js)         │         │  (plugin-bridge.js)  │ │
│  │                      │         │                      │ │
│  │  - characters        │◄────────│  - getCharacters()   │ │
│  │  - chat              │  import │  - bindCharacter()   │ │
│  │  - world_info        │         │  - initGameData()    │ │
│  │  - eventSource       │         │                      │ │
│  └──────────────────────┘         └──────────────────────┘ │
│                                             │               │
│                                             │ window.oeosApi│
│                                             ▼               │
│                                    ┌──────────────────────┐ │
│                                    │  Vue 应用            │ │
│                                    │  (App.vue)           │ │
│                                    │                      │ │
│                                    │  - 角色选择          │ │
│                                    │  - 游戏播放          │ │
│                                    │  - 状态管理          │ │
│                                    └──────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. 模块依赖关系

```
App.vue
  ↓ window.oeosApi
plugin-bridge.js
  ↓ import
script.js (ST 核心)
world-info.js (ST 核心)
extensions.js (ST 核心)
```

### 3. 数据流

```
用户操作 (Vue) → window.oeosApi.updateState() → plugin-bridge.js 更新 World Info →
SillyTavern Prompt Manager 构建上下文 → AI 生成新内容 → Regex 提取页面数据 →
plugin-bridge.js 保存到 World Info → Vue 应用读取并渲染
```

---

## 数据层设计

### World Info Schema

所有游戏数据存储在专门的 World Info 条目中，采用**紧凑的文本格式**以最大化 Token 效率。

#### 1. 页面存储 (`WI-OEOS-Pages`)

**用途**: 所有 OEOS 页面的主数据库

**内容**: 完整的 OEOScript v4 格式字符串（保留换行和缩进）

**激活状态**: **永不激活** - 仅作为数据仓库，不消耗 AI 上下文

**更新方式**: 由正则表达式捕获 `<oeos page>` 标签后，通过插件 API 写入

**OEOScript v4 格式示例**:
```yaml
> start
  say "欢迎来到冒险世界！"
  choice:
    - "进入森林":
      - goto: forest
    - "访问村庄":
      - goto: village

> forest
  say "你进入了茂密的森林..."
  choice:
    - "继续前进":
      - goto: cave
    - "返回":
      - goto: start
```

**存储格式**（包含在 `<oeos page>` 标签中）:
```xml
<oeos page id="start">
- say: "欢迎来到冒险世界！"
- choice:
  - "进入森林":
    - goto: forest
  - "访问村庄":
    - goto: village
</oeos page>
```

#### 2. 状态与路径 (`WI-OEOS-State`)

**用途**: 记录玩家的完整行动轨迹和每个节点的状态

**内容格式**: 使用 `>` 分隔的路径字符串，括号包裹变量状态
```
start(hp:100,gold:500) > forest(hp:100,gold:450) > cave(hp:90,gold:450,sex:0)
```

**激活状态**: **永远激活** - 为 AI 提供"玩家在哪"和"如何到达"的完整记忆

**更新方式**: OEOS 播放器每进入新页面或变量变化时通知插件更新

#### 3. 故事图谱 (`WI-OEOS-Graph`)

**用途**: 存储已探索页面的连接关系，形成有向图

**内容格式**: 使用 `;` 分隔的邻接表
```
start > forest, town; forest > cave, river; town > shop, inn;
```

**激活状态**: **永远激活** - 为 AI 提供故事的宏观结构

**更新方式**: 新页面生成时，插件解析 `goto` 指令并更新图谱

#### 4. 页面摘要 (`WI-OEOS-Abstracts`)

**用途**: 存储所有页面的文本摘要

**内容格式**: 使用 `;` 分隔的键值对
```
start: 故事的开端...; forest: 你进入了森林...; cave: 你发现了一个阴暗的洞穴;
```

**激活状态**: **永远激活** - 让 AI 以低 Token 成本"速览"大量页面

**更新方式**: 由正则表达式捕获 `<oeos abstract>` 标签后更新

#### 5. 动态上下文 (`WI-OEOS-DynamicContext`)

**用途**: **核心** - 动态计算生成，为 AI 提供生成下一个页面所需的详细参考

**激活状态**: **永远激活**

**构建逻辑**:
1. **识别种子页面**:
   - 当前页面 ID（从 `WI-OEOS-State` 获取）
   - 当前页面的所有子页面 ID（从 `WI-OEOS-Graph` 获取）
   - 路径中最近 5 个页面 ID

2. **扩展历史上下文**:
   - 遍历历史页面，查找它们的子页面

3. **聚合与提取**:
   - 合并所有页面 ID 并去重
   - 从 `WI-OEOS-Pages` 提取完整源码

4. **生成最终内容**:
   - 拼接所有 OEOScript v4 源码，形成大代码块

**更新时机**: 当 `WI-OEOS-State` 更新时立即触发重写

#### 6. 角色绑定数据 (`WI-OEOS-CharacterContext`)

**用途**: 存储选定角色的核心信息作为游戏背景

**内容格式**:
```
角色: Alice
描述: 一位勇敢的冒险家...
性格: 好奇、勇敢、善良
场景: 在一个神秘的魔法世界中...
```

**激活状态**: **永远激活**

**更新方式**: 角色选择后一次性写入

#### 7. 聊天历史上下文 (`WI-OEOS-ChatHistory`)

**用途**: 整合角色的聊天历史到游戏中

**内容格式**:
```
最近对话:
User: 你好，Alice
Character: 你好！很高兴见到你
User: 我们去冒险吧
Character: 好的，我准备好了！
```

**激活状态**: 可选激活（根据需要）

**更新方式**: 角色绑定时提取最近 20 条消息

### 数据流图

```
OEOS 播放器
    ↓ updateState()
plugin-bridge.js
    ↓ 更新 WI-OEOS-State
    ↓ 触发重写 WI-OEOS-DynamicContext
SillyTavern Prompt Manager
    ↓ 组合所有激活的 WI
AI 生成
    ↓ 输出 <oeos page> 和 <oeos abstract>
Regex 系统
    ↓ 提取数据
plugin-bridge.js
    ↓ 更新 WI-OEOS-Pages 和 WI-OEOS-Graph
OEOS 播放器
    ↓ getPage() 读取新页面
渲染并继续游戏
```

---

## 架构演进

### 阶段 1: 错误的做法（已废弃）

#### 问题 1: 使用 window 对象

```javascript
// ❌ 错误：污染全局命名空间
window.stOeosPlugin = {
    initGameData,
    getPage,
    updateState,
};

// ❌ 错误：在 Vue 组件中访问
if (window.stOeosPlugin) {
    this.characters = window.stOeosPlugin.getCharacters();
}
```

**问题**:
- 污染全局命名空间
- 无类型安全
- 难以追踪依赖关系
- 不符合 ST 插件规范

#### 问题 2: 使用 window.parent

```javascript
// ❌ 错误：假设在 iframe 中运行
window.parent.stOeosPlugin.updateState(newState);
```

**问题**:
- OEOS 不在 iframe 中运行
- 与 ST 在同一窗口上下文
- 跨窗口通信是不必要的

#### 问题 3: Vue 应用直接 import ST 文件

```javascript
// ❌ 错误：导致构建失败
import { initGameData } from '../../SillyTavern-release/.../plugin-bridge.js'
```

**问题**:
- webpack 尝试编译 ST 所有文件
- ESLint 配置冲突
- 依赖耦合，无法独立构建

### 阶段 2: 全局 API 桥接（过渡方案）

```javascript
// 插件暴露全局 API
window.oeosApi = {
    initGameData,
    getPage,
    updateState,
};

// Vue 应用使用全局 API
if (window.oeosApi) {
    await window.oeosApi.initGameData();
}
```

**优势**:
- ✅ Vue 应用可以独立构建
- ✅ 不需要 import ST 文件
- ✅ 解决了构建问题

**缺点**:
- ⚠️ 仍然使用全局对象
- ⚠️ 不符合 ST 插件规范

### 阶段 3: ES6 模块（当前方案）✅

#### 插件端 (plugin-bridge.js)

```javascript
// ✅ 正确：导入 ST 模块
import { characters, this_chid, chat } from '../../../../script.js';
import { loadWorldInfo, saveWorldInfo } from '../../../world-info.js';

// ✅ 正确：导出函数
export function getCharacters() {
    return characters.map((char, index) => ({
        index,
        name: char.name,
        avatar: char.avatar,
    }));
}

export async function bindCharacter(charIndex) {
    // 实现逻辑
}

// ✅ 正确：统一导出
export {
    initGameData,
    getPage,
    updateState,
};
```

#### Vue 应用端 (App.vue)

```javascript
// ✅ 正确：使用全局 API（解耦）
export default {
    methods: {
        async startGame() {
            if (!window.oeosApi) {
                throw new Error('OEOS API not available');
            }
            await window.oeosApi.initGameData();
        }
    }
}
```

**说明**: Vue 应用仍使用 `window.oeosApi`，因为：
1. Vue 应用需要独立构建，不能 import ST 文件
2. 插件在运行时将 API 暴露到 `window.oeosApi`
3. 这是解耦架构的必要妥协

#### 其他 ST 插件参考

```javascript
// Gallery 插件
import { eventSource, this_chid, characters } from '../../../script.js';
const currentChar = characters[this_chid];

// Memory 插件
import { getContext, extension_settings } from '../../extensions.js';
await generateQuietPrompt(...);

// Quick Reply 插件
import { chat, chat_metadata, eventSource } from '../../../script.js';
export let quickReplyApi;
```

### 架构对比表

| 方面 | window 对象 | 全局 API 桥接 | ES6 模块 |
|------|------------|--------------|----------|
| **数据传递** | `window.stOeosPlugin` | `window.oeosApi` | `import/export` |
| **跨模块通信** | 全局对象 | 全局对象 | ES6 模块 |
| **类型安全** | ❌ | ❌ | ✅ (可用 TS) |
| **命名空间** | 污染全局 | 污染全局 | 模块化隔离 |
| **调试** | 难以追踪 | 较难追踪 | 清晰依赖 |
| **符合规范** | ❌ | ⚠️ | ✅ |
| **Vue 独立构建** | ❌ | ✅ | ✅ |

---

## 核心原则

### 1. 不重复造轮子

**充分利用 SillyTavern 原生系统**:
- ✅ World Info 存储数据
- ✅ Prompt Manager 构建上下文
- ✅ Regex 系统处理输出
- ✅ 角色卡管理角色
- ✅ 事件系统监听变化

### 2. 模块化设计

**单一职责原则**:
- `plugin-bridge.js` - API 桥接
- `game-state.js` - 状态管理
- `context-engine.js` - 上下文构建
- `st-api.js` - ST API 封装
- `ui.js` - UI 加载

### 3. 解耦架构

**Vue 应用与插件分离**:
- Vue 应用通过 `window.oeosApi` 访问插件
- 插件通过 ES6 模块访问 ST
- 两者可以独立开发和构建

### 4. 数据驱动

**所有状态存储在 World Info**:
- 游戏数据持久化
- AI 可以访问完整上下文
- 支持保存/加载
- 跨会话保持状态

### 5. 事件驱动

**监听 ST 事件**:
```javascript
import { eventSource, event_types } from '../../../../script.js';

eventSource.on(event_types.CHAT_CHANGED, () => {
    // 处理聊天变化
});

eventSource.on(event_types.CHARACTER_SELECTED, () => {
    // 处理角色选择
});
```

### 6. Token 效率优化

**紧凑的数据格式**:
- 使用简洁的文本格式而非 JSON
- 动态上下文只包含相关页面
- 摘要系统减少 Token 消耗

### 7. 安全性

**沙箱执行**:
- OEOScript 在 JS-Interpreter 沙箱中执行
- 限制访问浏览器 API
- 防止恶意代码执行

### 8. 使用 toastr 通知系统

**统一使用 SillyTavern 的 toastr**:
- ✅ 使用 `toastr.info()` 显示信息
- ✅ 使用 `toastr.success()` 显示成功
- ✅ 使用 `toastr.warning()` 显示警告
- ✅ 使用 `toastr.error()` 显示错误
- ❌ 避免使用 `console.log()` 作为用户反馈

**示例**:
```javascript
// ✅ 正确：使用 toastr
toastr.info('[OEOS] 正在初始化...');
toastr.success('[OEOS] 初始化成功');
toastr.error(`[OEOS] 错误: ${error.message}`);

// ❌ 错误：仅用 console（用户看不到）
console.log('初始化成功'); // 仅用于调试
```

---

## 最佳实践

### 1. 使用 ES6 模块

```javascript
// ✅ 正确
import { characters } from '../../../../script.js';
export function getCharacters() { ... }

// ❌ 错误
window.myPlugin = { ... };
```

### 2. 检查 API 可用性

```javascript
// ✅ 正确
if (!window.oeosApi) {
    throw new Error('OEOS API not available');
}
await window.oeosApi.initGameData();

// ❌ 错误
window.oeosApi.initGameData(); // 可能报错
```

### 3. 使用事件而非轮询

```javascript
// ✅ 正确
eventSource.on(event_types.CHAT_CHANGED, handleChatChange);

// ❌ 错误
setInterval(() => checkChatChange(), 1000);
```

### 4. 保持 World Info 紧凑

```javascript
// ✅ 正确：紧凑格式
"start(hp:100) > forest(hp:90) > cave(hp:80)"

// ❌ 错误：冗长格式
JSON.stringify({
    path: [
        { page: "start", state: { hp: 100 } },
        { page: "forest", state: { hp: 90 } },
    ]
})
```

### 5. 异步操作使用 async/await

```javascript
// ✅ 正确
async function loadData() {
    const data = await loadWorldInfo('WI-Name');
    return data;
}

// ❌ 错误
function loadData() {
    loadWorldInfo('WI-Name').then(data => { ... });
}
```

---

## 参考资源

- **SillyTavern 官方文档**: [GitHub](https://github.com/SillyTavern/SillyTavern)
- **OEOS 命令参考**: `oeos-commands.v4.md`
- **实现指南**: `IMPLEMENTATION.md`
- **官方插件示例**: `SillyTavern-release/public/scripts/extensions/`

---

**文档版本**: 1.0
**最后更新**: 2025-10-11
    ↓
plugin-bridge.js 更新 World Info
    ↓
SillyTavern Prompt Manager 构建上下文
    ↓
AI 生成新内容
    ↓
Regex 提取页面数据
    ↓
plugin-bridge.js 保存到 World Info
    ↓
Vue 应用读取并渲染
```

---

## 数据层设计

### World Info Schema

所有游戏数据存储在专门的 World Info 条目中，采用**紧凑的文本格式**以最大化 Token 效率。


