# OEOS 角色选择功能实现指南

## 📋 概述

本文档提供了为 OEOS-SillyTavern 插件添加角色选择功能的完整实现指南。

## 🎯 目标

实现以下用户流程：
```
点击火箭图标 → 显示角色选择界面 → 选择角色 → 绑定角色数据 → 开始游戏
```

## ⚠️ 重要架构修正

### 错误理解（已修正）
- ❌ OEOS 在 iframe 中运行，需要 `window.parent` 跨窗口通信
- ❌ Vue 应用与 ST 在不同的 JavaScript 上下文
- ❌ 使用 `window.stOeosPlugin` 全局对象传递数据

### 正确理解
- ✅ OEOS 插件直接在 ST 页面中运行，**同一个窗口上下文**
- ✅ 可以直接 `import` ST 的模块或访问全局变量
- ✅ **使用 ES6 模块 `import/export`**，不使用 `window` 对象
- ✅ Vue 应用挂载到 ST 页面的 DOM 元素上
- ✅ 遵循 SillyTavern 官方插件的标准做法

## 📊 SillyTavern 核心系统理解

### 1. World Info（世界树）系统
```javascript
// 数据结构
{
  entries: {
    [uid]: {
      uid: number,
      keys: string[],
      content: string,
      constant: boolean,  // true = 永久激活
      order: number,
      position: number,
      role: number,
      enabled: boolean,
      probability: number
    }
  }
}

// API
import { loadWorldInfo, saveWorldInfo } from '../../../world-info.js';
await loadWorldInfo(name);
await saveWorldInfo(name, data, immediately);
```

### 2. 角色卡（Character Card）系统
```javascript
// 访问当前角色
import { characters, this_chid } from '../../../../script.js';
const currentChar = characters[this_chid];

// 角色数据结构
{
  name: string,
  description: string,
  personality: string,
  scenario: string,
  avatar: string,
  chat: string,
  data: {
    extensions: {
      world: string,  // 关联的 World Info 名称
      regex_scripts: Array  // 角色专属正则
    }
  }
}
```

### 3. 聊天记录系统
```javascript
// 访问聊天记录
import { chat } from '../../../../script.js';

// 消息结构
{
  name: string,
  is_user: boolean,
  mes: string,
  send_date: number,
  extra: object
}
```

### 4. 正则表达式系统
```javascript
// 全局正则
import { extension_settings } from '../../extensions.js';
extension_settings.regex

// 角色正则
characters[chid].data.extensions.regex_scripts

// 应用正则
import { getRegexedString, regex_placement } from '../../extensions/regex/engine.js';
getRegexedString(rawString, regex_placement.AI_OUTPUT, params);
```

## 🔧 实现步骤

### 阶段 0：修正现有架构问题 ⭐⭐⭐

#### 0.1 修正 Vue 挂载点
**文件**：`src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/ui.js`

```javascript
// 第 48 行，修改：
appRoot.id = 'app';  // 原来是 'oeos-app-container'
```

#### 0.2 修正跨窗口通信错误
**文件**：`src/openeos-master/src/App.vue`

全局替换：`window.parent.stOeosPlugin` → `window.stOeosPlugin`

### 阶段 1：扩展插件 API ⭐⭐⭐

**文件**：`src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js`

#### 1.1 添加导入
```javascript
// 在文件顶部添加
import { characters, this_chid, chat, eventSource, event_types } from '../../../../script.js';
import { world_info, selected_world_info, loadWorldInfo, saveWorldInfo } from '../../../world-info.js';
import { extension_settings, saveSettingsDebounced } from '../../extensions.js';
```

#### 1.2 添加角色访问函数（使用 export）
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
 */
export function getCharacterWorldInfo(charIndex) {
    const char = characters[charIndex];
    return char?.data?.extensions?.world || null;
}

/**
 * 获取指定角色的正则表达式脚本
 */
export function getCharacterRegexScripts(charIndex) {
    const char = characters[charIndex];
    return char?.data?.extensions?.regex_scripts || [];
}
```

#### 1.3 添加角色绑定函数（使用 export）
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

        // 1. 创建角色上下文
        await createCharacterContextEntry(character);

        // 2. 激活角色的 World Info
        const worldInfoName = character.data?.extensions?.world;
        if (worldInfoName) {
            await activateCharacterWorldInfo(worldInfoName);
        }

        // 3. 创建聊天历史上下文
        await createChatHistoryContext(chat);

        // 4. 激活角色正则
        activateCharacterRegex(charIndex);

        toastr.success(`[OEOS] 角色 ${character.name} 绑定成功`);
    } catch (error) {
        toastr.error(`[OEOS] 绑定角色失败: ${error.message}`);
        throw error;
    }
}

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
        constant: true,
        order: 0,
        enabled: true,
        probability: 100,
        position: 0,
        role: 0
    };
    
    await saveWi('WI-OEOS-CharacterContext', contextEntry);
}

async function activateCharacterWorldInfo(worldInfoName) {
    if (!selected_world_info.includes(worldInfoName)) {
        selected_world_info.push(worldInfoName);
        saveSettings();
    }
}

async function createChatHistoryContext(chatHistory) {
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

#### 1.4 修改导出方式（移除 window 对象）
```javascript
// ❌ 删除这部分（不再使用 window 对象）
// window.stOeosPlugin = {
//     initGameData,
//     getPage,
//     updateState,
//     updatePage: updatePageEntry,
// };

// ✅ 改为 ES6 模块导出
export {
    initGameData,
    getPage,
    updateState,
    updatePageEntry as updatePage,
    // 角色相关函数已经在上面用 export function 导出
    // getCharacters, getCurrentCharacter, bindCharacter, etc.
};
```

### 阶段 2：创建角色选择组件 ⭐⭐⭐

**新建文件**：`src/openeos-master/src/components/CharacterSelector.vue`

**关键点**：使用 ES6 模块导入，不使用 window 对象

```vue
<script>
// ✅ 使用 ES6 模块导入
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
      } finally {
        this.loading = false;
      }
    },
    selectCharacter(index) {
      this.$emit('character-selected', { index, character: this.characters[index] });
    }
  }
}
</script>
```

完整代码见 `target_new.md` 阶段 2.1

### 阶段 3：集成到 App.vue ⭐⭐⭐

**文件**：`src/openeos-master/src/App.vue`

#### 3.1 导入组件和函数
```javascript
// ✅ 导入 Vue 组件
import CharacterSelector from './components/CharacterSelector'

// ✅ 导入插件桥接函数（使用 ES6 模块）
import { bindCharacter } from '../../SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js';
```

#### 3.2 添加 data
```javascript
data() {
  return {
    showCharacterSelector: true,
    selectedCharacterIndex: null,
    selectedCharacter: null,
    // ... 其他现有字段
  }
}
```

#### 3.3 修改 template
```vue
<character-selector
  v-if="showCharacterSelector"
  @character-selected="onCharacterSelected"
/>

<open-eos-player
  v-else-if="script"
  ...
/>

<v-container v-else>
  <loading>正在初始化游戏...</loading>
</v-container>
```

#### 3.4 添加方法
```javascript
async onCharacterSelected({ index, character }) {
    this.selectedCharacterIndex = index;
    this.selectedCharacter = character;
    this.showCharacterSelector = false;

    try {
        // ✅ 直接调用导入的函数，不使用 window 对象
        await bindCharacter(index);
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
}
```

## ✅ 测试清单

### 单元测试
- [ ] `getCharacters()` 返回正确的角色列表
- [ ] `bindCharacter()` 创建正确的 World Info 条目
- [ ] 角色选择界面显示所有角色
- [ ] 选择角色后正确启动游戏

### 集成测试
- [ ] 完整流程：点击火箭 → 选择角色 → 游戏启动
- [ ] 角色的 World Info 被正确激活
- [ ] 聊天历史被正确整合
- [ ] 角色正则表达式被应用

### 调试技巧
1. 检查 `window.stOeosPlugin` 是否正确暴露
2. 检查 `characters` 数组是否可访问
3. 检查 World Info 条目是否正确创建
4. 使用 Vue DevTools 查看组件状态

## 📁 文件修改清单

### 需要修改
1. `ui.js` - 修正挂载点
2. `plugin-bridge.js` - 添加 API
3. `App.vue` - 集成角色选择

### 需要创建
4. `CharacterSelector.vue` - 新建组件

## 🎉 预期效果

完成后，用户将体验到：
1. 点击火箭图标看到角色选择界面
2. 选择角色后自动绑定所有相关数据
3. 游戏中 AI 可以访问角色的背景、World Info、聊天历史
4. 每个角色有独立的游戏进度

## 📚 参考文档

- 详细实现计划：`src/target_new.md`
- OEOS 命令参考：`src/oeos-commands.v4.md`
- ST 架构文档：`src/SillyTavern-release/README.md`

