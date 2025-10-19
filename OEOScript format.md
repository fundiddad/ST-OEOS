# OEOScript 命令参考文档

本文档旨在详细介绍 OEOScript 格式的语法、命令和所有可用参数。

## 目录
1.  [核心概念](#核心概念)
2.  [数据类型与表达式](#数据类型与表达式)
3.  [显示与交互命令](#显示与交互命令)
    *   [`say`](#say---显示对话)
    *   [`image`](#image---显示图片)
    *   [`choice`](#choice---提供选项)
    *   [`prompt`](#prompt---用户输入)
    *   [`audio`](#audio---音频播放)
    *   [`notification`](#notification---显示通知)
    *   [`timer`](#timer---计时器)
4.  [逻辑与控制命令](#逻辑与控制命令)
    *   [`if` / `else if` / `else`](#if--else-if--else---条件判断)
    *   [`goto`](#goto---页面跳转)
    *   [`eval`](#eval---执行代码)
    *   [`storage` 命令](#storage-命令)
    *   [`enable` / `disable`](#enable--disable---页面状态控制)
    *   [`noop`](#noop---空操作)
5.  [高级主题](#高级主题)
    *   [与 `Sound` 对象交互](#与-Sound-对象交互)
    *   [模拟状态栏](#模拟状态栏)


---
## 核心概念

### 1. 页面 (Pages)
*   每个页面块以 `>`  开头，后跟唯一的页面ID,以`---`结束。
*   页面块内的所有后续缩进行都属于该页面。

**示例:**
```
> start
  say "这是起始页"
---
> page2
  say "这是第二页"
---
```

### 2. 命令 (Commands)
*   命令是构成页面的基本指令，每行一个。
*   **主要语法 (命名参数)**: `commandName key1: value1 key2: value2 ...`
    *   所有参数都带有名称，不会产生混淆。
*   **快捷语法 (位置参数)**: `commandName <value>`
    *   部分常用命令的**第一个核心参数**可以省略其名称。

> **支持快捷语法的命令列表**
>
> 以下命令的首位参数可以省略关键字：
> *   `say <label>` (等同于 `say label: <label>`)
> *   `image <url>` (等同于 `image url: <url>`)
> *   `audio <url>` (等同于 `audio url: <url>`)
> *   `goto <pageId>` (等同于 `goto pageId: <pageId>`)
> *   `storage.remove <key>` (等同于 `storage.remove key: <key>`)
> *   `enable <pageId>` (等同于 `enable pageId: <pageId>`)
> *   `disable <pageId>` (等同于 `disable pageId: <pageId>`)
>
> **除以上列表外，所有其他命令及其参数都必须使用命名参数语法。**
> **对于支持快捷语法的命令必须使用快捷语法。**


### 3. 缩进与代码块
*   OEOScript v4 使用缩进（Indentation）来定义代码块的层级结构，类似于 Python。
*   **标准缩进**: 必须使用 **2个空格** 进行缩进。请勿使用 Tab 字符或混合使用空格和 Tab。
*   **强制性**: 缩进在 `if`, `choice`, `notification.create` 等包含子命令块的命令中是 **强制性** 的，错误的缩进将导致脚本解析失败。

---
## 数据类型与表达式

### 1. 字符串 (String)
*   使用双引号 `"` 包裹。
*   示例: `say "你好, 世界"`

### 2. 数字 (Number) & 布尔值 (Boolean)
*   直接书写，无需引号。
*   示例: `storage.set key: "age" value: 25`
*   示例: `say "你好" skip: true`

### 3. 表达式 (Expressions)
OEOScript 依赖表达式来实现动态的游戏逻辑。

*   **`$` 前缀表达式**: 以单个美元符号 `$` 开头的字符串被视为一段完整的 JavaScript 代码。其执行结果将作为参数的最终值。
*   **`<eval>` 内嵌表达式**: 在字符串内部，可以使用 `<eval>...</eval>` 标签来嵌入并执行 JavaScript 表达式，并将其结果拼接到字符串中。



**示例:**
```
# 使用 $ 前缀
storage.set key: "gold" value: $storage.get('gold') - 10
goto $nextPage

# 在字符串中使用 <eval>
say "你的分数是 <eval>score * 100</eval> 分。"
say "你好, <eval>storage.get('playerName')</eval>!"
```

> **重要：JavaScript 表达式语法限制**
>
> OEOScript v4 中所有的 `$` 前缀表达式、`<eval>` 内嵌表达式以及 `eval` 命令块都必须严格遵循 **ECMAScript 5 (ES5)** 语法。
> *   **请使用 `var`** 声明变量，**禁止**使用 `let` 和 `const`。
> *   **请使用 `function() {}`** 形式的函数，**禁止**使用箭头函数 `() => {}`。
>
> 违背此规则将导致脚本执行失败。

---
## 显示与交互命令

### `say` - 显示对话
在屏幕上显示一段文字。

**语法**: `say "<label>" [key: value ...]`

**参数**:
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `label` | String | 是 | `""` | **(首位参数)** 要显示的文本内容。 |
| `mode` | String | 否 | `"auto"` | 显示模式: `"auto"`, `"instant"`, `"pause"`。 |
| `duration`| String/Num | 否 | `0` | 显示的持续时间 (如 `5s`, `1000`)。 |
| `skip` | Boolean | 否 | `true` | 是否允许用户跳过打字机效果。 |
| `align` | String | 否 | `left` | 文本对齐方式: `left`, `center`, `right`。 |

**示例:**
```
> page1
  say "你好, <eval>storage.get('playerName')</eval>！" mode: "instant"
  say label: "这是一个<font color='red'>重要</font>消息。"
```

### `image` - 显示图片
设置页面的背景图片。

**语法**: `image "<url>"`

**参数**:
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `url` | String | 是 | - | **(首位参数)** 图片的 URL。支持 `$` 表达式。 |

**示例:**
```
> start
  image "media/bg1.jpg"
  image url: $storage.get('currentBackground')
```

### `choice` - 提供选项
向用户显示一组可点击的选项。

**语法**:
```
choice
  "<label>" [when: <condition>] [color: <color>] [keep: <boolean>]
    # 要执行的命令块
    <commands>
  "<label>" [when: <condition>] [color: <color>] [keep: <boolean>] -> <single_command>
```

**选项参数**:
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `label` | String | 是 | - | **(首位参数)** 选项显示的文本。 |
| `when` | Expression | 否 | `true` | (可选) 控制选项是否可见的JS条件表达式。 |
| `color` | String | 否 | - | (可选) 选项按钮的颜色。 |
| `keep` | Boolean | 否 | `false` | (可选) 若为 `true`，点击后选项列表不消失。 |
| `->` | - | - | - | (可选) 用于单行命令的快捷语法。 |

**单行命令快捷方式**
如果选项被点击后只需要执行一个命令，你可以使用 `->` 符号来简化书写，无需缩进代码块。
```
choice
  "直接结束" -> end
  "去下一页" -> goto next_page
```

**示例:**
```
> crossroads
  say "你走到了一个十字路口。"
  choice
    "向左走"
      say "你选择了左边的路。"
      goto forest_path
    "向右走" when: $storage.get('hasMap') == true color: "blue"
      say "你看着地图，选择了右边。"
      goto city_path
    "查看状态" keep: true
      say "你的生命值是 <eval>storage.get('hp')</eval>"
    "原地等待" -> goto waiting_event
```

### `prompt` - 用户输入
显示一个输入框，让用户输入文本。

**语法**: `prompt var: "<variable_name>" [value: "<initial_value>"]`

**参数**:
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `var` | String | 是 | - | 用户输入的值将被赋给的全局变量名。 |
| `value` | String | 否 | `""` | 输入框的初始默认值。 |

> **工作机制说明**：`prompt` 命令会创建一个由 `var` 参数指定的 **临时全局变量**（例如 `playerName`）。这个变量仅在当前页面的后续命令执行期间有效。为了长期保存用户输入，你必须紧接着使用 `eval` 或 `storage.set` 命令将其存入 `storage`，如示例所示。

**示例:**
```
> ask_name
  say "你叫什么名字？"
  prompt var: "playerName" value: "路人甲"
  eval code: "storage.set('playerName', playerName)"
  say "你好, <eval>playerName</eval>!"
```

### `audio` - 音频播放
播放一个音频文件。

**语法**: `audio.play "<url>" [key: value ...]`

**参数**:
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `url` | String | 是 | - | **(首位参数)** 音频文件的 URL。 |
| `id` | String | 否 | `__Sound_`+URL | 音频的唯一标识符，用于后续控制。 |
| `loops` | Number | 否 | `1` | 循环播放次数。`0` 表示无限循环。 |
| `volume` | Number | 否 | `1.0` | 音量，范围从 `0` 到 `1`。 |
| `background`| Boolean | 否 | `false`| 是否作为背景音乐播放。 |

**示例:**
```
> battle_scene
  audio.play "media/bgm.mp3" id: "bgm" loops: 0 background: true volume: 0.5
```

### `notification` - 显示通知
在屏幕边缘显示一个短暂或持久的通知。

**语法**:
```
# 创建/更新通知
notification.create id: "<id>" label: "<text>" [key: value ...]
  # (可选) 点击按钮时执行的命令
  commands
    <command_block>
  # (可选) 计时结束后执行的命令
  timerCommands
    <command_block>

# 移除通知
notification.remove "<id>"
```

**`notification.create` 参数**:
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | 是 | - | 通知的唯一标识符。 |
| `label` | String | 是 | `""` | 通知的内容。支持 `<eval>`。 |
| `duration` | String/Num | 否 | - | 通知的持续显示时间。若不提供，则通知将持久显示。 |
| `button` | String | 否 | `""` | 通知上按钮的文本。 |

**`notification.remove` 参数**:
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | 是 | - | **(首位参数)** 要移除的通知的ID。 |

**示例:**
```
> show_quest
  notification.create id: "quest" label: "新任务：找到钥匙" button: "接受" duration: "10s"
    commands
      say "任务已接受！"
      eval code: "storage.set('quest_accepted', true)"
    timerCommands
      say "你错过了接受任务的时间。"

> remove_quest
  notification.remove "quest"
```

### `timer` - 计时器
创建一个延时、倒计时或周期性事件。

**语法**:
```
# 同步（阻塞）计时器
timer duration: <duration> [key: value ...]

# 异步（非阻塞）计时器
timer duration: <duration> [key: value ...]
  <commands>

# 移除计时器
timer.remove id: "<id>"
```

> ⚠️ **重要：同步 vs 异步模式**
> `timer` 命令的行为模式取决于它是否包含子命令块：
> *   **同步 (阻塞) 模式**: `timer duration: ...`
>     *   当 `timer` 命令**不带**子命令块时，它会暂停整个脚本的执行，直到计时结束。这适用于需要精确延时的场景。
> *   **异步 (非阻塞) 模式**: `timer duration: ...`
>     *   当 `timer` 命令**带有**子命令块时（即使块内为空），它会立即在后台开始计时，并且脚本会继续执行后续命令，不会暂停。这适用于创建后台任务或倒计时。

**参数**:
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `duration` | String/Num | 是 | - | 计时器时长（如 `5s`, `1000`）。 |
| `id` | String | 否 | `__timer_`+数字 | 计时器的唯一标识符，用于控制。 |
| `loops` | Number | 否 | `1` | 循环次数，`0` 为无限循环。 |
| `style` | String | 否 | - | 界面显示样式（如 `bar`, `text`）。 |
| `paused` | Boolean | 否 | `false`| 如果为 `true`，计时器创建后将处于暂停状态。 |
| `commands` | Block | 否 | `[]` | 计时结束时执行的命令块。**此参数的存在会使计时器变为异步模式。** |

**示例:**
```
> sync_timer_example
  say "5秒后爆炸..."
  timer duration: "5s" style: "text"
  say "轰！"

> async_timer_example
  say "炸弹已启动，你只有30秒！"
  timer duration: "30s" id: "bomb"
    say "时间到了！"
    goto game_over
  
> disarm_bomb
  say "你成功拆除了炸弹！"
  timer.remove id: "bomb"
```

---
## 逻辑与控制命令

### `if` / `else if` / `else` - 条件判断
根据条件的真假执行不同的命令分支。

**语法**:
```
if <condition>
  <commands>
[else if <condition>
  <commands>]
[else
  <commands>]
```
**示例:**
```
if $storage.get('gold') >= 100
  say "你购买了商品。"
else if $storage.get('gold') >= 50
  say "你可以买个便宜点的。"
else
  say "你的金币不够。"
```

### `goto` - 页面跳转
跳转到指定的页面。

**语法**: `goto <pageId>`

**参数**:
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `pageId` | String | 是 | - | **(首位参数)** 要跳转到的目标页面的ID。支持 `$` 表达式。 |

### `eval` - 执行代码
执行一段任意的 JavaScript 代码。

**语法**:
```
# 单行
eval code: "<js_code_string>"

# 多行
eval
  <js_code_line_1>
  <js_code_line_2>
```

**参数**:
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `code` | String | 是 | - | 要执行的单行 JavaScript 代码字符串。 |

> **重要提示: ES5 语法限制**
>
> `eval` 和表达式中执行的 JavaScript 代码必须遵循 **ES5 语法**。请**避免**使用 ES6+ 的特性，例如 `let`、`const` 或箭头函数 (`=>`)。请使用 `var` 来声明变量。

**示例:**
```
eval code: "var newHp = storage.get('hp') - 10; storage.set('hp', newHp);"

eval
  var currentFavor = storage.get('favor');
  storage.set('favor', currentFavor + 1);
```

### `storage` 命令
用于在游戏的整个生命周期中持久化存储和读取数据。

**`storage.set`**: 设置一个键值对。
**语法**: `storage.set key: "<key>" value: <value>`

**`storage.remove`**: 移除一个键值对。
**语法**: `storage.remove "<key>"`

**`storage.clear`**: 清除所有存储的数据。
**语法**: `storage.clear`

### `enable` / `disable` - 页面状态控制
启用或禁用某个页面，控制其是否可被 `goto` 跳转。

**语法**:
```
enable "<pageId>"
disable "<pageId>"
```
**参数**:
| 参数 | 类型 | 必须 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `pageId` | String | 是 | - | **(首位参数)** 要启用或禁用的目标页面的ID。 |


### `noop` - 空操作
一个不执行任何操作的命令，通常用作逻辑占位符。

**语法**: `noop`

---
## 高级主题

### 与 `Sound` 对象交互
所有对音频的播放控制（暂停、停止、恢复等）都**必须**通过 `eval` 命令，获取 `Sound` 对象实例后调用其方法来完成。

**可用的 `Sound` 对象方法:**
| 方法 | 描述 |
| :--- | :--- |
| `.play()` | 播放或恢复音频。 |
| `.pause()` | 暂停音频。 |
| `.stop()` | 停止音频并回到起点。 |

**示例：**
```
> battle_won
  say "战斗胜利！"
  eval code: "Sound.get('bgm').stop()"
```

### 模拟状态栏
通过创建一个**不会自动消失**的 `notification` 来实现。要更新状态栏，只需使用相同的 `id` 再次调用 `notification.create`。

**示例:**
```
> start
  # 首次创建状态栏
  storage.clear
  storage.set key: "hp" value:100
  storage.set key: "gold" value: 50
  notification.create id: "statusBar" label: "❤️ HP: <eval>hp</eval> | 💰 金币: <eval>gold</eval>"
  goto encounter

> encounter
  say "你受到了10点伤害！"
  eval code: "hp = hp - 10;"
  # 使用相同的 ID 更新状态栏
  notification.create id: "statusBar" label: "❤️ HP: <eval>hp</eval> | 💰 金币: <eval>gold</eval>"
```

