<template>
  <div class="task-tool-view">
    <!-- TaskCreate: 显示任务创建 -->
    <div v-if="tool.name === 'TaskCreate'" class="task-create">
      <div class="task-item">
        <span class="task-checkbox" :class="taskStatus">
          {{ getCheckboxSymbol(taskStatus) }}
        </span>
        <div class="task-info">
          <div class="task-subject">{{ taskSubject }}</div>
          <div v-if="taskDescription" class="task-description">{{ taskDescription }}</div>
          <div v-if="taskActiveForm" class="task-active-form">{{ taskActiveForm }}</div>
          <div v-if="taskId" class="task-id">ID: {{ taskId }}</div>
        </div>
      </div>
    </div>

    <!-- TaskUpdate: 显示任务更新 -->
    <div v-else-if="tool.name === 'TaskUpdate'" class="task-update">
      <div class="task-item">
        <span class="task-checkbox" :class="updateStatus">
          {{ getCheckboxSymbol(updateStatus) }}
        </span>
        <div class="task-info">
          <div class="task-subject">{{ updateSubject || taskSubjectFromId }}</div>
          <div v-if="updateStatus" class="task-status-badge" :class="updateStatus">
            {{ getStatusLabel(updateStatus) }}
          </div>
          <div v-if="taskId" class="task-id">ID: {{ taskId }}</div>
        </div>
      </div>
    </div>

    <!-- TaskList: 显示任务列表 -->
    <div v-else-if="tool.name === 'TaskList'" class="task-list">
      <div class="task-list-header">
        <span class="list-title">Tasks</span>
        <span class="list-count">{{ taskList.length }} total</span>
      </div>
      <div class="task-list-items">
        <div v-for="task in taskList" :key="task.id" class="task-item">
          <span class="task-checkbox" :class="task.status">
            {{ getCheckboxSymbol(task.status) }}
          </span>
          <div class="task-info">
            <div class="task-subject">{{ task.subject }}</div>
            <div v-if="task.description" class="task-description">{{ task.description }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- TaskGet/TaskStop/TaskOutput: 显示操作信息 -->
    <div v-else class="task-action">
      <div class="task-item">
        <span class="task-checkbox">◻</span>
        <div class="task-info">
          <div class="task-action-label">{{ actionLabel }}</div>
          <div v-if="taskId" class="task-id">Task: {{ taskId }}</div>
        </div>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-if="tool.state === 'error'" class="task-error">
      <span class="error-icon">❌</span>
      <span class="error-text">{{ errorText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ToolCall, Metadata } from '@/types/happy-protocol';

interface Props {
  tool: ToolCall;
  metadata?: Metadata | null;
}

const props = withDefaults(defineProps<Props>(), {
  metadata: null
});

// 从 tool.result.metadata 中提取 task 信息
const taskMetadata = computed(() => {
  if (props.tool.result && typeof props.tool.result === 'object') {
    const result = props.tool.result as Record<string, unknown>;
    if (result.metadata) {
      const metadata = result.metadata as Record<string, unknown>;
      if (metadata.task) {
        return metadata.task as Record<string, unknown>;
      }
    }
  }
  return null;
});

// TaskCreate 相关
const taskSubject = computed(() => {
  return (props.tool.args?.subject as string) || 'Unnamed Task';
});

const taskDescription = computed(() => {
  return (props.tool.args?.description as string) || '';
});

const taskActiveForm = computed(() => {
  return (props.tool.args?.activeForm as string) || '';
});

const taskId = computed(() => {
  return taskMetadata.value?.id as string || '';
});

const taskStatus = computed(() => {
  return taskMetadata.value?.status as string || 'pending';
});

// TaskUpdate 相关
const updateStatus = computed(() => {
  return (props.tool.args?.status as string) || taskMetadata.value?.status as string || '';
});

const updateSubject = computed(() => {
  return (props.tool.args?.subject as string) || '';
});

const taskSubjectFromId = computed(() => {
  return taskMetadata.value?.subject as string || '';
});

// TaskList 相关
const taskList = computed(() => {
  if (props.tool.result && typeof props.tool.result === 'object') {
    const result = props.tool.result as Record<string, unknown>;
    if (result.metadata) {
      const metadata = result.metadata as Record<string, unknown>;
      if (metadata.tasks && Array.isArray(metadata.tasks)) {
        return metadata.tasks as Array<Record<string, unknown>>;
      }
    }
  }
  return [];
});

// TaskGet/TaskStop/TaskOutput 相关
const actionLabel = computed(() => {
  const name = props.tool.name;
  if (name === 'TaskGet') return 'Get task details';
  if (name === 'TaskOutput') return 'Get task output';
  if (name === 'TaskStop') return 'Stop task';
  return 'Task action';
});

// 获取复选框符号
const getCheckboxSymbol = (status: string) => {
  switch (status) {
    case 'completed': return '✓';
    case 'in_progress': return '◻';
    default: return '◻';
  }
};

// 获取状态标签
const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed': return 'Completed';
    case 'in_progress': return 'In Progress';
    case 'pending': return 'Pending';
    case 'stopped': return 'Stopped';
    case 'failed': return 'Failed';
    default: return status;
  }
};

// 错误文本
const errorText = computed(() => {
  if (props.tool.result && typeof props.tool.result === 'object') {
    const result = props.tool.result as Record<string, unknown>;
    return (result.error as string) || JSON.stringify(props.tool.result, null, 2);
  }
  return String(props.tool.result);
});
</script>

<style scoped>
.task-tool-view {
  padding: 0.5rem 0;
}

.task-create,
.task-update,
.task-action {
  background: #f9fafb;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
}

.task-list {
  background: #f9fafb;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
}

.task-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.list-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: #111827;
}

.list-count {
  font-size: 0.75rem;
  color: #6b7280;
}

.task-list-items {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.task-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.task-checkbox {
  flex-shrink: 0;
  width: 20px;
  text-align: center;
  font-size: 1rem;
  font-weight: bold;
}

.task-checkbox.pending {
  color: #9ca3af;
}

.task-checkbox.in_progress {
  color: #3b82f6;
}

.task-checkbox.completed {
  color: #22c55e;
}

.task-checkbox.stopped,
.task-checkbox.failed {
  color: #ef4444;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-subject {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
}

.task-description {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.125rem;
}

.task-active-form {
  font-size: 0.75rem;
  color: #3b82f6;
  font-style: italic;
  margin-top: 0.125rem;
}

.task-id {
  font-size: 0.625rem;
  color: #9ca3af;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  margin-top: 0.25rem;
}

.task-status-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 600;
  margin-top: 0.25rem;
  text-transform: uppercase;
}

.task-status-badge.pending {
  background: #f3f4f6;
  color: #4b5563;
}

.task-status-badge.in_progress {
  background: #dbeafe;
  color: #2563eb;
}

.task-status-badge.completed {
  background: #dcfce7;
  color: #16a34a;
}

.task-status-badge.stopped,
.task-status-badge.failed {
  background: #fee2e2;
  color: #dc2626;
}

.task-action-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-style: italic;
}

/* 错误信息 */
.task-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-top: 0.5rem;
  background: #fef2f2;
  border-radius: 6px;
  border: 1px solid #fecaca;
}

.error-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.error-text {
  font-size: 0.75rem;
  color: #dc2626;
  word-break: break-all;
}
</style>
