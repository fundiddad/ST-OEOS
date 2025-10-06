import { parseEosDuration } from '../util'

let idCounter = 0

export default {
  data: () => ({
    timers: [],
  }),
  methods: {
    purgePageTimers() {
      for (let i = this.timers.length - 1; i >= 0; i--) {
        if (!this.timers[i].persist) {
          this.timers.splice(i, 1)
        }
      }
    },
    removeTimer(timerId) {
      if (!timerId) return
      const index = this.timers.findIndex(t => t.id === timerId)
      if (index > -1) {
        this.timers.splice(index, 1)
      }
    },
    getTimerById(timerId) {
      return this.timers.find(t => t.id === timerId)
    },
    installTimer(interpreter, globalObject) {
      const vue = this
      const constructor = function(opt) {
        const optProps = opt.properties
        let timerId = '__timer_' + ++idCounter
        vue.debug('Creating timer')
        const pseudoItem = interpreter.createObjectProto(proto)
        const timer = {}
        timer.pseudoItem = () => pseudoItem
        pseudoItem._item = timer
        for (var i in optProps) {
          // Copy source props to our new timer
          const pseudoVal = optProps[i]
          if (pseudoVal instanceof vue.Interpreter.Object) {
            // Convert Interpreter objects to native
            timer[i] = interpreter.pseudoToNative(pseudoVal)
          } else if (typeof pseudoVal === 'object') {
            // Copy other objects as-is
            // timer[i] = pseudoVal
          } else {
            // Make other props reactive
            vue.$set(timer, i, pseudoVal)
          }
          // interpreter.setProperty(timer, i, pseudoVal)
        }
        // interpreter.setProperty(timer, 'id', timerId)
        const duration = parseEosDuration(timer.duration)
        timer.duration = duration
        timer.timeLeft = duration
        timer.loop = 0
        timer.id = timer.id || timerId
        timer.paused = !!timer.paused
        timer.onTimeout = () => {
          if (optProps.onTimeout) {
            // onTimeout callback provided by interperted code
            // (interpreter has been doing other things while our timer was running)
            interpreter.queueFunction(optProps.onTimeout, pseudoItem)
            vue.removeTimer(timer.id)
            interpreter.run()
          }
          if (optProps.onContinue) {
            interpreter.queueFunction(optProps.onContinue, pseudoItem)
            vue.removeTimer(timer.id)
            interpreter.run()
          }
        }
        timer.onLoop = () => {
          if (optProps.onTimeout) {
            // onTimeout callback provided by interperted code
            // (interpreter has been doing other things while our timer was running)
            interpreter.queueFunction(optProps.onTimeout, pseudoItem)
            interpreter.run()
          }
        }
        timer.onUpdate = ({ remaining, loop }) => {
          timer.loop = loop
          timer.remaining = remaining
        }
        timer.ready = el => {
          timer._o_el = el
          if (optProps.ready) {
            interpreter.queueFunction(
              optProps.ready,
              pseudoItem,
              this.getHTMLElementPseudo(el, true)
            )
            interpreter.run()
          }
        }
        vue.debug('Adding timer', timer)
        vue.timers.push(timer)
        return pseudoItem
      }

      const manager = interpreter.createNativeFunction(constructor, true)
      interpreter.setProperty(
        manager,
        'prototype',
        interpreter.createObject(globalObject.properties['EventTarget']),
        this.Interpreter.NONENUMERABLE_DESCRIPTOR
      )
      const proto = manager.properties['prototype']
      interpreter.setProperty(globalObject, 'Timer', manager)

      interpreter.setProperty(
        manager,
        'get',
        interpreter.createNativeFunction(id => {
          if (typeof id !== 'string') {
            throw new TypeError('id must be a string')
          }
          const timer = this.getTimerById(id.pseudoItem ? id.pseudoItem() : id)
          if (timer) {
            return timer.pseudoItem()
          }
        }),
        this.Interpreter.NONENUMERABLE_DESCRIPTOR
      )

      interpreter.setNativeFunctionPrototype(manager, 'getElement', function() {
        return vue.getHTMLElementPseudo(this._item._o_el, true)
      })

      interpreter.setProperty(
        manager,
        'getAll',
        interpreter.createNativeFunction(() => {
          var pseudoArray = interpreter.createArray()
          this.timers.forEach((a, i) => {
            interpreter.setProperty(pseudoArray, i, a.pseudoItem())
          })
          return pseudoArray
        }),
        this.Interpreter.NONENUMERABLE_DESCRIPTOR
      )

      interpreter.setNativeFunctionPrototype(manager, 'remove', function() {
        vue.removeTimer(this._item.id)
      })

      interpreter.setNativeFunctionPrototype(manager, 'pause', function() {
        this._item.paused = true
      })

      interpreter.setNativeFunctionPrototype(manager, 'play', function() {
        this._item.paused = false
      })

      interpreter.setNativeFunctionPrototype(manager, 'getId', function() {
        return this._item.id
      })

      interpreter.setNativeFunctionPrototype(
        manager,
        'getRemaining',
        function() {
          return this.remaining
        }
      )

      interpreter.setNativeFunctionPrototype(manager, 'getLoop', function() {
        return this._item.loop
      })

      interpreter.setNativeFunctionPrototype(manager, 'getPaused', function() {
        return !!this._item.paused
      })

      interpreter.setNativeFunctionPrototype(manager, 'getLoops', function() {
        return this._item.loops
      })
    },
  },
}
