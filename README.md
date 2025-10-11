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
2. 选择一个角色开始冒险
3. 系统自动绑定角色数据（描述、性格、World Info、聊天历史）
4. 开始 AI 驱动的互动故事

### 游戏流程

```
点击火箭图标 → 选择角色 → 绑定角色数据 → AI 生成起始页面 →
玩家互动 → AI 生成新内容 → 无限循环
```

### 数据持久化

- 游戏状态存储在 SillyTavern 的 World Info 中
- 每个角色有独立的游戏进度
- 支持保存/加载游戏

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
    initGameData,
    getPage,
    updateState,
    bindCharacter,
};

// Vue 应用调用 API
if (window.oeosApi) {
    await window.oeosApi.initGameData();
}
```

### World Info 驱动

所有游戏数据存储在 World Info 中：
- `WI-OEOS-Pages` - 页面数据库
- `WI-OEOS-State` - 玩家状态和路径
- `WI-OEOS-Graph` - 故事图谱
- `WI-OEOS-DynamicContext` - 动态上下文

## ❓ 常见问题

**Q: 为什么 SillyTavern-release 不在 git 中？**
A: SillyTavern 是独立项目（~1GB），应由用户自行安装。我们只维护插件代码。

**Q: 如何更新插件？**
A: 修改代码后运行 `npm run build && node deploy.js` 即可。

**Q: 支持哪些 OEOScript 版本？**
A: 目前支持 OEOScript v4。详见 `oeos-commands.v4.md`。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📝 License

MIT
