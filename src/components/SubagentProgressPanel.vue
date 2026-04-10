<template>
  <div class="subagent-progress-panel" :class="{ 'compact': compact, 'expanded': isExpanded }">
    <!-- 头部：批次概览 -->
    <div class="panel-header" @click="toggleExpand">
      <div class="header-left">
        <div class="status-icon" :class="batchStatusClass">
          <svg v-if="allTasksCompleted && !hasFailedTasks" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          <svg v-else-if="hasFailedTasks" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <svg v-else class="icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </div>
        <div class="header-info">
          <div class="title">
            <span v-if="allTasksCompleted && !hasFailedTasks">✅ 并行任务完成</span>
            <span v-else-if="hasFailedTasks">⚠️ 部分任务失败</span>
            <span v-else>
              🚀 {{ displayTaskCount }} 个任务并行执行中
              <span v-if="estimatedRemaining" class="time-remaining">
                （约 {{ estimatedRemaining }} 秒）
              </span>
            </span>
          </div>
          <div class="subtitle">
            {{ completedCount }}/{{ totalCount }} 完成
            <span v-if="failedCount > 0" class="failed-count">，{{ failedCount }} 失败</span>
          </div>
        </div>
      </div>
      <div class="header-right">
        <div class="progress-ring" :style="{ '--progress': progressPercentage }">
          <svg viewBox="0 0 36 36">
            <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            <path class="ring-fill" :stroke-dasharray="`${progressPercentage}, 100`" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
          </svg>
          <span class="progress-text">{{ progressPercentage }}%</span>
        </div>
        <button class="expand-btn" :class="{ 'expanded': isExpanded }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 展开后的任务列表 -->
    <transition name="expand">
      <div v-if="isExpanded" class="task-list">
        <div 
          v-for="task in sortedTasks" 
          :key="task.runId" 
          class="task-item"
          :class="`status-${task.status}`"
        >
          <div class="task-status-icon">
            <svg v-if="task.status === 'completed'" class="icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <svg v-else-if="task.status === 'failed' || task.status === 'cancelled'" class="icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            <div v-else-if="task.status === 'running'" class="progress-spinner">
              <div class="spinner-ring"></div>
            </div>
            <div v-else class="status-dot pending"></div>
          </div>
          
          <div class="task-content">
            <div class="task-goal" :title="task.goal">{{ truncateGoal(task.goal) }}</div>
            <div class="task-meta">
              <span v-if="task.status === 'running' && task.progress !== undefined" class="progress-bar">
                <span class="progress-fill" :style="{ width: `${task.progress}%` }"></span>
                <span class="progress-label">{{ task.progress }}%</span>
              </span>
              <span v-else-if="task.phase" class="phase-label">{{ task.phase }}</span>
              <span class="run-id">{{ shortenRunId(task.runId) }}</span>
            </div>
          </div>
          
          <div class="task-duration">
            <span v-if="task.completedAt && task.startedAt">
              {{ formatDuration(task.completedAt - task.startedAt) }}
            </span>
            <span v-else-if="task.startedAt" class="running-time">
              {{ formatDuration(Date.now() - task.startedAt) }}
            </span>
          </div>
        </div>
      </div>
    </transition>

    <!-- 连接状态提示 -->
    <div v-if="connectionError" class="connection-error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      <span>实时连接断开：{{ connectionError }}</span>
      <button @click.stop="reconnect">重连</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { SubagentTask, BatchInfo } from '@/services/subagent-sse-service'

interface Props {
  batch: BatchInfo | null
  isConnected: boolean
  connectionError: string | null
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compact: false
})

const emit = defineEmits<{
  reconnect: []
}>()

const isExpanded = ref(true)

// 切换展开/收起
const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

// 创建默认批次（当没有 batch 但已连接时）
const effectiveBatch = computed<BatchInfo | null>(() => {
  if (props.batch) return props.batch
  
  // 如果没有 batch 但已连接，显示一个简化版
  if (props.isConnected) {
    return {
      batchId: 'connecting',
      sessionId: '',
      totalTasks: 1,
      completedTasks: 0,
      failedTasks: 0,
      status: 'running',
      tasks: [{
        runId: 'unknown',
        goal: '子任务执行中...',
        status: 'running'
      }],
      startedAt: Date.now()
    }
  }
  
  return null
})

// 计算属性（使用 effectiveBatch）
const totalCount = computed(() => effectiveBatch.value?.totalTasks ?? 0)
const completedCount = computed(() => effectiveBatch.value?.completedTasks ?? 0)
const failedCount = computed(() => effectiveBatch.value?.failedTasks ?? 0)
const progressPercentage = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round((completedCount.value / totalCount.value) * 100)
})
const allTasksCompleted = computed(() => {
  return completedCount.value + failedCount.value >= totalCount.value && totalCount.value > 0
})
const hasFailedTasks = computed(() => failedCount.value > 0)
const displayTaskCount = computed(() => totalCount.value)
const estimatedRemaining = computed(() => {
  if (!effectiveBatch.value?.estimatedEndAt) return null
  const remaining = Math.ceil((effectiveBatch.value.estimatedEndAt - Date.now()) / 1000)
  return remaining > 0 ? remaining : null
})

// 排序后的任务列表（运行中的在前，完成的在后）
const sortedTasks = computed(() => {
  const tasks = effectiveBatch.value?.tasks ?? []
  return [...tasks].sort((a, b) => {
    const statusOrder: Record<string, number> = {
      'running': 0,
      'pending': 1,
      'completed': 2,
      'failed': 3,
      'cancelled': 4
    }
    return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
  })
})

// 批次状态样式类
const batchStatusClass = computed(() => {
  if (allTasksCompleted.value && !hasFailedTasks.value) return 'success'
  if (hasFailedTasks.value) return 'warning'
  return 'running'
})

// 工具函数
const truncateGoal = (goal: string) => {
  if (!goal) return '未命名任务'
  if (goal.length <= 40) return goal
  return goal.substring(0, 40) + '...'
}

const shortenRunId = (runId: string) => {
  if (!runId) return ''
  if (runId.length <= 12) return runId
  return runId.substring(0, 6) + '...' + runId.substring(-4)
}

const formatDuration = (ms: number) => {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

const reconnect = () => {
  emit('reconnect')
}

// 当批次完成时自动播放音效（可选）
watch(() => allTasksCompleted.value, (completed) => {
  if (completed && !hasFailedTasks.value) {
    // 可以在这里添加完成音效
    console.log('[SubagentProgress] All tasks completed!')
  }
})
</script>

<style scoped>
.subagent-progress-panel {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.panel-header:hover {
  background-color: rgba(255, 255, 255, 0.5);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.status-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-icon.success {
  background: #dcfce7;
  color: #166534;
}

.status-icon.warning {
  background: #fef3c7;
  color: #92400e;
}

.status-icon.running {
  background: #dbeafe;
  color: #1e40af;
}

.status-icon .icon {
  width: 20px;
  height: 20px;
}

.status-icon .icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.header-info {
  min-width: 0;
  flex: 1;
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.time-remaining {
  font-size: 12px;
  font-weight: 400;
  color: #64748b;
  background: rgba(255, 255, 255, 0.6);
  padding: 2px 8px;
  border-radius: 12px;
}

.subtitle {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

.failed-count {
  color: #dc2626;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.progress-ring {
  position: relative;
  width: 48px;
  height: 48px;
}

.progress-ring svg {
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
}

.ring-bg {
  fill: none;
  stroke: #e2e8f0;
  stroke-width: 3;
}

.ring-fill {
  fill: none;
  stroke: #3b82f6;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 0.5s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  font-weight: 600;
  color: #3b82f6;
}

.expand-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s;
}

.expand-btn svg {
  width: 16px;
  height: 16px;
  color: #64748b;
}

.expand-btn.expanded {
  transform: rotate(180deg);
}

/* 任务列表 */
.task-list {
  border-top: 1px solid #e2e8f0;
  padding: 12px;
  background: rgba(255, 255, 255, 0.5);
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  background: white;
  border: 1px solid #e2e8f0;
  transition: all 0.2s;
}

.task-item:last-child {
  margin-bottom: 0;
}

.task-item.status-running {
  border-color: #3b82f6;
  background: #eff6ff;
}

.task-item.status-completed {
  border-color: #22c55e;
  background: #f0fdf4;
}

.task-item.status-failed,
.task-item.status-cancelled {
  border-color: #ef4444;
  background: #fef2f2;
}

.task-status-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.task-status-icon .icon {
  width: 16px;
  height: 16px;
}

.task-status-icon .icon.success {
  color: #22c55e;
}

.task-status-icon .icon.error {
  color: #ef4444;
}

.progress-spinner {
  width: 16px;
  height: 16px;
  position: relative;
}

.spinner-ring {
  width: 100%;
  height: 100%;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-goal {
  font-size: 13px;
  color: #334155;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.progress-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  max-width: 120px;
}

.progress-fill {
  height: 4px;
  background: #3b82f6;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-label {
  font-size: 11px;
  color: #64748b;
  flex-shrink: 0;
}

.phase-label {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

.run-id {
  font-size: 10px;
  color: #94a3b8;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}

.task-duration {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
  flex-shrink: 0;
}

.running-time {
  color: #3b82f6;
}

/* 展开动画 */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  padding: 0;
}

/* 连接错误提示 */
.connection-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fef2f2;
  border-top: 1px solid #fecaca;
  color: #dc2626;
  font-size: 13px;
}

.connection-error svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.connection-error button {
  margin-left: auto;
  padding: 4px 12px;
  background: white;
  border: 1px solid #fecaca;
  border-radius: 4px;
  color: #dc2626;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.connection-error button:hover {
  background: #dc2626;
  color: white;
}

/* 紧凑模式 */
.subagent-progress-panel.compact .panel-header {
  padding: 12px;
}

.subagent-progress-panel.compact .status-icon {
  width: 32px;
  height: 32px;
}

.subagent-progress-panel.compact .status-icon .icon {
  width: 16px;
  height: 16px;
}

.subagent-progress-panel.compact .title {
  font-size: 13px;
}

.subagent-progress-panel.compact .progress-ring {
  width: 36px;
  height: 36px;
}

.subagent-progress-panel.compact .progress-text {
  font-size: 9px;
}
</style>
