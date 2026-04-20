import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import router from '@/router'
import App from './App.vue'
import './assets/main.css'
import { useAuthStore } from '@/stores/authStore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// PWA service worker — auto-updates in the background.
// Reloads once a new build is ready so the user gets the latest UI + bug fixes.
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload()
  },
})

// Resolve auth state before the first router navigation so guards see the real user
useAuthStore().fetchMe().then(() => {
  app.use(router).mount('#app')
})
