let STORAGE = {}
let MAX_STORAGE = 1024

export default {
  props: {
    teaseStorage: {
      type: String,
      default: null,
    },
  },
  data: () => ({}),
  watch: {
    teaseStorage(v) {
      const key = this.getStorageKey()
      if (v && v !== localStorage.getItem(key)) {
        try {
          const decoded = JSON.parse(v)
          STORAGE = decoded
          this.debugWarn('Restored tease storage', STORAGE)
          this.saveStorage()
          return
        } catch (e) {
          console.error('Invalid storage data', v)
        }
      }
    },
  },
  methods: {
    // New methods to handle JSON commands
    storageSet(key, value) {
      if (typeof key !== 'string') {
        console.error('storage.set: key must be a string')
        return
      }
      STORAGE[key] = value
      this.saveStorage()
    },
    storageRemove(key) {
      if (typeof key !== 'string') {
        console.error('storage.remove: key must be a string')
        return
      }
      delete STORAGE[key]
      this.saveStorage()
    },
    storageClear() {
      STORAGE = {}
      this.saveStorage()
    },
    getStorageKey() {
      return 'oeosTeaseStorage-' + this.teaseId
    },
    saveStorage() {
      if (!this.teaseId) return
      const data = JSON.stringify(STORAGE)
      if (data.length > MAX_STORAGE) {
        console.error(
          `Unable to save Tease Storage.  Over ${MAX_STORAGE} bytes.`
        )
        this.$emit('save-storage', data) // Allow parent handlers to decide if it's too big for them.
        return data.length - MAX_STORAGE
      }
      const key = this.getStorageKey()
      if (data !== localStorage.getItem(key)) {
        localStorage.setItem(key, this.hasStorageModule() ? data : false)
        this.$emit('save-storage', this.hasStorageModule() ? data : false)
      }
    },
    loadStorage() {
      if (!this.teaseId) return
      const data = localStorage.getItem(this.getStorageKey())
      this.debug('this.hasStorageModule', this.hasStorageModule())
      if (data) {
        try {
          const decoded = JSON.parse(data)
          STORAGE = decoded
          this.$emit('load-storage', this.hasStorageModule() ? data : false)
          return
        } catch (e) {
          console.error('Invalid storage data', data)
        }
      }
      STORAGE = {}
      this.$emit(
        'load-storage',
        this.hasStorageModule() ? JSON.stringify(STORAGE) : false
      )
    },
    installStorage(interpreter, globalObject) {
      const manager = interpreter.createObject(interpreter.OBJECT)
      interpreter.setProperty(manager, 'length', Object.keys(STORAGE).length)

      const keyFn = interpreter.createNativeFunction(index => {
        if (typeof index !== 'number') {
          return interpreter.createThrowable(
            interpreter.TYPE_ERROR,
            'Index must be a number'
          )
        }
        return Object.keys(STORAGE)[index]
      })
      interpreter.setProperty(manager, 'key', keyFn)

      const getItemFn = interpreter.createNativeFunction(keyName => {
        if (typeof keyName !== 'string') {
          return interpreter.createThrowable(
            interpreter.TYPE_ERROR,
            'Key must be a string'
          )
        }

        if (Object.keys(STORAGE).indexOf(keyName) !== -1) {
          return interpreter.nativeToPseudo(STORAGE[keyName])
        } else {
          return undefined
        }
      })
      interpreter.setProperty(manager, 'getItem', getItemFn)
      interpreter.setProperty(manager, 'get', getItemFn) // ALIAS

      const setItemFn = interpreter.createNativeFunction((keyName, value) => {
        if (typeof keyName !== 'string') {
          return interpreter.createThrowable(
            interpreter.TYPE_ERROR,
            'Key must be a string'
          )
        }
        // Sanitize value
        STORAGE[keyName] = JSON.parse(
          JSON.stringify(interpreter.pseudoToNative(value))
        )

        return this.saveStorage()
      })
      interpreter.setProperty(manager, 'setItem', setItemFn)
      interpreter.setProperty(manager, 'set', setItemFn) // ALIAS

      const removeItemFn = interpreter.createNativeFunction(keyName => {
        if (typeof keyName !== 'string') {
          return interpreter.createThrowable(
            interpreter.TYPE_ERROR,
            'Key must be a string'
          )
        }

        delete STORAGE[keyName]

        return this.saveStorage()
      })
      interpreter.setProperty(manager, 'removeItem', removeItemFn)
      interpreter.setProperty(manager, 'remove', removeItemFn) // ALIAS

      const clearFn = interpreter.createNativeFunction(() => {
        STORAGE = {}
        this.saveStorage()
      })
      interpreter.setProperty(manager, 'clear', clearFn)

      // Set both legacy and new properties on the global object for compatibility
      interpreter.setProperty(globalObject, 'teaseStorage', manager)
      interpreter.setProperty(globalObject, 'Storage', manager)
      interpreter.setProperty(globalObject, 'storage', manager) // ALIAS for lowercase
    },
  },
}
