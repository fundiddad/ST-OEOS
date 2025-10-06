<template>
  <v-app class="oeos-app-container">
    <v-main ref="mainPlayer">
      <open-eos-player
        v-if="script"
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
      <v-container v-else>
        <template v-if="this.formUri && !this.error">
          <loading>Importing...</loading>
        </template>
        <template v-else>
          <v-text-field
            label="Milovana Tease URL"
            v-model="teaseUrl"
            prepend-icon="mdi-link-variant"
            :error-messages="errors"
            :loading="loading"
            @keydown.enter="loadMilovanaUrl"
            @input="
              () => {
                this.error = null
                this.formUri = false
              }
            "
          />
          <v-btn @click="loadMilovanaUrl" :loading="loading"
            >Load Tease From URL</v-btn
          >
          <template v-if="!formUri">
            <v-file-input
              v-model="fileUpload"
              prepend-icon="mdi-cloud-upload"
              accept="application/json, text/json, .oeos, .eos, text/plain"
              label="Upload Json or OEOScript"
              :error-messages="fileErrors"
              @change="fileError = null"
            ></v-file-input>
            <v-btn @click="uploadFile" :loading="loading"
              >Load Tease From File</v-btn
            >
          </template>
        </template>
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
import { version } from '../package.json'
import {
  downloadObjectAsJson,
  convertToValidFilename,
  encodeForCorsProxy,
  corsProxyHeaders,
  FIX_POLLUTION,
  getFormattedDateForFile,
  acronym,
} from './util/io'
import prettysize from 'prettysize'
import CryptoJS from 'crypto-js'
import OEOSV4Parser from './util/v4-parser.js'

const parser = new DOMParser()
export default {
  name: 'App',
  components: {
    OpenEosPlayer,
    Loading,
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

    let uri = window.location.search.substring(1)
    let params = new URLSearchParams(uri)
    const teaseId = params.get('id')
    let previewMode = params.get('preview')
    this.allowNoSleep = !!params.get('nosleep')

    if (previewMode) {
      previewMode = parseInt(previewMode, 10)
      if (isNaN(previewMode)) previewMode = 0
    } else {
      previewMode = 0
    }
    this.previewMode = previewMode
    if (teaseId) {
      this.formUri = true
      let teaseUrl = `https://milovana.com/webteases/showtease.php?id=${teaseId}`
      const key = params.get('key')
      if (key) {
        teaseUrl += `&key=${key}`
      }
      this.teaseUrl = teaseUrl
      this.loadMilovanaUrl()
    }
  },
  methods: {
    setExternalLink(link) {
      this.externalLink = link || null
    },
    openExternalLink() {
      if (!this.externalLink || !this.externalLink.link) return
      window.open(this.externalLink.link, '_blank').focus()
    },
    restoreTeaseStorage() {
      const input = this.$refs.teaseStorageLoader
      input.type = 'file'
      input.accept = `.oeos_${this.teaseId}`
      input.addEventListener('change', handleFiles, false)
      const vue = this
      function handleFiles() {
        const file = this.files[0]
        if (file) {
          var reader = new FileReader()
          reader.onload = function(e) {
            try {
              const bytes = CryptoJS.AES.decrypt(
                JSON.parse(e.target.result),
                vue.teaseId + '::OEOS'
              )
              const storageData = bytes.toString(CryptoJS.enc.Utf8)
              if (
                storageData &&
                storageData.startsWith('{') &&
                JSON.parse(storageData)
              ) {
                vue.teaseStorage = storageData
              } else {
                console.error('Invalid data?', bytes, storageData)
                throw new Error('Invalid tease storage file', storageData)
              }
            } catch (err) {
              vue.showMessage(
                'Invalid Tease Storage',
                'Sorry, that file does not appear to be a valid storage file for this tease.'
              )
              console.error(err)
            }
          }
          reader.readAsText(file)
        }
      }
      input.click()
    },
    downloadTeaseStorage() {
      const storageData = CryptoJS.AES.encrypt(
        this.teaseStorage,
        this.teaseId + '::OEOS'
      ).toString()
      downloadObjectAsJson(
        storageData,
        convertToValidFilename(
          acronym(this.title) + '-' + getFormattedDateForFile()
        ),
        `oeos_${this.teaseId}`
      )
    },
    didStorageSave(v) {
      if (v && v !== '{}') {
        this.hasStorage = true
      }
      if (v) this.teaseStorage = v
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
      this.pageId = pageId
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
    async uploadFile() {
      if (!this.fileUpload) {
        this.fileError = 'Please select a file first.'
        return
      }
      console.log('Ready to upload', this.fileUpload)
      try {
        const fileContent = await this.fileUpload.text()
        let script

        // Check if it's a v4 script
        if (
          this.fileUpload.name.endsWith('.oeos') ||
          !fileContent.trim().startsWith('{')
        ) {
          try {
            script = OEOSV4Parser.toV1(fileContent)
          } catch (e) {
            this.fileError = `Failed to parse OEOScript v4: ${e.message}`
            console.error(e)
            return
          }
        } else {
          // Assume it's a v1 JSON
          script = JSON.parse(fileContent)
        }

        if (
          !script ||
          !script.pages ||
          (script.modules && script.modules.nyx)
        ) {
          if (script.modules && script.modules.nyx) {
            this.fileError = 'Sorry, NYX teases are not supported.'
          } else {
            this.fileError =
              'Does not appear to be a valid EOS tease (Invalid Definitions)'
          }
        } else {
          if (script.oeosmeta) {
            const meta = script.oeosmeta
            this.title = meta.title
            this.author = meta.author
            this.authorId = meta.authorId
            this.teaseId = meta.teaseId
            this.teaseKey = meta.teaseKey
            this.script = script
          } else {
            this.message.title = 'Warning'
            this.message.html = `This appears to be a raw EOS file, not an Open EOS file.<br>
            Images, etc., will still be loaded from Milovana, and I won't know the title or author of this tease.<br>
            <br>
            Do you want to continue?`
            this.message.onContinue = () => {
              this.title = this.fileUpload.name
              this.script = script
              this.author = 'Unknown'
            }
            this.message.onCancel = () => {}
            this.message.show = true
          }
        }
      } catch (e) {
        this.fileError = 'Could not read or parse the file.'
        console.error(e)
      }
    },

    loadMilovanaUrl() {
      this.error = null
      this.hasStorage = false
      this.easeStarted = false
      if (this.loading) return
      const uri = this.parseTeaseURI()
      if (!uri) {
        this.error = 'Invalid tease URL'
      } else {
        // this.getRemoteScriptName(uri)
        this.getRemoteScript(uri)
      }
    },
    toggleFullscreen() {
      this.isFullscreen = true
      requestAnimationFrame(() => this.$refs.mainPlayer.$el.requestFullscreen())
    },
    getRemoteScript(uri) {
      this.loading = true

      fetch(
        encodeForCorsProxy(
          'https://milovana.com/webteases/geteosscript.php',
          `id=${uri}&${FIX_POLLUTION}` +
            (this.previewMode
              ? '&ncpreview=' + this.previewMode
              : '&cacheable&_nc=' + Math.floor(Date.now() / 1000 / 60))
        ),
        { headers: corsProxyHeaders() }
      )
        .then(response => response.text()) // Get as text first
        .then(text => {
          const script = JSON.parse(text)

          if (
            !script ||
            !script.pages ||
            (script.modules && script.modules.nyx)
          ) {
            if (script.modules && script.modules.nyx) {
              this.error = 'Sorry, NYX teases are not supported.'
            } else {
              this.error =
                'Does not appear to be a valid EOS tease (Invalid Definitions)'
            }

            this.loading = false
          } else {
            this.getRemoteScriptName(uri, script)
          }
        })
        .catch(e => {
          // This catch block now handles JSON parsing errors and network errors.
          fetch(
            encodeForCorsProxy(
              `https://milovana.com/webteases/showtease.php`,
              `&id=${uri}&${FIX_POLLUTION}` +
                (this.previewMode
                  ? '&preview=' + this.previewMode
                  : '&cacheable&_nc=' + Math.floor(Date.now() / 1000 / 60))
            ),
            { headers: corsProxyHeaders() }
          )
            .then(response => response.text())
            .then(contents => {
              console.log('Looking for old-school tease', contents)
              this.loading = false
              if (
                parser
                  .parseFromString(contents, 'text/html')
                  .getElementById('tease_title')
              ) {
                this.error = 'Sorry, classic teases are not supported.'
              } else {
                throw e
              }
            })
            .catch(() => {
              this.error =
                'Does not appear to be a valid EOS tease (Invalid JSON)'
              console.error('Response parsing error', e)
              this.loading = false
            })
        })
    },
    getRemoteScriptName(uri, script) {
      fetch(
        encodeForCorsProxy(
          `https://milovana.com/webteases/showtease.php`,
          `id=${uri}&${FIX_POLLUTION}` +
            (this.previewMode
              ? '&ncpreview=' + this.previewMode
              : '&cacheable&_nc=' + Math.floor(Date.now() / 1000 / 60))
        ),
        { headers: corsProxyHeaders() }
      )
        .then(response => response.text())
        .then(contents => {
          this.loading = false
          // console.log('HTML response', contents)
          try {
            const doc = parser
              .parseFromString(contents, 'text/html')
              .getElementsByTagName('body')[0]
            this.title = doc.getAttribute('data-title')
            this.author = doc.getAttribute('data-author')
            this.authorId = doc.getAttribute('data-author-id')
            this.teaseId = doc.getAttribute('data-tease-id')
            this.teaseKey = doc.getAttribute('data-key')
            if (this.title) document.title = this.title
            this.script = script
          } catch (e) {
            console.error('Error parseing EOS HTML', e)
            this.title = 'Error Getting Title'
          }
        })
        .catch(e => {
          this.error = 'Error loading tease HTML from Milovana'
          console.error('HTML response error', e)
          this.loading = false
        })
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
.oeos-app-container {
  height: 100%;
  overflow: hidden;
}

.v-application--wrap {
  min-height: 100%;
}
</style>
