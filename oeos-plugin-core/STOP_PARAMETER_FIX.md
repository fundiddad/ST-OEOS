# Stop参数和lastUserMessage宏修复说明

## 问题描述

### 问题1：Stop参数缺失

预生成请求的 `stop` 参数为 `undefined`，而手动点击发送的请求的 `stop` 参数为 `['<end>']`。

### 问题2：{{lastUserMessage}}宏未正确替换

ST手动发送会使用`{{lastUserMessage}}`替换用户输入的信息，而预生成是直接加在最后面，导致宏未被正确替换。

### 问题对比

**手动点击发送的请求：**
```javascript
{
  stop: [ '<end>' ],  // ✅ 正确
  // ... 其他参数
}
```

**预生成的请求（修复前）：**
```javascript
{
  stop: undefined,  // ❌ 错误
  // ... 其他参数
}
```

## 问题原因

### 问题1原因：Stop参数缺失

在 `concurrent-generator-v2.js` 的 `_buildRequestBody` 方法中，原代码使用：

```javascript
stop: capturedData?.stop || undefined,
```

这个逻辑有问题：
1. `capturedData` 来自 `GENERATE_AFTER_DATA` 事件（使用 `dryRun=true`）
2. 这个事件中的数据可能不包含完整的 `stop` 参数
3. SillyTavern 在正常发送时会从 `power_user.custom_stopping_strings` 读取并构建 `stop` 参数

### 问题2原因：{{lastUserMessage}}宏未正确替换

在 `buildAPIRequest` 方法中，原代码使用：

```javascript
await context.generate('normal', {
    quiet_prompt: prompt,  // ❌ 问题所在
    quietToLoud: false,
    skipWIAN: false,
    force_name2: true
}, true);
```

问题分析：
1. 在`generatePage`中，我们先调用`addUserMessage(prompt)`把`goto: xxx`添加到chat数组
2. 然后调用`buildAPIRequest(prompt)`，传入`quiet_prompt: prompt`
3. **关键问题**：`quiet_prompt`参数会被SillyTavern当作一个**临时的**用户消息来构建prompt，但这个临时消息**不会**被添加到chat数组中
4. 所以当SillyTavern构建消息并替换`{{lastUserMessage}}`时，它读取的是chat数组中的**之前的**最后一条用户消息，而不是我们刚添加的`goto: xxx`
5. 这导致`{{lastUserMessage}}`被替换为旧的用户消息，而不是当前的`goto: xxx`

## 解决方案

### 修复问题1：Stop参数缺失

#### 1. 导入必要的依赖

在文件顶部添加：
```javascript
import { substituteParams } from '../../../../script.js';
import { power_user } from '../../../../scripts/power-user.js';
```

#### 2. 添加 `_buildStopStrings` 方法

新增方法来构建 `stop` 参数，参考 SillyTavern 的 `power-user.js` 中的 `getPermanent()` 函数：

```javascript
/**
 * 构建stop参数（从power_user.custom_stopping_strings读取）
 * @param {object} capturedData - 捕获的数据
 * @returns {Array|undefined} stop字符串数组或undefined
 */
_buildStopStrings(capturedData) {
    // 优先使用capturedData中的stop参数（如果存在且有效）
    if (capturedData?.stop && Array.isArray(capturedData.stop) && capturedData.stop.length > 0) {
        return capturedData.stop;
    }

    // 从power_user.custom_stopping_strings读取
    try {
        // 如果没有自定义停止字符串，返回undefined
        if (!power_user.custom_stopping_strings) {
            return undefined;
        }

        // 解析JSON字符串
        let strings = JSON.parse(power_user.custom_stopping_strings);

        // 确保是数组
        if (!Array.isArray(strings)) {
            return undefined;
        }

        // 过滤掉非字符串和空字符串
        strings = strings.filter(s => typeof s === 'string' && s.length > 0);

        // 如果启用了宏替换，则替换参数
        if (power_user.custom_stopping_strings_macro) {
            strings = strings.map(x => substituteParams(x));
        }

        return strings.length > 0 ? strings : undefined;
    } catch (error) {
        console.warn('[OEOS-ConcurrentV2] 解析custom_stopping_strings失败:', error);
        return undefined;
    }
}
```

#### 3. 修改 `_buildRequestBody` 方法

将原来的：
```javascript
stop: capturedData?.stop || undefined,
```

改为：
```javascript
stop: this._buildStopStrings(capturedData),
```

### 修复问题2：{{lastUserMessage}}宏未正确替换

#### 修改 `buildAPIRequest` 方法

**原代码（错误）：**
```javascript
async buildAPIRequest(prompt) {
    // ...
    await context.generate('normal', {
        quiet_prompt: prompt,  // ❌ 导致{{lastUserMessage}}读取错误
        quietToLoud: false,
        skipWIAN: false,
        force_name2: true
    }, true);
    // ...
}
```

**修复后（正确）：**
```javascript
async buildAPIRequest() {  // ✅ 不再需要prompt参数
    // ...
    await context.generate('normal', {
        // ✅ 不传入quiet_prompt，让ST从chat数组中读取最后一条消息
        // 这样{{lastUserMessage}}宏会被正确替换为我们刚添加的用户消息
        quietToLoud: false,
        skipWIAN: false,
        force_name2: true
    }, true);
    // ...
}
```

**调用处修改：**
```javascript
// generatePage方法中
// 原代码：
const requestData = await this.buildAPIRequest(prompt);

// 修复后：
const requestData = await this.buildAPIRequest();
```

## 修改的文件

1. `src/oeos-plugin-core/concurrent-generator-v2.js`
2. `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/concurrent-generator-v2.js`

## 测试验证

修复后，预生成的请求应该：

1. **Stop参数正确**：
```javascript
{
  stop: [ '<end>' ],  // ✅ 正确
  // ... 其他参数
}
```

2. **{{lastUserMessage}}宏正确替换**：
   - 在包含`{{lastUserMessage}}`的提示词中，该宏会被替换为当前的`goto: xxx`
   - 而不是之前的用户消息

## 参考

- SillyTavern 的 `power-user.js` 中的 `getPermanent()` 函数（第3152-3177行）
- 用户设置中的 `custom_stopping_strings` 配置（JSON字符串格式：`"[\"<end>\"]"`）

