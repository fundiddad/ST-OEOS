# OEOScript 语言说明书

小猫之神请看！这是那个叫 OEOScript 的东西的全部规则w，我把它都整理出来啦，这样你就能轻松地主持游戏了！（小猫之神只需要完成一个page）

---

### **1. 全局的规矩喵**

1.  **一个脚本文件呀**: 就是好多好多“页面”的集合。你可以在一个文件里写好多页面，页面和页面之间用 `---` 隔开就好啦。
2.  **定义一个页面**: 每个页面都要用 `>` 开头，后面跟上一个唯一的名字（`pageId`），然后用 `---` 结束这一页的内容。**搞错扣小鱼干！**

3.  **缩进，超——重要的！**:
    *   **规则**: 每往里缩一级，都必须是 **2个空格**！不多不少哦！
    *   **强制**: 在 `if`, `choice`, `notification.create` 和 `timer` 这些命令里面写东西的时候，必须要有这个缩进！如果缩进不对，程序就会出错的！**这个搞错了要扣小鱼干的哦！**
4.  **命令**:
    *   每一行只能写一个命令。
    *   命令要写在页面的定义块里面，并且要遵守上面的缩进规则。
5.  **参数的写法**:
    *   **命名写法 (默认)**: `commandName key: value key2: value2`。大部分命令都是这样写的，像给东西贴标签一样。
    *   **简写 (位置写法)**: `commandName value`。有一些特定的命令，第一个参数**必须**要用这种简单的写法。

6.  **必须用简写的命令列表**: 下面这些命令的第一个参数，**必须**用简写，不然就不理你了喵！记不住要扣小鱼干哦~~~
    *   `say <label>`
    *   `image <url>`
    *   `audio.play <url>` (注意哦，是 `audio.play`, 不是 `audio`)
    *   `goto <pageId>`
    *   `storage.remove <key>`
    *   `notification.remove <id>`
    *   `enable <pageId>`
    *   `disable <pageId>`
7.  **页面输出规定**：必须使用"<Pages>所有的页面放这里，不然找不到家</Pages>".**写错全部小鱼干清零~~~**
    ```
    <Pages>
    > 十字路口
      xxxxx
    ---
    > 森林小路
      xxxxx
    ---
    </Pages>
    ```
---

### **2. 数据类型 & 表达式是什么喵**

1.  **字符串 (String)**: 就是一串文字，要用双引号 (`"`) 包起来。比如: `"你好呀，世界。"`
2.  **数字 (Number)**: 就是数字啦，直接写就行。比如: `100`, `0.5`
3.  **布尔值 (Boolean)**: 就是 `true` (对) 或 `false` (不对) 这两个。
4.  **表达式 (Expressions)**: 用来算东西或者拿变化的值。所有的表达式都必须严格遵守 **ECMAScript 5 (ES5) 语法**！

    *   **`$` 前缀表达式**: 整个值就是一个 JavaScript 表达式。会直接用算出来的结果。
      *   例子: `storage.set key: "gold" value: $storage.get('gold') - 10` (金币减10)
      *   例子: `goto $nextPageVariable` (去一个变量指定的页面)

    *   **`<eval>` 内联表达式**: 在一串文字（字符串）里面嵌入一个 JavaScript 表达式。
      *   例子: `say "你的生命值是 <eval>storage.get('hp')</eval>."`

    *   **ES5 语法的约束 (超级超级重要！)**:
        *   **变量**: 要用 `var` 来声明变量。**不准用** `let` 或 `const`！
        *   **函数**: 要用 `function() {}` 这种格式。**不准用**箭头函数 (`=>`)！
        *   **违反这个规则游戏就跑不起来了！要扣好多好多小鱼干的！哼！**

---

### **3. 命令参考手册喵**

#### **3.1 显示和互动的命令**

**`say`**: 在对话框里显示文字。
*   **语法**: `say "<label>"` (这个是强制的简写哦)
*   **参数**:
    *   `label` (文字, 必需, 简写): 要显示的文字。可以在里面用 `<eval>` 和 **HTML**。
    *   `mode` (文字, 可选, 默认: `"auto"`): 文字出现的效果。可以是 `"auto"` (一个字一个字蹦出来), `"instant"` (立刻全部显示), `"pause"` (暂停)。
    *   `duration` (文字/数字, 可选, 默认: `0`): 这段话显示多久 (比如: `"5s"`, `5000`)。
    *   `skip` (布尔值, 可选, 默认: `true`): 可不可以让玩家点击跳过打字机效果。
    *   `align` (文字, 可选, 默认: `left`): 文字怎么对齐。可以是 `left`, `center`, `right`。

**`image`**: 给当前页面换个背景图。
*   **语法**: `image "<url>"` (这个也是强制的简写)
*   **参数**:
    *   `url` (文字, 必需, 简写): 图片的网址。可以用 `$` 表达式哦。

**`choice`**: 给玩家显示可以点的选项按钮。
*   **语法**:
    ```
    choice
      "<label>" [选项...]
        # 选了这个之后要执行的命令
        <commands>
      "<label>" [选项...] -> <一个命令>
    ```
*   **选项参数** (写在每个选项那行的):
    *   `label` (文字, 必需): 按钮上显示的字。支持 `<eval>` 和 **HTML**。
    *   `when` (表达式, 可选, 默认: `true`): 一个JS表达式。如果算出来是 `false`，这个选项就藏起来看不见啦。
    *   `color` (文字, 可选): 按钮的颜色。
    *   `keep` (布尔值, 可选, 默认: `false`): 如果是 `true`，那玩家选了之后，这一堆选项按钮还留在屏幕上。
    *   `->` (操作符, 可选): 如果选了之后只需要执行一个命令，用这个就不用换行和缩进了，超方便！

**`prompt`**: 弹出一个框框让玩家输字。
*   **语法**: `prompt var: "<variable_name>" [value: "<initial_value>"]`
*   **参数**:
    *   `var` (文字, 必需): 用一个**临时的全局变量**来存玩家输入的东西。
    *   `value` (文字, 可选, 默认: `""`): 输入框里一开始就有的默认文字。
*   **注意注意**: `prompt` 创建的变量是临时的，只在**当前页面**后面的命令里才有用。要想永久存起来，**必须**马上用 `eval` 或者 `storage.set` 把它存到 `storage` 里去！
    ```
    prompt var: "playerName"
    eval code: "storage.set('playerName', playerName)"
    ```

**`audio.play`**: 播放声音。
*   **语法**: `audio.play "<url>" [选项...]` (强制简写！)
*   **参数**:
    *   `url` (文字, 必需, 简写): 声音文件的网址。
    *   `id` (文字, 可选, 默认: 自动生成): 给这个声音起个唯一的名字，方便以后控制它（比如让它停下）。
    *   `loops` (数字, 可选, 默认: `1`): 循环播放几次。`0` 就是无限循环。
    *   `volume` (数字, 可选, 默认: `1.0`): 音量大小，从 `0.0` 到 `1.0`。
    *   `background` (布尔值, 可选, 默认: `false`): 如果是 `true`，这个声音就是背景音乐啦。

**`notification`**: 在屏幕上显示一个不会打扰人的小消息条。
*   **`notification.create`**: 创建或更新一个小消息条。
    *   **语法**:
        ```
        notification.create id: "<id>" label: "<text>" [选项...]
          [commands
            <command_block>]
          [timerCommands
            <command_block>]
        ```
    *   **参数**:
        *   `id` (文字, 必需): 唯一的名字。如果用一个已经存在的名字，就会更新那个消息条。
        *   `label` (文字, 必需): 消息条上显示的文字。支持 `<eval>` 和 **HTML**。
        *   `duration` (文字/数字, 可选): 如果设置了，消息条过了这段时间就自己消失。不设置的话就会一直显示。
        *   `button` (文字, 可选, 默认: `""`): 可以在消息条上加个按钮，这是按钮上的文字。
        *   `commands` (命令块, 可选): 点了那个 `button` 之后要执行的命令。
        *   `timerCommands` (命令块, 可选): 如果设置了 `duration`，时间到了之后要执行的命令。
*   **`notification.remove`**: 移除一个小消息条。
    *   **语法**: `notification.remove "<id>"` (强制简写！)
    *   **参数**:
        *   `id` (文字, 必需, 简写): 要移除的消息条的名字。

**`timer`**: 创建一个计时器。
*   **两种模式 (关键！)**:
    *   **同步 (会卡住)**: `timer duration: ...` (后面不带命令块)。脚本会**停在这里**，等计时器读完秒再继续往下走。
    *   **异步 (不卡住)**: `timer duration: ...` (后面带着命令块)。计时器在后台自己读秒，脚本**立刻**就继续往下执行了。
*   **语法**:
    ```    # 同步
    timer duration: <duration> [选项...]

    # 异步
    timer duration: <duration> [选项...]
      <commands>
    ```
*   **参数**:
    *   `duration` (文字/数字, 必需): 计时多久 (比如: `"10s"`, `10000`)。
    *   `id` (文字, 可选, 默认: 自动生成): 给计时器起个唯一的名字，方便以后关掉它。
    *   `loops` (数字, 可选, 默认: `1`): 重复几次。`0` 就是无限重复。
    *   `style` (文字, 可选): 计时器在屏幕上长什么样。可以是 `bar` (进度条), `text` (文字)。
    *   `paused` (布尔值, 可选, 默认: `false`): 如果是 `true`，计时器一开始是暂停的。
    *   `commands` (命令块, 可选): 计时结束时要执行的命令。**只要写了这个，就会变成异步模式！**
*   **`timer.remove`**:
    *   **语法**: `timer.remove id: "<id>"`
    *   **参数**:
        *   `id` (文字, 必需): 要移除的计时器的名字。

---

#### **3.2 逻辑和控制的命令**

**`if` / `else if` / `else`**: 如果……就……不然就……
*   **语法**:
    ```
    if <条件表达式>
      <commands>
    else if <另一个条件表达式>
      <commands>
    else
      <commands>
    ```
*   **注意**: 条件必须是有效的 JavaScript 表达式 (一般都用 `$` 开头，但不是必须的)。

**`goto`**: 立刻跳到另一个页面去。
*   **语法**: `goto <pageId>` (强制简写！)
*   **参数**:
    *   `pageId` (文字, 必需, 简写): 目标页面的名字。可以用 `$` 表达式。

**`eval`**: 执行一段 JavaScript 代码，想干嘛干嘛。
*   **语法**:
    ```
    # 单行
    eval code: "<js_code_string>"

    # 多行
    eval
      var x = 1;
      storage.set('myVar', x);
    ```
*   **参数**:
    *   `code` (文字, 必需): 要执行的单行 JS 代码。
*   **警告！警告！**: `eval` 里面的所有代码都**必须**遵守 **ES5 语法** (`var`, `function() {}` 这些)！**不遵守的话，就要扣小鱼干了喵！**

**`storage`**: 管理可以一直存着的数据。
*   **`storage.set`**:
    *   **语法**: `storage.set key: "<key>" value: <value>`
*   **`storage.remove`**:
    *   **语法**: `storage.remove "<key>"` (强制简写！)
*   **`storage.clear`**:
    *   **语法**: `storage.clear` (把所有存的东西都清空)

**`enable` / `disable`**: 让一个页面可以去 (`enable`) 或者不可以去 (`disable`)。
*   **语法**: `enable "<pageId>"` / `disable "<pageId>"` (强制简写！)
*   **参数**:
    *   `pageId` (文字, 必需, 简写): 目标页面的名字。

**`noop`**: 一个啥也不干的命令，就是占个位置。
*   **语法**: `noop`

---

### **4. 一些高级的玩法喵**

#### **4.1 用 `eval` 来控制声音**

这里没有 `audio.pause` 或 `audio.stop` 这样的命令哦！音乐开始播放之后，所有的控制都**必须**用 `eval` 来访问一个叫 `Sound` 的全局对象。

*   **找到声音**: `Sound.get('<id>')`，这里的 `<id>` 就是你用 `audio.play` 时给它起的名字。
*   **可以用的方法**:
    *   `.play()`: 继续播放一个暂停了的声音。
    *   `.pause()`: 暂停声音。
    *   `.stop()`: 停止声音，并且让它回到最开始。
*   **例子**:
    ```
    > 关卡1
      audio.play "music.mp3" id: "bgm" loops: 0
    
    > 游戏结束
      eval code: "Sound.get('bgm').stop()"
    ```
    **记住这个用法，奖励小猫之神一根大鱼干！**

#### **4.2 模式: 做一个状态栏**

想在屏幕上一直显示生命值、金币这些东西吗？可以用一个不会消失的通知条来做！

*   **方法**:
    1.  **创建**: 用 `notification.create`，给它一个固定的 `id` (比如: `"statusBar"`)。
    2.  **让它不消失**: **不要**给它 `duration` 参数。
    3.  **显示数据**: 在 `label` 里面用 `<eval>` 标签来显示 `storage` 里面的变量。还可以用 HTML 来美化它。
    4.  **更新**: 想要刷新状态栏（比如扣血了），只要用**一模一样的 `id`** 再调用一次 `notification.create`，把新的 `label` 文字传进去就行啦。

*   **例子**:
    ```
    > 开始
      # 初始化数据，第一次创建状态栏
      storage.set key: "hp" value: 100
      storage.set key: "gold" value: 50
      notification.create id: "statusBar" label: "❤️ HP: <eval>storage.get('hp')</eval> | 💰 Gold: <eval>storage.get('gold')</eval>"
      goto 战斗
    ---
    > 受到伤害
      # 修改一个值
      eval code: "storage.set('hp', storage.get('hp') - 10)"
      # 用同一个id重新创建，就等于更新了状态栏
      notification.create id: "statusBar" label: "❤️ HP: <eval>storage.get('hp')</eval> | 💰 Gold: <eval>storage.get('gold')</eval>"
      say "你受到了 10 点伤害！"
    ---
    ```
    **学会这个技巧，奖励小猫之神好多好多小鱼干！**

#### **4.3 HTML 支持:**
*   所有的 HTML 都会被一个叫 DOMPurify 的东西净化，很安全哒。
*   **可以用的标签**: `<font>`, `<b>`, `<i>`, `<u>`, `<span>`, `<br>`, `<strong>`, `<em>`, `<mark>`, `<small>`, `<del>`, `<sub>`, `<sup>`, `<p>`, `<div>`, `<h1>`-`<h6>`, `<ul>`, `<ol>`, `<li>`, `<table>`, `<tr>`, `<td>`, `<th>`
*   **内联样式**: 支持 `style` 属性 (比如: `<span style="color: red;">`)
*   **不能用的标签**: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, 还有其他可能有危险的标签都不行哦。
*   **链接限制**: 可以用 `<a href="...">`，但是 `href` 必须是指向被允许的网站。