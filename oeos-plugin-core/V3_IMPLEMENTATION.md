# V3 实现说明 - LittleWhiteBox方式

## 🎯 目标

实现一个**完全不触发UI状态**的并发生成器，同时保持：
- ✅ 保存到聊天记录
- ✅ 显示在聊天界面
- ✅ 获取完整的API配置
- ✅ 支持所有API源（OpenAI, Claude, Gemini, Cohere, DeepSeek, Custom）

---

## 📊 V3 vs V2 对比

| 特性 | V2（修复前） | V3（LittleWhiteBox方式） |
|------|-------------|------------------------|
| **触发UI状态** | ⚠️ 是（短暂<100ms） | ✅ 否 |
| **dryRun参数** | `false` | `true` |
| **监听事件** | `CHAT_COMPLETION_SETTINGS_READY` | `GENERATE_AFTER_DATA` |
| **配置构建** | ST自动构建 | 手动构建 |
| **代码复杂度** | 简单（50行） | 复杂（200行） |
| **保存到聊天** | ✅ | ✅ |
| **显示在UI** | ✅ | ✅ |

---

## 🔧 核心实现

### 1. buildAPIRequest 方法

**V2的方式（触发UI）：**
```javascript
// ❌ 使用dryRun=false，会触发UI状态
await context.generate('quiet', {
    quiet_prompt: prompt,
    signal: abortController.signal
}, false); // dryRun=false

// 监听CHAT_COMPLETION_SETTINGS_READY获取完整配置
eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, listener);
```

**V3的方式（不触发UI）：**
```javascript
// ✅ 使用dryRun=true，不触发UI状态
await context.generate('normal', {
    quiet_prompt: prompt,
    skipWIAN: false,
    force_name2: true
}, true); // dryRun=true

// 监听GENERATE_AFTER_DATA获取消息数组
eventSource.on(event_types.GENERATE_AFTER_DATA, listener);

// 手动构建完整配置
const requestBody = this._buildRequestBody(messages, capturedData);
```

---

### 2. _buildRequestBody 方法（新增）

手动构建完整的API请求体，参考LittleWhiteBox的实现：

```javascript
_buildRequestBody(messages, capturedData) {
    // 1. 获取当前API源
    const chat_completion_source = oai_settings.chat_completion_source;
    
    // 2. 根据API源选择模型
    let model;
    switch (chat_completion_source) {
        case chat_completion_sources.OPENAI:
            model = oai_settings.openai_model;
            break;
        case chat_completion_sources.CLAUDE:
            model = oai_settings.claude_model;
            break;
        case chat_completion_sources.MAKERSUITE:
            model = oai_settings.google_model;
            break;
        // ... 其他API源
    }
    
    // 3. 读取所有参数
    const temperature = num(oai_settings.temp_openai ?? oai_settings.temperature);
    const presence_penalty = num(oai_settings.pres_pen_openai);
    const frequency_penalty = num(oai_settings.freq_pen_openai);
    
    // 4. 根据API源选择top_p和max_tokens
    let top_p, max_tokens, top_k;
    if (chat_completion_source === chat_completion_sources.MAKERSUITE) {
        // Gemini特殊处理
        top_p = num(oai_settings.makersuite_top_p ?? oai_settings.top_p);
        top_k = num(oai_settings.makersuite_top_k ?? oai_settings.top_k);
        max_tokens = num(oai_settings.makersuite_max_tokens ?? 1024);
    } else {
        // OpenAI, Claude等
        top_p = num(oai_settings.top_p_openai ?? oai_settings.top_p);
        max_tokens = num(oai_settings.openai_max_tokens ?? 1024);
    }
    
    // 5. 构建请求体
    const body = {
        messages,
        model,
        stream: true,
        chat_completion_source,
        temperature,
        presence_penalty,
        frequency_penalty,
        top_p,
        max_tokens,
        stop: capturedData?.stop || undefined,
    };
    
    // 6. Gemini特殊处理
    if (chat_completion_source === chat_completion_sources.MAKERSUITE) {
        if (top_k !== undefined) {
            body.top_k = top_k;
        }
        body.max_output_tokens = max_tokens;
    }
    
    // 7. 反向代理配置
    if (oai_settings.reverse_proxy) {
        body.reverse_proxy = oai_settings.reverse_proxy;
        if (oai_settings.proxy_password) {
            body.proxy_password = oai_settings.proxy_password;
        }
    }
    
    // 8. Custom API特殊处理
    if (chat_completion_source === chat_completion_sources.CUSTOM) {
        if (oai_settings.custom_url) {
            body.custom_url = oai_settings.custom_url;
        }
        if (oai_settings.custom_include_headers) {
            body.custom_include_headers = oai_settings.custom_include_headers;
        }
        // ... 其他custom配置
    }
    
    return body;
}
```

---

### 3. callAPI 方法（改进）

使用 `getStreamingReply` 来正确解析不同API源的响应：

```javascript
async* callAPI(requestData, abortSignal) {
    const response = await fetch('/api/backends/chat-completions/generate', {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: getRequestHeaders(),
        signal: abortSignal,
    });
    
    if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
    }
    
    // 使用ST的SSE流处理器
    const eventStream = getEventSourceStream();
    response.body.pipeThrough(eventStream);
    const reader = eventStream.readable.getReader();
    
    // 用于存储推理内容和图片（某些API如Claude可能返回）
    const state = { reasoning: '', image: '' };
    let fullText = '';
    
    while (true) {
        const { done, value } = await reader.read();
        if (done || !value?.data || value.data === '[DONE]') {
            break;
        }
        
        const parsed = JSON.parse(value.data);
        
        // ✅ 使用ST的getStreamingReply来正确解析不同API源的响应
        const chunk = getStreamingReply(parsed, state, { 
            chatCompletionSource: requestData.chat_completion_source 
        });
        
        if (typeof chunk === 'string' && chunk) {
            fullText += chunk;
            yield fullText;
        }
    }
    
    return fullText;
}
```

---

## 📝 需要导入的模块

```javascript
import { getContext } from '../../../../scripts/extensions.js';
import { 
    chat, 
    saveChat, 
    characters, 
    this_chid, 
    eventSource, 
    event_types, 
    getRequestHeaders 
} from '../../../../script.js';
import { getEventSourceStream } from '../../../sse-stream.js';
import { 
    chat_completion_sources,  // ✅ 新增
    oai_settings,             // ✅ 新增
    getStreamingReply         // ✅ 新增
} from '../../../openai.js';
```

---

## 🎯 关键改进点

### 1. 不触发UI状态

**原理：**
- 使用 `dryRun=true` 调用 `context.generate()`
- ST不会设置全局锁 `is_send_press`
- ST不会禁用发送按钮

**代码：**
```javascript
await context.generate('normal', {
    quiet_prompt: prompt,
    skipWIAN: false,
    force_name2: true
}, true); // ✅ dryRun=true
```

---

### 2. 手动构建完整配置

**原理：**
- `dryRun=true` 只触发 `GENERATE_AFTER_DATA` 事件
- 该事件只返回消息数组，不包含完整配置
- 需要手动从 `oai_settings` 读取所有参数

**需要读取的参数：**
- `chat_completion_source` - API源
- `openai_model`, `claude_model`, `google_model` 等 - 模型
- `temp_openai`, `temperature` - 温度
- `pres_pen_openai`, `presence_penalty` - 存在惩罚
- `freq_pen_openai`, `frequency_penalty` - 频率惩罚
- `top_p_openai`, `top_p` - Top P
- `top_k_openai`, `top_k` - Top K（Gemini）
- `openai_max_tokens`, `max_tokens` - 最大令牌数
- `reverse_proxy`, `proxy_password` - 反向代理
- `custom_url`, `custom_include_headers` 等 - Custom API配置

---

### 3. 支持多种API源

**不同API源的特殊处理：**

#### Gemini/Google (MAKERSUITE)
```javascript
if (chat_completion_source === chat_completion_sources.MAKERSUITE) {
    // 使用Gemini特定的参数
    top_p = oai_settings.makersuite_top_p;
    top_k = oai_settings.makersuite_top_k;
    max_tokens = oai_settings.makersuite_max_tokens;
    
    // 添加Gemini特定字段
    body.top_k = top_k;
    body.max_output_tokens = max_tokens;
}
```

#### Custom API
```javascript
if (chat_completion_source === chat_completion_sources.CUSTOM) {
    body.custom_url = oai_settings.custom_url;
    body.custom_include_headers = oai_settings.custom_include_headers;
    body.custom_include_body = oai_settings.custom_include_body;
    body.custom_exclude_body = oai_settings.custom_exclude_body;
}
```

---

### 4. 使用getStreamingReply解析响应

**原理：**
- 不同API源的响应格式不同
- OpenAI: `choices[0].delta.content`
- Claude: 可能包含 `reasoning` 字段
- Gemini: 可能包含 `image` 字段

**代码：**
```javascript
const chunk = getStreamingReply(parsed, state, { 
    chatCompletionSource: requestData.chat_completion_source 
});
```

`getStreamingReply` 会自动处理不同API源的响应格式。

---

## ⚠️ 注意事项

### 1. 代码复杂度增加

- V2: ~50行（buildAPIRequest方法）
- V3: ~200行（buildAPIRequest + _buildRequestBody方法）

### 2. 需要维护参数映射

每次ST更新时，需要检查：
- 是否有新的API源
- 是否有新的参数
- 参数名称是否改变

### 3. 容易遗漏参数

手动构建配置时，可能会遗漏某些参数，导致：
- API请求失败（400 Bad Request）
- 生成结果不符合预期

### 4. 需要测试所有API源

确保V3在所有API源下都能正常工作：
- ✅ OpenAI
- ✅ Claude
- ✅ Gemini/Google
- ✅ Cohere
- ✅ DeepSeek
- ✅ Custom

---

## 🚀 测试建议

### 1. 测试不同API源

```javascript
// 测试OpenAI
oai_settings.chat_completion_source = chat_completion_sources.OPENAI;
await generator.generatePage(1, 'test_page');

// 测试Gemini
oai_settings.chat_completion_source = chat_completion_sources.MAKERSUITE;
await generator.generatePage(2, 'test_page');

// 测试Custom
oai_settings.chat_completion_source = chat_completion_sources.CUSTOM;
await generator.generatePage(3, 'test_page');
```

### 2. 测试UI状态

```javascript
// 在生成前检查发送按钮状态
const sendButton = document.querySelector('#send_but');
console.log('生成前按钮状态:', sendButton.disabled);

await generator.generatePage(1, 'test_page');

console.log('生成后按钮状态:', sendButton.disabled);
// 应该保持不变
```

### 3. 测试聊天记录

```javascript
const beforeLength = chat.length;
await generator.generatePage(1, 'test_page');
const afterLength = chat.length;

console.log('新增消息数:', afterLength - beforeLength);
// 应该是2（1个用户消息 + 1个AI消息）
```

---

## 📚 参考资料

- **LittleWhiteBox实现**: `src/SillyTavern-release/public/scripts/extensions/third-party/LittleWhiteBox/streaming-generation.js`
  - 第114-270行: `callAPI` 方法
  - 第420-470行: 消息构建方法

- **ST的openai.js**: `src/SillyTavern-release/public/scripts/openai.js`
  - `chat_completion_sources` 常量定义
  - `oai_settings` 对象定义
  - `getStreamingReply` 函数实现

---

## ✅ 总结

V3实现了**完全不触发UI状态**的并发生成器，代价是：
- 代码复杂度增加（50行 → 200行）
- 需要手动维护参数映射
- 需要测试所有API源

但获得了：
- ✅ 完全不触发UI状态
- ✅ 保存到聊天记录
- ✅ 显示在聊天界面
- ✅ 支持所有API源

如果你能接受代码复杂度的增加，V3是最佳选择！

