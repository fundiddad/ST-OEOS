<template>
  <v-app class="oeos-app-container">
    <v-main ref="mainPlayer">
      <!-- 角色选择界面 -->
      <character-selector
        v-if="showCharacterSelector"
        @character-selected="onCharacterSelected"
      />

      <!-- 游戏播放器 -->
      <open-eos-player
        v-else-if="script"
        :script="script"
        :title="title"
        :author="author"
        :author-id="authorId"
        :tease-id="teaseId"
        :tease-key="teaseKey"
        :is-fullscreen="this.isFullscreen"
        :tease-storage="teaseStorage"
        :debug-enabled="debugEnabled"
        :tease-url="teaseUrl"
        :debug-prompt="debugPrompt"
        :allow-no-sleep="allowNoSleep"
        :preview-mode="previewMode"
        :is-debug="previewMode > 0"
        @page-change="pageChange"
        @save-storage="didStorageSave"
        @load-storage="didStorageLoad"
        @tease-start="didTeaseStart"
        @tease-end="didTeaseEnd"
        @set-external-link="setExternalLink"
        @debugprompt="
          v => {
            debugPrompt = v
          }
        "
      />

      <!-- 加载中 -->
      <v-container v-else>
        <loading>Initializing AI Adventure...</loading>
      </v-container>
    </v-main>
    <v-dialog v-model="message.show" max-width="290">
      <v-card>
        <v-card-title class="headline">
          {{ message.title }}
        </v-card-title>

        <v-card-text>
          <div v-html="message.html"></div>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>

          <v-btn
            v-if="message.onCancel"
            color="green darken-1"
            text
            @click="
              message.onCancel()
              closeMessage()
            "
          >
            Nope
          </v-btn>
          <v-btn
            color="green darken-1"
            text
            @click="
              message.onContinue()
              closeMessage()
            "
          >
            Okay
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <input type="file" ref="teaseStorageLoader" style="display:none" />
  </v-app>
</template>

<script>
import OpenEosPlayer from './components/OpenEosPlayer'
import Loading from './components/common/Loading'
import CharacterSelector from './components/CharacterSelector'
import { version } from '../package.json'
import prettysize from 'prettysize'
import OEOSV4Parser from './util/v4-parser.js'


export default {
  name: 'App',
  components: {
    OpenEosPlayer,
    Loading,
    CharacterSelector,
  },
  computed: {
    downloadedDisplay() {
      return prettysize(this.downloaded)
    },
    errors() {
      return this.error ? [this.error] : []
    },
    fileErrors() {
      return this.fileError ? [this.fileError] : []
    },
    displayTitle() {
      return this.title ? this.title : 'this tease'
    },
    debugEnabled() {
      return !this.formUri || !!this.previewMode
    },
  },
  data: () => ({
    // 角色选择相关
    showCharacterSelector: true,  // 初始显示角色选择
    selectedCharacterIndex: null,
    selectedCharacter: null,

    isFullscreen: false,
    script: null,
    eosuri: null,
    error: null,
    fileError: null,
    title: null,
    author: null,
    authorId: null,
    teaseId: null,
    teaseKey: null,
    teaseUrl: null,
    formUri: false,
    previewMode: 0,
    loading: false,
    version: version,
    fileUpload: null,
    externalLink: null,
    pageId: null,
    hasStorage: false,
    teaseStarted: false,
    teaseStorage: null,
    debugPrompt: false,
    allowNoSleep: false,
    message: {
      title: null,
      html: null,
      show: false,
    },
  }),
  mounted() {
    // Keep the fullscreen handling logic
    const t = this
    function exitHandler() {
      if (
        document.webkitIsFullScreen ||
        document.mozFullScreen ||
        document.msFullscreenElement
      ) {
        requestAnimationFrame(() => (t.isFullscreen = true))
      } else {
        requestAnimationFrame(() => (t.isFullscreen = false))
      }
    }
    if (document.addEventListener) {
      document.addEventListener('fullscreenchange', exitHandler, false)
      document.addEventListener('mozfullscreenchange', exitHandler, false)
      document.addEventListener('MSFullscreenChange', exitHandler, false)
      document.addEventListener('webkitfullscreenchange', exitHandler, false)
    }

    // 不自动启动游戏，等待用户选择角色
    // this.startAiDrivenTease();
  },
  methods: {
    // 角色选择处理
    async onCharacterSelected({ index, character }) {
      this.selectedCharacterIndex = index;
      this.selectedCharacter = character;
      this.showCharacterSelector = false;

      try {
        // 使用全局 API（解耦方案）
        if (window.oeosApi && window.oeosApi.bindCharacter) {
          await window.oeosApi.bindCharacter(index);
        }

        // 启动游戏
        await this.startAiDrivenTease();
      } catch (error) {
        this.error = `初始化失败: ${error.message}`;
        this.showCharacterSelector = true;
      }
    },

    // 返回角色选择
    returnToCharacterSelection() {
      this.showCharacterSelector = true;
      this.script = null;
      this.selectedCharacterIndex = null;
      this.selectedCharacter = null;
    },

    // New method to start the game via the ST plugin
    async startAiDrivenTease() {
      // console.log('[OEOS Player] ========== 开始初始化游戏 ==========');
      this.loading = true;
      // 使用全局 API（解耦方案）
      try {
        // console.log('[OEOS Player] 检查 OEOS API...');
        if (!window.oeosApi || !window.oeosApi.getPage || !window.oeosApi.getState) {
          throw new Error('OEOS API not available. Please ensure the plugin is loaded.');
        }
        // console.log('[OEOS Player] ✓ OEOS API 可用');

        // 获取当前游戏状态，从最后一个页面开始
        // console.log('[OEOS Player] 获取游戏状态...');
        const currentState = await window.oeosApi.getState();
        const startPageId = currentState?.pageId || 'start';
        const initialVariables = currentState?.variables || {};

        // console.info(`[OEOS Player] ✓ 从页面 '${startPageId}' 开始游戏，初始变量:`, initialVariables);

        // 读取起始页面
        // console.log(`[OEOS Player] 读取页面 '${startPageId}'...`);
        const startPageScript = await window.oeosApi.getPage(startPageId);

        if (!startPageScript) {
          throw new Error(`Page '${startPageId}' not found.`);
        }
         console.log(`[OEOS Player] ✓ 页面内容获取成功，长度: ${startPageScript.length} 字符`);
         console.log(`[OEOS Player] 页面内容预览:\n${startPageScript.substring(0, 200)}...`);

        // console.log('[OEOS Player] 解析 V4 脚本...');
        const script = OEOSV4Parser.toV1(startPageScript);
        // console.log('[OEOS Player] ✓ V4 脚本解析成功');
         console.log('[OEOS Player] 解析结果:', script);

        this.title = 'AI Adventure';
        this.author = 'The AI Dungeon Master';
        this.teaseId = 'ai-adventure-01';
        this.script = script;
        // console.log('[OEOS Player] ✓ 脚本已设置到播放器');

        // 恢复变量状态
        if (Object.keys(initialVariables).length > 0) {
          this.teaseStorage = JSON.stringify(initialVariables);
          // console.log('[OEOS Player] ✓ 变量状态已恢复');
        }

        // console.log('[OEOS Player] ========== 游戏初始化完成 ==========');
      } catch (e) {
        this.error = `Error initializing game: ${e.message}`;
        console.error('[OEOS Player] ❌ 初始化失败:', e);
        console.error('[OEOS Player] 错误堆栈:', e.stack);
      } finally {
        this.loading = false;
      }
    },

    // New method to report state changes back to the ST plugin
    reportStateToPlugin() {
        // 直接使用导入的函数
        let variables = {};
        try {
            // teaseStorage is a JSON string, so we need to parse it
            if (this.teaseStorage) {
                variables = JSON.parse(this.teaseStorage);
            }
        } catch (e) {
            console.error('[OEOS] Failed to parse teaseStorage for state update:', e);
        }

        const newState = {
            pageId: this.pageId,
            variables: variables,
        };

        if (window.oeosApi && window.oeosApi.updateState) {
          window.oeosApi.updateState(newState);
        }
    },

    setExternalLink(link) {
      this.externalLink = link || null
    },
    openExternalLink() {
      if (!this.externalLink || !this.externalLink.link) return
      window.open(this.externalLink.link, '_blank').focus()
    },
    restoreTeaseStorage() {
      this.showMessage('Restore Storage', 'This feature is not available in AI-driven mode.');
    },
    downloadTeaseStorage() {
      this.showMessage('Download Storage', 'This feature is not available in AI-driven mode.');
    },
    didStorageSave(v) {
      if (v && v !== '{}') {
        this.hasStorage = true
      }
      if (v) this.teaseStorage = v;
      this.reportStateToPlugin();
    },
    didStorageLoad(v) {
      if (v && v !== '{}') {
        this.hasStorage = true
      } else if (!v) {
        this.hasStorage = false
      } else {
        this.hasStorage = null
      }
      console.log('Did storage load', v)
      if (v) this.teaseStorage = v
    },
    didTeaseStart() {
      this.teaseStarted = true
    },
    didTeaseEnd() {},
    pageChange(pageId) {
      this.pageId = pageId;
      this.reportStateToPlugin();
    },
    closeMessage() {
      this.message.show = false
      this.message.onContinue = () => {}
      this.message.onCancel = false
    },
    showMessage(title, html, onContinue, onCancel) {
      this.message.title = title
      this.message.html = html
      this.message.onContinue = onContinue || function() {}
      this.message.onCancel = onCancel
      this.message.show = true
    },
    toggleFullscreen() {
      this.isFullscreen = true
      requestAnimationFrame(() => this.$refs.mainPlayer.$el.requestFullscreen())
    },
  },
}
</script>
<style>
.oeos-app-container {
  height: 100%;
  overflow: hidden;
}
html {
  overflow: hidden;
}
.oeos-start-prompt,
.oeos-outer,
.oeos-main {
  position: relative;
  height: 100%;
}
#oeos-sounds {
  display: none;
}
.oeos-sound-time {
  position: absolute;
  top: 0;
  left: 0;
}
.oeos-start-title {
  text-align: center;
  margin-top: 50px;
  font-size: 200%;
  margin-bottom: 10px;
}
.oeos-start-author {
  text-align: center;
  margin-bottom: 10px;
  opacity: 0.6;
}
.oeos-background {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 0;
  transition: background-color 0.3s ease;
  background-repeat: repeat;
}
.oeos-background:before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-image: linear-gradient(90deg, #000, transparent, #000);
  opacity: 0.6;
}
.oeos-top {
  position: absolute;
  height: var(--bubble-area-image-top);
  top: 0;
  left: 0;
  right: 0;
}
.oeos-image-full .oeos-top {
  height: 100%;
}
.oeos-right {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 10px;
  pointer-events: none;
}
.oeos-notifications {
  position: absolute;
  overflow: visible;
  top: var(--notifications-top);
  left: var(--notifications-left);
  right: var(--notifications-right);
  bottom: var(--notifications-bottom);
  pointer-events: auto;
}
.oeos-bottom {
  position: absolute;
  overflow-y: scroll;
  top: var(--bubble-area-top);
  bottom: var(--bubble-area-bottom);
  left: var(--bubble-area-left);
  right: var(--bubble-area-right);
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* Internet Explorer 10+ */
  -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 10%);
  mask-image: linear-gradient(180deg, transparent 0, #000 10%);
  overflow-anchor: none;
}
.oeos-image-full .oeos-bottom {
  pointer-events: none;
}
.oeos-clickable {
  pointer-events: auto;
}
.oeos-bottom::-webkit-scrollbar {
  /* WebKit */
  width: 0;
  height: 0;
}
.oeos-bottom.has-image {
  top: var(--bubble-area-image-top);
}
.oeos-image {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}
.oeos-video-overlays,
.oeos-image-overlays {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 100%;
  height: 100%;
  -webkit-transform: translate(-50%, -50%);
  transform: translate(-50%, -50%);
}
.oeos-image img {
  display: block;
  position: absolute;
  left: 50%;
  top: 50%;
  max-width: 100%;
  height: 100%;
  object-fit: contain;
  -webkit-transform: translate(-50%, -50%);
  transform: translate(-50%, -50%);
  min-width: 0;
  box-sizing: border-box;
  user-select: none;
  filter: drop-shadow(0 0 25px rgba(0, 0, 0, 0.3));
}
.oeos-video {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}
.oeos-video video {
  display: none;
  position: absolute;
  left: 50%;
  top: 50%;
  max-width: 100%;
  height: 100%;
  object-fit: contain;
  -webkit-transform: translate(-50%, -50%);
  transform: translate(-50%, -50%);
  min-width: 0;
  box-sizing: border-box;
  user-select: none;
  pointer-events: none;
  filter: drop-shadow(0 0 25px rgba(0, 0, 0, 0.3));
}
/* hide video controls on safari iOS */
.oeos-video *::-webkit-media-controls-timeline,
.oeos-video *::-webkit-media-controls-container,
.oeos-video *::-webkit-media-controls-container,
.oeos-video *::-webkit-media-controls-start-playback-button,
.oeos-video *::-webkit-media-controls-play-button,
.oeos-video *::-webkit-media-controls-panel,
.oeos-video *::-webkit-media-controls {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  -webkit-appearance: none !important;
  z-index: -200 !important;
}

.oeos-video video.oeos-show {
  display: block;
}
.oeos-video video.oeos-show-prep {
  display: block;
  visibility: visible !important;
  opacity: 0 !important;
}
.oeos-video-element-pool video {
  position: fixed;
  left: 0;
  top: 0;
}
.oeos-scroll-button {
  position: absolute;
  bottom: 5px;
  right: 5px;
  opacity: 0.8;
}
.oeos-bubble {
  margin-bottom: 8px;
  user-select: none;
}
.oeos-bubble p {
  margin-bottom: 0px;
  padding: 3px;
  user-select: text;
}
.oeos-bubble.oeos-align-center {
  margin-right: auto;
  margin-left: auto;
}
.oeos-bubble.oeos-align-left {
  margin-right: auto;
}
.oeos-bubble.oeos-align-right {
  margin-left: auto;
}
.oeos-bubble-end {
  display: block;
  height: 1px;
}
.oeos-say-item {
  max-width: 95%;
}
.oeos-choice-item {
  margin-bottom: 0px;
  max-width: 95%;
}
.oeos-choice-item .v-btn {
  margin-bottom: 6px;
}
.oeos-blink-button,
.oeos-start-button {
  animation: fadeinout 1.5s linear forwards;
  animation-iteration-count: infinite;
}
.oeos-blink-button {
  position: absolute;
  right: 5px;
  bottom: 7px;
}
.oeos-blink-button.no-blink {
  animation: none;
}
.oeos-start-button {
  text-align: center;
  margin-left: auto;
  margin-right: auto;
}
.oeos-text-standard {
  font-size: 1.1rem;
}
.theme--dark.v-card > .v-card__text,
.theme--dark.v-card .v-card__subtitle {
  color: rgba(255, 255, 255, 0.8);
}

.oeos-main .v-btn.v-size--default {
  height: auto;
  min-height: 36px;
  font-size: 1.1rem;
  font-family: 'Noto Sans', sans-serif;
  letter-spacing: normal;
  font-weight: bold;
}

.oeos-main .v-btn.v-size--default.expand-x-transition-enter-active,
.oeos-main .v-btn.v-size--default.expand-x-transition-leave-active {
  height: 36px;
}

.oeos-main .v-btn.v-size--small {
  height: auto;
  min-height: 26px;
  font-size: 1rem;
  font-family: 'Noto Sans', sans-serif;
  letter-spacing: normal;
  font-weight: bold;
}

.oeos-main .v-btn.v-size--small.expand-x-transition-enter-active {
  height: 26px;
}

.oeos-main .v-btn.v-size--default .v-btn__content {
  max-width: 100%;
}

.oeos-main .v-btn.v-size--default .v-btn__content > span {
  white-space: normal;
}

.oeos-main
  .v-btn.v-size--default.expand-x-transition-enter-active
  .v-btn__content
  > span,
.oeos-main
  .v-btn.v-size--default.expand-x-transition-leave-active
  .v-btn__content
  > span {
  white-space: nowrap;
}

.oeos-hide-no-click {
  visibility: hidden;
}

.oeos-video-embeds {
  position: fixed;
  overflow: hidden;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
}

@keyframes fadeinout {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 1;
  }
}

/* Use styles from EOS buttons for teases that used these classes */
.Button_root__28K_E {
  background: #111
    linear-gradient(180deg, hsla(0, 0%, 100%, 0.15), hsla(0, 0%, 100%, 0))
    repeat-x;
  display: inline-block;
  padding: 5px 10px 6px;
  color: #fff;
  text-decoration: none;
  border-radius: 5px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.25);
  position: relative;
  cursor: pointer;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  font-size: 100%;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 -1px 1px rgba(0, 0, 0, 0.5);
}
.Button_root__28K_E:hover {
  background: #111
    linear-gradient(180deg, hsla(0, 0%, 100%, 0.2), hsla(0, 0%, 100%, 0.1))
    repeat-x;
}
.Button_root__28K_E:active {
  top: 1px;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
}
/* 确保整个 Vue 应用填满 #app 容器，并与 #oeos-main-container 大小位置一致 */
.oeos-app-container {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

/* v-application--wrap 是 Vuetify 自动生成的包装器，需要填满父容器 */
.oeos-app-container .v-application--wrap {
  width: 100%;
  height: 100%;
  min-height: 100%;
}

/* v-main 填满 v-application--wrap，移除默认 padding */
.oeos-app-container .v-main {
  height: 100%;
  padding: 0 !important;
}

/* v-main__wrap 填满 v-main */
.oeos-app-container .v-main__wrap {
  height: 100%;
}
</style>
