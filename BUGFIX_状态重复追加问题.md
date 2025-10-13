# Bug修复：OEOS-State 状态重复追加问题

## 问题描述

每次重新调用 `start()` 时，OEOS-State 条目会重复追加相同的页面：

```
> start() > start() > start() > start()
```

这会导致：
1. 如果上次的最后一个页面是 A，下次进入就会继续添加 `> A() > A()`
2. 状态路径中充满重复的页面记录
3. 影响上下文计算的准确性

## 问题根源

在 `game-state.js` 的 `updateStateEntry` 函数中（第206行），每次状态更新都是**无条件追加**：

```javascript
// 追加到现有状态
stateEntry.content += newStateString;
```

没有检查新状态是否与最后一个状态相同。

## 修复方案

在追加新状态之前，检查是否与最后一个状态**完全相同**（包括页面ID和变量）：

1. 从现有状态内容中提取所有状态记录
2. 获取最后一个完整状态（包括变量）
3. 比较新状态与最后一个状态的完整字符串
4. 如果完全相同，跳过追加；否则正常追加

**关键改进**：比较完整状态而不是只比较页面ID，这样可以支持：
- ✅ 同一页面但变量不同：`D(hp:100) > D(hp:80)` - 会被记录
- ✅ 完全相同的状态：`start() > start()` - 会被跳过

## 修复代码

在 `updateStateEntry` 函数中添加去重逻辑：

```javascript
// 检查是否与最后一个状态完全相同（包括变量），避免重复追加
// 这样可以支持同一页面但变量不同的情况，如 D(hp:100) > D(hp:80)
const currentContent = stateEntry.content.trim();
if (currentContent) {
    // 匹配所有的 " > pageId(...)" 格式
    const stateMatches = currentContent.match(/>\s*\w+\s*\([^)]*\)/g);
    if (stateMatches && stateMatches.length > 0) {
        // 获取最后一个完整状态（包括变量）
        const lastState = stateMatches[stateMatches.length - 1].trim();
        const newStateTrimmed = newStateString.trim();

        // 比较完整的状态字符串（页面ID + 变量）
        if (lastState === newStateTrimmed) {
            console.log(`[OEOS] 跳过完全相同的状态: ${newStateTrimmed}`);
            return; // 如果与最后一个状态完全相同，不追加
        }
    }
}

// 追加到现有状态
stateEntry.content += newStateString;
```

## 修改的文件

1. `src/oeos-plugin-core/game-state.js` (第202-225行)
2. `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/game-state.js` (第202-225行)

## 测试场景

### 场景1：重复调用 start()（完全相同）
- **修复前**：`> start() > start() > start()`
- **修复后**：`> start()` ✅（第二次和第三次调用被跳过）

### 场景2：正常页面跳转（完全相同）
- **修复前**：`> start() > A() > A() > B()`
- **修复后**：`> start() > A() > B()` ✅（重复的 A 被跳过）

### 场景3：带变量的状态（完全相同）
- **修复前**：`> start() > A(hp:100) > A(hp:100)`
- **修复后**：`> start() > A(hp:100)` ✅（完全相同的状态被跳过）

### 场景4：变量不同的情况（重要！）
- **状态**：`> A(hp:100) > A(hp:90)`
- **行为**：✅ **会正常追加**，因为虽然页面相同，但变量不同
- **说明**：这是合理的状态变化，应该被记录

### 场景5：页面可以指向自身（用户提出的场景）
- **状态**：`> D(hp:100) > D(hp:80) > D(hp:60)`
- **行为**：✅ **会正常记录所有状态**，因为每次变量都不同
- **说明**：完美支持同一页面的状态变化追踪

## 注意事项

1. ✅ **比较完整状态**：当前实现比较完整的状态字符串（页面ID + 变量），而不是只比较页面ID
2. ✅ **支持变量变化**：同一页面但变量不同的情况会被正常记录
3. ✅ **避免无意义重复**：只有完全相同的状态（页面ID和变量都相同）才会被跳过
4. ⚠️ **变量顺序敏感**：如果变量顺序不同，会被视为不同状态（例如 `A(hp:100,mp:50)` 和 `A(mp:50,hp:100)`）

## 为什么这个方案更好

### 问题分析
用户提出的场景：`D(hp:100) > D(hp:80)` - 同一个页面，但需要记录变量变化

### 之前的错误方案
只比较页面ID，会导致：
- ❌ `D(hp:100) > D(hp:80)` 被错误地跳过
- ❌ 无法追踪同一页面的状态变化

### 当前的正确方案
比较完整状态（页面ID + 变量），可以：
- ✅ `D(hp:100) > D(hp:80)` 正常记录（变量不同）
- ✅ `start() > start()` 跳过重复（完全相同）
- ✅ 完美平衡去重和状态追踪

## 后续优化建议

1. **变量顺序归一化**（可选）：
   如果需要忽略变量顺序，可以在比较前对变量进行排序：
   ```javascript
   // 将 "hp:100,mp:50" 和 "mp:50,hp:100" 视为相同
   const normalizeVars = (vars) => {
       return vars.split(',').sort().join(',');
   };
   ```

2. **添加配置选项**（可选）：
   允许用户选择去重策略：
   - 严格模式：完全相同才跳过（当前实现）
   - 宽松模式：页面ID相同就跳过
   - 无去重模式：记录所有状态

3. **限制状态路径长度**（性能优化）：
   如果状态路径过长，可以考虑只保留最近的N个状态。

