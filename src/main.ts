import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './styles/main.css'

// 页面组件
import ChatPage from './pages/ChatPage.vue'
import SettingsPage from './pages/SettingsPage.vue'
import TestPage from './pages/TestPage.vue'

// 路由配置
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/chat' },
    { path: '/chat', component: ChatPage },
    { path: '/settings', component: SettingsPage },
    { path: '/test', component: TestPage }
  ]
})

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
