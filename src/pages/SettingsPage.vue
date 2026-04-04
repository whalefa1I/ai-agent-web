<template>
  <div class="settings-page min-h-screen bg-gray-50">
    <!-- 头部 -->
    <header class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
      <div class="flex items-center space-x-3">
        <button @click="$router.back()" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-lg font-bold text-gray-800">设置</h1>
      </div>
    </header>

    <!-- 内容 -->
    <main class="p-4 space-y-4 max-w-2xl mx-auto">
      <!-- API 配置 -->
      <section class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 class="font-semibold text-gray-800">API 配置</h2>
        </div>
        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">服务端地址</label>
            <input
              v-model="serverUrl"
              type="text"
              placeholder="https://your-server.railway.app"
              class="w-full rounded-xl border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
            />
            <p class="text-xs text-gray-500 mt-1">WebSocket 和 HTTP API 的基础地址</p>
          </div>
        </div>
      </section>

      <!-- 模型配置 -->
      <section class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 class="font-semibold text-gray-800">模型配置</h2>
        </div>
        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">模型名称</label>
            <select v-model="modelName"
                    class="w-full rounded-xl border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all">
              <option value="kimi-k2">Kimi K2</option>
              <option value="kimi-k1.5">Kimi K1.5</option>
              <option value="qwen-plus">Qwen Plus</option>
              <option value="qwen-max">Qwen Max</option>
              <option value="glm-4">GLM-4</option>
              <option value="glm-4-flash">GLM-4 Flash</option>
            </select>
            <p class="text-xs text-gray-500 mt-1">阿里云百炼可用模型</p>
          </div>
        </div>
      </section>

      <!-- 权限配置 -->
      <section class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 class="font-semibold text-gray-800">权限配置</h2>
        </div>
        <div class="p-4 space-y-3">
          <label class="flex items-center justify-between cursor-pointer">
            <span class="text-sm text-gray-700">自动允许只读工具</span>
            <input v-model="autoAllowReadOnly" type="checkbox"
                   class="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-200" />
          </label>
          <label class="flex items-center justify-between cursor-pointer">
            <span class="text-sm text-gray-700">自动允许文件操作</span>
            <input v-model="autoAllowFileOps" type="checkbox"
                   class="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-200" />
          </label>
        </div>
      </section>

      <!-- 关于 -->
      <section class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 class="font-semibold text-gray-800">关于</h2>
        </div>
        <div class="p-4">
          <div class="text-sm text-gray-600">
            <p class="mb-2"><strong>ai-agent-web</strong> - AI Agent 前端</p>
            <p class="text-xs text-gray-500">版本：1.0.0</p>
            <p class="text-xs text-gray-500 mt-2">基于 Spring Boot + Vue 3 构建</p>
          </div>
        </div>
      </section>

      <!-- 保存按钮 -->
      <button @click="saveSettings"
              class="w-full py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors shadow-lg shadow-primary-200">
        保存设置
      </button>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// 配置状态
const serverUrl = ref('http://localhost:8080')
const modelName = ref('kimi-k2')
const autoAllowReadOnly = ref(true)
const autoAllowFileOps = ref(false)

// 本地存储 Key
const STORAGE_KEY = 'ai-agent-settings'

// 加载设置
onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      if (settings.serverUrl) serverUrl.value = settings.serverUrl
      if (settings.modelName) modelName.value = settings.modelName
      if (typeof settings.autoAllowReadOnly === 'boolean') autoAllowReadOnly.value = settings.autoAllowReadOnly
      if (typeof settings.autoAllowFileOps === 'boolean') autoAllowFileOps.value = settings.autoAllowFileOps
    } catch (e) {
      console.error('加载设置失败:', e)
    }
  }
})

// 保存设置
const saveSettings = () => {
  const settings = {
    serverUrl: serverUrl.value,
    modelName: modelName.value,
    autoAllowReadOnly: autoAllowReadOnly.value,
    autoAllowFileOps: autoAllowFileOps.value
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  alert('设置已保存，刷新页面后生效')
}
</script>
