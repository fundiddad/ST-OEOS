# OEOS-SillyTavern 实现指南

## 📋 目录

1. [实现状态](#实现状态)
2. [已实现功能](#已实现功能)
3. [待实现功能](#待实现功能)
4. [关键代码示例](#关键代码示例)
5. [故障排除](#故障排除)

---

## 实现状态

### ✅ 已完成的核心功能

1. **插件桥接系统** - `plugin-bridge.js` 完整实现
2. **角色选择界面** - `CharacterSelector.vue` 已创建
3. **角色数据绑定** - `bindCharacter()` 函数已实现
4. **游戏状态管理** - `game-state.js` 完整实现
5. **World Info 集成** - 所有 WI 条目创建和更新逻辑已实现
6. **Vue 应用集成** - `App.vue` 已集成角色选择流程
7. **全局 API 暴露** - `window.oeosApi` 已正确暴露
8. **toastr 通知系统** - 统一使用 ST 的 toastr
9. **OEOS 角色标记系统** ✨ 新增
   - `isOEOSCharacter()` - 检查角色是否为 OEOS 角色
   - `enableOEOSForCharacter()` - 为角色启用 OEOS 支持
   - 角色选择界面的 OEOS 角色视觉标识（绿色背景）
   - 为非 OEOS 角色提供"启用 OEOS"开关

### ⚠️ 部分实现的功能

1. **角色 World Info 激活** - 函数存在但未完全实现
2. **角色正则表达式激活** - 函数存在但未完全实现
3. **动态上下文引擎** - `context-engine.js` 需要完善

### ❌ 待实现的功能

1. **AI 生成页面的正则表达式规则** - 需要在 ST 中配置
2. **多角色协作模式** - 高级功能
3. **角色成长系统** - 高级功能
4. **可视化编辑器** - 高级功能

---

## 已实现功能

### 1. 核心架构 ✅

**文件**: `src/oeos-plugin-core/plugin-bridge.js`

**已实现**:
- ✅ ES6 模块导出
- ✅ 全局 API 暴露 (`window.oeosApi`)
- ✅ `initGameData()` - 初始化游戏数据
- ✅ `getPage(pageId)` - 获取页面内容
- ✅ `updateState(newState)` - 更新游戏状态
- ✅ `getCharacters()` - 获取角色列表（包含 OEOS 状态）
- ✅ `getCurrentCharacter()` - 获取当前角色
- ✅ `bindCharacter(charIndex)` - 绑定角色
- ✅ `isOEOSCharacter(charIndex)` - 检查角色是否为 OEOS 角色 ✨ 新增
- ✅ `enableOEOSForCharacter(charIndex)` - 为角色启用 OEOS 支持 ✨ 新增
- ✅ toastr 通知系统集成

### 2. 角色选择界面 ✅

**文件**: `src/openeos-master/src/components/CharacterSelector.vue`

**已实现**:
- ✅ 显示所有可用角色
- ✅ 显示角色头像、名称、描述
- ✅ 显示聊天记录数量和最后聊天时间
- ✅ 点击角色触发选择事件
- ✅ 加载状态和错误处理
- ✅ 使用 `window.oeosApi` 访问数据
- ✅ **OEOS 角色视觉标识** ✨ 新增
  - 绿色背景和左边框
  - "OEOS" 标签显示
  - 显示角色的 World Info 名称
- ✅ **启用 OEOS 开关** ✨ 新增
  - 为非 OEOS 角色显示"启用 OEOS"按钮
  - 点击后自动创建 World Info 并添加标记
  - 加载状态指示

### 3. Vue 应用集成 ✅

**文件**: `src/openeos-master/src/App.vue`

**已实现**:
- ✅ 导入 `CharacterSelector` 组件
- ✅ 添加角色选择相关 data 字段
- ✅ `onCharacterSelected()` 方法
- ✅ `returnToCharacterSelection()` 方法
- ✅ `startAiDrivenTease()` 方法
- ✅ 使用 `window.oeosApi` 调用插件 API
- ✅ 初始显示角色选择界面

### 4. 游戏状态管理 ✅

**文件**: `src/oeos-plugin-core/game-state.js`

**已实现**:
- ✅ `updatePageEntry(id, content, abstract)` - 更新页面条目
- ✅ `updateStateEntry(newState)` - 更新状态条目
- ✅ 自动更新 `WI-OEOS-Pages`
- ✅ 自动更新 `WI-OEOS-Abstracts`
- ✅ 自动更新 `WI-OEOS-Graph`
- ✅ 自动更新 `WI-OEOS-State`
- ✅ 使用 toastr 显示操作结果

### 5. World Info 集成 ✅

**全局 WI 条目**（用于所有 OEOS 游戏）:
- ✅ `WI-OEOS-Pages` - 页面数据库
- ✅ `WI-OEOS-State` - 玩家状态和路径
- ✅ `WI-OEOS-Graph` - 故事图谱
- ✅ `WI-OEOS-Abstracts` - 页面摘要
- ✅ `WI-OEOS-DynamicContext` - 动态上下文（待完善）
- ✅ `WI-OEOS-CharacterContext` - 角色上下文（已弃用，改用角色专属 WI）
- ✅ `WI-OEOS-ChatHistory` - 聊天历史（已弃用，改用角色专属 WI）

**角色专属 WI** ✨ 新增:
- ✅ 每个 OEOS 角色都有自己的 World Info 文件（如 `Seraphina-OEOS.json`）
- ✅ 通过 `character.data.extensions.world` 绑定到角色
- ✅ 包含 `OEOS-character` 标记条目用于识别 OEOS 角色

### 6. OEOS 角色标记系统 ✅ ✨ 新增

**功能概述**:
OEOS 角色标记系统用于区分普通角色和 OEOS 支持的角色，并提供一键启用功能。

**实现细节**:

1. **角色检测** - `isOEOSCharacter(charIndex)`
   - 检查角色是否有 World Info（`character.data.extensions.world`）
   - 加载角色的 World Info 文件
   - 查找包含 `OEOS-character` 关键字的条目
   - 返回布尔值

2. **角色启用** - `enableOEOSForCharacter(charIndex)`
   - 如果角色没有 World Info，创建新的 WI 文件（命名为 `{角色名}-OEOS`）
   - 将 World Info 绑定到角色（通过 `/api/characters/merge-attributes` API）
   - 在 World Info 中添加 `OEOS-character` 标记条目
   - 使用 toastr 显示操作进度

3. **视觉标识**
   - OEOS 角色：绿色背景 + 绿色左边框 + "OEOS" 标签
   - 非 OEOS 角色：普通背景 + "启用 OEOS" 按钮

4. **数据结构**

`OEOS-character` 标记条目示例：
```json
{
  "uid": 1234567890,
  "key": ["OEOS-character", "OEOS", "interactive"],
  "comment": "OEOS Character Marker",
  "content": "This character is enabled for OEOS...",
  "constant": false,
  "selective": true,
  "order": 0,
  "enabled": true
}
```

---

## 待实现功能

### 1. 角色 World Info 激活 ⚠️

**文件**: `src/oeos-plugin-core/plugin-bridge.js`

**当前状态**: 函数存在但仅显示 toastr 消息

**需要实现**:
```javascript
async function activateCharacterWorldInfo(worldInfoName) {
    // TODO: 需要导入 selected_world_info
    // import { selected_world_info } from '../../../world-info.js';
    
    if (!selected_world_info.includes(worldInfoName)) {
        selected_world_info.push(worldInfoName);
        saveSettingsDebounced();
        toastr.success(`[OEOS] World Info 已激活: ${worldInfoName}`);
    }
}
```

### 2. 角色正则表达式激活 ⚠️

**文件**: `src/oeos-plugin-core/plugin-bridge.js`

**当前状态**: 函数存在但仅显示 toastr 消息

**需要实现**:
```javascript
function activateCharacterRegex(charIndex) {
    // TODO: 需要导入 extension_settings
    // import { extension_settings } from '../../extensions.js';
    
    if (!extension_settings.character_allowed_regex) {
        extension_settings.character_allowed_regex = [];
    }

    const char = characters[charIndex];
    if (char && !extension_settings.character_allowed_regex.includes(char.avatar)) {
        extension_settings.character_allowed_regex.push(char.avatar);
        saveSettingsDebounced();
        toastr.success(`[OEOS] 角色正则已激活: ${char.name}`);
    }
}
```

### 3. 动态上下文引擎 ⚠️

**文件**: `src/oeos-plugin-core/context-engine.js`

**需要实现**: 完整的动态上下文计算逻辑（参考 ARCHITECTURE.md）

### 4. AI 生成页面的正则表达式规则 ❌

**需要在 SillyTavern 中配置**:

**规则 A (数据提取)**:
- 捕获 `<oeos page id="xxx">...</oeos page>` 和 `<oeos abstract>...</oeos abstract>`
- 调用 `window.oeosApi.updatePage(id, content, abstract)`
- 将匹配到的内容替换为空字符串

**规则 B (显示格式化)**:
- 保留 `<oeos abstract>` 的内容并美化
- 作为 AI 的回复显示在聊天记录中

---

## 关键代码示例

### 1. OEOS 角色管理 ✨

#### 检查角色是否为 OEOS 角色

```javascript
// 检查单个角色
const isOEOS = await window.oeosApi.isOEOSCharacter(charIndex);
if (isOEOS) {
    console.log('这是一个 OEOS 角色');
}

// 获取所有角色并检查 OEOS 状态
const characters = await window.oeosApi.getCharacters();
characters.forEach(char => {
    console.log(`${char.name}: ${char.isOEOS ? 'OEOS' : '普通'}`);
    if (char.isOEOS) {
        console.log(`  World Info: ${char.worldInfo}`);
    }
});
```

#### 为角色启用 OEOS 支持

```javascript
// 为角色启用 OEOS
const charIndex = 0;
await window.oeosApi.enableOEOSForCharacter(charIndex);

// 验证启用结果
const isOEOS = await window.oeosApi.isOEOSCharacter(charIndex);
console.log('OEOS 已启用:', isOEOS); // true
```

#### 角色 World Info 结构

```javascript
// OEOS 角色的 World Info 文件示例
{
    "entries": {
        "1234567890": {
            "uid": 1234567890,
            "key": ["OEOS-character", "OEOS", "interactive"],
            "comment": "OEOS Character Marker",
            "content": "This character is enabled for OEOS...",
            "constant": false,
            "selective": true,
            "order": 0,
            "enabled": true
        }
    }
}
```

### 2. 使用 toastr 通知系统

```javascript
// ✅ 正确：使用 toastr 提供用户反馈
toastr.info('[OEOS] 正在初始化...');
toastr.success('[OEOS] 初始化成功');
toastr.warning('[OEOS] 警告信息');
toastr.error(`[OEOS] 错误: ${error.message}`);

// ❌ 错误：仅用 console（用户看不到）
console.log('初始化成功'); // 仅用于调试
```

### 3. 使用全局 API (window.oeosApi)

```javascript
// Vue 组件中访问插件 API
if (window.oeosApi && window.oeosApi.getCharacters) {
    const characters = await window.oeosApi.getCharacters(); // 注意：现在是异步的
}

// 检查 OEOS 角色
const isOEOS = await window.oeosApi.isOEOSCharacter(charIndex);

// 启用 OEOS 支持
await window.oeosApi.enableOEOSForCharacter(charIndex);

// 绑定角色
await window.oeosApi.bindCharacter(charIndex);

// 获取页面
const pageContent = await window.oeosApi.getPage('start');

// 更新状态
await window.oeosApi.updateState({
    pageId: 'current',
    variables: { score: 100 },
    path: ['start', 'current']
});
```

### 4. World Info 操作

```javascript
import { loadWorldInfo, saveWorldInfo } from '../../../world-info.js';

// 加载全局 World Info
const data = await loadWorldInfo('WI-OEOS-Pages');

// 加载角色专属 World Info
const char = characters[charIndex];
const worldInfoName = char.data?.extensions?.world;
if (worldInfoName) {
    const charWI = await loadWorldInfo(worldInfoName);
}

// 创建新条目（注意：使用 key 而不是 keys）
const uid = Date.now();
if (!data.entries) data.entries = {};
data.entries[uid] = {
    uid: uid,
    key: ["keyword1", "keyword2"],  // 注意：是 key 不是 keys
    keysecondary: [],
    comment: "条目注释",
    content: "条目内容",
    constant: true,  // 永久激活
    selective: true,
    order: 0,
    enabled: true,
    probability: 100,
    position: 0,
    role: 0
};

// 保存 World Info
await saveWorldInfo('WI-OEOS-Pages', data, true);
```

### 5. OEOScript v4 格式示例

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
  if: <eval>player.courage > 50</eval>
    say "你感到勇气倍增！"
  choice:
    - "继续前进":
      - goto: cave
    - "返回":
      - goto: start
```

---

## 故障排除

### 问题 1: 角色列表为空

**症状**: CharacterSelector 显示"没有找到可用的角色"

**原因**: `window.oeosApi` 未正确初始化

**解决方案**:
1. 检查插件是否正确加载
2. 在浏览器控制台执行: `console.log(window.oeosApi)`
3. 确认 `plugin-bridge.js` 已正确导入并执行

### 问题 2: 绑定角色失败

**症状**: 点击角色后显示错误

**原因**: World Info 操作失败

**解决方案**:
1. 检查 `loadWorldInfo` 和 `saveWorldInfo` 函数是否正确导入
2. 查看浏览器控制台的错误信息
3. 确认 World Info 文件权限正确

### 问题 3: AI 生成的页面未被保存

**症状**: 游戏无法前进到下一页

**原因**: 正则表达式规则未配置或未激活

**解决方案**:
1. 在 ST 的正则表达式设置中添加页面提取规则
2. 确认规则已启用
3. 测试正则表达式是否正确匹配 `<oeos page>` 标签

### 问题 4: toastr 通知不显示

**症状**: 操作没有任何反馈

**原因**: toastr 未正确引用

**解决方案**:
1. 确认 SillyTavern 的 toastr 库已加载
2. 在控制台测试: `toastr.info('测试')`
3. 检查是否有 JavaScript 错误阻止执行

---

**文档版本**: 2.0 (简化版)  
**最后更新**: 2025-10-11

**修改历史**:
- v2.0 (2025-10-11): 大幅简化，移除重复内容，更新实现状态，添加 toastr 通知系统
- v1.0 (2025-10-10): 初始版本

