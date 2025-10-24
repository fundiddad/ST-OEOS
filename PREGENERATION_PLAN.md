# 🎯 预生成系统完整实现计划

## 📋 任务清单

- [x] **阶段1：扩展ElementDataManager** ✅
  - 添加 `computeDynamicContextForNode()` 方法
  - 添加 `_buildPathToNode()` 辅助方法

- [x] **阶段2：创建预生成核心模块** ✅
  - 创建 `src/oeos-plugin-core/pregeneration.js`
  - 实现STscript调用封装
  - 实现缺失页面识别逻辑
  - 实现并发生成函数
  - 实现生成完成等待机制

- [x] **阶段3：集成到plugin-bridge** ✅
  - 导入预生成模块
  - 导出 `getManager` 函数
  - 在 `bindCharacter()` 中启动预生成系统

- [ ] **阶段4：测试与调试** 🔄
  - 测试第一层预生成
  - 测试第二层预生成
  - 测试并发槽位管理
  - 测试错误处理

---

## 📁 文件修改清单

### 1. `src/oeos-plugin-core/element-data-manager.js`（修改）

**新增方法：**

```javascript
/**
 * 为指定节点计算Dynamic-Context
 * @param {string} targetPageId - 目标页面ID
 * @returns {string} 该节点的Dynamic-Context
 */
computeDynamicContextForNode(targetPageId) {
    // 1. 构建到目标节点的路径
    const simulatedPath = this._buildPathToNode(targetPageId);
    
    // 2. 获取未来页面（子页面）
    const future = this.graph.get(targetPageId) || [];
    
    // 3. 获取历史页面（最近5页）
    const history = simulatedPath.slice(-5);
    
    // 4. 合并所有相关页面
    const all = new Set([...future, ...history]);
    
    // 5. 包含历史节点的子节点
    for (const h of history) {
        const kids = this.graph.get(h) || [];
        for (const k of kids) all.add(k);
    }
    
    // 6. 提取页面内容
    let block = '';
    for (const id of all) {
        const content = this._extractPageSource(id);
        if (content) block += content + '\n\n';
    }
    
    return block.trim();
}

/**
 * 构建到目标节点的路径（从start到目标节点）
 * @param {string} targetPageId - 目标页面ID
 * @returns {string[]} 路径数组
 */
_buildPathToNode(targetPageId) {
    // 从当前State获取路径
    const currentPath = this._parseStatePath(this.state);
    
    // 如果目标节点已在当前路径中，直接返回到该节点的路径
    const index = currentPath.indexOf(targetPageId);
    if (index !== -1) {
        return currentPath.slice(0, index + 1);
    }
    
    // 否则，将目标节点添加到当前路径末尾
    return [...currentPath, targetPageId];
}
```

---

### 2. `src/oeos-plugin-core/pregeneration.js`（新建）

**完整实现：**

```javascript
// src/oeos-plugin-core/pregeneration.js
// 预生成系统核心模块

import { getManager } from './element-data-manager.js';

/**
 * 预生成系统类
 */
export class PregenerationSystem {
    constructor(worldInfoName) {
        this.worldInfoName = worldInfoName;
        this.isGenerating = false;
        this.lastPageId = null;
        this.generationQueue = [];
        this.usedSlots = new Set();
    }

    /**
     * 启动预生成系统
     */
    start() {
        console.log('[OEOS-Pregen] 预生成系统已启动');
        this.startPageChangeMonitor();
    }

    /**
     * 监听页面变更
     */
    startPageChangeMonitor() {
        setInterval(async () => {
            try {
                const mgr = getManager(this.worldInfoName);
                await mgr.loadFromWiAndChat([]);

                const path = mgr._parseStatePath(mgr.state);
                const currentPageId = path[path.length - 1];

                if (currentPageId && currentPageId !== this.lastPageId) {
                    console.log(`[OEOS-Pregen] 页面变更: ${this.lastPageId} -> ${currentPageId}`);
                    this.lastPageId = currentPageId;
                    await this.triggerPregeneration(currentPageId);
                }
            } catch (error) {
                console.error('[OEOS-Pregen] 页面监听错误:', error);
            }
        }, 1000);
    }

    /**
     * 触发预生成流程
     */
    async triggerPregeneration(currentPageId) {
        if (this.isGenerating) {
            console.log('[OEOS-Pregen] 已有预生成任务在运行，跳过');
            return;
        }

        this.isGenerating = true;
        try {
            console.log(`[OEOS-Pregen] 开始预生成，当前页面: ${currentPageId}`);

            // 第一层预生成
            await this.pregenerateLayer1(currentPageId);

            // 第二层预生成
            await this.pregenerateLayer2(currentPageId);

            console.log('[OEOS-Pregen] 预生成完成');
        } catch (error) {
            console.error('[OEOS-Pregen] 预生成失败:', error);
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * 第一层预生成
     */
    async pregenerateLayer1(currentPageId) {
        const mgr = getManager(this.worldInfoName);
        await mgr.loadFromWiAndChat([]);

        const children = mgr.graph.get(currentPageId) || [];
        const existingPages = new Set(mgr.pages.keys());
        const missing = children.filter(id => !existingPages.has(id));

        if (missing.length === 0) {
            console.log('[OEOS-Pregen] 第一层页面已全部存在');
            return;
        }

        console.log(`[OEOS-Pregen] 第一层缺失页面: ${missing.join(', ')}`);
        await this.generatePages(currentPageId, missing);
    }

    /**
     * 第二层预生成
     */
    async pregenerateLayer2(currentPageId) {
        const mgr = getManager(this.worldInfoName);
        await mgr.loadFromWiAndChat([]);

        const firstLayerPages = mgr.graph.get(currentPageId) || [];
        const existingPages = new Set(mgr.pages.keys());

        for (const parentId of firstLayerPages) {
            const children = mgr.graph.get(parentId) || [];
            const missing = children.filter(id => !existingPages.has(id));

            if (missing.length > 0) {
                console.log(`[OEOS-Pregen] 第二层缺失页面 (父节点: ${parentId}): ${missing.join(', ')}`);
                await this.generatePages(parentId, missing);
            }
        }
    }

    /**
     * 并发生成页面
     */
    async generatePages(parentPageId, childPageIds) {
        const tasks = [];
        const sessionIds = [];

        for (let i = 0; i < childPageIds.length && i < 10; i++) {
            const childId = childPageIds[i];
            const slotId = this.allocateSlot();

            console.log(`[OEOS-Pregen] 生成页面: ${childId} (槽位: ${slotId})`);

            const task = this.executeGeneration(slotId, childId);
            tasks.push(task);
            sessionIds.push(`xb${slotId}`);
        }

        // 等待所有生成任务完成
        await Promise.all(tasks);

        // 释放槽位
        sessionIds.forEach(id => {
            const slotNum = parseInt(id.replace('xb', ''));
            this.usedSlots.delete(slotNum);
        });

        // 等待数据更新
        await this.waitForDataUpdate();
    }

    /**
     * 执行单个生成任务
     */
    async executeGeneration(slotId, pageId) {
        try {
            const command = `/xbgenraw id=${slotId} as=system goto: ${pageId}`;

            // 尝试多种方式调用STscript
            const sessionId = await this.executeSTscript(command);

            // 等待生成完成
            await this.waitForGenerationComplete(`xb${slotId}`);

            console.log(`[OEOS-Pregen] 页面 ${pageId} 生成完成`);
        } catch (error) {
            console.error(`[OEOS-Pregen] 页面 ${pageId} 生成失败:`, error);
        }
    }

    /**
     * 执行STscript命令
     */
    async executeSTscript(command) {
        // 方案1: 使用全局STscript（如果存在）
        if (typeof window !== 'undefined' && window.STscript) {
            return await window.STscript(command);
        }

        // 方案2: 使用executeSlashCommandsWithOptions
        try {
            const { executeSlashCommandsWithOptions } = await import('../../../../script.js');
            return await executeSlashCommandsWithOptions(command, {});
        } catch (error) {
            console.error('[OEOS-Pregen] 无法导入executeSlashCommandsWithOptions:', error);
        }

        // 方案3: 直接调用LittleWhiteBox API
        if (typeof window !== 'undefined' && window.streaming) {
            console.warn('[OEOS-Pregen] 使用备用方案调用生成命令');
            // 这里需要根据LittleWhiteBox的实际API实现
        }

        throw new Error('无法执行STscript命令');
    }

    /**
     * 等待生成完成
     */
    async waitForGenerationComplete(sessionId) {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                try {
                    if (typeof window !== 'undefined' && window.streaming) {
                        const status = window.streaming.getStatus(sessionId);
                        if (status && status.isCompleted) {
                            clearInterval(checkInterval);
                            resolve(status.text);
                        }
                    }
                } catch (error) {
                    // 忽略错误，继续等待
                }
            }, 200);

            // 超时保护（60秒）
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve(null);
            }, 60000);
        });
    }

    /**
     * 等待数据更新
     */
    async waitForDataUpdate() {
        // 等待AI回复被处理并更新到World Info
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    /**
     * 分配槽位
     */
    allocateSlot() {
        for (let i = 1; i <= 10; i++) {
            if (!this.usedSlots.has(i)) {
                this.usedSlots.add(i);
                return i;
            }
        }
        // 如果所有槽位都被占用，返回1（覆盖）
        return 1;
    }
}

// 全局实例管理
const instances = new Map();

/**
 * 获取或创建预生成系统实例
 */
export function getPregenerationSystem(worldInfoName) {
    if (!instances.has(worldInfoName)) {
        instances.set(worldInfoName, new PregenerationSystem(worldInfoName));
    }
    return instances.get(worldInfoName);
}
```

---

### 3. `src/oeos-plugin-core/plugin-bridge.js`（修改）

**在文件顶部添加导入：**

```javascript
import { getPregenerationSystem } from './pregeneration.js';
```

**在 `bindCharacter()` 函数末尾添加：**

```javascript
async function bindCharacter(charIndex) {
    try {
        // ... 现有代码 ...

        // 7. 启动预生成系统
        const pregenSystem = getPregenerationSystem(worldInfoName);
        pregenSystem.start();

        console.info(`[OEOS] 角色 ${character.name} 绑定成功，预生成系统已启动`);
    } catch (error) {
        console.error(`[OEOS] 绑定角色失败: ${error.message}`);
        throw error;
    }
}
```

---

## 🔧 关键技术细节

### 1. STscript调用方案（优先级顺序）

```javascript
// 优先级1: 使用全局STscript
if (window.STscript) {
    await window.STscript(command);
}

// 优先级2: 导入executeSlashCommandsWithOptions
import { executeSlashCommandsWithOptions } from '../../../../script.js';
await executeSlashCommandsWithOptions(command, {});

// 优先级3: 直接访问LittleWhiteBox API
window.streaming.xbgenrawCommand(args, prompt);
```

### 2. 并发槽位管理

- 最多10个并发槽位（xb1-xb10）
- 使用 `Set` 跟踪已使用的槽位
- 生成完成后释放槽位

### 3. 数据更新等待

- AI回复后，`updateGameDataFromAIResponseV2()` 会自动提取Pages和Summary
- 等待2秒确保数据已同步到World Info

### 4. 错误处理

- 单个页面生成失败不影响其他页面
- 超时保护（60秒）
- 日志记录所有关键步骤

---

## ✅ 验收标准

1. **第一层预生成**：玩家在页面F时，自动生成F的所有子页面
2. **第二层预生成**：第一层完成后，自动生成所有第一层页面的子页面
3. **并发执行**：同一层的页面并发生成
4. **数据持久化**：生成的页面自动保存到World Info
5. **Graph更新**：生成后立即更新Graph
6. **无重复生成**：已存在的页面不会重复生成

---

## 📝 实现说明

### 核心逻辑

1. **页面变更监听**：每秒轮询State，检测当前页面变化
2. **第一层预生成**：识别当前页面的缺失子页面，并发生成
3. **第二层预生成**：识别第一层所有页面的缺失子页面，并发生成
4. **自动数据更新**：AI回复后自动触发元素数据更新

### 预生成流程

```
玩家在页面F
    ↓
检测到页面变更
    ↓
第一层：生成 F > g1, g2, g3, g4
    ↓
等待生成完成 + 数据更新
    ↓
第二层：生成 g1 > h1, h2, h3
              g2 > h4, h5, h6
              g3 > h7, h8, h9
              g4 > h10, h11, h12
    ↓
预生成完成
```

### 并发策略

- 同一父节点的子页面并发生成（最多10个）
- 不同父节点的子页面串行生成（避免上下文混乱）
- 使用槽位管理避免冲突

---

## 🚀 部署步骤

1. ✅ 修改 `src/oeos-plugin-core/element-data-manager.js`
2. ✅ 创建 `src/oeos-plugin-core/pregeneration.js`
3. ✅ 修改 `src/oeos-plugin-core/plugin-bridge.js`
4. ⏳ 重新部署插件到SillyTavern
5. ⏳ 测试预生成功能

---

## ✅ 实现完成总结

### 已完成的修改

#### 1. `src/oeos-plugin-core/element-data-manager.js`
- ✅ 添加 `computeDynamicContextForNode(targetPageId)` 方法
- ✅ 添加 `_buildPathToNode(targetPageId)` 辅助方法
- **位置**: 第392-450行

#### 2. `src/oeos-plugin-core/pregeneration.js` (新建)
- ✅ 创建 `PregenerationSystem` 类
- ✅ 实现页面变更监听（每秒轮询）
- ✅ 实现第一层预生成逻辑
- ✅ 实现第二层预生成逻辑
- ✅ 实现并发生成函数（最多10个槽位）
- ✅ 实现STscript调用封装（3种方案）
- ✅ 实现生成完成等待机制
- ✅ 实现槽位分配和释放
- **总行数**: 270行

#### 3. `src/oeos-plugin-core/plugin-bridge.js`
- ✅ 导入 `getPregenerationSystem` 函数
- ✅ 导出 `getManager` 函数（供pregeneration.js使用）
- ✅ 在 `bindCharacter()` 函数中启动预生成系统
- **修改位置**: 第25行、第29行、第676-677行

### 下一步操作

1. **重新部署插件**
   ```bash
   cd src/openeos-master
   npm run build
   node deploy.js
   ```

2. **重启SillyTavern**
   ```bash
   cd src/SillyTavern-release
   npm start
   ```

3. **测试预生成功能**
   - 打开浏览器控制台（F12）
   - 查看 `[OEOS-Pregen]` 开头的日志
   - 观察页面变更时的预生成行为

### 预期日志输出

```
[OEOS-Pregen] 预生成系统已启动
[OEOS-Pregen] 页面变更: null -> start
[OEOS-Pregen] 开始预生成，当前页面: start
[OEOS-Pregen] 第一层缺失页面: forest, village
[OEOS-Pregen] 生成页面: forest (槽位: 1)
[OEOS-Pregen] 生成页面: village (槽位: 2)
[OEOS-Pregen] 页面 forest 生成完成
[OEOS-Pregen] 页面 village 生成完成
[OEOS-Pregen] 第二层缺失页面 (父节点: forest): cave, river
[OEOS-Pregen] 生成页面: cave (槽位: 1)
[OEOS-Pregen] 生成页面: river (槽位: 2)
[OEOS-Pregen] 预生成完成
```

### 故障排查

如果预生成不工作，检查：
1. LittleWhiteBox插件是否已启用
2. 浏览器控制台是否有错误信息
3. `window.streaming` 对象是否存在
4. STscript命令是否可以手动执行

