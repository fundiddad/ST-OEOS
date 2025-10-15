# OEOS-SillyTavern 架构设计文档

> **文档目的**: 详细说明 SillyTavern 核心系统、OEOS 架构以及 OEOS-SillyTavern 插件的集成架构设计，为开发者提供全面的技术参考。

## 📋 目录

1. [SillyTavern 核心系统](#sillytavern-核心系统)
2. [OEOS 架构](#oeos-架构)
3. [OEOS-SillyTavern 插件架构](#oeos-sillytavern-插件架构)
4. [核心原则](#核心原则)
5. [变更记录](#变更记录)

---

## SillyTavern 核心系统

> **说明**: 本章节详细介绍 SillyTavern 的核心系统和 API，这些是 OEOS 插件集成的基础。所有信息均基于 SillyTavern 实际代码。

### 1. 核心控制器 (`script.js`)

**职责**: SillyTavern 的中心枢纽，管理全局状态、角色数据、聊天记录和事件总线。

**关键导出**:
```javascript
import {
    characters,           // 角色列表数组
    this_chid,            // 当前选中的角色索引
    chat,                 // 当前聊天记录数组
    eventSource,          // 事件总线对象
    event_types,          // 事件类型枚举
    getRequestHeaders,    // 获取 HTTP 请求头
    saveChat,             // 保存聊天记录函数
    saveSettingsDebounced // 防抖保存设置函数
} from '../../../../script.js';
```

**运行环境**:
- ✅ 插件与 SillyTavern 在**同一窗口上下文**中运行
- ✅ 可以直接使用 ES6 `import` 导入 ST 模块
- ❌ **不需要** `window.parent` 或 `postMessage` 跨窗口通信

---

### 2. World Info（世界树）系统

**用途**: SillyTavern 的知识库系统，用于存储和管理游戏世界的背景信息、角色设定、状态数据等。World Info 条目可以根据关键词自动激活，注入到 AI 的上下文中。

#### 数据结构

每个 World Info 文件是一个 JSON 对象，包含多个条目：

```javascript
{
  entries: {
    [uid]: {
      uid: number,            // 唯一标识符（通常是时间戳）
      key: string[],          // 触发关键词数组（注意：字段名是 key 不是 keys）
      keysecondary: string[], // 次要关键词数组
      comment: string,        // 条目注释（用于管理）
      content: string,        // 条目内容（注入到 AI 上下文）
      constant: boolean,      // true = 永久激活，始终包含在上下文中
      selective: boolean,     // 是否启用选择性激活
      order: number,          // 排序优先级（数字越小越优先）
      position: number,       // 插入位置（0=角色定义后，1=示例对话后等）
      role: number,           // 角色类型（0=系统，1=用户，2=助手）
      enabled: boolean,       // 是否启用此条目
      probability: number,    // 激活概率（0-100）
      depth: number,          // 扫描深度（从最新消息向前扫描的消息数）
      // ...更多字段
    }
  }
}
```

#### API 接口

```javascript
import { loadWorldInfo, saveWorldInfo } from '../../../world-info.js';

// 加载 World Info 文件
const data = await loadWorldInfo('WI-Name');
// 返回: { entries: {...} } 或 null（如果不存在）

// 保存 World Info 文件
await saveWorldInfo('WI-Name', data, immediately);
// immediately: boolean - 是否立即保存（true）或防抖保存（false）
```

#### 激活机制

World Info 条目通过以下方式激活：

1. **永久激活** (`constant: true`)
   - 始终包含在 AI 上下文中
   - 适用于核心设定、规则说明等

2. **关键词激活** (`key` 匹配)
   - 当聊天记录中包含 `key` 或 `keysecondary` 中的关键词时激活
   - 扫描深度由 `depth` 字段控制

3. **全局激活** (`selected_world_info`)
   - 在 SillyTavern 设置中手动选择的 World Info 文件
   - 该文件中的所有条目都会被激活

#### World Info 分类

**核心原则**：每个角色就是一个独立的游戏，所有游戏数据都存储在角色专属的 World Info 中。

**角色专属 World Info**（`{角色名}-OEOS.json`）:
- 每个 OEOS 角色都有自己的 World Info 文件（如 `test1-OEOS.json`）
- 通过 `character.data.extensions.world` 字段绑定到角色
- 包含该角色游戏的所有数据：

  **1. OEOS Character Marker** - 标记条目
  - **用途**：仅用于识别 OEOS 角色
  - **激活状态**：`disable: true`（永不激活）
  - **数据格式**：`key: ['OEOS-character']`，无内容

  **2. OEOS-Pages** - 页面数据库
  - **用途**：存储该角色游戏的所有 OEOScript 页面
  - **激活状态**：`disable: true`（永不激活）
  - **数据来源**：从聊天记录中提取 `<OEOS-Pages>...</OEOS-Pages>` 标签内容（注意：标签无 `id` 属性）
  - **提取时机**：每次进入游戏时，遍历该角色的**所有聊天记录**，提取所有 `<OEOS-Pages>` 标签内容
  - **数据格式**：纯 OEOScript v4 代码（无 XML 标签），多个页面直接拼接
  - **AI 回复示例**（包含 XML 标签）：
    ```xml
    <OEOS-Pages>
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
        - "继续探索":
          - goto: deep_forest
    </OEOS-Pages>
    ```
  - **存储格式**（提取后，无 XML 标签）：
    ```
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
        - "继续探索":
          - goto: deep_forest
    ```

  **3. OEOS-State** - 玩家状态和路径
  - **用途**：记录玩家的游戏路径和变量状态
  - **激活状态**：`constant: true`（**永久激活**，注入到 AI 上下文）
  - **数据来源**：OEOS 引擎每次页面跳转时上报
  - **上报机制**：每到一个页面，OEOS 引擎发送当前页面 ID 和当前**所有变量**
  - **数据格式**：`pageId(变量1:值1,变量2:值2) > pageId(变量1:值1) > ...`
  - **示例**：`start(initialized:1) > forest(hp:100,gold:50) > cave(hp:80,gold:70)`
  - **用途说明**：
    - 记录玩家的完整游戏路径
    - 记录每个页面的所有变量状态
    - 用于恢复游戏进度（从最后位置继续）
    - 用于计算动态上下文（向前追溯历史）

  **4. OEOS-Graph** - 页面关系图
  - **用途**：记录页面之间的跳转关系（有向图）
  - **激活状态**：`constant: true`（**永久激活**，注入到 AI 上下文）
  - **数据来源**：从页面中自动提取 `goto` 命令
  - **数据格式**：`父页面 > 子页面1, 子页面2;`
  - **示例**：
    ```
    start > forest, village;
    forest > deep_forest, river;
    cave > treasure, exit;
    ```

  **5. OEOS-Abstracts** - 页面摘要
  - **用途**：存储每个页面的简短摘要，用于 Token 优化
  - **激活状态**：`constant: true`（**永久激活**，注入到 AI 上下文）
  - **数据来源**：从聊天记录中提取 `<OEOS-Abstracts>...</OEOS-Abstracts>` 标签内容
  - **提取时机**：每次进入游戏时，遍历该角色的**所有聊天记录**，提取所有 `<OEOS-Abstracts>` 标签内容
  - **AI 回复示例**（包含 XML 标签）：
    ```xml
    <OEOS-Abstracts>
    start: The adventure begins...;
    forest: Player enters a dense forest;
    </OEOS-Abstracts>
    ```
  - **存储格式**（提取后，无 XML 标签）：
    ```
    start: The adventure begins...;
    forest: Player enters a dense forest;
    cave: Player discovers a mysterious cave;
    ```
  - **数据格式**：`pageId: 摘要文本;`（每个摘要以分号结尾）

  **6. OEOS-DynamicContext** - 动态上下文
  - **用途**：根据玩家当前位置，动态计算需要提供给 AI 的页面内容
  - **激活状态**：`constant: true`（**永久激活**，注入到 AI 上下文）
  - **数据来源**：根据 OEOS-State 和 OEOS-Graph 动态计算
  - **数据格式**：相关页面的完整 OEOScript v4 代码（纯代码，无 XML 标签）
  - **计算逻辑**：
    1. 从 OEOS-State 获取当前位置（最后一个页面 ID）
    2. 从 OEOS-Graph 获取页面关系图
    3. **向前 5 个页面**：从 State 路径中提取最近 5 个页面 ID，并从 Graph 中获取这些页面的所有子页面
    4. **向后 1 个页面**：从 Graph 中获取当前页面的所有子页面
    5. 合并所有相关页面 ID（去重）
    6. 从 OEOS-Pages 提取这些 ID 的完整内容（如果页面不存在则忽略）
  - **计算示例**：
    - **OEOS-State**：`S > A1 > B2 > C2 > B1 > C3 > D2 > E3 > F3`（当前在 F3）
    - **OEOS-Graph**：
      ```
      F3 > G1,G2,G3,F2;
      B2 > C2,C5,C3,A2;
      C2 > D5,D2,D4,B1;
      B1 > C6,C2,C3;
      C3 > D7,D2,D5,B3;
      D2 > E1,E2,E3;
      E3 > F4,F8,F3;
      ```
    - **向前 5 个页面**：`C2 > B1 > C3 > D2 > E3`
      - 从 Graph 提取这些页面的关系：
        ```
        C2 > D5,D2,D4,B1;
        B2 > C2,C5,C3,A2;
        C3 > D7,D2,D5,B3;
        D2 > E1,E2,E3;
        E3 > F4,F8,F3;
        ```
      - 涉及的所有页面 ID：`C2, D5, D2, D4, B1, B2, C5, C3, A2, C3, D7, D5, B3, E1, E2, E3, F4, F8, F3`
    - **向后 1 个页面**：`F3 > G1,G2,G3,F2;`
      - 涉及的页面 ID：`F3, G1, G2, G3, F2`
    - **最终相关页面 ID**：合并去重后的所有 ID
    - **OEOS-DynamicContext 内容**：从 OEOS-Pages 提取这些 ID 的完整内容
  - **存储示例**：
    ```
    > forest
      say "你进入了茂密的森林..."
      choice:
        - "继续探索":
          - goto: deep_forest

    > deep_forest
      say "森林越来越深..."

    > cave
      say "你发现了一个洞穴..."
    ```

**重要原则**：
- ❌ **错误做法**：创建全局 WI 文件存储游戏数据（如 `WI-OEOS-Pages`、`WI-OEOS-State`）
- ✅ **正确做法**：所有游戏数据都存储在角色专属的 World Info 中
- ❌ **错误做法**：创建全局 WI 文件存储角色数据（如 `WI-OEOS-CharacterContext`）
- ✅ **正确做法**：在角色专属的 World Info 中添加条目

---

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

---

### 4. 正则表达式系统

**用途**: 在 AI 回复后自动处理消息内容，提取或替换特定格式。

**为什么需要正则表达式**：
- SillyTavern 会自动将聊天记录发送给 AI
- 如果不过滤，会导致发送大量垃圾内容（如 `<thinking>` 标签、完整的 `<OEOS-Pages>` 内容）污染 AI 上下文
- 正则表达式可以将 AI 回复中的所有内容替换为 `<OEOS-Abstracts>` 标签内的摘要内容
- **重要**：通过设置 `promptOnly: true` 和 `markdownOnly: true`，正则表达式**不会修改**存储在 JSONL 文件中的原始数据，只影响显示和发送给 AI 的聊天记录

**OEOS 使用的正则表达式**:
```javascript
{
  scriptName: 'OEOS-Filter',
  findRegex: '/([\\s\\S]*)<OEOS-Abstracts>([\\s\\S]*?)<\\/OEOS-Abstracts>([\\s\\S]*)/gs',
  replaceString: '$2',  // 只保留 Abstracts 内容
  trimStrings: [],
  placement: [2],  // AI_OUTPUT
  disabled: false,
  markdownOnly: true,  // 影响显示
  promptOnly: true,    // 影响发送给 AI 的 prompt
  runOnEdit: true
}
```

**效果示例**:
- **AI 原始回复**：
  ```xml
  <thinking>
  玩家选择了进入森林，我需要生成森林页面...
  </thinking>

  <OEOS-Pages>
  > forest
    say "你进入了茂密的森林..."
    choice:
      - "继续探索":
        - goto: deep_forest
  </OEOS-Pages>

  <OEOS-Abstracts>
  forest: Player enters a dense forest;
  </OEOS-Abstracts>
  ```
- **显示内容**（经过正则过滤）：
  ```
  forest: Player enters a dense forest;
  ```
- **原始数据（JSONL）**：保持不变，仍包含完整的 AI 回复（因为 `promptOnly: true` 和 `markdownOnly: true`）
- **发送给 AI 的聊天记录**：只包含摘要内容，大幅减少 Token 消耗

**配置方式**:
- 存储在角色的 `character.data.extensions.regex_scripts` 数组中
- **作用范围**：`placement: [2]`（AI_OUTPUT，只作用于 AI 输出）
- **短暂性设置**：`promptOnly: true` 和 `markdownOnly: true`（不修改 JSONL 文件）

---

### 5. 事件系统（EventSource）

**用途**: SillyTavern 的事件总线，用于监听和触发应用事件。

**主要事件类型**:
- `APP_READY` - 应用完全加载并准备就绪
- `MESSAGE_RECEIVED` - AI 消息生成并记录到 chat 对象
- `MESSAGE_SENT` - 用户消息发送并记录到 chat 对象
- `USER_MESSAGE_RENDERED` - 用户消息渲染到 UI
- `CHARACTER_MESSAGE_RENDERED` - AI 消息渲染到 UI
- `CHAT_CHANGED` - 聊天切换（切换角色或加载其他聊天）
- `GENERATION_AFTER_COMMANDS` - 生成即将开始（处理斜杠命令后）
- `GENERATION_STOPPED` - 生成被用户停止
- `GENERATION_ENDED` - 生成完成或出错
- `SETTINGS_UPDATED` - 应用设置已更新

**使用方式**:
```javascript
import { eventSource, event_types } from '../../../../script.js';

// 监听事件
eventSource.on(event_types.CHAT_CHANGED, () => {
    console.log('聊天已切换');
});

// 触发事件
await eventSource.emit(event_types.SETTINGS_UPDATED);
```

---

### 5. 聊天记录系统

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

---

### 6. 正则表达式系统

**用途**: 对文本进行预处理和后处理，可以用于提取 AI 生成的特定格式内容（如 `<OEOS-Pages>` 标签）。

**应用位置**:
- `USER_INPUT` - 用户输入
- `AI_OUTPUT` - AI 输出
- `SLASH_COMMAND` - 斜杠命令
- `WORLD_INFO` - World Info 内容

**配置方式**: 在 SillyTavern 设置 → 扩展 → Regex 中配置正则表达式规则。

---

## OEOS 架构

> **说明**: 本章节详细介绍 OEOS 播放器的核心架构和工作原理。

### 系统组成

OEOS 是一个基于 Vue.js 2 的 Web 应用，用于播放 OEOScript 格式的互动故事。

**核心组件**:
1. **Vue.js 2** - 前端框架，负责 UI 渲染和用户交互
2. **JS-Interpreter** - JavaScript 沙箱解释器，安全执行脚本代码
3. **pageCompiler** - 编译器，将 OEOScript 命令编译为 JavaScript 代码

### 核心流程

```
OEOScript v4 源码
    ↓
pageCompiler.js 编译
    ↓
JavaScript 代码
    ↓
JS-Interpreter 沙箱执行
    ↓
Vue 组件渲染（say, choice, image 等）
```

### 关键文件

**1. 编译器** (`src/openeos-master/src/util/pageCompiler.js`)
- 功能：将 OEOScript 页面对象编译为可在 JS-Interpreter 中执行的 JavaScript 代码
- 输入：OEOScript 页面对象（包含命令数组）
- 输出：编译后的 JavaScript 代码字符串 + 资源列表（图片、音频、视频）

**2. 解释器** (`src/openeos-master/src/interpreter/`)
- `interpreter.js` - JS-Interpreter 核心（第三方库）
- `index.js` - 扩展 `run()` 方法并导出解释器
- `code/` - 解释器模块代码（Console、Timer、PageManager 等）

**3. Vue 组件** (`src/openeos-master/src/components/`)
- `App.vue` - 主应用，处理脚本加载和角色选择
- `OpenEosPlayer.vue` - 游戏播放器，管理解释器和 UI 渲染
- `bubbles/` - 对话气泡组件（SayBubble, ChoiceBubble, PromptBubble）

### OEOScript v4 语法

**页面定义**:
```yaml
> start
  say "欢迎来到冒险世界！"
  choice:
    - "进入森林":
      - goto: forest
    - "访问村庄":
      - goto: village
```

**核心命令**:
- `say` - 显示对话
- `choice` - 提供选项
- `goto` - 页面跳转
- `if/else` - 条件判断
- `eval` - 执行 JavaScript 代码
- `image` - 显示图片
- `audio` - 播放音频
- `timer` - 计时器
- `storage.set/get` - 存储变量

详细语法参考：`src/oeos-commands.v4.md`

---

## OEOS-SillyTavern 插件架构

> **说明**: 本章节详细说明 OEOS-SillyTavern 插件的目标、拟实现方案和关键设计决策。

### 项目目标

**核心目标**：
将 OEOS 播放器集成到 SillyTavern，实现 AI 驱动的动态互动故事生成。

**具体目标**：
1. **AI 作为地下城主（DM）**
   - AI 根据玩家行为、角色设定和聊天历史动态生成 OEOScript v4 格式的故事内容
   - AI 负责创建新的页面、分支和挑战

2. **充分利用 SillyTavern 原生系统**
   - 使用 World Info 存储游戏数据（页面、状态、图谱）
   - 使用 Prompt Manager 构建 AI 上下文
   - 使用 Regex 系统提取 AI 生成的页面数据
   - 使用角色卡系统管理角色数据

3. **保持松耦合**
   - OEOS 播放器作为独立的 Vue 应用
   - 通过 `window.oeosApi` 与插件通信
   - 不修改 SillyTavern 核心代码

### 拟实现方案

#### 整体架构

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
│  │  - world_info        │         │                      │ │
│  │  - eventSource       │         │                      │ │
│  └──────────────────────┘         └──────────────────────┘ │
│                                             ▲                │
│                                             │ window.oeosApi │
│                                             ▼                │
│                                    ┌──────────────────────┐ │
│                                    │  OEOS Vue 应用       │ │
│                                    │  (App.vue)           │ │
│                                    │                      │ │
│                                    │  - CharacterSelector │ │
│                                    │  - OpenEosPlayer     │ │
│                                    └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 数据流

```
用户操作（选择选项）
    ↓
Vue 应用调用 window.oeosApi.updateState()
    ↓
plugin-bridge.js 更新 World Info（WI-OEOS-State）
    ↓
SillyTavern Prompt Manager 构建 AI 上下文（包含 World Info）
    ↓
AI 生成新内容（包含 <OEOS-Pages> 标签）
    ↓
Regex 系统提取页面数据
    ↓
plugin-bridge.js 保存到 World Info（WI-OEOS-Pages）
    ↓
Vue 应用通过 window.oeosApi.getPage() 读取页面
    ↓
OEOS 播放器渲染页面
```

#### 技术方案

**1. 数据层**
- 使用 World Info 存储所有游戏数据
- 角色专属 WI：每个角色一个游戏，包含该角色的所有游戏数据（页面库、状态、图谱、摘要、动态上下文、角色上下文、聊天历史等）

**2. 插件层**（ES6 模块）
- `plugin-bridge.js` - 核心桥接模块，暴露 `window.oeosApi`
- `game-state.js` - 状态管理模块，更新 World Info
- `context-engine.js` - 上下文引擎，计算动态上下文
- `st-api.js` - API 抽象层，封装 SillyTavern API

**3. 前端层**（Vue.js 2）
- `App.vue` - 主应用，处理角色选择
- `CharacterSelector.vue` - 角色选择界面
- `OpenEosPlayer.vue` - 游戏播放器
- 通过 `window.oeosApi` 访问插件功能

**4. AI 集成**
- Prompt Manager 构建包含 World Info 的上下文
- Regex 提取 AI 生成的 `<OEOS-Pages>` 标签
- 自动保存到 `WI-OEOS-Pages`

### 关键设计决策

#### 为什么使用 World Info？

**优势**：
- ✅ SillyTavern 原生支持，无需额外存储系统
- ✅ 自动包含在 AI 上下文中，AI 可以访问完整游戏状态
- ✅ 持久化存储，支持保存/加载
- ✅ 跨会话保持状态

**挑战**：
- ⚠️ Token 消耗较大，需要优化数据格式
- ⚠️ 需要设计紧凑的数据格式（如路径压缩）

#### 为什么使用 Regex？

**优势**：
- ✅ 无需修改 SillyTavern 核心代码
- ✅ 灵活处理 AI 输出，可以提取特定格式内容
- ✅ 可配置、可调试

**挑战**：
- ⚠️ 需要用户手动配置正则表达式规则
- ⚠️ AI 可能不总是生成正确格式的内容

#### 为什么使用 window.oeosApi？

**优势**：
- ✅ Vue 应用与插件解耦，可以独立构建
- ✅ 避免复杂的模块依赖（Vue 构建时不需要 import ST 文件）
- ✅ 便于调试和测试（可以在控制台直接调用）

**缺点**：
- ⚠️ 使用全局对象，不符合纯 ES6 模块规范
- ⚠️ 需要确保 API 在 Vue 应用加载前初始化

---

## 核心原则

### 1. 使用 ES6 模块，避免 window 对象污染
- 插件核心使用 ES6 `import/export`
- 仅在必要时暴露 `window.oeosApi`（供 Vue 应用使用）

<!-- ### 2. 使用 toastr 通知系统，而非 console
- ✅ 使用 `toastr.info()` 显示信息
- ✅ 使用 `toastr.success()` 显示成功
- ✅ 使用 `toastr.warning()` 显示警告
- ✅ 使用 `toastr.error()` 显示错误
- ❌ 避免使用 `console.log()` 作为用户反馈 -->

### 3. 优先使用 SillyTavern 原生 API
- 不重复造轮子
- 充分利用 World Info、Prompt Manager、Regex 等系统

### 4. 保持 World Info 紧凑（Token 效率）
- 使用简洁的文本格式而非冗长的 JSON
- 动态上下文只包含相关页面
- 使用摘要系统减少 Token 消耗

### 5. 异步操作使用 async/await
- 统一使用 `async/await` 而非回调或 Promise 链
- 便于错误处理和代码可读性

### 6. 角色专属数据存储在角色 World Info 中
- ❌ 不要创建全局 WI 存储角色数据
- ✅ 在角色的 World Info 中添加条目

### 7. 订阅事件而非轮询
- 使用 `eventSource.on()` 监听事件
- 避免使用 `setInterval()` 轮询

### 8. 所有代码必须有中文注释
- 函数、类、复杂逻辑都要有注释
- 说明功能、参数、返回值

---

## 完整游戏流程

### 阶段 1：初始化与角色选择

```
1. 用户打开 OEOS 播放器
   ↓
2. Vue 应用显示角色选择界面 (CharacterSelector.vue)
   ↓
3. 调用 window.oeosApi.getCharacters() 获取角色列表
   ↓
4. 检测每个角色是否为 OEOS 角色（检查 World Info 中的 OEOS-character 标记）
   ↓
5. 显示角色列表，OEOS 角色带有绿色标识
```

### 阶段 2：启用 OEOS 支持（如果角色不是 OEOS 角色）

```
1. 用户点击"启用 OEOS"
   ↓
2. 调用 window.oeosApi.enableOEOSForCharacter(charIndex)
   ↓
3. 创建角色专属的 World Info 文件：{角色名}-OEOS.json
   ↓
4. 在该文件中创建以下条目：
   - OEOS Character Marker（标记条目，disable: true）
   - OEOS-Pages（页面数据库，disable: true）
   - OEOS-State（游戏状态，constant: true）
   - OEOS-Graph（页面关系图，constant: true）
   - OEOS-Abstracts（页面摘要，constant: true）
   - OEOS-DynamicContext（动态上下文，constant: true）
   ↓
5. 将 World Info 绑定到角色（character.data.extensions.world）
   ↓
6. 添加 OEOS 正则表达式规则到角色
   ↓
7. 刷新 UI，角色现在显示为 OEOS 角色
```

### 阶段 3：进入游戏

```
1. 用户选择 OEOS 角色
   ↓
2. 调用 window.oeosApi.bindCharacter(charIndex)
   - 激活角色的 World Info
   - 激活角色的正则表达式
   ↓
3. 遍历该角色的**所有聊天记录**，提取所有 <OEOS-Pages> 和 <OEOS-Abstracts> 标签
   - 提取 <OEOS-Pages>...</OEOS-Pages> 标签内容（注意：标签无 id 属性）
   - 提取 <OEOS-Abstracts>...</OEOS-Abstracts> 标签内容
   - 更新 OEOS-Pages 条目（存储纯 OEOScript v4 代码，无 XML 标签）
   - 更新 OEOS-Abstracts 条目（存储摘要，无 XML 标签）
   - 更新 OEOS-Graph 条目（自动提取 goto 命令）
   ↓
4. 检查 OEOS-State，确定起始页面
   - **如果有 State**：从最后位置恢复（例如：State 为 "start > forest > cave"，则从 cave 开始）
   - **如果没有 State**：从 start 页面开始
   ↓
5. 调用 window.oeosApi.getPage(pageId)
   - 从 OEOS-Pages 获取页面内容
   - 如果页面存在，返回页面内容
   - 如果页面不存在，返回占位符页面（显示"正在生成..."）
   ↓
6. OEOS 播放器渲染页面
   - 使用 OEOSV4Parser 解析页面
   - 编译并执行
   - 显示对话、选项等 UI 元素
```

### 阶段 4：游戏进行中（核心循环）

```
┌─────────────────────────────────────────────────────────┐
│ 1. 玩家在 OEOS 播放器中进行操作                          │
│    - 点击选项 (choice)                                   │
│    - 输入文本 (prompt)                                   │
│    - 触发事件                                            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. OEOS 引擎执行 goto 命令（例如：goto: forest）        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. 调用 window.oeosApi.getPage('forest')                │
│    查询 OEOS-Pages 中是否存在 forest 页面               │
│    - 如果页面存在 → 跳到步骤 8                          │
│    - 如果页面不存在 → 继续步骤 4                        │
└─────────────────────────────────────────────────────────┘
                        ↓ (页面不存在)
┌─────────────────────────────────────────────────────────┐
│ 4. 显示占位符页面                                        │
│    - 返回占位符页面："正在生成页面 'forest'，请稍候..." │
│    - OEOS 播放器渲染占位符页面                           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. 请求 AI 生成页面                                      │
│    - 调用 window.oeosApi.requestPageFromAI('forest')    │
│    - 模拟用户输入："玩家选择：forest"                    │
│    - 相当于在 ST 输入框输入并点击发送                    │
│    - ST 自动组装上下文并发送给 AI：                      │
│      * 系统提示词                                        │
│      * 角色卡（描述、性格、场景等）                      │
│      * 聊天记录（经过正则过滤，只显示摘要）              │
│      * World Info（OEOS-Abstracts + OEOS-DynamicContext）│
│    - 注意：我们只负责"输入和点击发送"，                  │
│      具体发送内容由 ST 的提示词系统决定                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 6. AI 回复（包含多个标签）                               │
│    <thinking>                                            │
│    玩家选择了进入森林，我需要生成森林页面...             │
│    </thinking>                                           │
│                                                          │
│    <OEOS-Pages>                                           │
│    > forest                                              │
│      say "你进入了森林..."                               │
│      choice:                                             │
│        - "继续探索":                                     │
│          - goto: deep_forest                             │
│        - "返回":                                         │
│          - goto: start                                   │
│    </OEOS-Pages>                                          │
│                                                          │
│    <OEOS-Abstracts>                                      │
│    forest: Player enters forest;                         │
│    </OEOS-Abstracts>                                     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 7. 自动处理 AI 回复                                      │
│    a) 正则表达式过滤（ST 自动执行）                      │
│       - 将整个 AI 回复替换为 Abstracts 内容              │
│       - 显示内容："forest: Player enters forest;"        │
│       - 原始数据（JSONL）保持不变                        │
│                                                          │
│    b) 监听 AI 回复事件（setupAIResponseListener）       │
│       - 提取 <OEOS-Pages>...</OEOS-Pages> 内容             │
│         → 更新 OEOS-Pages（存储纯代码，无 XML 标签）    │
│       - 提取 <OEOS-Abstracts>...</OEOS-Abstracts> 内容   │
│         → 更新 OEOS-Abstracts（存储摘要，无 XML 标签）  │
│       - 自动提取 goto 命令                               │
│         → 更新 OEOS-Graph（forest > deep_forest, start）│
│       - 重新计算 OEOS-DynamicContext                     │
│         → 根据当前位置提取相关页面内容                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 8. OEOS 播放器加载 forest 页面                           │
│    - 再次调用 window.oeosApi.getPage('forest')          │
│    - 从 OEOS-Pages 读取 forest 页面内容                 │
│    - 使用 OEOSV4Parser 解析页面                          │
│    - 编译为 JavaScript 代码                              │
│    - 在 JS-Interpreter 沙箱中执行                        │
│    - 渲染 UI（对话气泡、选项按钮等）                     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 9. 监听页面变化事件                                      │
│    - OEOS 引擎在页面跳转时触发回调                       │
│    - 调用 window.oeosApi.updateState(pageId, variables) │
│    - 发送当前页面 ID 和所有变量                          │
│    - 更新 OEOS-State：                                   │
│      start(initialized:1) > forest(hp:100,gold:50)       │
│    - 重新计算 OEOS-DynamicContext                        │
└─────────────────────────────────────────────────────────┘
                        ↓
                   回到步骤 1
```

### 关键技术点

**1. 聊天记录提取**
- **时机**：每次进入游戏时（调用 `bindCharacter`）
- **范围**：遍历该角色的**所有聊天记录**（`chat` 数组）
- **提取内容**：
  - 使用正则提取 `<OEOS-page>...</OEOS-page>` 标签内容（注意：标签无 `id` 属性）
  - 使用正则提取 `<OEOS-Abstracts>...</OEOS-Abstracts>` 标签内容
- **存储格式**：
  - OEOS-Pages：存储纯 OEOScript v4 代码（无 XML 标签）
  - OEOS-Abstracts：存储摘要（无 XML 标签）
- **去重处理**：如果页面已存在，则跳过（不覆盖）

**2. 正则表达式过滤**
- **执行时机**：AI 回复后，ST 自动应用正则表达式
- **过滤规则**：将整个 AI 回复替换为 `<OEOS-Abstracts>` 标签内的摘要内容
- **短暂性设置**：`promptOnly: true` 和 `markdownOnly: true`
- **效果**：
  - 显示内容：只显示摘要（如 "forest: Player enters forest;"）
  - 发送给 AI 的聊天记录：只包含摘要，大幅减少 Token 消耗
  - 原始数据（JSONL）：保持不变，仍包含完整的 AI 回复
- **重要性**：防止发送大量垃圾内容（如 `<thinking>` 标签、完整的 `<OEOS-Pages>` 内容）污染 AI 上下文

**3. 动态上下文计算**
- **计算时机**：
  - 每次 AI 回复后（更新页面数据后）
  - 每次页面跳转后（更新状态后）
- **计算步骤**：
  1. 从 OEOS-State 获取当前位置（最后一个页面 ID）
  2. 从 OEOS-Graph 获取页面关系图
  3. **向前 5 个页面**：从 State 路径中提取最近 5 个页面 ID，并从 Graph 中获取这些页面的所有子页面
  4. **向后 1 个页面**：从 Graph 中获取当前页面的所有子页面
  5. 合并所有相关页面 ID（去重）
  6. 从 OEOS-Pages 提取这些 ID 的完整内容（如果页面不存在则忽略）
  7. 保存到 OEOS-DynamicContext
- **目的**：为 AI 提供当前位置附近的页面内容，帮助 AI 生成连贯的故事

**4. 变量追踪**
- **上报时机**：OEOS 引擎每次页面跳转时
- **上报内容**：当前页面 ID + 当前**所有变量**
- **实现方式**：
  - OEOS 引擎调用 `Storage.getAllVariables()` 获取所有变量
  - 调用 `window.oeosApi.updateState(pageId, variables)` 上报
- **存储格式**：`pageId(var1:val1,var2:val2) > pageId(var1:val1) > ...`
- **示例**：`start(initialized:1) > forest(hp:100,gold:50) > cave(hp:80,gold:70)`
- **用途**：
  - 记录玩家的完整游戏路径
  - 记录每个页面的所有变量状态
  - 用于恢复游戏进度
  - 用于计算动态上下文

---

## 变更记录

### v3.1 (2025-10-12)
- **重大更新**：修正 World Info 条目的数据格式说明
  - 修正 `<OEOS-Pages>` 标签格式（无 `id` 属性）
  - 明确 OEOS-Pages 和 OEOS-Abstracts 的提取时机（遍历所有聊天记录）
  - 完善 OEOS-State 的上报机制说明（每个页面的所有变量）
  - 大幅扩展 OEOS-DynamicContext 的计算逻辑说明（向前 5 个，向后 1 个）
  - 完善正则表达式系统的说明（为什么需要、如何工作、效果示例）
  - 详细说明游戏流程（进入游戏、核心循环）
  - 扩展关键技术点说明（聊天记录提取、正则过滤、动态上下文、变量追踪）

### v3.0 (2025-10-11)
- 彻底重构文档，聚焦架构设计
- 大幅扩展"SillyTavern 核心系统"章节，添加详细的 API 说明
- 大幅扩展"OEOS 架构"章节，添加核心流程和关键文件说明
- 新增"OEOS-SillyTavern 插件架构"章节，详细说明项目目标、拟实现方案和关键设计决策
- 精简"核心原则"章节
- 移除"架构演进"、"数据层设计"等冗长章节
- 所有信息均基于实际代码，确保准确性

### v2.0 (2025-10-11)
- 添加 OEOS 角色标记系统
- 添加 toastr 通知系统原则

### v1.0 (2025-10-10)
- 初始版本

