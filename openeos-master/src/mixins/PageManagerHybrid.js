import pagesCode from '!!raw-loader!../interpreter/code/pages.js'
import minimatch from 'minimatch'
import compareVersions from 'compare-versions'
import { version } from '../../package.json'
import axios from 'axios'
import pageCompiler from '../util/pageCompiler'
import Vue from 'vue'
import OEOSV4Parser from '../util/v4-parser.js'

const API_BASE_URL = `http://${process.env.BACKEND_HOST}:${process.env.BACKEND_PORT}/api`
let navCounter = 0
let navIndex = 0
let disabledPages = {}
let lastGetPageId = null
let skipNextBubbleClear = false
let nextPageFuncs = []
let nextImageFuncs = []
let pageMediaCache = {} // 用于缓存页面的媒体信息

let pagesInstance = null

const isPattern = s => {
  if (typeof s !== 'string') return false
  return !!s.match(/(^!|[*?{}])/)
}

export default {
  data: () => ({
    waitingForPageChange: false,
    currentPageId: null,
    lastPageId: '',
    commandIndex: 0,
    showEndDialog: false,
    endDialogTitle: 'Thanks for playing!',
  }),
  mounted() {
    navCounter = 0
    disabledPages = {}
    pageMediaCache = {}
    document.addEventListener('visibilitychange', this.documentVisibilityChange)
  },
  beforeDestroy() {
    document.removeEventListener(
      'visibilitychange',
      this.documentVisibilityChange
    )
  },
  watch: {
    currentPageId(val) {
      this.$emit('page-change', val)
    },
  },
  methods: {
    // NOTE: getPageNames will only work on already loaded pages in this mode
    cachePageFromWebSocket(pageData) {
      const { pageId, content, media } = pageData

      const isUpdate = this.script.pages[pageId]

      this.$emit('log', {
        type: 'info',
        message: isUpdate
          ? `🔄 Updating page ${pageId} from WebSocket push...`
          : `📥 Caching new page ${pageId} from WebSocket push...`,
      })

      // 编译和缓存页面
      const compiledPage = pageCompiler(content)
      const pageScript = this.interpreter.parse_(
        compiledPage.script,
        'oeosPageScript:' + pageId
      )
      content.compiledScript = pageScript // Attach compiled script

      Vue.set(this.script.pages, pageId, content)
      pageMediaCache[pageId] = media

      this.$emit('log', {
        type: 'success',
        message: `Page ${pageId} pre-cached and compiled successfully via WebSocket.`,
      })
    },
    getPageNames: function(pattern, onlyEnabled) {
      const pages = Object.keys(this.script.pages)
      if (!pattern) return pages
      const filter = minimatch.filter(pattern)
      return pages.filter(filter).filter(p => !onlyEnabled || !disabledPages[p])
    },
    endTease() {
      navCounter++
      if (this.allowNoSleep) this.noSleep.disable()
      this.showEndDialog = true
    },
    pagesInstance() {
      return pagesInstance
    },
    documentVisibilityChange(e) {
      this.dispatchEvent({
        target: pagesInstance,
        type: 'visibilitychange',
        timeStamp: e.timeStamp + performance.timing.navigationStart,
      })
    },
    documentSizeChange(e) {
      this.dispatchEvent({
        target: pagesInstance,
        type: 'resize',
        timeStamp:
          (e && e.timeStamp + performance.timing.navigationStart) || Date.now(),
      })
    },
    isPageEnabled(pageId) {
      return !disabledPages[pageId]
    },
    pageClick(e) {
      if (!this.hasEventListeners(pagesInstance, 'click'))
        return this.clickLastSayBubble(e)
      e.stopPropagation()
      const rect = e.target.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      this.dispatchEvent(
        {
          target: pagesInstance,
          type: 'click',
          value: {
            x: x / e.target.clientWidth,
            y: y / e.target.clientHeight,
          },
          timeStamp: e.timeStamp + performance.timing.navigationStart,
        },
        e
      )
      if (!e._stopImmediatePropagation) {
        this.clickLastSayBubble(e)
      }
    },
    enablePage(pattern) {
      const filter = minimatch.filter(pattern)
      const pages = Object.keys(this.script.pages).filter(filter)

      for (const page of pages) {
        delete disabledPages[page]
      }
    },
    disablePage(pattern) {
      const filter = minimatch.filter(pattern)
      const pages = Object.keys(this.script.pages).filter(filter)

      for (const page of pages) {
        disabledPages[page] = true
      }
    },
    getCurrentPageId() {
      return this.currentPageId
    },
    beforePageChange() {
      const interpreter = this.interpreter
      try {
        this.dispatchEvent({
          target: pagesInstance,
          type: 'change',
          value: {
            to: this.currentPageId,
            from: this.lastPageId,
          },
        })
      } catch (e) {
        return interpreter.createThrowable(interpreter.TYPE_ERROR, e.toString())
      }
      this.purgePageTimers()
      if (skipNextBubbleClear) {
        skipNextBubbleClear = false
      } else {
        this.purgePageBubbles()
      }
      this.purgePageSounds()
    },
    doNextPageFuncs() {
      let func = nextPageFuncs.shift()
      while (func) {
        this.interpreter.queueFunction(func, pagesInstance)
        func = nextPageFuncs.shift()
      }
    },
    showPage(pattern, noRun) {
      this.debugWarn('Showing Page:', pattern)
      const interpreter = this.interpreter

      // 1. 获取页面数据（异步）
      this.getPage(pattern)
        .then(result => {
          if (!result || !result.content) {
            this.$emit('log', {
              type: 'error',
              message: `❌ Failed to get page data for pattern: ${pattern}`,
            })
            return
          }

          const { requestedPageId, receivedPageId } = result

          // --- 验证逻辑 ---
          if (requestedPageId !== receivedPageId) {
            this.debugWarn(
              `Page mismatch! Requested '${requestedPageId}', but received '${receivedPageId}'. Re-requesting...`
            )
            this.$emit('log', {
              type: 'warning',
              message: `⚠️ Page mismatch: wanted ${requestedPageId}, got ${receivedPageId}. Retrying.`,
            })
            // 不渲染，立即重新请求正确的页面
            this.showPage(requestedPageId, noRun)
            return
          }

          // --- 渲染逻辑 (仅当 pageId 匹配时执行) ---
          const pageId = receivedPageId
          const media = pageMediaCache[pageId] || {
            images: [],
            sounds: [],
            videos: [],
          }

          if (media.images)
            media.images.forEach(locator => this.preloadImage(locator, true))

          this.debug('Preload finished, rendering page:', pageId)
          const pageData = this.script.pages[pageId]
          const pageCode = pageData.compiledScript

          if (!pageCode) {
            this.$emit('log', {
              type: 'error',
              message: `❌ Page script for ${pageId} is not compiled.`,
            })
            this.waitingForPageChange = false
            return
          }

          this.lastPageId = this.currentPageId
          this.currentPageId = pageId
          navCounter++
          navIndex++
          this.beforePageChange()

          this.doNextPageFuncs()
          interpreter.appendCode(pageCode)
          this.waitingForPageChange = false
          if (!noRun) interpreter.run()
        })
        .catch(error => {
          this.$emit('log', {
            type: 'error',
            message: `❌ Error in showPage for pattern ${pattern}: ${error.message}`,
          })
        })
    },
    lastGetPageId() {
      return lastGetPageId
    },
    hasPage(pattern) {
      if (isPattern(pattern)) {
        return !!this.getPageNames(pattern, true).length
      } else {
        return !!this.script.pages[pattern]
      }
    },
    async getPage(pattern) {
      if (!pattern) {
        this.$emit('log', {
          type: 'warning',
          message: `⚠️ Attempted to get a page with null or undefined pattern.`,
        })
        return null
      }
      if (isPattern(pattern)) {
        const pages = this.getPageNames(pattern, true)
        const selectedPage =
          pages.length && pages[Math.floor(Math.random() * pages.length)]
        if (selectedPage) {
          pattern = selectedPage
        } else {
          this.debugWarn(
            `No local page found for pattern: ${pattern}. Trying to fetch from server.`
          )
        }
      }

      // 检查页面内容是否已缓存，如果已缓存则不再请求
      if (
        this.script.pages[pattern] &&
        this.script.pages[pattern].compiledScript
      ) {
        lastGetPageId = pattern
        this.$emit('log', {
          type: 'info',
          message: `Page ${pattern} found in local cache. Rendering directly.`,
        })
        // 统一返回数据结构
        return Promise.resolve({
          requestedPageId: pattern,
          receivedPageId: pattern,
          content: this.script.pages[pattern],
        })
      }

      try {
        // 优先尝试从 World Info 获取页面（AI 驱动模式）
        if (window.oeosApi && window.oeosApi.getPage) {
          this.showPendingLoader = true

          this.$emit('log', {
            type: 'info',
            message: `📖 Fetching page from World Info: ${pattern}...`,
          })

          const v4PageScript = await window.oeosApi.getPage(pattern)

          this.showPendingLoader = false

          if (v4PageScript) {
            // 将 v4 格式转换为 v1 格式
            const v1Script = OEOSV4Parser.toV1(v4PageScript)

            // 获取页面内容（v1Script.pages 中应该只有一个页面）
            const pageIds = Object.keys(v1Script.pages)
            if (pageIds.length === 0) {
              throw new Error(`No page found in v4 script for pattern: ${pattern}`)
            }

            const receivedPageId = pageIds[0]
            const pageCommands = v1Script.pages[receivedPageId]

            // 构造页面内容对象（与原有格式兼容）
            const pageContent = {
              script: pageCommands
            }

            // 编译页面脚本
            const compiledPage = pageCompiler(pageContent)
            const pageScript = this.interpreter.parse_(
              compiledPage.script,
              'oeosPageScript:' + receivedPageId
            )

            pageContent.compiledScript = pageScript

            Vue.set(this.script.pages, receivedPageId, pageContent)
            pageMediaCache[receivedPageId] = { images: [], sounds: [], videos: [] }

            this.$emit('log', {
              type: 'success',
              message: `Page ${receivedPageId} loaded from World Info and compiled.`,
            })
            lastGetPageId = receivedPageId

            return {
              requestedPageId: pattern,
              receivedPageId: receivedPageId,
              content: pageContent,
            }
          }
        }

        // 如果 World Info 获取失败，尝试从 HTTP API 获取（传统模式）
        if (!this.clientId) {
          const errorMsg = '❌ Client ID not available and World Info fetch failed. Cannot fetch page.'
          this.$emit('log', { type: 'error', message: errorMsg })
          throw new Error(errorMsg)
        }

        this.showPendingLoader = true

        this.$emit('log', {
          type: 'info',
          message: `🌐 Fetching page from server: ${pattern} with clientId: ${this.clientId.substring(
            0,
            8
          )}...`,
        })
        const response = await axios.get(`${API_BASE_URL}/page/${pattern}`, {
          params: {
            clientId: this.clientId,
          },
        })

        this.showPendingLoader = false

        if (response.data.success) {
          const responseData = response.data.data
          const pageContent = responseData.content
          const pageMedia = responseData.media

          const compiledPage = pageCompiler(pageContent)
          const pageScript = this.interpreter.parse_(
            compiledPage.script,
            'oeosPageScript:' + responseData.pageId
          )

          pageContent.compiledScript = pageScript // Attach compiled script to the page data

          Vue.set(this.script.pages, responseData.pageId, pageContent)
          pageMediaCache[responseData.pageId] = pageMedia

          this.$emit('log', {
            type: 'success',
            message: `Page ${responseData.pageId} loaded and compiled. Media info cached.`,
          })
          lastGetPageId = responseData.pageId
          // 不再直接返回 pageContent，而是返回一个包含请求和响应信息的对象
          return {
            requestedPageId: pattern,
            receivedPageId: responseData.pageId,
            content: pageContent,
          }
        } else {
          throw new Error(
            `API error for page ${pattern}: ${response.data.message}`
          )
        }
      } catch (error) {
        this.showPendingLoader = false
        this.$emit('log', {
          type: 'error',
          message: `❌ Failed to load page ${pattern}: ${error.message}`,
        })
        throw error
      }
    },
    installPageManager(interpreter, globalObject) {
      const vue = this
      const constructor = () => {
        return interpreter.createThrowable(
          interpreter.ERROR,
          'Cannot construct PageManager object, use `pages` global'
        )
      }

      const manager = interpreter.createNativeFunction(constructor, true)
      interpreter.setProperty(
        manager,
        'prototype',
        interpreter.createObject(globalObject.properties['EventTarget']),
        this.Interpreter.NONENUMERABLE_DESCRIPTOR
      )
      const proto = manager.properties['prototype']
      interpreter.setProperty(globalObject, 'PageManager', manager)

      interpreter.setNativeFunctionPrototype(
        manager,
        'list',
        (pattern, onlyEnabled) => {
          if (pattern && typeof pattern !== 'string') {
            return interpreter.createThrowable(
              interpreter.TYPE_ERROR,
              'If filter pattern is supplied, must be a string'
            )
          }
          return interpreter.nativeToPseudo(
            this.getPageNames(pattern, onlyEnabled)
          )
        }
      )

      interpreter.setNativeFunctionPrototype(manager, 'isEnabled', pageId => {
        if (typeof pageId !== 'string') {
          return interpreter.createThrowable(
            interpreter.TYPE_ERROR,
            'pageId must be a string'
          )
        }

        return this.isPageEnabled(pageId)
      })

      interpreter.setNativeFunctionPrototype(
        manager,
        'setEndDialogTitle',
        v => {
          if (typeof v !== 'string') {
            return interpreter.createThrowable(
              interpreter.TYPE_ERROR,
              'endDialogTitle must be a string'
            )
          }

          this.endDialogTitle = v
        }
      )

      interpreter.setNativeFunctionPrototype(manager, 'enable', function(
        pattern
      ) {
        if (typeof pattern !== 'string') {
          return interpreter.createThrowable(
            interpreter.TYPE_ERROR,
            'pattern must be a string'
          )
        }
        vue.enablePage(pattern)
        return this
      })

      interpreter.setNativeFunctionPrototype(manager, 'disable', function(
        pattern
      ) {
        if (typeof pattern !== 'string') {
          return interpreter.createThrowable(
            interpreter.TYPE_ERROR,
            'pattern must be a string'
          )
        }
        vue.disablePage(pattern)
        return this
      })

      interpreter.setNativeFunctionPrototype(manager, '_getNavId', () => {
        return navCounter
      })

      interpreter.setNativeFunctionPrototype(manager, '_getNavQueued', () => {
        navIndex--
        if (navIndex < 0) {
          navIndex = 0
        }
        return navIndex
      })

      const _prepLocator = locator => {
        if (locator instanceof this.Interpreter.Object) {
          locator = JSON.stringify(interpreter.pseudoToNative(locator))
        }
        return locator
      }

      interpreter.setNativeFunctionPrototype(
        manager,
        'captureImageClicks',
        function(v) {
          console.error(
            'pages.captureImageClicks is deprecated.  Use stopImmediatePropagation() and stopPropagation().'
          )
          if (!arguments.length) {
            return true
          }
          return this
        }
      )

      interpreter.setNativeFunctionPrototype(
        manager,
        'captureImageLoads',
        function(v) {
          console.error(
            'pages.captureImageLoads is deprecated.  Image loads are always captured.  Do not use.'
          )
          if (!arguments.length) {
            return true
          }
          return this
        }
      )

      interpreter.setNativeFunctionPrototype(manager, 'captureClicks', function(
        v
      ) {
        console.error(
          'pages.captureClicks is deprecated.  Use stopImmediatePropagation() and stopPropagation().'
        )
        if (!arguments.length) {
          return true
        }
        return this
      })

      interpreter.setNativeFunctionPrototype(manager, 'clearBubbles', function(
        keep
      ) {
        vue.purgePageBubbles(keep)
        return this
      })

      interpreter.setNativeFunctionPrototype(
        manager,
        'skipNextBubbleClear',
        function(v) {
          if (!arguments.length) {
            return skipNextBubbleClear
          }
          skipNextBubbleClear = !!v
          return this
        }
      )

      interpreter.setNativeFunctionPrototype(
        manager,
        'getImageScale',
        function() {
          return vue.imageScale
        }
      )

      interpreter.setNativeFunctionPrototype(manager, 'hideBubbles', function(
        v
      ) {
        if (!arguments.length) {
          return vue.hideBubbles
        }
        vue.hideBubbles = !!v
        return this
      })

      interpreter.setNativeFunctionPrototype(manager, 'contains', function(p) {
        return vue.hasPage(p)
      })

      interpreter.setNativeFunctionPrototype(manager, 'hasCssProperty', val => {
        return !!vue.hasCssProperty(val)
      })

      interpreter.setNativeFunctionPrototype(manager, 'getImage', () => {
        return interpreter.nativeToPseudo(this.image)
      })

      interpreter.setNativeFunctionPrototype(manager, 'visibilityState', () => {
        return document.visibilityState
      })

      interpreter.setNativeFunctionPrototype(manager, 'restartImage', function(
        onLoadFunc,
        onErrorFunc
      ) {
        const img = vue.$refs.mainImage
        if (img) {
          vue.addImageOnLoad(onLoadFunc)
          vue.addImageOnError(onErrorFunc)
          // eslint-disable-next-line no-self-assign
          img.src = img.src
        }
        return this
      })

      interpreter.setNativeFunctionPrototype(manager, 'setImage', function(
        locator,
        onLoadFunc,
        onErrorFunc
      ) {
        const _doImageFunc = () => {
          const func = nextImageFuncs.shift()
          if (func) {
            return interpreter
              .callFunction(func, this, locator)
              .then(() => _doImageFunc())
              .catch(e => {
                console.error(
                  'Error in onNextImage call',
                  interpreter.getProperty(e, 'message')
                )
                return _doImageFunc()
              })
          } else {
            vue.addImageOnLoad(onLoadFunc)
            vue.addImageOnError(onErrorFunc)
            vue.setImage(_prepLocator(locator))
            return this
          }
        }
        return _doImageFunc()
      })

      interpreter.setNativeFunctionPrototype(manager, 'hideImage', function(v) {
        if (!arguments.length) {
          return vue.hideImage
        }
        vue.hideImage = !!v
        return this
      })

      interpreter.setNativeFunctionPrototype(
        manager,
        'addOnNextImage',
        function(func) {
          if (func) nextImageFuncs.push(func)
          return this
        }
      )

      interpreter.setNativeFunctionPrototype(
        manager,
        'removeOnNextImage',
        function(func) {
          let index = nextImageFuncs.findIndex(i => i === func)
          while (index > -1) {
            nextPageFuncs.splice(index, 1)
            index = nextImageFuncs.findIndex(i => i === func)
          }
          return this
        }
      )

      interpreter.setNativeFunctionPrototype(
        manager,
        'addOnNextPageChange',
        function(func) {
          if (func) nextPageFuncs.push(func)
          return this
        }
      )

      interpreter.setNativeFunctionPrototype(
        manager,
        'removeOnNextPageChange',
        function(func) {
          let index = nextPageFuncs.findIndex(i => i === func)
          while (index > -1) {
            nextPageFuncs.splice(index, 1)
            index = nextPageFuncs.findIndex(i => i === func)
          }
          return this
        }
      )

      interpreter.setNativeFunctionPrototype(
        manager,
        'fullHeightImage',
        function(v) {
          if (!arguments.length) {
            return vue.fullScreenImage
          }
          vue.fullScreenImage = !!v
          return this
        }
      )

      interpreter.setNativeFunctionPrototype(manager, 'preload', function(
        target
      ) {
        vue.debugWarn('pages.preload() is not fully implemented in async mode.')
        return this
      })

      interpreter.setNativeFunctionPrototype(manager, 'preloadImage', function(
        locator,
        onLoadFunc,
        onErrorFunc
      ) {
        vue.preloadImage(
          _prepLocator(locator),
          true, // wait for preload to finish
          () => {
            if (onLoadFunc) {
              interpreter.queueFunction(onLoadFunc, this)
              interpreter.run()
            }
          },
          e => {
            if (onErrorFunc) {
              interpreter.queueFunction(onErrorFunc, this, e)
              interpreter.run()
            }
          }
        )
        return this
      })

      interpreter.setNativeFunctionPrototype(manager, 'oeosVersion', function(
        v
      ) {
        if (!arguments.length) return version
        return compareVersions(version, v)
      })

      const allowedCssVars = {
        '--bubble-area-top': true,
        '--bubble-area-image-top': true,
        '--bubble-area-left': true,
        '--bubble-area-right': true,
        '--bubble-area-bottom': true,
        '--notifications-top': true,
        '--notifications-left': true,
        '--notifications-right': true,
        '--notifications-bottom': true,
      }

      interpreter.setNativeFunctionPrototype(manager, 'cssVar', function(
        name,
        val
      ) {
        if (!allowedCssVars[name]) {
          return interpreter.createThrowable(
            interpreter.TYPE_ERROR,
            `Invalid cssVar: ${name};  Allowed cssVars are: ${Object.keys(
              allowedCssVars
            ).join(', ')}`
          )
        }
        if (arguments.length < 2) {
          return vue.cssVars[name]
        }
        vue.cssVars[name] = val + ''
        return this
      })

      interpreter.setNativeFunctionPrototype(manager, 'barColor', function(
        color
      ) {
        if (!arguments.length) {
          return vue.$vuetify.theme.themes.dark.primary
        }
        color = vue.validateHTMLColor(color)
        if (color instanceof vue.Interpreter.Throwable) return color
        vue.$vuetify.theme.themes.dark.primary = color
        return this
      })

      interpreter.setNativeFunctionPrototype(manager, 'bgLockColor', function(
        color
      ) {
        if (!arguments.length) {
          return vue.forcedBackgroundColor
        }
        if (!color) {
          vue.forcedBackgroundColor = null
        }
        color = vue.validateHTMLColor(color)
        if (color instanceof vue.Interpreter.Throwable) return color
        vue.forcedBackgroundColor = color
        return this
      })

      interpreter.setNativeFunctionPrototype(manager, 'bgColor', function(
        color
      ) {
        if (!arguments.length) {
          return vue.currentBackgroundColor
        }
        if (!color) {
          vue.backgroundColor = null
        }
        color = vue.validateHTMLColor(color)
        if (color instanceof vue.Interpreter.Throwable) return color
        vue.backgroundColor = color
        return this
      })

      interpreter.setNativeFunctionPrototype(
        manager,
        'getCurrentPageId',
        () => {
          return this.getCurrentPageId()
        }
      )
      interpreter.setNativeFunctionPrototype(manager, 'end', () => {
        vue.endTease()
      })
      interpreter.setNativeFunctionPrototype(manager, 'goto', pageId => {
        // goto is now just a wrapper around showPage
        try {
          this.showPage(pageId)
        } catch (e) {
          console.error(e)
          return interpreter.createThrowable(
            interpreter.TYPE_ERROR,
            `Error loading page: ${pageId};  ${e.toString()}`
          )
        }
      })

      pagesInstance = interpreter.createObjectProto(proto)
      interpreter.setProperty(globalObject, 'pages', pagesInstance)

      interpreter.appendCode(pagesCode)
      interpreter.run()
    },
  },
}
