# open-eos

See the [Wiki](https://github.com/fapnip/openeos/wiki) for more details.

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
Follow instructions in `.env.development` to configure proxy for local development.
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

## Open EOS Player 概览（中文）

### 项目简介
- 这是一个基于 Vue 2 + Vuetify 的 EOS Tease 播放器（Open EOS Player）。
- 从 Milovana 获取 EOS 脚本（或本地 JSON），在前端“沙箱 JS 解释器”中执行，并将页面命令（say/choice/prompt/timer/audio/video/notification…）渲染为 UI 与多媒体交互。

### 工作原理与流程
1. 启动
   - `src/main.js` 初始化 Vue、Vuetify、插件（滚动/尺寸/键盘），挂载根组件 `App`。
2. 获取脚本
   - `src/App.vue` 提供输入 Milovana Tease URL 或上传 JSON 的 UI。
   - 通过 CORS 代理请求 `geteosscript.php` 获取脚本，抓取 `showtease.php` 解析标题/作者等元数据。
3. 初始化播放器
   - `src/components/OpenEosPlayer.vue` 初始化 JS 解释器并安装模块（Console、定时器、DOM 代理、页面管理、叠加、图片/文件/计时器/气泡/声音/视频/存储等）。
   - 预编译起始页、预加载页面脚本与媒体。
4. 预编译页面脚本
   - `src/util/pageCompiler.js` 将 EOS 页面的命令数组编译为可在解释器运行的 JS（调用 `new Say(...)`、`pages.goto(...)` 等），并抽取 `<eval>` 表达式与动态样式，记录该页图片/音频/视频/目标页。
5. 开始运行
   - 用户点击“开始”后，加载视频元素池、加载全局 JS include、执行 `init` 脚本、显示 `start` 页面。
   - `PageManager.showPage()` 处理 preload，等待图片/音频/视频就绪后将页代码 append 到解释器并执行。
6. 命令与 UI
   - `say/choice/prompt` 命令渲染到气泡列表；`timer` 渲染右侧计时器或通知条；`audio.play` 使用 Howler；`video.play` 使用 HTML5 video + 预置视频元素池；`goto/end` 控制页面与结束对话框；`teaseStorage` 提供简单 K/V 存取（与 `App.vue` 的加密导入/导出配合）。

### 目录与文件职责（要点）
- 启动与配置
  - `src/main.js`: 应用入口
  - `src/plugins/vuetify.js`: 主题与图标
  - `vue.config.js`: Webpack 配置（acorn 提供、raw-loader、worker、CSS 内联）
  - `public/index.html`: 根 HTML（字体、加载资源）
- 根组件
  - `src/App.vue`: 拉取/解析脚本与元数据、导入/导出存储、顶栏与表单
- 播放器（核心）
  - `src/components/OpenEosPlayer.vue`: 主显示区（图片/视频/叠加/气泡/计时器/通知）、解释器初始化、预编译/预加载与运行
- 解释器与编译
  - `src/interpreter/interpreter.js`: JS-Interpreter 内核
  - `src/interpreter/acorn.js`: 解释器用 JS 解析器
  - `src/interpreter/index.js`: 扩展 `run()` 并导出解释器
  - `src/util/pageCompiler.js` + `src/interpreter/code/pageCompilerUtil.js`: 将 EOS 命令编译为解释器可执行 JS
- 工具
  - `src/util/io.js`: CORS 代理封装、Milovana 媒体 URL 构建、下载工具
  - `src/util/index.js`: `parseEosDuration` 等实用函数
  - `src/util/media.js`: `BLANK_VIDEO_SRC`（视频元素池预授权）
  - `src/util/TreeMap.js`: 支持 `floorEntry` 的有序 Map（音频时间点回调）
- UI 组件
  - `src/components/bubbles/*.vue`: `SayBubble`/`ChoiceBubble`/`PromptBubble`
  - `src/components/sidebar/*.vue`: `CountdownTimer` 计时器、`NotificationItem` 通知
  - `src/components/common/*.vue`: `Loading`、`VueSwitch`、`OverlayItem`
- 解释器模块（Mixins）
  - `Script`/`PageManager`/`Preload`/`Bubbles`
  - 交互：`Say`/`Choice`/`Prompt`/`Timer`/`Notification`
  - 媒体：`Sound`（Howler）/`Video`（HTML5 video + RedGifs 解析）/`Image`
  - 其他：`Overlay`/`Background`（node-vibrant）/`Storage`/`Locator`（locator 解析与白名单）/`Console`/`NativeTimers`
  - DOM 沙箱：`mixins/dom/*` 将真实 DOM 安全映射到解释器世界（限制创建元素、事件分发、样式注入）

### 关键特性与注意事项
- CORS 代理必需：本地开发请在 `.env.development` 配置以下变量（示例）
  - `VUE_APP_CORS_PROXY`: 你的代理地址（例如 Cloudflare Worker/Node 中转）
  - `VUE_APP_CORS_PROXY_ENCODE`: `true`/`false`（是否整体 URL 编码）
  - `VUE_APP_CORS_PROXY_HEADERS`: JSON 字符串（额外请求头）
  - `VUE_APP_CORS_PROXY_QUERY_SEPARATOR`: 若代理要求，定义拼接分隔符
- 安全：解释器沙箱 + DOM 代理 + HTML/CSS sanitize，阻止危险标签（script/iframe/link 等）。
- 性能：页面脚本缓存、媒体预加载、视频元素池、声音/视频预加载池复用。
- 兼容性：NYX 脚本与 Classic teases 不支持；RedGifs 解析通过 API v2 兜底。

### 快速开始（中文）
- 安装依赖：
  ```bash
  npm install
  ```
- 配置开发代理：在项目根创建 `.env.development` 并设置 CORS 相关变量。
- 开发启动：
  ```bash
  npm run serve
  ```
- 生产构建：
  ```bash
  npm run build
  ```

### 使用公共 OEOS 播放器（来自 Wiki）
- 直接播放你的 Milovana Eos 作品：将原始链接中的 `milovana.com/webteases/showtease.php` 替换为 `oeos.art`。
  - 例如：`https://oeos.art/?id=[tease id]&key=[tease key]`
- 注意：Milovana Eos 编辑器中的预览无法用于 OpenEOS。

### 在 Milovana 使用 Eos 编辑器与扩展
- Eos 编辑器地址：[`https://milovana.com/eos/editor`](https://milovana.com/eos/editor)
- 初学教程：[`EOS tutorials`](https://milovana.com/forum/viewtopic.php?p=274834)
- 推荐安装 OpenEOS Editor Extensions（用户脚本，便于 GIF/视频链接、点击取点、生成预览链接等）：
  1) 使用 Chrome/Edge；2) 安装 Violentmonkey；3) 安装用户脚本：[`OpenEOS Editor Extensions`](https://openuserjs.org/scripts/fapnip/OpenEOS_Editor_Extensions)

### 入门建议（来自 Wiki）
1) 确保可访问 Eos 编辑器，并安装上面的编辑器扩展。
2) 在 Eos 编辑器中导入一个现有 OEOS Demo 并尝试修改。
3) 参考以下示例：
   - 使用 GIF（或 WEBP）：见下文“进阶主题 / 在 Image Action 中使用 GIF/WEBP”。
   - 捕获图片点击事件：见下文“进阶主题 / 捕获图片点击”。
   - Image Overlays：见下文“进阶主题 / Image Overlays”。
   - 自定义样式（CSS）与全局脚本（JS include）。
4) 阅读 Wiki 目录中你感兴趣的主题。
5) 遇到问题可到 Discord 或 Milovana 论坛求助。

## 基于 Wiki 的 API 速览

### PageManager（核心页面管理）
- 常用方法（更多详见 `openeos.wiki/Page-Manager.md`）：
  - `pages.list()`：返回全部页面 id
  - `pages.getCurrentPageId()`：当前页 id
  - `pages.enable(pageId)` / `pages.disable(pageId)`：启用/禁用页
  - `pages.clearBubbles([keep])`：清除气泡（保留尾部 keep 个）
  - `pages.setImage(locator, [onLoad], [onError])`：设置主图（支持 file:/gallery:/远程 URL/数组）
  - `pages.addOnNextPageChange(fn)` / `pages.addOnNextImage(fn)`：注册一次性钩子
  - `pages.preload(target)` / `pages.preloadImage(locator, ...)`：预加载页/图片
  - `pages.cssVar(name, [value])`：设置布局 CSS 变量（气泡区域、通知区域）
  - `pages.barColor(color)` / `pages.bgLockColor(color|falsy)` / `pages.bgColor(color)`：导航栏/背景色
  - `pages.goto(target)` / `pages.end()` / `pages.setEndDialogTitle(title)`
  - 事件：`change`、`visibilitychange`、`click`、`image-click`、`image-load`、`image-error`

### Say（文本气泡）
- 选项：`label`(HTML)、`mode`(instant|pause|autoplay)、`duration`、`allowSkip`、`color`、`align`、`onContinue`、`ready`
- 示例：
  ```js
  new Say({
    label: '<p>Do you like ducks?</p>',
    mode: 'autoplay',
    color: '#222',
    onContinue: function() {
      new Choice({ options: [
        { label: 'Yes!', onSelect: function(){ pages.goto('likes-ducks') } },
        { label: 'No!',  onSelect: function(){ pages.goto('hates-ducks') } },
      ]})
    }
  })
  ```

### Choice（选项气泡）与 Option
- 选项：`options`(数组)、`onComplete`、`onContinue`
- Option 字段：`label`、`onSelect`、`visible`(默认 true)、`keep`(默认 false)、`color`
- 获取/操作：`get(index)`、`active([bool])`、`cancel()`；Option：`label()`、`visible()`、`keep()`、`color()`、`index()`、`parent()`

### Prompt（输入气泡）
- 选项：`onInput(value)`（必填）
- 示例：
  ```js
  new Say({ label: "<p>What's your name?</p>" })
  new Prompt({ onInput: function(value){ new Say({ label: '<p>Hi ' + value + '!</p>' }) } })
  ```

### Notification（右下通知）
- 选项：`id`、`title`、`timerDuration`、`onTimeout`、`buttonLabel`、`onClick`、`ready`
- 构造方法：`Notification.getAll()`、`Notification.get(id)`；实例：`remove()`、`getId()`、`setButtonLabel()`、`setTitle()`、`getElement()`

### Timer（右侧计时器）
- 选项：`duration`(ms/1s/1m...)、`style`(normal|secret|hidden)、`onTimeout`、`onContinue`、`loops`、`paused`
- 构造方法：`Timer.getAll()`、`Timer.get(id)`；实例：`stop()`、`pause()`、`play()`、`getPaused()`、`getId()`、`getRemaining()`、`getLoops()`、`getLoop()`
- 在 EOS 异步计时器中实现循环：在异步动作首个 EVAL 添加注释 `// oeos-timer-loops-3`（3 次）或 `// oeos-timer-loops-0`（永远）或 `// oeos-timer-loops-<eval>expr</eval>`。

### Sound（声音）
- 注意：除非已预加载，否则任何 `new Sound({...})` 必须紧随用户交互（点击/暂停 say 后等），否则会被浏览器拦截。
- 选项：`id`、`locator`(file:/gallery:/远程/数组)、`loops`(0=无限)、`volume(0..1)`、`preload(true|fn)`
- 构造/实例：`Sound.get(id)`；`destroy()`、`stop()`、`pause()`、`play()`、`setDoAt(seconds, fn)`、`clearDoAt()`

### Video（视频）
- 注意：与声音相同的“必须紧随交互”规则；隐藏原生控件，脚本负责 play/pause/seek/volume。
- 选项：`id`、`locator`(支持 `https://thumbs*.redgifs.com/...`)、`loops`、`volume(0..1)`、`onContinue`、`preload(true|fn)`
- 构造/实例：`Video.get(id)`；`destroy()`、`stop()`、`pause()`、`play()`、`seek()`、`getElement()`

### 原生计时器（解释器内可用）
- 支持：`setTimeout` / `clearTimeout`、`setInterval` / `clearInterval`、`requestAnimationFrame` / `cancelAnimationFrame`

### FileManager
- 方法：`FileManager.files()`、`FileManager.file(name)`、`FileManager.galleries()`、`FileManager.gallery(id)`

## 进阶主题（来自 Wiki）

### 在 Image Action 中使用 GIF/WEBP（imgbb 链接）
- Eos 仅支持上传 JPEG/MP3。若要用 GIF/WEBP，需要：
  1) 先在 Files 区域上传 `placeholder.jpg`；2) 在 Image Action 选择该占位图；3) 将 imgbb 直链 URL 进行 URL 编码；
  4) 将其拼接到定位符：
  ```
  file:placeholder.jpg+(|oeos:ENCODED_URL)
  ```
  - 也可使用 URL 编码的 JSON 数组，OEOS 将随机选图。

### 在 Audio Action 中“黑科技”使用视频（redgifs/gfycat）
- 方法同上：先选占位 mp3，再把视频直链 URL 进行 URL 编码，拼接到定位符：
  ```
  file:placeholder.mp3+(|oeos-video:ENCODED_URL_OR_JSON_ARRAY)
  ```
  - 或者在脚本中直接 `new Video({ locator: 'https://thumbs.redgifs.com/....mp4' })`。

### 捕获图片点击（image-click 事件）
```js
;(function(){
  function onImgClick(e){
    e.stopImmediatePropagation()
    var x=e.value.x, y=e.value.y
    if(x<0.5){ pages.goto(y<0.5?'option-upper-left':'option-lower-left') }
    else     { pages.goto(y<0.5?'option-upper-right':'option-lower-right') }
  }
  pages.addEventListener('image-click', onImgClick)
  pages.addOnNextPageChange(function(){ pages.removeEventListener('image-click', onImgClick) })
})()
```

### Image Overlays（在主图/页面上叠加元素）
```js
(function(){
  var overlay = new Overlay({ type:'image', ready:function(el){
    var dot=document.createElement('div'); dot.style.cssText='background:red;border-radius:100%;width:50px;height:50px;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:auto;'
    dot.onclick=function(e){ new Say({label:'Hey!',type:'instant'}); e.preventDefault(); overlay.remove() }
    el.appendChild(dot)
  }})
  pages.addOnNextImage(function(){ overlay.remove() })
})()
```

### 自定义样式（CSS Stylesheet Include）
```js
/*--oeos-stylesheet
.myClass{ background-color: blue; }
*/
```
- 将以上内容放到任一 EVAL 或 init 脚本，开头必须为 `/*--oeos-stylesheet`，结尾 `*/`，且内部不得再含 `/*` 或 `*/`。

### 全局脚本（JS Include）
```js
//--oeos-js-include
var myGlobalFunction=function(){ console.log('included on tease start') }
```
- 标记后会在 tease 启动时（在 Init Script 之前）执行一次；仅执行一次。

## 示例与演示（来自 Wiki）
- Demos：
  - Original Open EOS Player Demo（NSFW）: [`oeos.art`](https://oeos.art/?id=47874&key=b74c174e2a) · 脚本：[Milovana geteosscript](https://milovana.com/webteases/geteosscript.php?id=47874&key=b74c174e2a)
  - Dynamic Censor Demo（NSFW）: [`oeos.art`](https://oeos.art/?id=48073&key=e893ae8fa5) · 脚本：同上
  - Image Overlay Demo（NSFW）: [`oeos.art`](https://oeos.art/?id=51107&key=42062fd86c)
  - Simple Video Demo（NSFW）: [`oeos.art`](https://oeos.art/?id=48123&key=20dd72a23f)
  - Audio Sync Demo（NSFW）: [`oeos.art`](https://oeos.art/?id=48143)
- 完整游戏：
  - The Fortune Teller（NSFW）: [`oeos.art`](https://oeos.art/?id=51036)

## 参考与更多
- 更详细的参数、方法与示例，请查看仓库内 `openeos.wiki/` 目录中的对应文档（本 README 已提炼其要点）。


