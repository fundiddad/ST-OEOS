// Expose a minimal API surface to the Vue app via window.oeosApi
// Fill these functions with real implementations that read/write
// SillyTavern runtime state as per target_new.md / IMPLEMENTATION_GUIDE.md.

(function ensureApi() {
  const stub = {
    async initGameData() {
      console.warn('[OEOS stub] initGameData not implemented')
    },
    async getPage(pageId) {
      console.warn('[OEOS stub] getPage not implemented', pageId)
      return null
    },
    updateState(state) {
      console.warn('[OEOS stub] updateState not implemented', state)
    },
    async bindCharacter(index) {
      console.warn('[OEOS stub] bindCharacter not implemented', index)
    },
  }

  if (!window.oeosApi) {
    window.oeosApi = stub
  } else {
    // Merge to avoid clobbering if something already set it
    window.oeosApi = Object.assign({}, stub, window.oeosApi)
  }
})()

