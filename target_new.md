# 项目背景

## 1. SillyTavern (ST) 架构概述

SillyTavern 是一个功能强大、高度模块化的 Web 应用，专为与 AI 进行深度角色扮演（RP）而设计。其核心技术栈为 HTML/CSS/JavaScript (jQuery)，并通过一个事件驱动的架构实现了高度的可扩展性。

*   **核心控制器**: `script.js` 作为应用的中心枢纽，管理着全局状态、核心功能函数和事件总线 `eventSource`。
*   **上下文构建**: `PromptManager.js` 负责动态构建发送给 AI 的最终提示词。它将聊天历史、角色设定、**世界树条目**、作者笔记等多个部分，按照预设的顺序和规则组合成一个完整的上下文。
*   **数据持久化**: 聊天记录以 JSONL 格式存储在后端，通过 `saveChatConditional` 等函数进行持久化。
*   **前端插件系统**: 插件通过监听 `eventSource` 上的事件、操作 DOM 以及与 `script.js` 中暴露的全局对象和服务交互，来将其功能集成到主应用中。
    *   **⚠️ 重要**：插件运行在**同一个窗口上下文**中，可以直接 `import` ST 的模块或访问全局变量，**不需要** `window.parent` 跨窗口通信。

## 2. OEOS (Open EOS) 架构概述

OEOS 是一个基于 Vue.js 2 的独立前端播放器，专门用于解析和渲染 OEOScript——一种为互动故事设计的领域特定语言（DSL）。

*   **页面驱动**: 故事被组织成一个个独立的"页面（Page）"，通过 `goto` 命令实现页面间的跳转，形成非线性的故事网络。
*   **编译执行**: `pageCompiler.js` 负责将 OEOScript v4 脚本编译成 JavaScript 代码，并在一个受限的 `JS-Interpreter` 沙箱环境中安全执行。
*   **集成方式**: OEOS 作为 ST 插件，Vue 应用直接挂载到 ST 页面的 DOM 元素上，与 ST 在同一个 JavaScript 上下文中运行。

## 3. OEOS 插件与 SillyTavern 的集成架构

### 3.1 运行环境
- **同一窗口上下文**：OEOS 插件不是在 iframe 中运行，而是直接在 ST 页面中
- **DOM 集成**：`ui.js` 创建 `<div id="app">` 并插入到 ST 的 DOM 树中
- **Vue 挂载**：`main.js` 将 Vue 应用挂载到 `#app` 元素上
- **模块共享**：可以直接 `import` ST 的模块（如 `script.js`、`world-info.js`）

### 3.2 数据访问方式（正确方式）
- **ES6 模块导入**：`import { characters, this_chid, chat } from '../../../../script.js'`
- **模块导出**：在 `plugin-bridge.js` 中 `export` 函数，供其他模块 `import` 使用
- **事件监听**：通过 `eventSource.on(event_types.XXX, callback)` 监听 ST 事件
- **全局上下文**：使用 `SillyTavern.getContext()` 访问扩展设置和保存功能
- **❌ 不使用 `window` 对象**：避免全局命名空间污染，遵循 ST 插件规范

### 3.3 SillyTavern 核心系统理解

#### World Info（世界树）系统
- **数据结构**：`{ entries: { [uid]: { uid, keys, content, constant, order, position, role, ... } } }`
- **API**：`loadWorldInfo(name)` 和 `saveWorldInfo(name, data, immediately)`
- **激活机制**：`constant: true` 永久激活，或通过 `keys` 匹配聊天内容激活
- **与角色关联**：`characters[chid].data.extensions.world` 存储关联的 World Info 名称

#### 角色卡（Character Card）系统
- **核心字段**：`name`, `description`, `personality`, `scenario`, `first_mes`, `mes_example`
- **扩展数据**：`data.extensions.world`（关联 World Info）、`data.extensions.regex_scripts`（角色正则）
- **当前角色**：`characters[this_chid]`（`this_chid` 是字符串索引）

#### 聊天记录（Chat History）系统
- **数据结构**：`chat` 数组，每条消息 `{ name, is_user, mes, send_date, extra }`
- **保存**：`saveChat()` 自动关联到 `characters[this_chid].chat`

#### 正则表达式（Regex）系统
- **全局正则**：`extension_settings.regex`
- **角色正则**：`characters[chid].data.extensions.regex_scripts`
- **应用位置**：USER_INPUT, AI_OUTPUT, SLASH_COMMAND, WORLD_INFO, REASONING
- **执行**：`getRegexedString(rawString, placement, params)`

# AI 驱动的 OEOS 项目简介

## 目标

将 OEOS 播放器作为 ST 的前端插件进行集成，并将其改造为一个由 AI 动态驱动的、沉浸式、可无限延续的互动故事平台。AI 将扮演"地下城主（Dungeon Master）"的角色，根据玩家的行为实时生成新的故事情节、分支和挑战。

**新增目标**：实现角色选择流程，允许玩家在启动游戏前选择一个 ST 角色，并将该角色的所有相关数据（World Info、聊天记录、正则表达式、提示词等）绑定到游戏中，实现深度的角色-游戏整合。

## AI 驱动核心理念

通过创建专属的角色卡和**充分利用 SillyTavern 原生的提示词与世界树系统**，指导 AI 理解当前的故事状态、玩家路径和已知的世界观，从而生成符合 OEOScript v4 格式的、高质量的页面。

# 技术实现方案

## I. 核心原则：充分利用原生 SillyTavern 系统

本方案严格遵循**不重复造轮子**的原则，将完全基于 SillyTavern 成熟的**世界树（World Info）、提示词（Prompt）和正则表达式（Regex）**三大系统进行构建。插件的核心职责是作为 OEOS 播放器与这些原生系统之间的"中间件"和"状态管理器"。

## II. 数据层：世界树（World Info） Schema

我们将创建一系列专门的世界树条目来存储和管理所有游戏数据，并采用**高度紧凑的、非 JSON 的文本格式**以最大化 Token 效率。

1.  **页面存储 (`WI-OEOS-Pages`)**
    *   **用途**: 作为所有 OEOS 页面的主数据库。
    *   **内容**: 存储由 AI 生成的、完整的、保留所有换行和缩进的 **OEOScript v4 格式字符串**。
    *   **激活状态**: **永不激活 (Not Activated)**。此条目仅作为数据仓库，不直接消耗 AI 上下文。
    *   **更新方式**: 由正则表达式在捕获到 AI 生成的 `<oeos page>` 标签后，通过插件 API 进行写入/更新。

2.  **状态与路径 (`WI-OEOS-State`)**
    *   **用途**: 记录玩家自游戏开始以来的**完整行动轨迹**和在**每个节点**上的**全部状态**。
    *   **内容 (紧凑格式)**: 使用 `>` 分隔的路径字符串，每个节点包含页面 ID 和括号包裹的变量状态。
        `start(hp:100,gold:500) > A(hp:100,gold:450) > B(hp:90,gold:450,sex:0)`
    *   **激活状态**: **永远激活 (Always Activated)**。为 AI 提供最关键的、关于"玩家现在在哪"以及"他们是如何带着何种状态到达这里的"的完整记忆。
    *   **更新方式**: OEOS 播放器每进入一个新页面或内部变量变化时，通知插件，由插件更新此条目。

3.  **故事图谱 (`WI-OEOS-Graph`)**
    *   **用途**: 存储已探索页面的连接关系，形成故事的有向图。
    *   **内容 (紧凑格式)**: 使用 `;` 分隔的邻接表表示法。
        `S > A1, A2, A3; A1 > B1, B2, A3; A2 > B2, B3, B4;`
    *   **激活状态**: **永远激活 (Always Activated)**。为 AI 提供故事的宏观结构。
    *   **更新方式**: 当新的页面被生成时，由插件解析其 `goto` 指令并更新此图谱。

4.  **页面摘要 (`WI-OEOS-Abstracts`)**
    *   **用途**: 存储所有页面的文本摘要。
    *   **内容 (紧凑格式)**: 使用 `;` 分隔的键值对。
        `start: 故事的开端...; forest: 你进入了森林...; cave: 你发现了一个阴暗的洞穴;`
    *   **激活状态**: **永远激活 (Always Activated)**。让 AI 能以较低的 Token 成本"速览"大量页面的核心内容。
    *   **更新方式**: 由正则表达式捕获 `<oeos abstract>` 标签后更新。

5.  **动态上下文 (`WI-OEOS-DynamicContext`) - [核心]**
    *   **用途**: 此条目的内容是**动态计算生成**的，它不存储持久数据，而是作为**信息聚合器**。它为 AI 提供生成下一个页面所需的最直接、最详细的参考资料。
    *   **激活状态**: **永远激活 (Always Activated)**。
    *   **构建逻辑**: 当 `WI-OEOS-State` 更新时，插件会**立即触发**以下逻辑来**重写**此条目的全部内容：
        1.  **识别"种子"页面**:
            *   **当前与未来**: 从 `WI-OEOS-State` 获取**当前页面** ID (如 `G2`)，并从 `WI-OEOS-Graph` 获取其所有**子页面** ID (如 `H2, H3, F3, H4`)。
            *   **历史回顾**: 从 `WI-OEOS-State` 获取路径中**最近的 5 个页面** ID (如 `B3, C6, D4, E3, F1`)。
        2.  **扩展历史上下文**:
            *   遍历**历史回顾**中的每一个页面 ID (如 `B3`, `C6` 等)。
            *   在 `WI-OEOS-Graph` 中查找**这些历史页面**的子页面 ID (如 `B3` -> `C6, C1, B1`; `D4` -> `E2, E5, E1` 等)。
        3.  **聚合与提取**:
            *   将以上步骤中收集到的**所有页面 ID**（当前、未来、历史、历史的未来）合并成一个最终列表并去重。
            *   遍历这个最终列表，从 `WI-OEOS-Pages` 数据仓库中，提取出所有**已存在**的页面的**完整 OEOScript v4 源码**。
        4.  **生成最终内容**:
            *   将所有提取出的 OEOScript v4 源码**直接拼接**在一起，形成一个大的代码块，作为 `WI-OEOS-DynamicContext` 的最终内容。这将为 AI 提供一个围绕当前剧情节点的、包含历史路径和未来分支的详细上下文参考。

6.  **角色绑定数据 (`WI-OEOS-CharacterContext`) - [新增]**
    *   **用途**: 存储选定角色的核心信息，作为游戏的背景设定。
    *   **内容**: 角色的 `name`, `description`, `personality`, `scenario` 等字段的紧凑表示。
    *   **激活状态**: **永远激活 (Always Activated)**。
    *   **更新方式**: 在角色选择后，由插件一次性写入。

## III. 核心流程：AI 交互与内容生成

1.  **提示词配置**: 在角色卡的系统提示词中，加入指导 AI 生成 OEOScript v4 语法的指令，并明确要求其使用 `<oeos page>` 和 `<oeos abstract>` 标签包裹输出。（这部分由用户实现）

2.  **正则表达式配置**: 创建两条核心的正则表达式规则：
    *   **规则 A (数据提取)**: 捕获 `id`、页面内容和摘要，调用插件暴露的 API 函数（如 `window.stOeosPlugin.updatePage(id, content, abstract)`）来更新世界树，并将匹配到的 `<oeos page>` 块替换为空字符串。
    *   **规则 B (显示格式化)**: 仅保留 `<oeos abstract>` 的内容并进行美化，使其作为 AI 的回复显示在聊天记录中。

3.  **OEOS 播放器修改**:
    *   **获取页面**: 通过 `import { getPage } from './plugin-bridge.js'` 导入函数，从 `WI-OEOS-Pages` 中读取页面内容。
    *   **同步状态**: 页面跳转或内部 `Storage` 变量变化时，调用 `updateState(newState)` 上报最新状态。
    *   **⚠️ 修正**：使用 ES6 模块导入，不使用 `window.stOeosPlugin` 或 `window.parent.stOeosPlugin`。

4.  **插件 (plugin-bridge.js) 职责**:
    *   提供启动 OEOS 播放器的 UI 按钮。
    *   通过 ES6 `export` 暴露 API 供其他模块导入使用。
    *   实现 `updateState` 函数：接收 OEOS 传来的状态，**解析并更新** `WI-OEOS-State`，然后**立即触发** `WI-OEOS-DynamicContext` 的**重计算和重写**。
    *   实现 `updatePage` 和 `getPage` 等函数，作为读写世界树数据的统一接口。
    *   **新增**：实现角色选择和数据绑定相关的 API，并通过 `export` 暴露。

## IV. 工作流总结

1.  **启动**: 用户点击按钮，插件启动 OEOS 播放器，并为其提供 `start` 页面。
2.  **互动**: 用户在 OEOS 中与 `start` 页面互动，选择 `goto forest`。
3.  **状态同步**: OEOS 调用 `updateState` 上报新状态。插件接收到后，**将 `> forest(...)` 追加到 `WI-OEOS-State` 字符串末尾**，并立即**重写** `WI-OEOS-DynamicContext` 的内容。
4.  **自动触发**: 在下一次生成请求时，SillyTavern 的 `PromptManager` 自动将所有**激活**的世界树条目（包括刚刚更新的 `State` 和 `DynamicContext`）组合进提示词。
5.  **AI 生成**: AI 获得完整的上下文，生成了 `forest` 页面指向的 `cave` 和 `river` 页面的 OEOScript 代码和摘要。
6.  **正则处理**: 正则表达式捕获到新生成的页面数据，调用插件 API 更新世界树，并只将摘要部分显示在聊天中。
7.  **循环**: 当用户在 `forest` 页面选择 `goto cave` 时，OEOS 再次向插件请求页面，插件从 `WI-OEOS-Pages` 中找到了刚刚由 AI 生成的内容并返回。故事由此无限延续。

# 当前进度

*   已成功将 OEOS 播放器作为 ST 的一个基本插件进行移植。
*   可以通过点击输入框旁的按钮打开 OEOS 播放器界面。
*   播放器已支持加载和播放 OEOScript v4 格式的脚本文件。
*   **待实现**：角色选择流程和角色数据绑定。

---

# 新功能实现计划：角色选择与数据绑定

## 目标流程

```
点击火箭图标 → 显示角色选择界面 → 选择角色 → 绑定角色数据 → 开始游戏
```

## 分阶段实现计划

### 阶段 0：修正现有架构问题（优先级：最高）

#### 0.1 修正 Vue 挂载点不匹配
**问题**：`ui.js` 创建 `#oeos-app-container`，但 `main.js` 挂载到 `#app`

**修改文件**：
- `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/ui.js`

**具体修改**：
```javascript
// 第 48 行，将：
appRoot.id = 'oeos-app-container';
// 改为：
appRoot.id = 'app';
```

**依赖**：无

---

#### 0.2 修正 App.vue 中的跨窗口通信错误
**问题**：使用 `window.parent.stOeosPlugin` 而非 `window.stOeosPlugin`

**修改文件**：
- `src/openeos-master/src/App.vue`

**具体修改**：
将所有 `window.parent.stOeosPlugin` 替换为 `window.stOeosPlugin`
- 第 172 行
- 第 178-179 行
- 第 201 行
- 第 218 行

**依赖**：无

---

### 阶段 1：扩展插件桥接 API（优先级：高）

#### 1.1 添加角色数据访问 API
**目标**：在 `plugin-bridge.js` 中添加获取角色列表和角色数据的函数

**修改文件**：
- `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js`

**第一步：添加导入**
```javascript
// 在文件顶部添加
import { characters, this_chid, chat, eventSource, event_types } from '../../../../script.js';
import { world_info, selected_world_info, loadWorldInfo, saveWorldInfo } from '../../../world-info.js';
import { extension_settings, saveSettingsDebounced } from '../../extensions.js';
```

**第二步：新增函数**
```javascript
/**
 * 获取所有可用角色列表
 * @returns {Array} 角色列表
 */
export function getCharacters() {
    return characters.map((char, index) => ({
        index: index,
        name: char.name,
        avatar: char.avatar,
        description: char.description,
        personality: char.personality,
        scenario: char.scenario,
        chat_size: char.chat_size,
        date_last_chat: char.date_last_chat,
    }));
}

/**
 * 获取当前选中的角色
 * @returns {object|null} 当前角色对象
 */
export function getCurrentCharacter() {
    if (this_chid === undefined) return null;
    return characters[this_chid];
}

/**
 * 获取指定角色的 World Info 名称
 * @param {number} charIndex 角色索引
 * @returns {string|null} World Info 名称
 */
export function getCharacterWorldInfo(charIndex) {
    const char = characters[charIndex];
    return char?.data?.extensions?.world || null;
}

/**
 * 获取指定角色的正则表达式脚本
 * @param {number} charIndex 角色索引
 * @returns {Array} 正则脚本数组
 */
export function getCharacterRegexScripts(charIndex) {
    const char = characters[charIndex];
    return char?.data?.extensions?.regex_scripts || [];
}
```

**第三步：修改现有的导出（移除 window 对象）**
```javascript
// ❌ 删除这部分
// window.stOeosPlugin = {
//     initGameData,
//     getPage,
//     updateState,
//     updatePage: updatePageEntry,
// };

// ✅ 改为直接 export（在文件顶部或函数定义处）
export {
    initGameData,
    getPage,
    updateState,
    updatePageEntry as updatePage,
    // 新增的角色相关函数已经在上面用 export function 导出
};
```

**依赖**：阶段 0 完成

---

#### 1.2 添加角色绑定函数
**目标**：实现将选定角色的数据绑定到游戏的函数

**修改文件**：
- `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js`

**新增函数**：
```javascript
/**
 * 绑定选定的角色到游戏
 * @param {number} charIndex 角色索引
 */
export async function bindCharacter(charIndex) {
    try {
        toastr.info(`[OEOS] 正在绑定角色...`);

        const character = characters[charIndex];
        if (!character) {
            throw new Error('角色不存在');
        }

        // 1. 创建角色上下文 World Info 条目
        await createCharacterContextEntry(character);

        // 2. 如果角色有关联的 World Info，将其激活
        const worldInfoName = character.data?.extensions?.world;
        if (worldInfoName) {
            await activateCharacterWorldInfo(worldInfoName);
        }

        // 3. 将聊天历史摘要写入上下文
        await createChatHistoryContext(chat);

        // 4. 激活角色的正则表达式
        activateCharacterRegex(charIndex);

        toastr.success(`[OEOS] 角色 ${character.name} 绑定成功`);
    } catch (error) {
        toastr.error(`[OEOS] 绑定角色失败: ${error.message}`);
        throw error;
    }
}

/**
 * 创建角色上下文条目
 */
async function createCharacterContextEntry(character) {
    let contextEntry = await loadWi('WI-OEOS-CharacterContext');
    if (!contextEntry || !contextEntry.entries) {
        contextEntry = { entries: {} };
    }

    const content = `角色: ${character.name}\n描述: ${character.description}\n性格: ${character.personality}\n场景: ${character.scenario}`;

    const uid = Date.now();
    contextEntry.entries[uid] = {
        uid: uid,
        keys: ["character", "context"],
        content: content,
        constant: true,  // 永久激活
        order: 0,
        enabled: true,
        probability: 100,
        position: 0,
        role: 0
    };

    await saveWi('WI-OEOS-CharacterContext', contextEntry);
}

/**
 * 激活角色的 World Info
 */
async function activateCharacterWorldInfo(worldInfoName) {
    // 将 World Info 添加到 selected_world_info
    if (!selected_world_info.includes(worldInfoName)) {
        selected_world_info.push(worldInfoName);
        // 保存设置
        saveSettingsDebounced();
    }
}

/**
 * 创建聊天历史上下文
 */
async function createChatHistoryContext(chatHistory) {
    // 获取最近 20 条消息
    const recentChat = chatHistory.slice(-20);
    const summary = recentChat.map(msg =>
        `${msg.is_user ? 'User' : 'Character'}: ${msg.mes}`
    ).join('\n');

    let contextEntry = await loadWi('WI-OEOS-ChatHistory');
    if (!contextEntry || !contextEntry.entries) {
        contextEntry = { entries: {} };
    }

    const uid = Date.now() + 1;
    contextEntry.entries[uid] = {
        uid: uid,
        keys: ["history", "chat"],
        content: `最近对话:\n${summary}`,
        constant: false,
        order: 1,
        enabled: true,
        probability: 100,
        position: 0,
        role: 0
    };

    await saveWi('WI-OEOS-ChatHistory', contextEntry);
}

/**
 * 激活角色的正则表达式脚本
 * @param {number} charIndex 角色索引
 */
function activateCharacterRegex(charIndex) {
    if (!extension_settings.character_allowed_regex) {
        extension_settings.character_allowed_regex = [];
    }

    const char = characters[charIndex];
    if (char && !extension_settings.character_allowed_regex.includes(char.avatar)) {
        extension_settings.character_allowed_regex.push(char.avatar);
        saveSettingsDebounced();
    }
}
```

**依赖**：阶段 1.1 完成

---

### 阶段 2：创建角色选择 Vue 组件（优先级：高）

#### 2.1 创建 CharacterSelector.vue 组件
**目标**：创建一个显示所有角色并允许选择的 Vue 组件

**新建文件**：
- `src/openeos-master/src/components/CharacterSelector.vue`

**文件内容**：
```vue
<template>
  <v-container class="character-selector">
    <v-card>
      <v-card-title class="headline">
        选择角色开始冒险
      </v-card-title>
      <v-card-text>
        <v-progress-circular v-if="loading" indeterminate></v-progress-circular>
        <v-alert v-else-if="error" type="error">{{ error }}</v-alert>
        <v-list v-else-if="characters.length > 0">
          <v-list-item
            v-for="(char, index) in characters"
            :key="index"
            @click="selectCharacter(index)"
            class="character-item"
          >
            <v-list-item-avatar>
              <v-img :src="getCharacterAvatar(char.avatar)"></v-img>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>{{ char.name }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ char.description.substring(0, 100) }}...
              </v-list-item-subtitle>
              <v-list-item-subtitle class="text--secondary">
                聊天记录: {{ char.chat_size || 0 }} |
                最后聊天: {{ formatDate(char.date_last_chat) }}
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </v-list>
        <v-alert v-else type="info">
          没有找到可用的角色
        </v-alert>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script>
// ✅ 使用 ES6 模块导入，不使用 window 对象
import { getCharacters } from '../../../../SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js';

export default {
  name: 'CharacterSelector',
  data() {
    return {
      characters: [],
      loading: true,
      error: null
    }
  },
  mounted() {
    this.loadCharacters()
  },
  methods: {
    async loadCharacters() {
      try {
        this.loading = true;
        this.error = null;

        // ✅ 直接调用导入的函数
        this.characters = getCharacters();
      } catch (err) {
        this.error = err.message || '加载角色列表失败';
        console.error('[CharacterSelector] Error loading characters:', err);
      } finally {
        this.loading = false;
      }
    },
    selectCharacter(index) {
      const character = this.characters[index];
      this.$emit('character-selected', {
        index: index,
        character: character
      });
    },
    getCharacterAvatar(avatar) {
      return `/characters/${avatar}`;
    },
    formatDate(timestamp) {
      if (!timestamp) return '无';
      return new Date(timestamp).toLocaleDateString('zh-CN');
    }
  }
}
</script>

<style scoped>
.character-selector {
  padding: 20px;
}

.character-item {
  cursor: pointer;
  transition: background-color 0.3s;
}

.character-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>
```

**依赖**：阶段 1 完成

---

### 阶段 3：修改 App.vue 集成角色选择（优先级：高）

#### 3.1 在 App.vue 中添加角色选择流程
**目标**：修改 App.vue 以支持角色选择界面和数据绑定

**修改文件**：
- `src/openeos-master/src/App.vue`

**修改内容**：

1. **导入必要的模块和组件**：
```vue
<script>
// ✅ 导入 Vue 组件
import CharacterSelector from './components/CharacterSelector'
import OpenEosPlayer from './components/OpenEosPlayer'
import Loading from './components/common/Loading'

// ✅ 导入插件桥接函数（使用 ES6 模块）
import { bindCharacter } from '../../SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js';

// ... 其他导入
</script>
```

2. **添加 data 字段**：
```javascript
data() {
  return {
    showCharacterSelector: true,  // 初始显示角色选择
    selectedCharacterIndex: null,
    selectedCharacter: null,
    // ... 其他现有字段
  }
}
```

3. **修改 template**：
```vue
<template>
  <v-app class="oeos-app-container">
    <v-main ref="mainPlayer">
      <!-- 角色选择界面 -->
      <character-selector
        v-if="showCharacterSelector"
        @character-selected="onCharacterSelected"
      />

      <!-- 游戏播放器 -->
      <open-eos-player
        v-else-if="script"
        :script="script"
        :title="title"
        :author="author"
        :author-id="authorId"
        :tease-id="teaseId"
        :tease-key="teaseKey"
        :is-fullscreen="this.isFullscreen"
        :tease-storage="teaseStorage"
        :debug-enabled="debugEnabled"
        :tease-url="teaseUrl"
        :debug-prompt="debugPrompt"
        :allow-no-sleep="allowNoSleep"
        :preview-mode="previewMode"
        :is-debug="previewMode > 0"
        @page-change="pageChange"
        @save-storage="didStorageSave"
        @load-storage="didStorageLoad"
        @tease-start="didTeaseStart"
        @tease-end="didTeaseEnd"
        @set-external-link="setExternalLink"
        @debugprompt="v => { debugPrompt = v }"
      />

      <!-- 加载中 -->
      <v-container v-else>
        <loading>正在初始化游戏...</loading>
      </v-container>
    </v-main>
    <!-- ... 其他现有内容 -->
  </v-app>
</template>
```

4. **添加 methods**：
```javascript
methods: {
  async onCharacterSelected({ index, character }) {
    this.selectedCharacterIndex = index;
    this.selectedCharacter = character;
    this.showCharacterSelector = false;

    try {
      // ✅ 直接调用导入的函数，不使用 window 对象
      await bindCharacter(index);

      // 启动游戏
      await this.startAiDrivenTease();
    } catch (error) {
      this.error = `初始化失败: ${error.message}`;
      this.showCharacterSelector = true;
    }
  },

  returnToCharacterSelection() {
    this.showCharacterSelector = true;
    this.script = null;
    this.selectedCharacterIndex = null;
    this.selectedCharacter = null;
  },

  // ... 其他现有方法
}
```

**依赖**：阶段 2 完成

---

### 阶段 4：优化 UI 和用户体验（优先级：中）

#### 4.1 添加返回角色选择的功能
**目标**：允许用户在游戏中返回角色选择界面

**修改文件**：
- `src/openeos-master/src/App.vue`

**添加方法**：
```javascript
methods: {
  // ... 现有方法

  returnToCharacterSelection() {
    this.showCharacterSelector = true
    this.script = null
    this.selectedCharacterIndex = null
    this.selectedCharacter = null
  }
}
```

**添加 UI 按钮**（在 OpenEosPlayer 组件中或 App.vue 的工具栏）：
```vue
<v-btn @click="returnToCharacterSelection" small>
  <v-icon left>mdi-arrow-left</v-icon>
  返回角色选择
</v-btn>
```

**依赖**：阶段 3 完成

---

#### 4.2 添加加载状态和错误处理
**目标**：改善用户体验，显示加载状态和错误信息

**修改文件**：
- `src/openeos-master/src/components/CharacterSelector.vue`

**添加 data 字段**：
```javascript
data() {
  return {
    characters: [],
    loading: true,
    error: null
  }
}
```

**修改 template**：
```vue
<v-card-text>
  <v-progress-circular v-if="loading" indeterminate></v-progress-circular>
  <v-alert v-else-if="error" type="error">{{ error }}</v-alert>
  <v-list v-else-if="characters.length > 0">
    <!-- 角色列表 -->
  </v-list>
  <v-alert v-else type="info">没有找到可用的角色</v-alert>
</v-card-text>
```

**修改 loadCharacters 方法**：
```javascript
async loadCharacters() {
  try {
    this.loading = true
    this.error = null

    if (window.stOeosPlugin && window.stOeosPlugin.getCharacters) {
      this.characters = window.stOeosPlugin.getCharacters()
    } else {
      throw new Error('无法访问角色数据')
    }
  } catch (err) {
    this.error = err.message
  } finally {
    this.loading = false
  }
}
```

**依赖**：阶段 2 完成

---

### 阶段 5：高级功能 - 角色数据深度整合（优先级：低）

#### 5.1 整合角色的正则表达式
**目标**：将角色专属的正则表达式应用到游戏中

**修改文件**：
- `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js`

**添加函数**：
```javascript
/**
 * 激活角色的正则表达式脚本
 * @param {number} charIndex 角色索引
 */
function activateCharacterRegex(charIndex) {
    const regexScripts = getCharacterRegexScripts(charIndex);

    // 确保角色正则被启用
    if (!extension_settings.character_allowed_regex) {
        extension_settings.character_allowed_regex = [];
    }

    const char = characters[charIndex];
    if (char && !extension_settings.character_allowed_regex.includes(char.avatar)) {
        extension_settings.character_allowed_regex.push(char.avatar);
        saveSettings();
    }
}
```

**在 bindCharacter 中调用**：
```javascript
async function bindCharacter(charIndex) {
    // ... 现有代码

    // 4. 激活角色的正则表达式
    activateCharacterRegex(charIndex);

    // ... 现有代码
}
```

**依赖**：阶段 1.2 完成

---

#### 5.2 创建角色专属的游戏存档
**目标**：为每个角色创建独立的游戏进度存档

**修改文件**：
- `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js`

**添加函数**：
```javascript
/**
 * 获取角色专属的存档键名
 * @param {number} charIndex 角色索引
 * @returns {string} 存档键名
 */
function getCharacterSaveKey(charIndex) {
    const char = characters[charIndex];
    return `oeos-save-${char.avatar}`;
}

/**
 * 加载角色的游戏存档
 * @param {number} charIndex 角色索引
 * @returns {object|null} 存档数据
 */
function loadCharacterSave(charIndex) {
    const saveKey = getCharacterSaveKey(charIndex);
    const saveData = localStorage.getItem(saveKey);
    return saveData ? JSON.parse(saveData) : null;
}

/**
 * 保存角色的游戏进度
 * @param {number} charIndex 角色索引
 * @param {object} saveData 存档数据
 */
function saveCharacterProgress(charIndex, saveData) {
    const saveKey = getCharacterSaveKey(charIndex);
    localStorage.setItem(saveKey, JSON.stringify(saveData));
}
```

**暴露 API**：
```javascript
window.stOeosPlugin = {
    // ... 现有 API
    loadCharacterSave,
    saveCharacterProgress,
};
```

**依赖**：阶段 1 完成

---

### 阶段 6：测试和调试（优先级：高）

#### 6.1 单元测试清单
- [ ] 测试 `getCharacters()` 返回正确的角色列表
- [ ] 测试 `bindCharacter()` 正确创建 World Info 条目
- [ ] 测试角色选择界面正确显示所有角色
- [ ] 测试选择角色后正确启动游戏
- [ ] 测试角色的 World Info 被正确激活
- [ ] 测试聊天历史被正确整合

#### 6.2 集成测试清单
- [ ] 完整流程测试：点击火箭图标 → 选择角色 → 游戏启动
- [ ] 测试返回角色选择功能
- [ ] 测试多次切换角色
- [ ] 测试角色数据在游戏中的应用
- [ ] 测试存档系统

#### 6.3 调试建议
1. 在浏览器控制台检查 `window.stOeosPlugin` 是否正确暴露
2. 检查 `characters` 数组是否可访问
3. 检查 World Info 条目是否正确创建
4. 使用 `console.log` 跟踪数据流
5. 检查 Vue DevTools 中的组件状态

---

## 实现优先级总结

### 第一优先级（必须完成）
1. ✅ 阶段 0：修正架构问题
2. ✅ 阶段 1：扩展插件 API
3. ✅ 阶段 2：创建角色选择组件
4. ✅ 阶段 3：集成到 App.vue

### 第二优先级（重要）
5. ✅ 阶段 4：优化 UI 和用户体验
6. ✅ 阶段 6：测试和调试

### 第三优先级（可选）
7. ⭕ 阶段 5：高级功能

---

## 技术难点和解决方案

### 难点 1：World Info 数据结构复杂
**解决方案**：
- 参考现有的 `plugin-bridge.js` 中的 `initGameData()` 函数
- 使用相同的数据结构创建新条目
- 确保 `uid` 唯一（使用 `Date.now()`）

### 难点 2：Vue 组件与 ST 数据的同步
**解决方案**：
- 通过 `window.stOeosPlugin` 全局对象作为桥梁
- 在 Vue 组件的 `mounted` 钩子中加载数据
- 使用事件（`$emit`）向父组件传递选择结果

### 难点 3：角色切换时的状态管理
**解决方案**：
- 在 `App.vue` 中维护 `selectedCharacterIndex` 状态
- 切换角色时清空游戏状态
- 为每个角色创建独立的存档

---

## 数据流图

```
用户点击火箭图标
    ↓
ui.js 显示 OEOS 容器（创建 #app 元素）
    ↓
App.vue 挂载到 #app，显示 CharacterSelector
    ↓
CharacterSelector.vue:
  - import { getCharacters } from 'plugin-bridge.js'
  - 调用 getCharacters() 获取角色列表
    ↓
plugin-bridge.js:
  - import { characters } from 'script.js'
  - 从 characters 数组获取数据并返回
    ↓
CharacterSelector 显示角色列表
    ↓
用户选择角色
    ↓
CharacterSelector $emit('character-selected', data)
    ↓
App.vue onCharacterSelected() 处理:
  - import { bindCharacter } from 'plugin-bridge.js'
  - 调用 bindCharacter(index)
    ↓
plugin-bridge.js 执行绑定：
  - 创建 WI-OEOS-CharacterContext
  - 激活角色的 World Info (selected_world_info.push)
  - 创建聊天历史上下文
  - 激活角色正则表达式 (extension_settings)
  - 调用 saveSettingsDebounced()
    ↓
App.vue startAiDrivenTease() 启动游戏
    ↓
游戏开始，AI 可以访问角色数据
```

**关键点**：
- ✅ 全程使用 ES6 模块 `import/export`
- ✅ 不使用 `window` 对象传递数据
- ✅ 符合 SillyTavern 插件规范

---

## 文件修改清单

### 需要修改的文件
1. `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/ui.js`
   - 修正 Vue 挂载点 ID

2. `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js`
   - 添加角色数据访问 API
   - 添加角色绑定函数
   - 添加存档管理函数

3. `src/openeos-master/src/App.vue`
   - 修正 `window.parent` 为 `window`
   - 添加角色选择流程
   - 集成 CharacterSelector 组件

### 需要创建的文件
4. `src/openeos-master/src/components/CharacterSelector.vue`
   - 新建角色选择组件

---

## 预期效果

完成所有阶段后，用户体验流程如下：

1. **启动**：用户点击 ST 界面的火箭图标
2. **选择**：看到一个美观的角色选择界面，显示所有可用角色及其信息
3. **绑定**：选择一个角色后，系统自动：
   - 加载角色的描述、性格、场景设定
   - 激活角色关联的 World Info
   - 整合最近的聊天历史
   - 应用角色的正则表达式规则
4. **游戏**：进入 OEOS 游戏界面，AI 生成的内容会基于：
   - 角色的背景设定
   - 角色的 World Info 知识库
   - 之前的聊天历史
   - 当前的游戏状态
5. **持久化**：游戏进度自动保存，与角色关联
6. **切换**：可以随时返回角色选择界面，切换到其他角色

---

## 后续扩展方向

1. **多角色协作模式**：允许多个角色同时参与游戏
2. **角色成长系统**：根据游戏进度更新角色的 World Info
3. **动态提示词**：根据游戏状态动态调整发送给 AI 的提示词
4. **可视化编辑器**：为 World Info 条目提供图形化编辑界面
5. **导出/导入**：允许导出游戏进度和角色设定

---

