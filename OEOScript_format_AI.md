# OEOScript Language Specification

This document provides a comprehensive and definitive reference for the OEOScript language, detailing all syntax, commands, parameters, and usage rules.

---

### **1. Global Syntax Rules**

1.  **File Structure**: A script is a collection of Pages. Multiple pages can be defined in a single script, separated by `---`.
2.  **Page Definition**: Each page begins with `>` followed by a unique `pageId` and ends with `---`.
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
 
3.  **Indentation**:
    *   **Rule**: Use exactly **2 spaces** for each level of indentation.
    *   **Prohibition**: Do NOT use Tab characters.
    *   **Mandatory**: Indentation is mandatory for defining command blocks within commands like `if`, `choice`, `notification.create`, and `timer`. Incorrect indentation will cause a parsing error.
4.  **Commands**:
    *   One command per line.
    *   Commands are indented within a page block.
5.  **Parameter Syntax**:
    *   **Named Syntax (Default)**: `commandName key: value key2: value2`. This is the standard for most commands.
    *   **Shorthand Syntax (Positional)**: `commandName value`. This syntax is **MANDATORY** for the first and primary parameter of specific commands.

6.  **Shorthand Syntax Command List**: The following commands **MUST** use the shorthand syntax for their first parameter.
    *   `say <label>`
    *   `image <url>`
    *   `audio.play <url>` (Note: The command is `audio.play`, not `audio`)
    *   `goto <pageId>`
    *   `storage.remove <key>`
    *   `notification.remove <id>`
    *   `enable <pageId>`
    *   `disable <pageId>`

---

### **2. Data Types & Expressions**

1.  **String**: Enclosed in double quotes (`"`). Example: `"Hello, world."`
2.  **Number**: Written directly. Example: `100`, `0.5`
3.  **Boolean**: Written directly as `true` or `false`.
4.  **Expressions**: Used for dynamic values. All expressions MUST adhere strictly to **ECMAScript 5 (ES5) syntax**.

    *   **`$` Prefix Expression**: The entire value is a JavaScript expression. The result of the expression is used.
      *   Example: `storage.set key: "gold" value: $storage.get('gold') - 10`
      *   Example: `goto $nextPageVariable`

    *   **`<eval>` Inline Expression**: Embeds a JavaScript expression within a string.
      *   Example: `say "Your HP is <eval>storage.get('hp')</eval>."`

    *   **ES5 Syntax Constraint (CRITICAL)**:
        *   **Variables**: Use `var`. **DO NOT USE** `let` or `const`.
        *   **Functions**: Use `function() {}`. **DO NOT USE** arrow functions (`=>`).
        *   Violation of this rule will cause script execution failure.

---

### **3. Command Reference**

#### **3.1 Display & Interaction Commands**

**`say`**: Displays text in the dialogue box.
*   **Syntax**: `say "<label>"` or `say label: "<label>" [options...]` (Shorthand is mandatory)
*   **Parameters**:
    *   `label` (String, Required, Shorthand): The text to display. Supports `<eval>` and **HTML** .
    *   `mode` (String, Optional, Default: `"auto"`): Typing effect. Values: `"auto"` (typewriter), `"instant"`, `"pause"`.
    *   `duration` (String/Number, Optional, Default: `0`): Duration to display the text (e.g., `"5s"`, `5000`).
    *   `skip` (Boolean, Optional, Default: `true`): Allows user to skip the typewriter effect.
    *   `align` (String, Optional, Default: `left`): Text alignment. Values: `left`, `center`, `right`.

**`image`**: Sets the background image for the current page.
*   **Syntax**: `image "<url>"` (Shorthand is mandatory)
*   **Parameters**:
    *   `url` (String, Required, Shorthand): The URL of the image. Supports `$` expressions.

**`choice`**: Presents clickable options to the user.
*   **Syntax**:
    ```
    choice
      "<label>" [options...]
        # command block for this choice
        <commands>
      "<label>" [options...] -> <single_command>
    ```
*   **Option Parameters** (Applied to each choice line):
    *   `label` (String, Required): The text on the button. Supports `<eval>` and **HTML**.
    *   `when` (Expression, Optional, Default: `true`): A JS expression. If `false`, the option is hidden.
    *   `color` (String, Optional): The color of the button.
    *   `keep` (Boolean, Optional, Default: `false`): If `true`, the choice menu remains after selection.
    *   `->` (Operator, Optional): A shortcut for a single command, avoiding the need for an indented block.

**`prompt`**: Displays an input field for user text entry.
*   **Syntax**: `prompt var: "<variable_name>" [value: "<initial_value>"]`
*   **Parameters**:
    *   `var` (String, Required): The name of a **temporary global variable** that will hold the user's input.
    *   `value` (String, Optional, Default: `""`): The default text in the input box.
*   **IMPORTANT**: The variable created by `prompt` is temporary and only exists for subsequent commands on the SAME page. To save the input permanently, you **must** immediately use `eval` or `storage.set` to copy it into the `storage` object.
    ```
    prompt var: "playerName"
    eval code: "storage.set('playerName', playerName)"
    ```

**`audio.play`**: Plays an audio file.
*   **Syntax**: `audio.play "<url>" [options...]` (Shorthand is mandatory)
*   **Parameters**:
    *   `url` (String, Required, Shorthand): URL of the audio file.
    *   `id` (String, Optional, Default: autogenerated): A unique ID to reference this sound later (e.g., for stopping it).
    *   `loops` (Number, Optional, Default: `1`): Number of times to loop. `0` means infinite looping.
    *   `volume` (Number, Optional, Default: `1.0`): Volume from `0.0` to `1.0`.
    *   `background` (Boolean, Optional, Default: `false`): If `true`, designates the audio as background music.

**`notification`**: Displays a non-intrusive message on the screen.
*   **`notification.create`**: Creates or updates a notification.
    *   **Syntax**:
        ```
        notification.create id: "<id>" label: "<text>" [options...]
          [commands
            <command_block>]
          [timerCommands
            <command_block>]
        ```
    *   **Parameters**:
        *   `id` (String, Required): Unique identifier. Using an existing ID will update the notification.
        *   `label` (String, Required): The notification text. Supports `<eval>` and **HTML**.
        *   `duration` (String/Number, Optional): If set, the notification disappears after this duration. If omitted, it is permanent until removed.
        *   `button` (String, Optional, Default: `""`): Text for an optional button on the notification.
        *   `commands` (Block, Optional): A block of commands to execute when the `button` is clicked.
        *   `timerCommands` (Block, Optional): A block of commands to execute when the `duration` expires.
*   **`notification.remove`**: Removes a notification.
    *   **Syntax**: `notification.remove "<id>"` (Shorthand is mandatory)
    *   **Parameters**:
        *   `id` (String, Required, Shorthand): The ID of the notification to remove.

**`timer`**: Creates a time-based event.
*   **Mode of Operation (CRITICAL)**:
    *   **Synchronous (Blocking)**: `timer duration: ...` (with NO command block). The script execution PAUSES until the timer finishes.
    *   **Asynchronous (Non-blocking)**: `timer duration: ...` (WITH a command block). The timer starts in the background, and script execution continues IMMEDIATELY.
*   **Syntax**:
    ```
    # Synchronous
    timer duration: <duration> [options...]

    # Asynchronous
    timer duration: <duration> [options...]
      <commands>
    ```
*   **Parameters**:
    *   `duration` (String/Number, Required): The timer duration (e.g., `"10s"`, `10000`).
    *   `id` (String, Optional, Default: autogenerated): Unique ID for later removal.
    *   `loops` (Number, Optional, Default: `1`): Number of repetitions. `0` for infinite.
    *   `style` (String, Optional): Visual style for the timer on-screen. Values: `bar`, `text`.
    *   `paused` (Boolean, Optional, Default: `false`): If `true`, starts in a paused state.
    *   `commands` (Block, Optional): A block of commands to execute when the timer finishes. **Its presence activates asynchronous mode.**
*   **`timer.remove`**:
    *   **Syntax**: `timer.remove id: "<id>"`
    *   **Parameters**:
        *   `id` (String, Required): The ID of the timer to remove.

---

#### **3.2 Logic & Control Commands**

**`if` / `else if` / `else`**: Conditional branching.
*   **Syntax**:
    ```
    if <condition_expression>
      <commands>
    else if <condition_expression>
      <commands>
    else
      <commands>
    ```
*   **Note**: The condition must be a valid JavaScript expression (often using the `$` prefix, though not strictly required).

**`goto`**: Transfers control to another page.
*   **Syntax**: `goto <pageId>` (Shorthand is mandatory)
*   **Parameters**:
    *   `pageId` (String, Required, Shorthand): The ID of the target page. Supports `$` expressions.

**`eval`**: Executes arbitrary JavaScript code.
*   **Syntax**:
    ```
    # Single-line
    eval code: "<js_code_string>"

    # Multi-line block
    eval
      var x = 1;
      storage.set('myVar', x);
    ```
*   **Parameters**:
    *   `code` (String, Required): The single-line JS code to execute.
*   **WARNING**: All code inside `eval` **MUST** adhere to **ES5 syntax** (`var`, `function() {}`, etc.).

**`storage`**: Manages persistent key-value data.
*   **`storage.set`**:
    *   **Syntax**: `storage.set key: "<key>" value: <value>`
*   **`storage.remove`**:
    *   **Syntax**: `storage.remove "<key>"` (Shorthand is mandatory)
*   **`storage.clear`**:
    *   **Syntax**: `storage.clear`

**`enable` / `disable`**: Controls if a page can be accessed via `goto`.
*   **Syntax**: `enable "<pageId>"` / `disable "<pageId>"` (Shorthand is mandatory)
*   **Parameters**:
    *   `pageId` (String, Required, Shorthand): The ID of the target page.

**`noop`**: No operation. A placeholder command that does nothing.
*   **Syntax**: `noop`

---

### **4. Advanced Concepts & Patterns**

#### **4.1 Controlling Audio via `eval`**

Direct commands like `audio.pause` or `audio.stop` **do not exist**. All audio control after playback has started MUST be done using `eval` to access the global `Sound` object.

*   **Accessing a Sound**: `Sound.get('<id>')` where `<id>` is the ID you provided in `audio.play`.
*   **Available Methods**:
    *   `.play()`: Resumes a paused sound.
    *   `.pause()`: Pauses the sound.
    *   `.stop()`: Stops the sound and resets its position to the beginning.
*   **Example**:
    ```
    > level_1
      audio.play "music.mp3" id: "bgm" loops: 0
    
    > game_over
      eval code: "Sound.get('bgm').stop()"
    ```

#### **4.2 PATTERN: Implementing a Status Bar**

A persistent on-screen status bar (for HP, Gold, etc.) is created using a permanent notification.

*   **Mechanism**:
    1.  **Create**: Use `notification.create` with a fixed `id` (e.g., `"statusBar"`).
    2.  **Make Permanent**: **Do NOT** provide the `duration` parameter.
    3.  **Display Data**: Use `<eval>` tags in the `label` to show variables from `storage`. HTML can be used for styling.
    4.  **Update**: To refresh the status bar, simply call `notification.create` again with the **exact same `id`** and the updated `label` text.

*   **Example**:
    ```
    > start
      # Initialize stats and create the status bar for the first time
      storage.set key: "hp" value: 100
      storage.set key: "gold" value: 50
      notification.create id: "statusBar" label: "❤️ HP: <eval>storage.get('hp')</eval> | 💰 Gold: <eval>storage.get('gold')</eval>"
      goto fight
    ---
    > take_damage
      # Modify a value
      eval code: "storage.set('hp', storage.get('hp') - 10)"
      # Update the status bar by re-creating it with the same ID
      notification.create id: "statusBar" label: "❤️ HP: <eval>storage.get('hp')</eval> | 💰 Gold: <eval>storage.get('gold')</eval>"
      say "You took 10 damage!"
    ---
    ```
####    **4.3 HTML Support:**
*   All HTML is sanitized using DOMPurify for security
*   **Supported tags**: `<font>`, `<b>`, `<i>`, `<u>`, `<span>`, `<br>`, `<strong>`, `<em>`, `<mark>`, `<small>`, `<del>`, `<sub>`, `<sup>`, `<p>`, `<div>`, `<h1>`-`<h6>`, `<ul>`, `<ol>`, `<li>`, `<table>`, `<tr>`, `<td>`, `<th>`
*   **Inline styles**: The `style` attribute is supported (e.g., `<span style="color: red;">`)
*   **Blocked tags**: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, and other potentially dangerous tags
*   **Link restrictions**: `<a href="...">` is allowed, but `href` must point to allowed domains