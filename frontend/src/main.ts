import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'
import App from './App.vue'
import './assets/main.css'
import { useAuthStore } from '@/stores/authStore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// Resolve auth state before the first router navigation so guards see the real user
useAuthStore().fetchMe().then(() => {
  app.use(router).mount('#app')
})
