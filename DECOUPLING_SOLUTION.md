# 解耦方案：Vue 应用与 SillyTavern 插件分离

## 🎯 问题

之前的实现中，Vue 应用（openeos-master）直接 import SillyTavern 的文件：

```javascript
// ❌ 错误做法：直接 import SillyTavern 文件
import { initGameData, getPage } from '../../SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js'
```

这导致了以下问题：
1. **构建失败**：webpack 会尝试编译 SillyTavern 的所有文件
2. **ESLint 错误**：SillyTavern 使用不同的 ESLint 配置
3. **依赖耦合**：Vue 应用无法独立构建
4. **路径复杂**：需要使用复杂的相对路径

## ✅ 解决方案：全局 API 桥接

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    SillyTavern 环境                          │
│                                                              │
│  ┌──────────────────────┐         ┌──────────────────────┐ │
│  │  ST 插件             │         │  Vue 应用            │ │
│  │  (plugin-bridge.js)  │         │  (App.vue)           │ │
│  │                      │         │                      │ │
│  │  - initGameData()    │         │  - 调用全局 API      │ │
│  │  - getPage()         │────────▶│  - 不直接 import     │ │
│  │  - updateState()     │         │                      │ │
│  │  - bindCharacter()   │         │                      │ │
│  │                      │         │                      │ │
│  │  暴露到:             │         │  访问:               │ │
│  │  window.oeosApi      │         │  window.oeosApi      │ │
│  └──────────────────────┘         └──────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 实现步骤

#### 1. SillyTavern 插件暴露全局 API

**文件**: `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js`

```javascript
// ✅ 暴露全局 API 供 Vue 应用调用（解耦方案）
window.oeosApi = {
    initGameData,
    getPage,
    updateState,
    updatePage: updatePageEntry,
    // 角色相关 API
    getCharacters,
    getCurrentCharacter,
    getCharacterWorldInfo,
    getCharacterRegexScripts,
    bindCharacter,
};

// ✅ 同时也导出，供其他 ST 插件使用
export {
    initGameData,
    getPage,
    updateState,
    updatePageEntry as updatePage,
    getCharacters,
    getCurrentCharacter,
    getCharacterWorldInfo,
    getCharacterRegexScripts,
    bindCharacter,
};
```

#### 2. Vue 应用使用全局 API

**文件**: `src/openeos-master/src/App.vue`

```javascript
// ✅ 使用全局 API（解耦方案）
// 不直接 import SillyTavern 文件，避免构建问题
// 插件会在 window.oeosApi 上暴露 API

export default {
  methods: {
    async startAiDrivenTease() {
      // ✅ 检查 API 是否可用
      if (!window.oeosApi) {
        throw new Error('OEOS API not available. Please ensure the plugin is loaded.');
      }

      // ✅ 调用全局 API
      await window.oeosApi.initGameData();
      const startPageScript = await window.oeosApi.getPage('start');
      
      // ...
    },
    
    async onCharacterSelected({ index, character }) {
      // ✅ 调用全局 API
      if (window.oeosApi && window.oeosApi.bindCharacter) {
        await window.oeosApi.bindCharacter(index);
      }
      
      await this.startAiDrivenTease();
    }
  }
}
```

**文件**: `src/openeos-master/src/components/CharacterSelector.vue`

```javascript
export default {
  methods: {
    async loadCharacters() {
      // ✅ 使用全局 API
      if (!window.oeosApi || !window.oeosApi.getCharacters) {
        throw new Error('OEOS API not available');
      }
      
      this.characters = window.oeosApi.getCharacters();
    }
  }
}
```

## 📊 对比

### 之前（耦合方案）

```javascript
// ❌ 直接 import
import { initGameData } from '../../SillyTavern-release/.../plugin-bridge.js'

// ❌ 构建时会处理 SillyTavern 文件
// ❌ 需要配置 webpack 排除规则
// ❌ 路径复杂，难以维护
```

### 现在（解耦方案）

```javascript
// ✅ 使用全局 API
if (window.oeosApi) {
  await window.oeosApi.initGameData()
}

// ✅ 构建时不处理 SillyTavern 文件
// ✅ 不需要特殊的 webpack 配置
// ✅ 代码简洁，易于维护
```

## 🎯 优势

### 1. **完全解耦**
- Vue 应用可以独立构建
- 不依赖 SillyTavern 的代码结构
- 构建速度更快

### 2. **构建简单**
- 不需要特殊的 webpack 配置
- 不需要排除 SillyTavern 目录
- 不会触发 ESLint 错误

### 3. **代码清晰**
- 明确的 API 边界
- 易于理解和维护
- 符合前端最佳实践

### 4. **灵活性**
- 可以在运行时检查 API 是否可用
- 可以提供降级方案
- 易于测试和调试

## 🔧 技术细节

### API 可用性检查

```javascript
// ✅ 始终检查 API 是否可用
if (!window.oeosApi) {
  throw new Error('OEOS API not available');
}

// ✅ 检查特定方法是否存在
if (window.oeosApi && window.oeosApi.bindCharacter) {
  await window.oeosApi.bindCharacter(index);
}
```

### 错误处理

```javascript
try {
  if (!window.oeosApi) {
    throw new Error('OEOS API not available. Please ensure the plugin is loaded.');
  }
  
  await window.oeosApi.initGameData();
} catch (error) {
  this.error = `初始化失败: ${error.message}`;
  console.error('[OEOS] Error:', error);
}
```

## 📝 迁移指南

如果你有其他组件需要访问 SillyTavern 数据：

### 步骤 1：移除 import 语句

```javascript
// ❌ 删除这些
import { someFunction } from '../../SillyTavern-release/.../some-file.js'
```

### 步骤 2：使用全局 API

```javascript
// ✅ 改用这些
if (window.oeosApi && window.oeosApi.someFunction) {
  window.oeosApi.someFunction()
}
```

### 步骤 3：添加错误处理

```javascript
// ✅ 始终检查 API 是否可用
if (!window.oeosApi) {
  console.error('OEOS API not available');
  return;
}
```

## 🎉 结果

- ✅ **构建成功**：`npm run build` 不再报错
- ✅ **代码解耦**：Vue 应用完全独立
- ✅ **易于维护**：清晰的 API 边界
- ✅ **符合规范**：遵循前端最佳实践

## 📚 相关文件

- `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js` - 暴露全局 API
- `src/openeos-master/src/App.vue` - 使用全局 API
- `src/openeos-master/src/components/CharacterSelector.vue` - 使用全局 API
- `src/openeos-master/vue.config.js` - 恢复为简单配置（不再需要排除规则）

## 🔑 关键要点

1. **不要直接 import SillyTavern 文件**
2. **使用 `window.oeosApi` 访问 API**
3. **始终检查 API 是否可用**
4. **添加适当的错误处理**
5. **保持代码简洁和可维护**

