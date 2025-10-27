// Replace all polyfill for older browsers
if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function(str, newStr) {
    // If a regex pattern
    if (
      Object.prototype.toString.call(str).toLowerCase() === '[object regexp]'
    ) {
      return this.replace(str, newStr)
    }

    // If a string
    return this.replace(
      new RegExp(str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'),
      newStr
    )
  }
}

import Vue from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import 'vue-resize/dist/vue-resize.css'
// import '@mdi/font/css/materialdesignicons.css'
import VueScrollTo from 'vue-scrollto'
import GlobalEvents from 'vue-global-events'
// import 'typeface-noto-sans'
import VueResize from 'vue-resize'
import './styles/isolation.css'

if (location.hostname === 'oeos-player-preview.herokuapp.com') {
  const query = window.location.search
  window.location.replace('https://oeos.ml' + query)
} else {
  Vue.config.productionTip = false

  Vue.use(VueResize)
  Vue.use(VueScrollTo)
  Vue.component('GlobalEvents', GlobalEvents)

  const vueInstance = new Vue({
    vuetify,
    render: h => h(App),
  }).$mount('#app')

  // 保存 Vue 实例到 window，以便外部销毁
  window.oeosVueInstance = vueInstance

  // 挂载后立即重置外部样式，防止 Vuetify 影响 SillyTavern
  Vue.nextTick(() => {
    // 保存原始的 body 样式
    const originalBodyFontSize = window.getComputedStyle(document.body).fontSize

    // 创建一个 MutationObserver 来监听样式变化
    const observer = new MutationObserver(() => {
      // 重置 body 的字体大小
      if (
        document.body.style.fontSize &&
        document.body.style.fontSize !== originalBodyFontSize
      ) {
        document.body.style.fontSize = ''
      }
    })

    // 监听 body 的属性变化
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    })
  })
}
