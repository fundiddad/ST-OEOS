# OEOS SillyTavern 插件使用指南

## 📋 为什么 `oeos-st-extension` 不在 git 中？

### 问题背景

你可能注意到 `.gitignore` 中排除了整个 `SillyTavern-release/` 目录：

```gitignore
# 忽略整个 SillyTavern-release 目录
# 这个目录应该由用户自己安装 SillyTavern
# 我们只需要在插件目录中维护我们的代码
SillyTavern-release/
```

这意味着 `SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/` 也被排除了。

### 为什么这样做？

#### ❌ 之前的问题

1. **仓库体积巨大**：SillyTavern 包含大量文件（~1GB），提交时包含了 962 个不必要的文件
2. **构建产物污染**：`oeos-st-extension/dist/` 是构建产物，不应该在 git 中
3. **版本冲突**：SillyTavern 有自己的 git 仓库，嵌套会导致冲突
4. **依赖耦合**：Vue 应用直接 import SillyTavern 文件，导致构建失败

#### ✅ 现在的方案

1. **解耦架构**：Vue 应用通过 `window.oeosApi` 访问插件 API，不直接 import
2. **独立构建**：Vue 应用可以独立构建，不依赖 SillyTavern 文件
3. **清晰职责**：
   - `src/openeos-master/` - Vue 应用源码（在 git 中）
   - `src/oeos-plugin-core/` - 插件核心文件（在 git 中）
   - `src/SillyTavern-release/` - SillyTavern 安装（不在 git 中）

## 🚀 完整的使用流程

### 方案 A：推荐方案（插件核心文件也在 git 中）

我建议创建一个 `src/oeos-plugin-core/` 目录来存放插件核心文件，这样：
- ✅ 所有代码都在 git 中
- ✅ 部署脚本自动复制到 SillyTavern
- ✅ 不会提交 SillyTavern 的其他文件

#### 目录结构

```
src/
├── oeos-plugin-core/            # 插件核心文件（在 git 中）
│   ├── index.js                 # 插件入口
│   ├── manifest.json            # 插件清单
│   ├── plugin-bridge.js         # API 桥接
│   ├── ui.js                    # UI 加载器
│   ├── game-state.js            # 游戏状态管理
│   ├── st-api.js                # ST API 封装
│   └── v4-parser.js             # V4 脚本解析器
│
├── openeos-master/              # Vue 应用源码（在 git 中）
│   ├── src/                     # Vue 组件
│   ├── dist/                    # 构建产物（不在 git 中）
│   └── deploy.js                # 部署脚本（需要修改）
│
└── SillyTavern-release/         # SillyTavern 安装（不在 git 中）
    └── public/scripts/extensions/third-party/
        └── oeos-st-extension/   # 部署目标（自动生成）
```

#### 使用步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/fundiddad/ST-OEOS.git
   cd ST-OEOS/src
   ```

2. **安装 SillyTavern**
   ```bash
   git clone https://github.com/SillyTavern/SillyTavern.git SillyTavern-release
   cd SillyTavern-release
   npm install
   cd ..
   ```

3. **构建和部署**
   ```bash
   cd openeos-master
   npm install
   npm run build
   node deploy.js  # 会同时复制插件核心文件和 Vue 构建产物
   ```

4. **启动 SillyTavern**
   ```bash
   cd ../SillyTavern-release
   npm start
   ```

5. **在 SillyTavern 中启用插件**
   - 打开 `http://localhost:8000`
   - Extensions → OEOS Player → 启用

### 方案 B：当前方案（手动管理插件文件）

如果你不想修改项目结构，可以手动管理插件文件。

#### 使用步骤

1. **克隆仓库并安装 SillyTavern**（同方案 A）

2. **手动创建插件目录**
   ```bash
   mkdir -p SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension
   ```

3. **从文档中复制插件代码**
   
   查看以下文档，复制代码到对应文件：
   - `target_new.md` - 包含所有插件文件的完整代码
   - `IMPLEMENTATION_GUIDE.md` - 快速参考

   需要创建的文件：
   - `index.js` - 插件入口
   - `manifest.json` - 插件清单
   - `plugin-bridge.js` - API 桥接
   - `ui.js` - UI 加载器
   - `game-state.js` - 游戏状态管理
   - `st-api.js` - ST API 封装
   - `v4-parser.js` - V4 脚本解析器

4. **构建 Vue 应用**
   ```bash
   cd openeos-master
   npm install
   npm run build
   node deploy.js
   ```

5. **启动 SillyTavern**（同方案 A）

## 🔧 开发工作流

### 修改 Vue 应用

```bash
cd openeos-master

# 开发模式（需要配置 CORS 代理）
npm run serve

# 或者构建生产版本
npm run build
node deploy.js
```

### 修改插件核心文件

**方案 A**：
```bash
# 编辑 src/oeos-plugin-core/ 下的文件
# 然后重新部署
cd openeos-master
node deploy.js
```

**方案 B**：
```bash
# 直接编辑 SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/ 下的文件
# 刷新 SillyTavern 页面即可看到效果
```

## 📝 下一步建议

我建议采用**方案 A**，创建 `src/oeos-plugin-core/` 目录。这样：

1. **所有代码都在 git 中**，不会丢失
2. **部署自动化**，一个命令完成所有部署
3. **清晰的项目结构**，易于维护

需要我帮你：
1. 创建 `src/oeos-plugin-core/` 目录
2. 从文档中提取插件代码
3. 修改 `deploy.js` 脚本
4. 更新 `.gitignore`

吗？

