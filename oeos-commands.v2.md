# OEOS Player 命令参考文档 v2

本文档旨在详细介绍 OEOS Player 冒险、故事格式中标准的 JSON 命令及其所有可用参数。

## 目录
1.  [核心结构](#核心结构)
2.  [表达式 (Expressions)](#表达式-expressions)
3.  [显示与交互命令](#显示与交互命令)
4.  [逻辑与控制命令](#逻辑与控制命令)
5.  [高级脚本](#高级脚本)

---
## 核心结构

OEOS 冒险、故事是一个 JSON 对象，其核心是 `pages` 对象。

-   **`pages`**: 一个对象，键是“页面”的唯一标识符（`pageId`），值是一个命令数组。
-   **命令 (Command)**: 一个命令是一个数组，格式为 `[ "命令名", 参数 ]`。
    - 对于只有一个主要参数的命令（如 `say`），可以采用简写形式：`[ "say", "要显示的文本" ]`。
    - 对于有多个参数的命令，第二个元素是一个参数对象：`[ "timer", { "duration": "10s", "style": "bar" } ]`。
    - 对于没有参数的命令，可以省略第二个元素：`[ "end" ]`。

**示例:**
```json
{
  "pages": {
    "start": [
      [ "image", "media/bg1.jpg" ],
      [ "say", "欢迎来到游戏！" ],
      [ "goto", "page2" ]
    ]
  }
}
```

---

## 表达式 (Expressions)

- **`$` 前缀**: 以 `$` 开头的字符串值将被作为 JavaScript 执行。
  - 示例: `[ "goto", "$nextDestination" ]`
- **`<eval>` 标签**: 在文本字符串中嵌入 JavaScript 表达式。
  - 示例: `[ "say", "你的分数是 <eval>score</eval>" ]`

---

## 显示与交互命令

### `say` - 显示对话
在屏幕上显示一段文字。

**格式**:
- `[ "say", "要显示的文本" ]` (简写)
- `[ "say", { "label": "文本", "mode": "instant", ... } ]` (完整)

**参数 (`{}`中的内容):**
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `label` | String | 是 | `""` | 要显示的文本内容。支持 HTML 与 `<eval>`。 |
| `mode` | String | 否 | `"auto"` | 显示模式: `"auto"`, `"instant"`, `"pause"`。 |
| `duration`| String/Number | 否 | `0` | 显示的持续时间。 |
| `skip` | Boolean | 否 | `true` | 是否允许用户跳过打字机效果。 |
| `align` | String | 否 | `left` | 文本对齐方式: `left`, `center`, `right`。 |

**示例:**
```json
[ "say", "你好, <eval>Storage.get('playerName')</eval>！这是一个<font color='red'>重要</font>消息。" ]
```

### `image` - 显示图片
设置页面的背景图片。

**格式**: `[ "image", "图片的URL" ]`

**参数**:
- `url` (String, 必须): 图片的 URL。支持 `$` 表达式。

**示例:**
```json
[ "image", "$Storage.get('currentBackground')" ]
```

### `audio.play` - 音频播放
播放一个音频文件。

**格式**: `[ "audio.play", { "url": "...", "id": "...", ... } ]`

**参数:**
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `url` | String | 是 | - | 音频文件的 URL。 |
| `id` | String | 否 | `__sound_`+URL | 音频的唯一标识符，用于后续控制。 |
| `loops` | Number | 否 | `1` | 循环次数。`0` 表示无限循环。 |
| `volume` | Number | 否 | `1.0` | 音量，范围从 `0` 到 `1`。 |
| `background`| Boolean | 否 | `false`| 是否作为背景音乐播放。 |

**示例:**
```json
[ "audio.play", { "url": "media/bgm.mp3", "id": "bgm", "loops": 0, "background": true } ]
```

### `choice` - 提供选项
向用户显示一组可点击的选项。

**格式**: `[ "choice", { "options": [ ... ] } ]`

**`options` 数组内的对象参数:**
| 参数 | 类型 | 必须 | 描述 |
| :--- | :--- | :--- | :--- |
| `label` | String | 是 | 选项显示的文本。 |
| `commands` | Array | 是 | 选择此选项后要执行的命令数组。 |
| `visible` | String/Boolean| 否 | 控制选项是否可见。 |
| `color` | String | 否 | 选项按钮的颜色。 |
| `keep` | Boolean | 否 | 若为 `true`，点击后选项列表不消失。 |

**示例:**
```json
[
  "choice",
  {
    "options": [
      {
        "label": "攻击",
        "commands": [ [ "goto", "battle_result" ] ]
      },
      {
        "label": "购买药水 (10金币)",
        "visible": "$Storage.get('gold') >= 10",
        "commands": [ [ "storage.set", { "key": "gold", "value": "$Storage.get('gold') - 10" } ] ]
      }
    ]
  }
]
```

### `prompt` - 用户输入
显示一个输入框，让用户输入文本。

**格式**: `[ "prompt", { "var": "...", "value": "..." } ]`

**参数:**
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `var` | String | 否 | `__lastPromptVal`| 用户输入的值将被赋给一个以此命名的全局变量。 |
| `value` | String | 否 | `""` | 输入框的初始默认值。不支持表达式。 |

**示例:**
```json
[
  [ "say", "你叫什么名字？" ],
  [ "prompt", { "var": "playerName", "value": "路人甲" } ],
  [ "eval", "Storage.set('playerName', playerName)" ]
]
```

### `notification` - 通知相关命令

#### `notification.create`
创建一个通知。

**格式**: `[ "notification.create", { "id": "...", "label": "...", ... } ]`
**参数**:
| 参数 | 类型 | 必须 | 描述 |
|:---|:---|:---|:---|
| `id`| String | 是 | 通知的唯一标识符。 |
| `label`| String | 是 | 通知的内容。 |
| `duration`| String/Number| 否 | 通知的持续显示时间。 |
| `button`| String | 否 | 通知上按钮的文本。 |
| `commands`| Array | 否 | 点击按钮时执行的命令。 |
| `timerCommands`| Array | 否 | 计时结束后执行的命令。 |

#### `notification.remove`
移除一个已创建的通知。

**格式**: `[ "notification.remove", "要移除的通知ID" ]`


### `timer` - 计时器相关命令

#### `timer`
创建一个计时器。

**格式**: `[ "timer", { "duration": "...", "commands": [...], ... } ]`
- **同步 (阻塞)**: 当不包含 `commands` 数组时，游戏暂停直到计时结束。
- **异步 (非阻塞)**: 当包含 `commands` 数组时，计时器在后台运行。

**参数:**
| 参数 | 类型 | 必须 | 描述 |
| :--- | :--- | :--- | :--- |
| `duration` | String/Number | 是 | 计时器时长（毫秒或 `1s` 格式）。 |
| `commands` | Array | 否 | 计时结束时执行的命令。**此参数会使计时器变为异步。** |
| `id` | String | 否 | 计时器的唯一标识符。 |
| `loops` | String/Number | 否 | 循环次数，`0` 为无限循环。 |
| `style` | String | 否 | 界面显示样式（如 `bar`, `text`）。 |
| `paused` | Boolean | 否 | 若为 `true`，计时器创建后将处于暂停状态。 |


**示例 (异步):**
```json
[
  "timer",
  {
    "id": "bomb_timer",
    "duration": "30s",
    "commands": [
      [ "say", "BOOM! 你没能及时拆除炸弹。" ],
      [ "goto", "game_over" ]
    ]
  }
]
```
#### `timer.remove`
移除（停止）一个正在运行的计时器。

**格式**: `[ "timer.remove", "要移除的计时器ID" ]`

---

## 逻辑与控制命令

### `storage` - 数据存储相关命令

#### `storage.set`
**格式**: `[ "storage.set", { "key": "...", "value": "..." } ]`

#### `storage.remove`
**格式**: `[ "storage.remove", "要移除的键" ]`

#### `storage.clear`
**格式**: `[ "storage.clear" ]`

### `eval` - 执行代码
执行一段任意的 JavaScript 代码。

**格式**: `[ "eval", "JS代码字符串" ]`
**重要提示**: 请使用 `var` 来声明变量 (ES5 语法)。

**示例:**
```json
[ "eval", "var currentHp = Storage.get('hp'); Storage.set('hp', currentHp - 10);" ]
```

### `if` - 条件判断
根据条件的真假执行不同的命令分支。

**格式**: `[ "if", { "condition": "...", "commands": [...], "elseCommands": [...] } ]`
**注意**: `condition` 字符串本身就是表达式，不需要 `$` 前缀。

**示例:**
```json
[
  "if",
  {
    "condition": "Storage.get('gold') >= 100",
    "commands": [
      [ "say", "你购买了传说之剑！" ]
    ],
    "elseCommands": [
      [ "say", "你的金币不够。" ]
    ]
  }
]
```

### `goto` - 页面跳转
跳转到指定的页面。

**格式**: `[ "goto", "目标页面ID" ]`

### `enable` / `disable` - 页面状态控制
启用或禁用某个页面。

**格式**: `[ "enable", "页面ID" ]` 或 `[ "disable", "页面ID" ]`

### `end` - 结束冒险
立即结束整个冒险或故事。

**格式**: `[ "end" ]`

### `noop` - 空操作
一个不执行任何操作的命令。

**格式**: `[ "noop" ]`

---

## 高级脚本

### 与 `Sound` 对象交互
所有对音频的播放控制（暂停、停止等）都**必须**通过 `eval` 命令完成。

**示例：在战斗结束后停止背景音乐**
```json
[
  [ "say", "战斗胜利！" ],
  [ "eval", "Sound.get('bgm').stop()" ]
]
```

### 模拟状态栏
通过创建一个**不会自动消失**的通知来实现。要更新状态栏，只需使用相同的 `id` 再次调用 `notification.create`。

**示例：**
```json
[
  "notification.create",
  {
    "id": "statusBar",
    "label": "❤️ HP: <eval>Storage.get('hp')</eval> | 💰 金币: <eval>Storage.get('gold')</eval>"
  }
]