<template>
  <div class="app-container">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { wsService } from '@/services/websocket'

const chatStore = useChatStore()

onMounted(async () => {
  // 初始化 WebSocket 连接
  try {
    await wsService.connect()
    chatStore.initWebSocket()
  } catch (error) {
    console.error('WebSocket 连接失败:', error)
  }
})

onUnmounted(() => {
  wsService.disconnect()
})
</script>

<style>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
