<template>
  <div class="mcp-server-view">
    <div v-if="servers && servers.length > 0" class="servers-list">
      <div class="servers-header">
        <span class="header-icon">🔌</span>
        <span class="header-title">MCP 服务器</span>
        <span class="header-count">{{ connectedCount }}/{{ servers.length }} 已连接</span>
      </div>

      <div class="servers-body">
        <div v-for="server in servers" :key="server.name" class="server-item">
          <div class="server-header">
            <span class="server-status" :class="{ connected: server.connected }">
              {{ server.connected ? '🟢' : '🔴' }}
            </span>
            <span class="server-name">{{ server.name }}</span>
            <span class="server-transport">{{ server.transport }}</span>
          </div>

          <div v-if="server.connected" class="server-tools">
            <div class="tools-label">工具 ({{ server.tools?.length || 0 }})</div>
            <div class="tools-list">
              <span v-for="tool in server.tools" :key="tool" class="tool-badge">
                {{ tool }}
              </span>
            </div>
          </div>

          <div v-else-if="server.lastError" class="server-error">
            <span class="error-icon">❌</span>
            <span>{{ server.lastError }}</span>
          </div>

          <div class="server-actions">
            <button
              v-if="!server.connected"
              class="btn btn-connect"
              @click="$emit('connect', server.name)">
              连接
            </button>
            <button
              v-else
              class="btn btn-disconnect"
              @click="$emit('disconnect', server.name)">
              断开
            </button>
            <button
              class="btn btn-health"
              @click="$emit('healthcheck', server.name)">
              健康检查
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <span class="empty-icon">🔌</span>
      <span>暂无 MCP 服务器</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface McpServer {
  name: string
  url: string
  transport: 'stdio' | 'sse' | 'websocket'
  connected: boolean
  tools?: string[]
  lastError?: string
  lastHealthCheck?: number
}

const props = defineProps<{
  servers: McpServer[]
}>()

defineEmits<{
  connect: [name: string]
  disconnect: [name: string]
  healthcheck: [name: string]
}>()

const connectedCount = computed(() => {
  return props.servers.filter(s => s.connected).length
})
</script>

<style scoped>
.mcp-server-view {
  padding: 8px 0;
}

.servers-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.servers-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f3f4f6;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
}

.header-icon {
  font-size: 16px;
}

.header-title {
  flex: 1;
  font-weight: 600;
}

.header-count {
  color: #6b7280;
  font-size: 12px;
}

.servers-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.server-item {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
}

.server-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.server-status {
  font-size: 12px;
}

.server-name {
  flex: 1;
  font-weight: 500;
  color: #111827;
}

.server-transport {
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  color: #6b7280;
}

.server-tools {
  margin: 8px 0;
}

.tools-label {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 4px;
}

.tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tool-badge {
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  color: #374151;
}

.server-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background: #fef2f2;
  border-radius: 4px;
  color: #dc2626;
  font-size: 12px;
  margin: 8px 0;
}

.error-icon {
  font-size: 14px;
}

.server-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid transparent;
  cursor: pointer;
}

.btn-connect {
  background: #16a34a;
  color: white;
}

.btn-connect:hover {
  background: #15803d;
}

.btn-disconnect {
  background: #dc2626;
  color: white;
}

.btn-disconnect:hover {
  background: #b91c1c;
}

.btn-health {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-health:hover {
  background: #e5e7eb;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  color: #9ca3af;
  font-size: 13px;
}

.empty-icon {
  font-size: 32px;
  opacity: 0.5;
}
</style>
