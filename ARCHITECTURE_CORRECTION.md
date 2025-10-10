# OEOS 插件架构修正说明

## 📌 核心问题

之前的实现方案中存在一个**重大架构误解**：使用 `window` 对象作为全局 API 桥梁。

## ❌ 错误的做法

### 错误 1：使用 window 对象暴露 API
```javascript
// ❌ 错误：在 plugin-bridge.js 中
window.stOeosPlugin = {
    initGameData,
    getPage,
    updateState,
    getCharacters,
    bindCharacter,
};
```

### 错误 2：在 Vue 组件中访问 window 对象
```javascript
// ❌ 错误：在 CharacterSelector.vue 中
if (window.stOeosPlugin && window.stOeosPlugin.getCharacters) {
    this.characters = window.stOeosPlugin.getCharacters();
}
```

### 错误 3：在 App.vue 中使用 window.parent
```javascript
// ❌ 错误：假设在 iframe 中运行
window.parent.stOeosPlugin.updateState(newState);
```

## ✅ 正确的做法

### 正确理解：SillyTavern 插件架构

1. **同一窗口上下文**：OEOS 插件直接在 ST 页面中运行，不是 iframe
2. **ES6 模块系统**：使用 `import/export` 进行模块间通信
3. **遵循 ST 规范**：参考其他官方插件的实现方式

### 正确 1：使用 ES6 export
```javascript
// ✅ 正确：在 plugin-bridge.js 中
import { characters, this_chid, chat } from '../../../../script.js';
import { loadWorldInfo, saveWorldInfo } from '../../../world-info.js';

export function getCharacters() {
    return characters.map((char, index) => ({
        index,
        name: char.name,
        avatar: char.avatar,
        // ...
    }));
}

export async function bindCharacter(charIndex) {
    // 实现逻辑
}

// 导出所有函数
export {
    initGameData,
    getPage,
    updateState,
    updatePageEntry as updatePage,
};
```

### 正确 2：在 Vue 组件中使用 import
```javascript
// ✅ 正确：在 CharacterSelector.vue 中
import { getCharacters } from '../../../../SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js';

export default {
    methods: {
        async loadCharacters() {
            // 直接调用导入的函数
            this.characters = getCharacters();
        }
    }
}
```

### 正确 3：在 App.vue 中使用 import
```javascript
// ✅ 正确：在 App.vue 中
import { bindCharacter } from '../../SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/plugin-bridge.js';

export default {
    methods: {
        async onCharacterSelected({ index }) {
            // 直接调用导入的函数
            await bindCharacter(index);
        }
    }
}
```

## 🔍 参考：其他 ST 插件的实现

### Gallery 插件
```javascript
// src/SillyTavern-release/public/scripts/extensions/gallery/index.js
import {
    eventSource,
    this_chid,
    characters,
    getRequestHeaders,
    event_types,
} from '../../../script.js';

// 直接使用导入的变量和函数
const currentChar = characters[this_chid];
```

### Memory 插件
```javascript
// src/SillyTavern-release/public/scripts/extensions/memory/index.js
import { getContext, extension_settings } from '../../extensions.js';
import {
    eventSource,
    event_types,
    generateQuietPrompt,
    setExtensionPrompt,
} from '../../../script.js';

// 直接使用导入的函数
await generateQuietPrompt(...);
```

### Quick Reply 插件
```javascript
// src/SillyTavern-release/public/scripts/extensions/quick-reply/index.js
import { chat, chat_metadata, eventSource, event_types } from '../../../script.js';
import { extension_settings } from '../../extensions.js';

// 导出 API
export let quickReplyApi;
```

## 📊 架构对比

| 方面 | 错误做法 | 正确做法 |
|------|---------|---------|
| **数据传递** | `window.stOeosPlugin` | `import/export` |
| **跨模块通信** | 全局对象 | ES6 模块 |
| **类型安全** | 无 | 可使用 TypeScript |
| **命名空间** | 污染全局 | 模块化隔离 |
| **调试** | 难以追踪 | 清晰的依赖关系 |
| **符合规范** | ❌ | ✅ |

## 🎯 修改清单

### 需要修改的文件

1. **plugin-bridge.js**
   - ❌ 删除 `window.stOeosPlugin = {...}`
   - ✅ 添加 `export function ...` 和 `export {...}`

2. **CharacterSelector.vue**
   - ❌ 删除 `window.stOeosPlugin.getCharacters()`
   - ✅ 添加 `import { getCharacters } from '...'`

3. **App.vue**
   - ❌ 删除 `window.parent.stOeosPlugin` 或 `window.stOeosPlugin`
   - ✅ 添加 `import { bindCharacter } from '...'`

## 🚀 迁移步骤

### 步骤 1：修改 plugin-bridge.js
```bash
# 1. 添加所有必要的 import
# 2. 将所有函数改为 export function
# 3. 删除 window.stOeosPlugin 赋值
# 4. 添加统一的 export { ... } 语句
```

### 步骤 2：修改 Vue 组件
```bash
# 1. 在 <script> 顶部添加 import 语句
# 2. 删除所有 window.stOeosPlugin 引用
# 3. 直接调用导入的函数
```

### 步骤 3：测试
```bash
# 1. 检查浏览器控制台是否有模块加载错误
# 2. 验证函数调用是否正常
# 3. 确认数据流是否正确
```

## 💡 关键要点

1. **不要使用 `window` 对象**：这不符合 ST 插件规范
2. **使用 ES6 模块**：`import/export` 是标准做法
3. **参考官方插件**：gallery、memory、quick-reply 等都是好例子
4. **同一窗口上下文**：不需要 `window.parent`，直接 `import` 即可

## 📚 相关文档

- **详细实现计划**：`src/target_new.md`
- **快速实现指南**：`src/IMPLEMENTATION_GUIDE.md`
- **OEOS 命令参考**：`src/oeos-commands.v4.md`

## ✅ 验证方法

修改完成后，在浏览器控制台执行：

```javascript
// ❌ 这应该是 undefined（不再使用 window 对象）
console.log(window.stOeosPlugin); // undefined

// ✅ 模块应该正常加载（检查 Network 标签）
// 查看是否有 plugin-bridge.js 的加载记录
```

## 🎉 预期效果

修改完成后：
- ✅ 代码更清晰、更易维护
- ✅ 符合 SillyTavern 插件规范
- ✅ 更好的模块化和类型安全
- ✅ 避免全局命名空间污染
- ✅ 更容易调试和追踪问题

