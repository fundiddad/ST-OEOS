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

#### 核心功能
- ⏳ AI 生成页面的正则表达式规则配置
- ⏳ 动态上下文引擎完善
- ⏳ 角色 World Info 激活机制
- ⏳ 角色正则表达式激活机制
- ⏳ 页面编译和执行流程测试

#### 高级功能
- 📋 多角色协作模式
- 📋 角色成长系统
- 📋 可视化编辑器
- 📋 页面图谱可视化

### 已知问题

1. **World Info 架构调整**
   - 之前错误地创建了全局 WI 文件存储角色数据
   - 已修正为使用角色专属 World Info

2. **未经测试**
   - 所有代码模块均未进行完整的功能测试
   - 需要建立测试流程

3. **正则表达式规则未配置**
   - 需要在 SillyTavern 中配置提取 `<oeos page>` 标签的正则表达式

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

```
SillyTavern-release/data/{user}/worlds/
├── WI-OEOS-Pages.json            # 全局：页面数据库
├── WI-OEOS-State.json            # 全局：游戏状态
├── WI-OEOS-Graph.json            # 全局：页面关系图
├── WI-OEOS-Abstracts.json        # 全局：页面摘要
├── WI-OEOS-DynamicContext.json   # 全局：动态上下文
└── {角色名}-OEOS.json            # 角色专属：角色数据
```

---

## 注意事项

### 开发规范

#### 1. 代码注释
- 所有函数必须有中文注释
- 说明功能、参数、返回值
- 复杂逻辑需要添加行内注释

#### 2. 错误处理
- 使用 `try-catch` 捕获异常
- 使用 `toastr` 显示错误信息给用户
- 在控制台记录详细错误信息（用于调试）

示例：
```javascript
try {
    await someOperation();
    toastr.success('[OEOS] 操作成功');
} catch (error) {
    console.error('[OEOS] 详细错误:', error);
    toastr.error(`[OEOS] 操作失败: ${error.message}`);
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
- ✅ 全局数据 → 全局 World Info（`WI-OEOS-*`）
- ✅ 角色数据 → 角色专属 World Info（`{角色名}-OEOS.json`）
- ❌ 不要创建全局 WI 存储角色数据

#### 2. 通知系统
- ✅ 使用 `toastr` 提供用户反馈
- ❌ 不要仅用 `console.log`（用户看不到）

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
- `toastr.info('测试')` - 测试通知系统
- Chrome DevTools - 查看网络请求和错误
- SillyTavern 控制台 - 查看服务器日志

---

## 变更记录

### v3.0 (2025-10-11)
- 彻底重构文档，聚焦项目进度
- 明确标注"探索阶段"，所有功能未经测试
- 将"已实现功能"改为"已编写的代码模块"
- 移除"关键代码示例"（未验证正确性）
- 移除"故障排除"（无实际测试数据）
- 添加详细的文件结构说明
- 添加开发规范和测试注意事项

### v2.0 (2025-10-11)
- 大幅简化，移除重复内容
- 更新实现状态
- 添加 toastr 通知系统

### v1.0 (2025-10-10)
- 初始版本

