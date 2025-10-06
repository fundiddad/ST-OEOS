import pagesCode from '!!raw-loader!../interpreter/code/pages.js'
import normalizeCommand from '../util/commandAdapter.js'
import minimatch from 'minimatch'
import compareVersions from 'compare-versions'
import { version } from '../../package.json'

let navCounter = 0
let navIndex = 0
let disabledPages = {}
let preloadedPage = {}
let lastGetPageId = null
let skipNextBubbleClear = false
let nextPageFuncs = []
let nextImageFuncs = []

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
    // preloadImages: [],
  }),
  mounted() {
    navCounter = 0
    disabledPages = {}
    preloadedPage = {}
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
    getPageNames: function(pattern, onlyEnabled) {
      const pages = Object.keys(this.pages())
      if (!pattern) return pages
      const filter = minimatch.filter(pattern)
      return pages.filter(filter).filter(p => !onlyEnabled || !disabledPages[p])
    },
    endTease() {
      navCounter++
      // TODO: display end modal
      if (this.allowNoSleep) this.noSleep.disable() // Allow tease to sleep on mobile devices
      this.showEndDialog = true
    },
    pagesInstance() {
      return pagesInstance
    },
    documentVisibilityChange(e) {
      this.dispatchEvent({
        target: pagesInstance,
        type: 'visibilitychange', // Tab lost or gained focus
        timeStamp: e.timeStamp + performance.timing.navigationStart,
      })
    },
    documentSizeChange(e) {
      this.dispatchEvent({
        target: pagesInstance,
        type: 'resize', // Tab lost or gained focus
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
      const x = e.clientX - rect.left //x position within the element.
      const y = e.clientY - rect.top //y position within the element.
      this.dispatchEvent(
        {
          target: pagesInstance,
          type: 'click',
          value: {
            x: x / e.target.clientWidth, // between 0 and 1, where clicked
            y: y / e.target.clientHeight, // between 0 and 1, where clicked
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
      const pages = Object.keys(this.pages()).filter(filter)

      for (const page of pages) {
        delete disabledPages[page]
      }
    },
    disablePage(pattern) {
      const filter = minimatch.filter(pattern)
      const pages = Object.keys(this.pages()).filter(filter)

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
    showPage(patten, noRun) {
      this.debugWarn('Showing Page:', patten)
      const interpreter = this.interpreter
      const pageScript = this.getPageScript(patten)
      // Normalize commands to ensure backward compatibility with array format
      if (pageScript && pageScript.script && Array.isArray(pageScript.script)) {
        pageScript.script = pageScript.script.map(normalizeCommand)
      }

      // Handle new storage commands before interpreter parsing
      if (pageScript && pageScript.script && Array.isArray(pageScript.script)) {
        const remainingCommands = []
        for (const command of pageScript.script) {
          const commandName = Object.keys(command)[0]
          const params = command[commandName]
          let handled = false
          switch (commandName) {
            case 'storage.set':
              this.storageSet(params.key, params.value)
              handled = true
              break
            case 'storage.remove':
              this.storageRemove(params.key)
              handled = true
              break
            case 'storage.clear':
              this.storageClear()
              handled = true
              break
          }
          if (!handled) {
            remainingCommands.push(command)
          }
        }
        // Replace the script with the filtered one
        pageScript.script = remainingCommands
        // Invalidate cached compiled code if it exists
        delete pageScript.code
      }

      const pageId = lastGetPageId
      let pageCode = pageScript.code
      if (!pageCode) {
        // console.log('Building "' + pageId + '" page script', pageScript.script)
        pageCode = interpreter.parse_(
          pageScript.script,
          'oeosPageScript:' + pageId
        )
        pageScript.code = pageCode
      }

      this.lastPageId = this.currentPageId
      this.currentPageId = pageId
      navCounter++ // Increment nav counter so we know when to stop executing page commands
      navIndex++ // Increment nav depth, so we know to skip consecutive gotos.
      this.beforePageChange()
      this.waitingForPageChange = true
      this.doNextPageFuncs()
      interpreter.appendCode(pageCode)
      this.waitingForPageChange = false
      if (!noRun) interpreter.run()
    },
    lastGetPageId() {
      return lastGetPageId
    },
    hasPage(pattern) {
      if (isPattern(pattern)) {
        return !!this.getPageNames(pattern, true).length
      } else {
        return !!this.pages()[pattern]
      }
    },
    getPage(pattern, preload) {
      // if (!preload && preloadedPage[pattern]) {
      //   const result = preloadedPage[pattern]
      //   delete preloadedPage[pattern]
      //   pattern = result
      // }
      if (isPattern(pattern)) {
        var lastLookup = preloadedPage[pattern]
        if (!lastLookup) {
          lastLookup = []
          preloadedPage[pattern] = lastLookup
        }
        if (!preload && lastLookup.length) {
          const preloadFromPattern = lastLookup.shift()
          if (this.isPageEnabled(preloadFromPattern)) {
            pattern = preloadFromPattern
          }
        }
        if (isPattern(pattern)) {
          const pages = this.getPageNames(pattern, true)
          const selectedPage =
            pages.length && pages[Math.floor(Math.random() * pages.length)]
          if (selectedPage) {
            if (preload) {
              // preloadedPage[pattern] = selectedPage
              lastLookup.push(selectedPage)
            }
            pattern = selectedPage
          } else {
            throw new Error(`No enabled page found with pattern: ${pattern}`)
          }
        }
      }
      const result = this.pages()[pattern]
      if (!result) {
        this.debugWarn('Script pages', this.pages())
        throw new Error(`Invalid page: ${pattern}`)
      }
      lastGetPageId = pattern
      return result
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
        // If more than one pages.goto(...) were executed in a row before the
        // interpreted script returns control to us, this will make sure only the last
        // goto is executed, just like the original EOS player
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
            // Done
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
        try {
          return this.showPage(pageId)
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

      // Add interpreted code
      interpreter.appendCode(pagesCode)
      interpreter.run()
    },
  },
}
