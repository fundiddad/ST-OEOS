# OEOS Player JSON 命令参考文档

本文档旨在详细介绍 OEOS Player 冒险、故事格式中常用的 JSON 命令及其所有可用参数。

## 目录
1.  [核心结构](#核心结构)
2.  [表达式 (Expressions)](#表达式-expressions)
3.  [显示与交互命令](#显示与交互命令)
    *   [`say`](#say---显示对话)
    *   [`image`](#image---显示图片)
    *   [`audio.play`](#audioplay---音频播放)
    *   [`choice`](#choice---提供选项)
    *   [`prompt`](#prompt---用户输入)
    *   [`notification`](#notification---通知相关命令)
    *   [`timer`](#timer---计时器相关命令)
4.  [逻辑与控制命令](#逻辑与控制命令)
    *   [`storage`](#storage---数据存储相关命令)
    *   [`eval`](#eval---执行代码)
    *   [`if`](#if---条件判断)
    *   [`goto`](#goto---页面跳转)
    *   [`enable` / `disable`](#enable--disable---页面状态控制)
    *   [`end`](#end---结束冒险)
    *   [`noop`](#noop---空操作)
5.  [高级脚本](#高级脚本)
    *   [与 `Sound` 对象交互](#与-sound-对象交互)
---
## 核心结构

OEOS 冒险、故事是一个 JSON 对象，其核心是 `pages` 对象。

-   **`pages`**: 一个对象，键是“页面”的唯一标识符（`pageId`），值是一个命令数组。
-   **命令 (Command)**: 页面数组中的每个元素都是一个命令对象。该对象只有一个键，即命令名称，其值是包含该命令所有参数的对象。

**示例:**
```json
{
  "pages": {
    "start": [
      { "image": { "url": "xxxxx" } },
      { "say": { "label": "欢迎来到游戏！" } },
      { "goto": { "target": "page2" } }
    ]
  }
}
```

---

## 表达式 (Expressions)

在 OEOS 中，许多命令的参数值都可以是动态的，这是通过**表达式**实现的。OEOS 支持两种主要的表达式形式：**`$` 前缀表达式**和 **`<eval>` 内嵌表达式**。

### 1. `$` 前缀表达式

任何以单个美元符号 `$` 开头的字符串值，都会被 OEOS 播放器视为一段完整的 JavaScript 代码来执行，并使用其执行结果作为参数的最终值。

-   **如何使用?**
    你可以在表达式中使用变量、进行数学运算、调用 `storage.get()` 等方法。表达式的执行结果将直接决定参数的值。
-   **示例**:
    -   `"target": "$nextPage"`: 跳转到名为 `nextPage` 的 JavaScript 变量所指向的页面 ID。
    -   `"value": "$currentScore + 10"`: 将一个名为 `currentScore` 的变量值加 10，并使用其结果。
    -   `"visible": "$storage.get('gold') >= 100"`: 执行一个条件判断，其结果（`true` 或 `false`）将决定选项是否可见。
**重要**: 某些参数（如 `if.condition`）天生就是 JavaScript 表达式，因此**不需要**也不能使用 `$` 前缀。请参考具体命令的文档。

### 2. `<eval>` 内嵌表达式

对于某些文本类型的参数（如 `say` 命令的 `label`），你可以在字符串内部使用 `<eval>...</eval>` 标签来嵌入动态的 JavaScript 表达式。这允许你将静态文本与动态计算的值拼接在一起。

-   **如何使用?**
    在字符串中，将要执行的 JavaScript 代码包裹在 `<eval>` 和 `</eval>` 标签之间。
-   **示例**:
    -   `"label": "你好, <eval>storage.get('playerName')</eval>！"`: 读取玩家名称并插入到问候语中。
    -   `"label": "你的分数是: <eval>score * 100</eval>"`: 计算并显示最终分数。

支持 `<eval>` 的参数通常是用于显示文本的，如 `say.label`, `choice.options.label`, `notification.create.label` 等。

---

## 显示与交互命令

### `say` - 显示对话

在屏幕上显示一段文字。

**参数:**

| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `label` | String | 是 | `""` | 要显示的文本内容。支持 HTML 标签，并通过 [`<eval>`](#2-eval-内嵌表达式) 嵌入动态表达式。 |
| `mode` | String | 否 | `"auto"` | 显示模式。`"auto"`: 默认，打字机效果，但如果下一个命令是 `prompt` 则立即显示。`"instant"`: 立即显示所有文本。`"pause"`: 打字机效果，结束后等待用户点击。 |
| `duration` | String/Number | 否 | `0` | 文本显示的持续时间（毫秒或 `1s`, `2.5s` 等格式）。可以是一个固定的数字/字符串，或是一个[`$` 前缀表达式](#1--前缀表达式)。 |
| `skip` | Boolean | 否 | `true` | 是否允许用户点击跳过打字机效果。 |
| `align` | String | 否 | `left` | 文本对齐方式。可以是 `left`，`center`，`right`。 |

**示例:**

```json
{
  "say": {
    "label": "你好, <eval>storage.get('playerName')</eval>！这是一个<font color='red'>重要</font>消息。",
    "mode": "instant"
  }
}
```

### `image` - 显示图片

设置页面的背景图片。

**参数:**

| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `url` | String | 是 | - | 图片的 URL。可以是一个固定的 URL，或是一个[`$` 前缀表达式](#1--前缀表达式)。 |


**示例:**
```json
{
  "image": {
    "url": "<url>"
  }
}
```

### `audio.play` - 音频播放

播放一个音频文件。此命令会创建一个 `Sound` 对象，可以通过 `eval` 和 `Sound.get('id')` 进行高级控制。

**参数:**

| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `url` | String | 是 | - | 音频文件的 URL。 |
| `id` | String | 否 | `__sound_`+URL | 音频的唯一标识符，用于后续控制。强烈建议为所有需要控制的音频设置 `id`。 |
| `loops` | Number | 否 | `1` | 循环播放次数。`0` 表示无限循环。 |
| `volume` | Number | 否 | `1.0` | 音量，范围从 `0` 到 `1`。 |
| `background`| Boolean | 否 | `false`| 是否作为背景音乐播放。背景音乐在页面转换时不会停止。 |

**高级用法**:
`audio.play` 命令返回一个 `Sound` 对象，可以稍后在 `eval` 中通过 `Sound.get('your-id')` 获取并操作。详见 [与 `Sound` 对象交互](#与-sound-对象交互)。

**示例:**
```json
{
  "audio.play": {
    "url": "xxxxxx",
    "id": "bgm",
    "loops": 0,
    "background": true
  }
}
```

### `choice` - 提供选项

向用户显示一组可点击的选项。

**参数:**

| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `options`| Array | 是 | `[]` | 一个包含选项对象的数组。 |

**`options` 对象内的参数:**

| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `label` | String | 是 | `""` | 选项显示的文本。支持通过 [`<eval>`](#2-eval-内嵌表达式) 嵌入动态表达式。 |
| `commands` | Array | 是 | `[]` | 用户选择此选项后要执行的命令数组。 |
| `visible` | String/Boolean | 否 | `true` | 控制选项是否可见。可以是一个布尔值，或是一个[`$` 前缀表达式](#1--前缀表达式)。 |
| `color` | String | 否 | - | 选项按钮的颜色。可以是颜色名称或十六进制代码，或是一个[`$` 前缀表达式](#1--前缀表达式)。 |
| `keep` | Boolean | 否 | `false`| 如果为 `true`，则点击该选项后，选项列表不会消失，允许玩家点击多个选项。 |

**示例:**
```json
{
  "choice": {
    "options": [
      {
        "label": "攻击",
        "commands": [{ "goto": { "target": "battle_result" } }]
      },
      {
        "label": "购买药水 (10金币)",
        "visible": "$storage.get('gold') >= 10",
        "commands": [{ "storage.set": { "key": "gold", "value": "$storage.get('gold') - 10" } }]
      },
      {
        "label": "查看状态",
        "keep": true,
        "commands": [{ "say": { "label": "你的生命值是 <eval>storage.get('hp')</eval>" } }]
      }
    ]
  }
}
```

### `prompt` - 用户输入

显示一个输入框，让用户输入文本。

**参数:**

| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `var` | String | 否 | `__lastPromptVal`| 用户输入的值将被赋给一个以此命名的全局变量，可在当前页面后续的命令中（如 `eval`）直接使用。 |
| `value` | String | 否 | `""` | 输入框的初始默认值。**注意：** 此参数不支持表达式。 |

**示例:**
```json
[
  { "say": { "label": "你叫什么名字？" } },
  {
    "prompt": {
      "var": "playerName",
      "value": ""
    }
  },
  { "eval": { "action": "storage.set('playerName', playerName)" } }
]
```

### `notification` - 通知相关命令

#### `notification.create`
创建一个通知。

**参数:**

| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | 是 | - | 通知的唯一标识符。 |
| `label` | String | 是 | `""` | 通知的内容。支持通过 [`<eval>`](#2-eval-内嵌表达式) 嵌入动态表达式。 |
| `duration` | String/Number | 否 | - | 通知的持续显示时间（毫秒或 `1s` 格式）。可以是一个[`$` 前缀表达式](#1--前缀表达式)。 |
| `button` | String | 否 | `""` | 通知上按钮的文本。支持通过 [`<eval>`](#2-eval-内嵌表达式) 嵌入动态表达式。 |
| `commands`| Array | 否 | `[]` | 点击按钮时执行的命令。 |
| `timerCommands` | Array | 否 | `[]` | 计时结束后执行的命令。 |

#### `notification.remove`
移除一个已创建的通知。

**参数:**

| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | 是 | - | 要移除的通知的 `id`。 |


### `timer` - 计时器相关命令

`timer` 命令用于在游戏中创建各种计时器，以实现延时、倒计时、周期性事件等功能。它的核心行为取决于 `commands` 参数是否存在，分为**同步**和**异步**两种模式。

**核心概念：同步 (阻塞) vs. 异步 (非阻塞)**

-   **同步 (阻塞模式)**: 当 `timer` 命令中 **不包含** `commands` 数组时，它会阻塞后续命令的执行。游戏流程会暂停，直到计时结束。
-   **异步 (非阻塞模式)**: 当 `timer` 命令中 **包含** `commands` 数组时，它会变为异步模式，不会阻塞后续命令。它会在后台独立运行，并在计时结束后执行 `commands` 里的命令。

#### `timer`
创建一个计时器。

**参数:**

| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `duration` | String/Number | 是 | - | 计时器时长（毫秒或 `1s` 格式）。可以是一个[`$` 前缀表达式](#1--前缀表达式)。 |
| `id` | String | 否 | `__timer_`+数字 | 计时器的唯一标识符，用于控制。强烈建议为需要控制的计时器设置 `id`。 |
| `loops` | String/Number | 否 | `1` | 循环次数，`0` 为无限循环。可以是一个[`$` 前缀表达式](#1--前缀表达式)。 |
| `commands` | Array | 否 | `[]` | 计时结束时执行的命令。**此参数的存在会使计时器变为异步模式。** |
| `style` | String | 否 | - | 计时器在界面上的显示样式（如 `bar`, `text` 等）。 |
| `paused` | Boolean | 否 | `false`| 如果为 `true`，计时器创建后将处于暂停状态，需要手动 `play()`。 |

**示例 1: 同步阻塞式倒计时**

这是一个 5 秒的倒计时，期间游戏暂停，时间结束后显示消息。由于没有 `commands` 参数，计时器是同步的。

```json
[
  { "say": { "label": "准备好了吗？倒计时开始！" } },
  {
    "timer": {
      "duration": "5s",
      "style": "text"
    }
  },
  { "say": { "label": "时间到！" } }
]
```

**示例 2: 异步后台事件**

启动一个 30 秒的后台计时器。因为存在 `commands` 参数，计时器是异步的，玩家可以继续游戏。30 秒后游戏会自动跳转。

```json
[
  {
    "timer": {
      "id": "bomb_timer",
      "duration": "$difficulty === 'hard' ? '15s' : '30s'",
      "commands": [
        { "say": { "label": "BOOM! 你没能及时拆除炸弹。" } },
        { "goto": { "target": "game_over" } }
      ]
    }
  },
  { "say": { "label": "一个计时器启动了... 你必须在30秒内找到出路！" } }
]
```

#### `timer.remove`
移除（停止）一个正在运行的计时器。

**参数:**

| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | 是 | - | 要移除的计时器的 `id`。 |

---

## 逻辑与控制命令

这类命令负责处理游戏的核心逻辑，如数据存储、条件判断和流程控制。

### `storage` - 数据存储相关命令

`storage` 命令用于在游戏的整个生命周期中持久化存储和读取数据。

#### `storage.set`
存储一个键值对。
- **参数:** `key` (String), `value` (*)。两者都支持[`$` 前缀表达式](#1--前缀表达式)。

#### `storage.remove`
移除一个键值对。
- **参数:** `key` (String)。支持[`$` 前缀表达式](#1--前缀表达式)。

#### `storage.clear`
清除所有存储的数据。无参数。

**在表达式中使用 storage**:
你也可以在任何接受表达式的地方使用 `storage.get('key')`、`storage.set('key', value)`、`storage.remove('key')` 和 `storage.clear()`。`get`, `set`, `remove` 也是各自命令的别名。

**示例：保存和读取玩家名称**
```json
// page: "intro"
[
  { "say": { "label": "欢迎，冒险者！你叫什么名字？" } },
  { "prompt": { "variable": "playerName" } },
  { "storage.set": { "key": "playerName", "value": "$playerName" } },
  { "goto": { "target": "welcome" } }
]

// page: "welcome"
[
  // 使用 <eval> 表达式从 storage 中读取数据
  { "say": { "label": "你好, <eval>storage.get('playerName')</eval>！祝你好运。" } }
]
```

### `eval` - 执行代码
执行一段任意的 JavaScript 代码。这是实现复杂逻辑和变量操作的核心命令。

**参数:** `action` (String): 要执行的 JavaScript 代码字符串。
**重要提示**:
-   解释器目前支持 **ES5 语法**。请**避免**使用 ES6+ 的特性，例如 `const`、`let` 或箭头函数 (`=>`)。
-   请使用 `var` 来声明变量。

**示例：根据玩家属性计算新状态**
```json
// 假设玩家有 'hp' 和 'mp' 两个属性存储在 storage 中
[
  {
    "eval": {
      "action": "var currentHp = storage.get('hp'); var currentMp = storage.get('mp'); if (currentHp < 10 && currentMp < 5) { storage.set('status', 'exhausted'); }"
    }
  },
  {
    "if": {
      "condition": "storage.get('status') === 'exhausted'",
      "commands": [{ "say": { "label": "你感到精疲力尽..." } }]
    }
  }
]
```

### `if` - 条件判断
根据条件的真假执行不同的命令分支。

**参数:**
- `condition` (String): 一个 JavaScript 表达式，其结果将被评估为 `true` 或 `false`。**注意：** 此参数本身就是表达式，不需要 `$` 前缀。
- `commands` (Array): 条件为 `true` 时执行的命令数组。
- `elseCommands` (Array, 可选): 条件为 `false` 时执行的命令数组。

**示例 1：带 `else` 的分支 (商店购物)**
```json
[
  { "say": { "label": "这把传说中的剑售价100金币。你要买吗？" } },
  {
    "if": {
      "condition": "storage.get('gold') >= 100",
      "commands": [
        { "say": { "label": "你购买了传说之剑！" } },
        { "eval": { "action": "storage.set('gold', storage.get('gold') - 100); storage.set('hasLegendarySword', true);" } }
      ],
      "elseCommands": [
        { "say": { "label": "你的金币不够。" } }
      ]
    }
  }
]
```

### `goto` - 页面跳转
跳转到指定的页面。

**参数:** `target` (String): 目标页面的 `pageId`。可以是一个[`$` 前缀表达式](#1--前缀表达式)。

**示例：静态跳转与动态跳转**
```json
// 静态跳转：直接跳转到 'game_over' 页面
{ "goto": { "target": "game_over" } }

// 动态跳转：跳转到 'destination' 变量所指定的页面
// 这个变量可能在之前的 choice 或 eval 中被设置
{
  "eval": {
    "action": "var destination = (storage.get('karma') > 50) ? 'heaven' : 'hell';"
  }
},
{ "goto": { "target": "$destination" } }

```

### `enable` / `disable` - 页面状态控制
启用或禁用某个页面，控制其是否可被 `goto` 跳转。默认所有页面都是启用的。

**参数:** `target` (String): 目标页面的 `pageId`。可以是一个[`$` 前缀表达式](#1--前缀表达式)。

**示例：解锁一个隐藏区域**
```json
// "secret_passage" 页面初始时是禁用的
// page: "library"
[
  { "say": { "label": "你发现了一把生锈的钥匙。" } },
  { "storage.set": { "key": "hasRustyKey", "value": true } },
  {
    "if": {
      "condition": "storage.get('hasRustyKey') === true",
      "commands": [
        // 启用隐藏通道
        { "enable": { "target": "secret_passage" } },
        { "say": { "label": "钥匙插进了一个隐藏的锁孔，一扇暗门打开了！" } },
        { "goto": { "target": "secret_passage" } }
      ]
    }
  }
]
```

### `end` - 结束冒险
立即结束整个冒险或故事。

**参数:** 无。

### `noop` - 空操作
一个不执行任何操作的命令。通常用作逻辑占位符。

**参数:** 无。

---

## 高级脚本

**重要**: 与 `timer` 或 `notification` 不同，OEOS **没有**提供 `audio.pause` 或 `audio.stop` 这样的命令。所有对音频的播放控制（暂停、停止、恢复等）都**必须**通过 `eval` 命令，获取 `Sound` 对象实例后调用其方法来完成。

**示例：在战斗结束后停止背景音乐**
```json
// 假设之前有一个 id 为 'bgm' 的背景音乐在播放
[
  { "say": { "label": "战斗胜利！" } },
  { "eval": { "action": "Sound.get('bgm').stop()" } }
]
```
许多交互命令（如 `audio.play`）在执行时会创建可在 `eval` 中引用的对象，从而实现更复杂的控制。
### 与 `Sound` 对象交互
当您使用 `audio.play` 命令并提供 `id` 时，可以在 `eval` 中通过 `Sound.get('your-id')` 获取该音频实例。

**可用的 `Sound` 对象方法:**

| 方法 | 参数 | 描述 |
| :--- | :--- | :--- |
| `.play()` | - | 播放或恢复音频。 |
| `.pause()` | - | 暂停音频。 |
| `.stop()` | - | 停止音频并回到起点。 |

**示例：**
```json
[
  { "audio.play": { "url": "...", "id": "bgm", "loops": 0 } },
  { "say": { "label": "战斗开始！" } },
  { "eval": { "action": "Sound.get('bgm').pause()" } }
]
```
---
### 模拟状态栏 (Simulating a Status Bar)

OEOS 没有内置的 `statusBar` 命令，但可以通过组合 `notification` 和 `eval` 命令来灵活地模拟一个持久的状态栏，用于显示生命值、金钱、得分等信息。

**实现原理**: 创建一个**不会自动消失**的通知，并根据需要**更新其内容**。

**实现步骤:**

1.  **创建状态栏**: 使用 [`notification.create`](#notificationcreate) 命令。
    *   为其提供一个唯一的 `id` (例如 `"statusBar"`)。
    *   **不要**提供 `Duration` 参数，这样通知就会一直显示在屏幕上。
2.  **更新状态栏**: 当数值变化时，只需再次调用 `notification.create` 并使用**相同的 `id`**。播放器会自动用新内容替换掉旧的通知。


**完整示例：**

下面的例子展示了如何创建并更新一个显示 HP 和金币的状态栏。

```json
{
  "pages": {
    "start": [
      // 初始化玩家数据
      { "storage.set": { "key": "hp", "value": 100 } },
      { "storage.set": { "key": "gold", "value": 50 } },

      // 步骤 1: 创建状态栏 (持久化通知)
      {
        "notification.create": {
          "id": "statusBar",
          "label": "❤️ HP: <eval>storage.get('hp')</eval> | 💰 金币: <eval>storage.get('gold')</eval>"
        }
      },

      { "say": { "label": "你遇到了一个怪物！" } },
      {
        "choice": {
          "options": [
            {
              "label": "战斗 (-10 HP)",
              "commands": [
                { "storage.set": { "key": "hp", "value": "$storage.get('hp') - 10" } },
                
                // 步骤 2: 更新状态栏
                {
                  "notification.create": {
                    "id": "statusBar",
                    "label": "❤️ HP: <eval>storage.get('hp')</eval> | 💰 金币: <eval>storage.get('gold')</eval>"
                  }
                },

                { "say": { "label": "你在战斗中受了点伤。" } }
              ]
            }
          ]
        }
      }
    ]
  }
}
```