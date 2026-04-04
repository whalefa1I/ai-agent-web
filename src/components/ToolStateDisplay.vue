<template>
  <div class="tool-state-display">
    <div v-if="artifacts.length === 0" class="no-tools">
      <p>暂无工具调用</p>
    </div>

    <div v-else class="tools-list">
      <div
        v-for="artifact in artifacts"
        :key="artifact.id"
        class="tool-card"
        :class="getStatusClass(artifact)"
      >
        <!-- 工具头部 -->
        <div class="tool-header">
          <span class="tool-name">{{ getToolName(artifact) }}</span>
          <span class="tool-status" :class="artifact.header?.status">
            {{ formatStatus(artifact.header?.status) }}
          </span>
        </div>

        <!-- 工具内容 -->
        <div class="tool-body">
          <!-- TODO 状态 -->
          <div v-if="artifact.header?.status === 'todo'" class="todo-content">
            <p>{{ artifact.body?.todo }}</p>
          </div>

          <!-- 计划状态 -->
          <div v-if="artifact.header?.status === 'plan'" class="plan-content">
            <ul>
              <li v-for="(step, index) in artifact.body?.plan" :key="index">
                {{ step }}
              </li>
            </ul>
          </div>

          <!-- 待确认状态 -->
          <div v-if="artifact.header?.status === 'pending_confirmation'" class="confirmation-content">
            <p class="confirmation-label">需要您的确认：</p>
            <pre class="input-preview">{{ JSON.stringify(artifact.body?.input, null, 2) }}</pre>
            <div class="confirmation-actions" v-if="!artifact.body?.confirmation?.granted">
              <button @click="handleConfirm(artifact)" class="btn-confirm">确认执行</button>
              <button @click="handleDeny(artifact)" class="btn-deny">拒绝</button>
            </div>
            <div v-else class="confirmation-granted">
              <span class="checkmark">✓</span> 已确认
            </div>
          </div>

          <!-- 执行中状态 -->
          <div v-if="artifact.header?.status === 'executing'" class="executing-content">
            <div class="spinner"></div>
            <p>{{ artifact.body?.progress || '正在执行...' }}</p>
          </div>

          <!-- 完成状态 -->
          <div v-if="artifact.header?.status === 'completed'" class="completed-content">
            <p class="success-text">执行完成</p>
            <pre v-if="artifact.body?.output" class="output-preview">{{ JSON.stringify(artifact.body.output, null, 2) }}</pre>
          </div>

          <!-- 失败状态 -->
          <div v-if="artifact.header?.status === 'failed'" class="failed-content">
            <p class="error-text">执行失败</p>
            <pre class="error-message">{{ artifact.body?.error }}</pre>
          </div>
        </div>

        <!-- 版本信息 -->
        <div class="tool-footer">
          <span>版本：v{{ artifact.bodyVersion }}</span>
          <span class="timestamp">{{ formatTime(artifact.updatedAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ToolArtifact } from '@/types/tool-state'
import { useToolStateWebSocket } from '@/composables/useToolStateWebSocket'

const props = defineProps<{
  sessionId: string
  userId: string
}>()

const { artifacts, updateArtifact } = useToolStateWebSocket(props.userId)

// 获取工具名称
function getToolName(artifact: ToolArtifact): string {
  return artifact.header?.name || 'Unknown Tool'
}

// 获取状态样式类
function getStatusClass(artifact: ToolArtifact): string {
  const status = artifact.header?.status || 'todo'
  return `status-${status}`
}

// 格式化状态文本
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    todo: '待执行',
    plan: '计划中',
    pending_confirmation: '待确认',
    executing: '执行中',
    completed: '已完成',
    failed: '已失败'
  }
  return statusMap[status] || status
}

// 格式化时间
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

// 处理确认
async function handleConfirm(artifact: ToolArtifact) {
  await updateArtifact(
    artifact.id,
    'executing',
    {
      ...artifact.body,
      confirmation: { requested: true, granted: true }
    },
    artifact.bodyVersion
  )
}

// 处理拒绝
async function handleDeny(artifact: ToolArtifact) {
  await updateArtifact(
    artifact.id,
    'failed',
    {
      ...artifact.body,
      confirmation: { requested: true, granted: false },
      error: '用户拒绝执行'
    },
    artifact.bodyVersion
  )
}
</script>

<style scoped>
.tool-state-display {
  padding: 16px;
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tool-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tool-name {
  font-weight: 600;
  font-size: 14px;
}

.tool-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.tool-status.todo { background: #f0f0f0; }
.tool-status.plan { background: #e3f2fd; color: #1976d2; }
.tool-status.pending_confirmation { background: #fff3e0; color: #f57c00; }
.tool-status.executing { background: #e8f5e9; color: #388e3c; }
.tool-status.completed { background: #e8f5e9; color: #2e7d32; }
.tool-status.failed { background: #ffebee; color: #c62828; }

.tool-body {
  margin-top: 8px;
}

.confirmation-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn-confirm, .btn-deny {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-confirm {
  background: #1976d2;
  color: white;
}

.btn-deny {
  background: #f5f5f5;
  color: #666;
}

.input-preview, .output-preview {
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #e0e0e0;
  border-top-color: #1976d2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.tool-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
  font-size: 12px;
  color: #999;
}
</style>
