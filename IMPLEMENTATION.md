# OEOS-SillyTavern 项目进度

> **当前阶段**: 🔍 **探索阶段** - 项目处于架构设计和原型开发阶段，以下功能尚未经过完整测试。

## 📋 目录

1. [项目进度](#项目进度)
2. [文件结构](#文件结构)
3. [注意事项](#注意事项)
4. [变更记录](#变更记录)

---

## 项目进度

### 已编写的代码模块

> **说明**: 以下模块的代码已编写，但**尚未经过完整测试**，可能存在未知 bug。

#### 插件核心 (`src/oeos-plugin-core/`)

- ✏️ **plugin-bridge.js** - 核心桥接模块（未测试）
  - 功能：连接 Vue 应用和 SillyTavern，暴露 `window.oeosApi`
  - 主要函数：`getCharacters()`, `bindCharacter()`, `isOEOSCharacter()`, `enableOEOSForCharacter()`

- ✏️ **game-state.js** - 状态管理模块（未测试）
  - 功能：更新 World Info 中的游戏状态
  - 主要函数：`updatePageEntry()`, `updateStateEntry()`

- ✏️ **context-engine.js** - 上下文引擎（未测试）
  - 功能：根据游戏状态计算 AI 上下文
  - 主要函数：`recalculateDynamicContext()`

- ✏️ **st-api.js** - API 抽象层（未测试）
  - 功能：封装 World Info 和事件 API
  - 主要函数：`saveWi()`, `loadWi()`, `listenToAiResponse()`

#### Vue 组件 (`src/openeos-master/src/components/`)

- ✏️ **CharacterSelector.vue** - 角色选择界面（未测试）
  - 功能：显示角色列表，支持 OEOS 角色视觉标识和启用开关

- ✏️ **App.vue** - 主应用（已集成角色选择）
  - 功能：处理角色选择流程，加载游戏播放器

#### 功能模块

- ✏️ **OEOS 角色标记系统**（未测试）
  - `isOEOSCharacter()` - 检测角色是否为 OEOS 角色
  - `enableOEOSForCharacter()` - 为角色启用 OEOS 支持
  - 角色选择界面的 OEOS 角色视觉标识（绿色背景+边框+标签）
  - 为非 OEOS 角色提供"启用 OEOS"开关

### 待实现的功能

#### 阶段 1：核心数据流（优先级：🔴 最高）✅ **已完成 (2025-10-18)**

**1.1 World Info 条目实现**
- [x] 实现 Pages 节点（页面数据库，仅存储）
- [x] 实现 State 节点（游戏状态）
- [x] 实现 Graph 节点（页面关系图）
- [x] 实现 summary 节点（页面摘要）
- [x] 实现 Dynamic-Context 节点（动态上下文）

**1.2 元素数据对象（V2）与标签提取（内置）**
- [x] 引入 ElementDataManager 作为唯一数据源（pages/summary/graph/state/dynamicContext）
- [x] `initializeGameDataFromChatV2()` - 进入游戏时：从 World Info + chat 生成元素数据并同步
- [x] `updateGameDataFromAIResponseV2()` - AI 回复后：提取 <Pages>/<summary>，更新并同步
- [x] 内置正则解析（模块内实现），不依赖 ST 的 Regex 系统
- [x] 旧接口已移除：`initializeGameDataFromChat()`、`updateGameDataFromAIResponse()`

**1.3 预设文件同步系统**
- [x] 读取/保存预设：`getPresetByName()` + `savePresetDirect()`
- [x] `updatePresetPromptContent()` - 更新预设文件中的提示词内容
- [x] 实现双向同步机制（世界树 + 预设文件），并加入“近似原子提交+回滚”

#### 阶段 2：OEOS 引擎修改（优先级：🟠 高）✅ **已完成 (2025-10-12)**

**2.1 变量追踪系统**
- [x] 在 Storage mixin 中添加 `getAllVariables()` 方法
- [x] 在 OpenEosPlayer.vue 中监听页面变化
- [x] 实现 `onPageChange()` 回调，上报页面 ID 和所有变量
- [x] 调用 `window.oeosApi.updateState()` 更新 State 节点

**2.2 页面加载逻辑**
- [x] 修改 `getPage()` 支持从 Pages 节点读取部分脚本
- [x] 修改 OEOSV4Parser 支持解析不完整的脚本
- [x] 实现页面缺失时的处理逻辑（显示"正在生成..."）
- [x] 实现 AI 生成完成后的自动刷新

**详细完成报告**: 参见 `STAGE1_2_COMPLETION.md`

#### 阶段 3：AI 生成流程（优先级：🟡 中）

**3.1 页面请求系统**
- [ ] 实现 `requestPageFromAI()` - 模拟用户输入触发 AI 生成
- [ ] 监听 AI 回复事件（`AI_MESSAGE_RECEIVED`）
- [ ] 自动提取并更新 Pages 和 summary
- [ ] 自动重新计算 Dynamic-Context

**3.2 动态上下文引擎**
- [ ] 完善 `recalculateDynamicContext()` 的计算逻辑
- [ ] 实现向前 5 个页面的相关 ID 提取
- [ ] 实现向后 1 个页面的子页面提取
- [ ] 从 Pages 提取相关页面内容
- [ ] 更新 Dynamic-Context 条目

#### 阶段 4：测试与优化（优先级：🟢 低）

**4.1 功能测试**
- [ ] 测试角色启用 OEOS 流程
- [ ] 测试进入游戏并加载初始页面
- [ ] 测试玩家选择触发 AI 生成
- [ ] 测试 AI 生成后的页面加载
- [ ] 测试状态保存和恢复

**4.2 性能优化**
- [ ] 优化聊天记录遍历性能
- [ ] 优化 DynamicContext 计算性能
- [ ] 添加缓存机制

#### 高级功能（未来计划）
- 📋 多角色协作模式
- 📋 角色成长系统
- 📋 可视化编辑器
- 📋 页面图谱可视化

### 已知问题与待处理事项

#### 1. **未经完整测试** 🟢

**问题描述**：
- 所有代码模块均未进行完整的功能测试
- 需要建立测试流程

**测试计划**：
- 先测试基础功能（角色选择、World Info 读写）
- 再测试复杂功能（AI 生成、预设文件同步）

#### 2. **待优化事项** 🟡

**问题描述**：
- AI 回复监听器可能重复注册
- 占位符页面逻辑较简单
- 预设文件更新机制需要实际测试

**待处理**：
- 添加监听器去重逻辑
- 完善占位符页面的处理逻辑
- 在实际环境中测试预设文件同步

---

## 文件结构

### 项目根目录

```
ST_oeos/
├── src/                          # 源代码目录（Git 仓库）
│   ├── oeos-plugin-core/         # OEOS 插件核心
│   ├── openeos-master/           # OEOS Vue 播放器
│   ├── SillyTavern-release/      # SillyTavern 主程序
│   ├── ARCHITECTURE.md           # 架构设计文档
│   ├── IMPLEMENTATION.md         # 项目进度文档（本文件）
│   ├── README.md                 # 项目说明
│   └── oeos-commands.v4.md       # OEOScript v4 语法参考
```

### 插件核心 (`src/oeos-plugin-core/`)

```
oeos-plugin-core/
├── plugin-bridge.js              # 核心桥接模块
│   ├── 功能：连接 Vue 应用和 SillyTavern
│   ├── 导出：window.oeosApi
│   └── 依赖：st-api.js, game-state.js, context-engine.js
│
├── game-state.js                 # 游戏状态管理
│   ├── 功能：更新 World Info 中的游戏状态
│   ├── 导出：updatePageEntry, updateStateEntry
│   └── 依赖：st-api.js
│
├── context-engine.js             # 动态上下文引擎
│   ├── 功能：根据游戏状态计算 AI 上下文
│   ├── 导出：recalculateDynamicContext
│   └── 依赖：st-api.js
│
└── st-api.js                     # SillyTavern API 抽象层
    ├── 功能：封装 World Info 和事件 API
    ├── 导出：saveWi, loadWi, listenToAiResponse
    └── 依赖：SillyTavern 核心模块
```

### Vue 播放器 (`src/openeos-master/`)

```
openeos-master/
├── src/
│   ├── App.vue                   # 主应用
│   ├── components/
│   │   ├── CharacterSelector.vue # 角色选择组件
│   │   ├── OpenEosPlayer.vue     # 游戏播放器
│   │   └── bubbles/              # 对话气泡组件
│   ├── interpreter/              # JS-Interpreter 沙箱
│   └── util/
│       └── pageCompiler.js       # OEOScript 编译器
│
├── dist/                         # 构建输出（自动部署到 ST）
├── deploy.js                     # 自动部署脚本
└── package.json                  # 依赖配置
```

### SillyTavern 集成

```
SillyTavern-release/
└── public/scripts/extensions/third-party/oeos-st-extension/
    ├── index.html                # OEOS 播放器入口
    ├── js/app.js                 # Vue 应用（来自 dist/）
    ├── plugin-bridge.js          # 插件核心（来自 oeos-plugin-core/）
    ├── game-state.js
    ├── context-engine.js
    └── st-api.js
```

### World Info 文件

**核心原则**：每个角色就是一个独立的游戏，所有游戏数据都存储在角色专属的 World Info 中。

```
SillyTavern-release/data/{user}/worlds/
└── {角色名}-OEOS.json            # 角色专属：该角色游戏的所有数据
    ├── OEOS Character Marker     # 标记条目（仅用于识别，不激活）
    ├── Pages                     # 页面数据库（仅存储）
    ├── State                     # 游戏状态（仅存储）
    ├── Graph                     # 页面关系图（仅存储）
    ├── summary                   # 页面摘要（仅存储）
    └── Dynamic-Context           # 动态上下文（仅存储）
```

**说明**：
- 所有节点设置为 `constant: false, disable: true`（不激活，仅存储）
- AI 上下文通过预设文件 `小猫之神-oeos.json` 中的提示词注入
- 世界树节点仅用于数据存储和用户查看

**示例**：
- `test1-OEOS.json` - test1 角色的游戏数据
- `Seraphina-OEOS.json` - Seraphina 角色的游戏数据

---

## 注意事项

### 开发规范

#### 1. 代码注释
- 所有函数必须有中文注释
- 说明功能、参数、返回值
- 复杂逻辑需要添加行内注释

#### 2. 错误处理
- 使用 `try-catch` 捕获异常
- 使用 `console` 显示错误信息给用户
- 在控制台记录详细错误信息（用于调试）

示例：
```javascript
try {
    await someOperation();
    console.info('[OEOS] 操作成功');
} catch (error) {
    console.error('[OEOS] 详细错误:', error);
    console.error(`[OEOS] 操作失败: ${error.message}`);
}
```

#### 3. 异步操作
- 统一使用 `async/await`
- 避免回调地狱和 Promise 链

示例：
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

#### 4. 模块导入
- 插件核心使用 ES6 `import/export`
- Vue 应用通过 `window.oeosApi` 访问插件

### 架构原则

#### 1. 数据存储
- ✅ 每个角色一个游戏 → 所有游戏数据存储在角色专属 World Info（`{角色名}-OEOS.json`）


#### 2. 通知系统
- ✅ 使用 `console` 提供用户反馈
- ✅ 统一使用 `console.info`/`console.warn`/`console.error` 输出信息

#### 3. 事件处理
- ✅ 订阅 SillyTavern 事件（`eventSource.on()`）
- ❌ 不要使用轮询（`setInterval()`）

### 测试注意事项

#### 1. 当前状态
- 所有代码均未经过完整测试
- 可能存在未知 bug
- 需要建立系统的测试流程

#### 2. 测试建议
- 先测试基础功能（角色选择、World Info 读写）
- 再测试复杂功能（AI 生成、动态上下文）
- 使用浏览器控制台调试

#### 3. 调试工具
- `console.log(window.oeosApi)` - 检查 API 是否加载
- `console.info('测试')` - 测试日志输出
- Chrome DevTools - 查看网络请求和错误
- SillyTavern 控制台 - 查看服务器日志

---

## 变更记录

### v4.0 (2025-10-18)
- **架构升级**：实现预设文件提示词注入方案
  - 重命名世界树节点（Pages, State, Graph, summary, Dynamic-Context）
  - 所有节点设置为不激活状态（仅存储）
  - 实现 XML 标签提取系统（summary, Graph, State, Dynamic-Context）
  - 实现预设文件同步系统（双向同步：世界树 + 预设文件）
  - 移除正则表达式处理（不再需要）
  - 更新所有相关函数和文档

### v3.0 (2025-10-11)
- 彻底重构文档，聚焦项目进度
- 明确标注"探索阶段"，所有功能未经测试
- 将"已实现功能"改为"已编写的代码模块"
- 添加详细的文件结构说明
- 添加开发规范和测试注意事项

### v2.0 (2025-10-11)
- 大幅简化，移除重复内容
- 更新实现状态
- 将通知系统改为使用 console 输出

### v1.0 (2025-10-10)
- 初始版本

