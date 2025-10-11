# ST-OEOS

An AI-driven plugin for SillyTavern that adapts the Open Eos script engine to power dynamically generated interactive stories.

## 📋 项目架构说明

### 为什么 `oeos-st-extension` 不在 git 仓库中？

这个项目采用了**解耦架构**，将代码分为两部分：

```
src/
├── openeos-master/              # Vue 应用源码（在 git 中）
│   ├── src/                     # Vue 组件
│   ├── dist/                    # 构建产物（不在 git 中）
│   └── deploy.js                # 部署脚本
│
└── SillyTavern-release/         # SillyTavern 安装目录（不在 git 中）
    └── public/scripts/extensions/third-party/
        └── oeos-st-extension/   # 插件部署目录（构建后自动生成）
            ├── index.js         # 插件入口
            ├── plugin-bridge.js # API 桥接
            ├── ui.js            # UI 加载器
            ├── game-state.js    # 游戏状态管理
            ├── st-api.js        # ST API 封装
            └── dist/            # Vue 应用构建产物
```

### 设计原因

1. **避免重复**：`SillyTavern-release` 是完整的 SillyTavern 安装，包含大量文件（~1GB），不应该放在 git 中
2. **构建产物分离**：`oeos-st-extension` 目录是通过构建和部署脚本自动生成的
3. **独立开发**：Vue 应用可以独立开发和构建，不依赖 SillyTavern 的文件
4. **清晰的职责**：
   - `openeos-master/` - 开发源码
   - `oeos-st-extension/` - 部署产物

## 🚀 安装和使用

### 前置要求

- Node.js 14+
- npm 或 yarn
- SillyTavern（已安装）

### 步骤 1：克隆仓库

```bash
git clone https://github.com/fundiddad/ST-OEOS.git
cd ST-OEOS/src
```

### 步骤 2：安装 SillyTavern（如果还没有）

```bash
# 在 src 目录下
git clone https://github.com/SillyTavern/SillyTavern.git SillyTavern-release
cd SillyTavern-release
npm install
cd ..
```

### 步骤 3：构建 OEOS 插件

```bash
# 在 src 目录下
cd openeos-master
npm install
npm run build
```

### 步骤 4：部署到 SillyTavern

```bash
# 在 openeos-master 目录下
node deploy.js
```

这会自动将构建产物复制到：
```
SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/
```

### 步骤 5：手动复制插件核心文件

由于插件核心文件（`index.js`, `plugin-bridge.js` 等）不在 git 中，你需要手动创建它们。

**方法 1：从文档中复制**（推荐）

查看 `src/target_new.md` 和 `src/IMPLEMENTATION_GUIDE.md`，其中包含了所有插件文件的完整代码。

**方法 2：使用备份**（如果有）

如果你之前有备份，可以直接复制。

### 步骤 6：启动 SillyTavern

```bash
cd SillyTavern-release
npm start
```

### 步骤 7：在 SillyTavern 中启用插件

1. 打开 SillyTavern（通常是 `http://localhost:8000`）
2. 点击顶部的 **Extensions** 图标
3. 找到 **OEOS Player** 插件
4. 点击启用

## 🔧 开发工作流

### 修改 Vue 应用

```bash
cd openeos-master
# 修改 src/ 下的文件
npm run serve  # 开发模式（需要配置 CORS 代理）
# 或
npm run build  # 构建生产版本
node deploy.js # 部署到 SillyTavern
```

### 修改插件核心文件

直接编辑 `SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/` 下的文件：
- `index.js` - 插件入口
- `plugin-bridge.js` - API 桥接
- `ui.js` - UI 加载器
- `game-state.js` - 游戏状态管理
- `st-api.js` - ST API 封装

修改后刷新 SillyTavern 页面即可看到效果。

## 📚 架构文档

- **`target_new.md`** - 完整的实现计划和代码示例
- **`IMPLEMENTATION_GUIDE.md`** - 快速实现指南
- **`DECOUPLING_SOLUTION.md`** - 解耦方案详细说明
- **`ARCHITECTURE_CORRECTION.md`** - 架构修正文档

## 🎯 核心概念

### 全局 API 桥接

插件通过 `window.oeosApi` 暴露 API，Vue 应用通过全局对象访问：

```javascript
// 在 plugin-bridge.js 中
window.oeosApi = {
    initGameData,
    getPage,
    updateState,
    bindCharacter,
    // ...
};

// 在 App.vue 中
if (window.oeosApi) {
    await window.oeosApi.initGameData();
}
```

这样 Vue 应用可以独立构建，不需要 import SillyTavern 的文件。

## ❓ 常见问题

### Q: 为什么构建后还需要手动复制插件文件？

A: 因为插件核心文件（`index.js`, `plugin-bridge.js` 等）不在 git 仓库中。你可以：
1. 从文档中复制代码
2. 创建一个本地备份
3. 或者将这些文件添加到 git（但要注意不要提交 SillyTavern 的其他文件）

### Q: 我可以把插件文件加入 git 吗？

A: 可以！你可以创建一个单独的目录来存放插件核心文件，例如：

```
src/
├── oeos-plugin-source/          # 插件源码（可以加入 git）
│   ├── index.js
│   ├── plugin-bridge.js
│   ├── ui.js
│   └── ...
└── openeos-master/
    └── deploy.js                # 修改部署脚本，同时复制插件文件
```

### Q: 每次修改都要重新构建和部署吗？

A:
- **Vue 应用**：是的，需要 `npm run build` + `node deploy.js`
- **插件核心文件**：不需要，直接修改后刷新页面即可

## 📝 License

MIT
