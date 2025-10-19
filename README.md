# ST-OEOS

一个为 SillyTavern 设计的 AI 驱动插件，将 OEOS (Open Erotic Story) 脚本引擎改造为动态生成的互动故事平台。

## 📖 项目简介

ST-OEOS 将 OEOS 播放器深度集成到 SillyTavern 中，通过 AI 实时生成 OEOScript v4 格式的互动故事内容。AI 扮演"地下城主"角色，根据玩家行为、角色设定和聊天历史动态创建故事分支和挑战。

**核心特性：**
- ✅ AI 驱动的动态故事生成
- ✅ 与 SillyTavern 角色系统深度整合
- ✅ 基于 World Info 的状态持久化
- ✅ 支持角色选择和数据绑定
- ✅ 模块化架构，易于扩展

## 🚀 快速开始

### 前置要求

- Node.js 14+
- npm 或 yarn
- SillyTavern（已安装或准备安装）

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/fundiddad/ST-OEOS.git
cd ST-OEOS/src

# 2. 安装 SillyTavern（如果还没有）
git clone https://github.com/SillyTavern/SillyTavern.git SillyTavern-release
cd SillyTavern-release
npm install
cd ..

# 3. 构建 OEOS 插件
cd openeos-master
npm install
npm run build

# 4. 部署到 SillyTavern
node deploy.js

# 5. 启动 SillyTavern
cd ../SillyTavern-release
npm start
```

### 启用插件

1. 打开 SillyTavern（通常是 `http://localhost:8000`）
2. 点击顶部的 **Extensions** 图标
3. 找到 **OEOS Player** 插件并启用
4. 点击火箭图标开始游戏

## 📁 项目结构

```
src/
├── openeos-master/              # Vue 应用源码（在 git 中）
│   ├── src/                     # Vue 组件
│   ├── dist/                    # 构建产物（不在 git 中）
│   └── deploy.js                # 部署脚本
│
├── oeos-plugin-core/            # 插件核心文件（在 git 中）
│   ├── index.js                 # 插件入口
│   ├── plugin-bridge.js         # API 桥接
│   ├── ui.js                    # UI 加载器
│   └── ...                      # 其他核心模块
│
└── SillyTavern-release/         # SillyTavern 安装（不在 git 中）
    └── public/scripts/extensions/third-party/
        └── oeos-st-extension/   # 插件部署目录（自动生成）
```

## 🎮 基本使用

### 启动游戏

1. 在 SillyTavern 中点击火箭图标
2. 选择一个角色
3. 如果角色不是 OEOS 角色，点击"启用 OEOS"
4. 系统自动创建角色专属的 World Info 和游戏数据
5. 开始 AI 驱动的互动故事

### 游戏流程

```
点击火箭图标 → 选择角色 → 启用 OEOS（如需要） → 进入游戏 →
从 start 页面开始（或从上次位置恢复） → 玩家选择 →
AI 生成新页面 → 继续游戏 → 无限循环
```

### 数据持久化

- 每个角色就是一个独立的游戏
- 游戏数据存储在角色专属的 World Info 中（`{角色名}-OEOS.json`）
- 包含页面数据库、游戏状态、页面关系图、页面摘要等
- 支持从上次位置恢复游戏

## 🔧 开发工作流

### 修改 Vue 应用

```bash
cd openeos-master

# 开发模式（需要配置 CORS 代理）
npm run serve

# 或构建生产版本
npm run build
node deploy.js
```

### 修改插件核心文件

```bash
# 编辑 src/oeos-plugin-core/ 下的文件
# 然后重新部署
cd openeos-master
node deploy.js
```

## 📚 文档索引

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - 架构设计文档
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** - 实现指南和代码示例
- **[oeos-commands.v4.md](./oeos-commands.v4.md)** - OEOScript v4 语法参考

## 🎯 核心概念

### 解耦架构

Vue 应用通过全局 API (`window.oeosApi`) 与插件通信，实现完全解耦：

```javascript
// 插件暴露 API
window.oeosApi = {
    
    getPage,
    updateState,
    bindCharacter,
};


```

### 角色专属 World Info

每个 OEOS 角色都有自己的 World Info 文件（`{角色名}-OEOS.json`），包含：
- **OEOS Character Marker** - 标记条目（用于识别 OEOS 角色）
- **Pages** - 页面数据库（存储所有 OEOScript 页面）
- **State** - 游戏状态（玩家路径和变量）
- **Graph** - 页面关系图（页面之间的跳转关系）
- **summary** - 页面摘要（用于 Token 优化）
- **Dynamic-Context** - 动态上下文（根据玩家位置计算）

### AI 生成流程

1. 玩家选择一个选项（例如："进入森林"）
2. OEOS 引擎执行 `goto: forest`
3. 检查 Pages 是否有 `forest` 页面
4. 如果没有，显示"正在生成..."并请求 AI 生成
5. AI 回复包含 `<Pages>` 和 `<summary>` 标签
6. 系统自动提取并更新 World Info
7. 正则表达式过滤消息显示（只显示摘要）
8. OEOS 播放器加载新页面

## ⚠️ 项目状态

> **当前阶段**: 🔍 **探索阶段** - 项目处于架构设计和原型开发阶段，以下功能尚未经过完整测试。

**已完成**：
- ✅ 角色选择界面
- ✅ OEOS 角色标记系统
- ✅ World Info 条目创建
- ✅ 基础 API 桥接

**进行中**：
- 🔄 聊天记录提取系统
- 🔄 正则表达式配置
- 🔄 OEOS 引擎状态上报
- 🔄 动态上下文计算

**待实现**：
- ⏳ AI 生成页面流程
- ⏳ 页面加载和渲染
- ⏳ 完整的游戏循环测试

## ❓ 常见问题

**Q: 为什么 SillyTavern-release 不在 git 中？**
A: SillyTavern 是独立项目（~1GB），应由用户自行安装。我们只维护插件代码。

**Q: 如何更新插件？**
A: 修改代码后运行 `npm run build && node deploy.js` 即可。

**Q: 支持哪些 OEOScript 版本？**
A: 目前支持 OEOScript v4。详见 `oeos-commands.v4.md`。

**Q: 每个角色的游戏数据存储在哪里？**
A: 存储在角色专属的 World Info 文件中（`data/{user}/worlds/{角色名}-OEOS.json`）。

**Q: AI 生成的页面如何存储？**
A: AI 回复中的 `<Pages>` 标签内容会被提取并存储到 Pages 条目中。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📝 License

MIT
