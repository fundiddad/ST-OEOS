# OEOScript 语言规范

本文档为 OEOScript 语言提供了一份全面且权威的参考，详细说明了所有语法、命令、参数和使用规则。

---

### **1. 全局语法规则**

1.  **文件结构**: 一个脚本是多个页面的集合。可以在单个脚本中定义多个页面，页面之间用 `---` 分隔。
2.  **页面定义**: 每个页面以 `>` 后跟一个唯一的 `pageId` 开始，并以 `---` 结束。
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
---
```
 
3.  **缩进**:
    *   **规则**: 每个缩进级别必须使用 **2个空格**。
    *   **强制**: 在 `if`、`choice`、`notification.create` 和 `timer` 等命令中定义命令块时，缩进是强制性的。不正确的缩进将导致解析错误。
4.  **命令**:
    *   每行一个命令。
    *   命令在页面块内进行缩进。
5.  **参数语法**:
    *   **命名语法 (默认)**: `commandName key: value key2: value2`。这是大多数命令的标准格式。
    *   **简写语法 (位置性)**: `commandName value`。对于特定命令的第一个也是最主要的参数，**必须**使用此语法。

6.  **简写语法命令列表**: 以下命令的第一个参数**必须**使用简写语法。
    *   `say <label>`
    *   `image <url>`
    *   `audio.play <url>` (注意: 命令是 `audio.play`, 而不是 `audio`)
    *   `goto <pageId>`
    *   `storage.remove <key>`
    *   `notification.remove <id>`
    *   `enable <pageId>`
    *   `disable <pageId>`

---

### **2. 数据类型 & 表达式**

1.  **字符串 (String)**: 用双引号 (`"`) 括起来。例如: `"Hello, world."`
2.  **数字 (Number)**: 直接写入。例如: `100`, `0.5`
3.  **布尔值 (Boolean)**: 直接写作 `true` 或 `false`。
4.  **表达式 (Expressions)**: 用于动态值。所有表达式必须严格遵守 **ECMAScript 5 (ES5) 语法**。

    *   **`$` 前缀表达式**: 整个值是一个 JavaScript 表达式。将使用该表达式的结果。
      *   示例: `storage.set key: "gold" value: $storage.get('gold') - 10`
      *   示例: `goto $nextPageVariable`

    *   **`<eval>` 内联表达式**: 在字符串中嵌入一个 JavaScript 表达式。
      *   示例: `say "你的生命值是 <eval>storage.get('hp')</eval>."`

    *   **ES5 语法约束 (关键)**:
        *   **变量**: 使用 `var`。**不要使用** `let` 或 `const`。
        *   **函数**: 使用 `function() {}`。**不要使用**箭头函数 (`=>`)。
        *   违反此规则将导致脚本执行失败。

---

### **3. 命令参考**

#### **3.1 显示与交互命令**

**`say`**: 在对话框中显示文本。
*   **语法**: `say "<label>"` 或 `say label: "<label>" [options...]` (强制使用简写)
*   **参数**:
    *   `label` (字符串, 必需, 简写): 要显示的文本。支持 `<eval>` 和 **HTML**。
    *   `mode` (字符串, 可选, 默认: `"auto"`): 打字效果。可选值: `"auto"` (打字机效果), `"instant"` (立即显示), `"pause"` (暂停)。
    *   `duration` (字符串/数字, 可选, 默认: `0`): 文本显示的时长 (例如: `"5s"`, `5000`)。
    *   `skip` (布尔值, 可选, 默认: `true`): 允许用户跳过打字机效果。
    *   `align` (字符串, 可选, 默认: `left`): 文本对齐方式。可选值: `left`, `center`, `right`。

**`image`**: 设置当前页面的背景图片。
*   **语法**: `image "<url>"` (强制使用简写)
*   **参数**:
    *   `url` (字符串, 必需, 简写): 图片的 URL。支持 `$` 表达式。

**`choice`**: 向用户显示可点击的选项。
*   **语法**:
    ```
    choice
      "<label>" [options...]
        # 此选项的命令块
        <commands>
      "<label>" [options...] -> <single_command>
    ```
*   **选项参数** (应用于每个选项行):
    *   `label` (字符串, 必需): 按钮上显示的文本。支持 `<eval>` 和 **HTML**。
    *   `when` (表达式, 可选, 默认: `true`): 一个 JS 表达式。如果为 `false`，该选项将被隐藏。
    *   `color` (字符串, 可选): 按钮的颜色。
    *   `keep` (布尔值, 可选, 默认: `false`): 如果为 `true`，选择后选项菜单将保留。
    *   `->` (操作符, 可选): 单个命令的快捷方式，避免了编写缩进块的需要。

**`prompt`**: 显示一个供用户输入文本的输入框。
*   **语法**: `prompt var: "<variable_name>" [value: "<initial_value>"]`
*   **参数**:
    *   `var` (字符串, 必需): 用于存储用户输入的**临时全局变量**的名称。
    *   `value` (字符串, 可选, 默认: `""`): 输入框中的默认文本。
*   **重要**: 由 `prompt` 创建的变量是临时的，并且仅对**同一页面**上的后续命令有效。要永久保存输入，你**必须**立即使用 `eval` 或 `storage.set` 将其复制到 `storage` 对象中。
    ```
    prompt var: "playerName"
    eval code: "storage.set('playerName', playerName)"
    ```

**`audio.play`**: 播放一个音频文件。
*   **语法**: `audio.play "<url>" [options...]` (强制使用简写)
*   **参数**:
    *   `url` (字符串, 必需, 简写): 音频文件的 URL。
    *   `id` (字符串, 可选, 默认: 自动生成): 用于稍后引用此声音的唯一 ID (例如，用于停止它)。
    *   `loops` (数字, 可选, 默认: `1`): 循环播放的次数。`0` 表示无限循环。
    *   `volume` (数字, 可选, 默认: `1.0`): 音量，范围从 `0.0` 到 `1.0`。
    *   `background` (布尔值, 可选, 默认: `false`): 如果为 `true`，则将此音频指定为背景音乐。

**`notification`**: 在屏幕上显示一个非侵入性的消息。
*   **`notification.create`**: 创建或更新一个通知。
    *   **语法**:
        ```
        notification.create id: "<id>" label: "<text>" [options...]
          [commands
            <command_block>]
          [timerCommands
            <command_block>]
        ```
    *   **参数**:
        *   `id` (字符串, 必需): 唯一标识符。使用现有 ID 将更新该通知。
        *   `label` (字符串, 必需): 通知文本。支持 `<eval>` 和 **HTML**。
        *   `duration` (字符串/数字, 可选): 如果设置，通知将在此持续时间后消失。如果省略，它将是永久的，直到被移除。
        *   `button` (字符串, 可选, 默认: `""`): 通知上可选按钮的文本。
        *   `commands` (块, 可选): 点击 `button` 时要执行的命令块。
        *   `timerCommands` (块, 可选): 当 `duration` 过期时要执行的命令块。
*   **`notification.remove`**: 移除一个通知。
    *   **语法**: `notification.remove "<id>"` (强制使用简写)
    *   **参数**:
        *   `id` (字符串, 必需, 简写): 要移除的通知的 ID。

**`timer`**: 创建一个基于时间的事件。
*   **操作模式 (关键)**:
    *   **同步 (阻塞)**: `timer duration: ...` (没有命令块)。脚本执行将**暂停**直到计时器完成。
    *   **异步 (非阻塞)**: `timer duration: ...` (带有命令块)。计时器在后台启动，脚本执行**立即**继续。
*   **语法**:
    ```
    # 同步
    timer duration: <duration> [options...]

    # 异步
    timer duration: <duration> [options...]
      <commands>
    ```
*   **参数**:
    *   `duration` (字符串/数字, 必需): 计时器持续时间 (例如: `"10s"`, `10000`)。
    *   `id` (字符串, 可选, 默认: 自动生成): 用于稍后移除的唯一 ID。
    *   `loops` (数字, 可选, 默认: `1`): 重复次数。`0` 表示无限。
    *   `style` (字符串, 可选): 计时器在屏幕上的视觉样式。可选值: `bar`, `text`。
    *   `paused` (布尔值, 可选, 默认: `false`): 如果为 `true`，则以暂停状态启动。
    *   `commands` (块, 可选): 计时器完成时要执行的命令块。**它的存在会激活异步模式。**
*   **`timer.remove`**:
    *   **语法**: `timer.remove id: "<id>"`
    *   **参数**:
        *   `id` (字符串, 必需): 要移除的计时器的 ID。

---

#### **3.2 逻辑与控制命令**

**`if` / `else if` / `else`**: 条件分支。
*   **语法**:
    ```
    if <condition_expression>
      <commands>
    else if <condition_expression>
      <commands>
    else
      <commands>
    ```
*   **注意**: 条件必须是有效的 JavaScript 表达式 (通常使用 `$` 前缀，但不是严格要求)。

**`goto`**: 将控制权转移到另一个页面。
*   **语法**: `goto <pageId>` (强制使用简写)
*   **参数**:
    *   `pageId` (字符串, 必需, 简写): 目标页面的 ID。支持 `$` 表达式。

**`eval`**: 执行任意 JavaScript 代码。
*   **语法**:
    ```    # 单行
    eval code: "<js_code_string>"

    # 多行块
    eval
      var x = 1;
      storage.set('myVar', x);
    ```
*   **参数**:
    *   `code` (字符串, 必需): 要执行的单行 JS 代码。
*   **警告**: `eval` 内部的所有代码**必须**遵守 **ES5 语法** (`var`, `function() {}` 等)。

**`storage`**: 管理持久化的键值对数据。
*   **`storage.set`**:
    *   **语法**: `storage.set key: "<key>" value: <value>`
*   **`storage.remove`**:
    *   **语法**: `storage.remove "<key>"` (强制使用简写)
*   **`storage.clear`**:
    *   **语法**: `storage.clear`

**`enable` / `disable`**: 控制一个页面是否可以通过 `goto` 访问。
*   **语法**: `enable "<pageId>"` / `disable "<pageId>"` (强制使用简写)
*   **参数**:
    *   `pageId` (字符串, 必需, 简写): 目标页面的 ID。

**`noop`**: 无操作。一个什么都不做的占位符命令。
*   **语法**: `noop`

---

### **4. 高级概念与模式**

#### **4.1 通过 `eval` 控制音频**

像 `audio.pause` 或 `audio.stop` 这样的直接命令是**不存在的**。所有在音频开始播放后的控制都**必须**使用 `eval` 来访问全局的 `Sound` 对象。

*   **访问声音**: `Sound.get('<id>')`，其中 `<id>` 是你在 `audio.play` 中提供的 ID。
*   **可用方法**:
    *   `.play()`: 恢复一个暂停的声音。
    *   `.pause()`: 暂停声音。
    *   `.stop()`: 停止声音并将其位置重置到开头。
*   **示例**:
    ```
    > level_1
      audio.play "music.mp3" id: "bgm" loops: 0
    
    > game_over
      eval code: "Sound.get('bgm').stop()"
    ```

#### **4.2 模式: 实现状态栏**

一个持久的屏幕状态栏（用于显示生命值、金币等）是使用一个永久性的通知来创建的。

*   **机制**:
    1.  **创建**: 使用 `notification.create` 并指定一个固定的 `id` (例如: `"statusBar"`)。
    2.  **使其永久**: **不要**提供 `duration` 参数。
    3.  **显示数据**: 在 `label` 中使用 `<eval>` 标签来显示 `storage` 中的变量。可以使用 HTML 进行样式设置。
    4.  **更新**: 要刷新状态栏，只需使用**完全相同的 `id`** 和更新后的 `label` 文本再次调用 `notification.create`。

*   **示例**:
    ```
    > start
      # 初始化属性并首次创建状态栏
      storage.set key: "hp" value: 100
      storage.set key: "gold" value: 50
      notification.create id: "statusBar" label: "❤️ HP: <eval>storage.get('hp')</eval> | 💰 Gold: <eval>storage.get('gold')</eval>"
      goto fight
    ---
    > take_damage
      # 修改一个值
      eval code: "storage.set('hp', storage.get('hp') - 10)"
      # 通过使用相同的 ID 重新创建来更新状态栏
      notification.create id: "statusBar" label: "❤️ HP: <eval>storage.get('hp')</eval> | 💰 Gold: <eval>storage.get('gold')</eval>"
      say "你受到了 10 点伤害！"
    ---
    ```
####    **4.3 HTML 支持:**
*   所有 HTML 都使用 DOMPurify 进行净化以确保安全。
*   **支持的标签**: `<font>`, `<b>`, `<i>`, `<u>`, `<span>`, `<br>`, `<strong>`, `<em>`, `<mark>`, `<small>`, `<del>`, `<sub>`, `<sup>`, `<p>`, `<div>`, `<h1>`-`<h6>`, `<ul>`, `<ol>`, `<li>`, `<table>`, `<tr>`, `<td>`, `<th>`
*   **内联样式**: 支持 `style` 属性 (例如: `<span style="color: red;">`)
*   **禁用的标签**: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, 以及其他有潜在危险的标签。
*   **链接限制**: 允许 `<a href="...">`，但 `href` 必须指向允许的域名。