<template>
  <div class="task-tool-view">
    <!-- 工具头部 - 可展开/收起 -->
    <div class="tool-header" @click="toggleExpand">
      <div class="tool-icon">
        <span class="icon">📋</span>
      </div>
      <div class="tool-info">
        <div class="tool-title">Task List</div>
        <div class="tool-subtitle">{{ subtitle }}</div>
      </div>
      <div class="tool-status">
        <button class="expand-btn">
          <span :class="{ 'rotated': isExpanded }">›</span>
        </button>
      </div>
    </div>

    <!-- 展开内容：待办列表 -->
    <div v-if="isExpanded" class="tool-content">
      <!-- Todos 列表 -->
      <div v-if="todos && todos.length > 0" class="todo-list">
        <div
          v-for="(todo, index) in todos"
          :key="todo.id || index"
          class="todo-item"
          :class="todo.status"
        >
          <div class="todo-checkbox">
            <span class="checkbox-mark">
              {{ getCheckboxSymbol(todo.status) }}
            </span>
          </div>
          <div class="todo-content-text">
            <div class="todo-text" :class="{ 'completed': todo.status === 'completed' }">
              {{ todo.content }}
            </div>
            <div v-if="todo.activeForm && todo.status === 'in_progress'" class="todo-active-form">
              {{ todo.activeForm }}
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!todos || todos.length === 0" class="todo-empty">
        <span class="empty-icon">📋</span>
        <span class="empty-text">No tasks</span>
      </div>

      <!-- 错误信息 -->
      <div v-if="errorText" class="todo-error">
        <span class="error-icon">❌</span>
        <span class="error-text">{{ errorText }}</span>
      </div>

      <!-- 输入/输出 展示 -->
      <div class="io-sections">
        <!-- Input 部分 -->
        <div v-if="showInput && inputContent" class="io-section input-section">
          <div class="io-header">
            <span class="io-label input-label">Input</span>
          </div>
          <pre class="io-content">{{ inputContent }}</pre>
        </div>

        <!-- Output 部分 -->
        <div v-if="showOutput && outputContent" class="io-section output-section">
          <div class="io-header">
            <span class="io-label output-label">Output</span>
          </div>
          <pre class="io-content">{{ outputContent }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import type { ToolCallArtifact } from '@/types/happy-protocol';
import { logger } from '@/utils/debug-logger';

interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
  id?: string;
}

interface Props {
  toolCall: ToolCallArtifact;
}

const props = defineProps<Props>();

const isExpanded = ref(true);

// 组件挂载日志
onMounted(() => {
  logger.logComponentMount('TaskToolView', {
    toolCallId: props.toolCall?.id,
    toolName: props.toolCall?.header?.subtype || props.toolCall?.header?.toolName
  });
});

// 从 toolCall 中提取 todos
const todos = computed(() => {
  const toolName = props.toolCall?.header?.subtype || props.toolCall?.header?.toolName || 'unknown';
  logger.debug('TaskToolView', `Extracting todos for ${toolName}`, {
    hasMetadata: !!props.toolCall.body?.metadata,
    hasInput: !!props.toolCall.body?.input,
    hasOutput: !!props.toolCall.body?.output
  });

  // 1. 首先尝试从 result.metadata.todos 获取（Task* 工具）
  if (props.toolCall.body?.metadata) {
    const metadata = props.toolCall.body.metadata as Record<string, unknown>;
    logger.debug('TaskToolView', 'Checking metadata', { metadataKeys: Object.keys(metadata || {}) });

    if (metadata.todos && Array.isArray(metadata.todos)) {
      logger.info('TaskToolView', 'Found todos in metadata.todos', { count: metadata.todos.length });
      return metadata.todos.map((todo: any) => ({
        content: todo.content || todo.subject || 'Unnamed',
        status: (todo.status || 'pending') as 'pending' | 'in_progress' | 'completed',
        activeForm: todo.activeForm,
        id: todo.id
      }));
    }
    // 2. 尝试从 metadata.task 获取单个任务
    if (metadata.task) {
      const task = metadata.task as Record<string, unknown>;
      logger.info('TaskToolView', 'Found single task in metadata.task', {
        subject: task.subject,
        status: task.status
      });
      return [{
        content: (task.subject as string) || (task.content as string) || 'Unnamed Task',
        status: (task.status as 'pending' | 'in_progress' | 'completed') || 'pending',
        activeForm: task.activeForm as string,
        id: task.id as string
      }];
    }
  }

  // 3. 尝试从 input.todos 获取（声明式输入）
  if (props.toolCall.body?.input) {
    const input = props.toolCall.body.input as Record<string, unknown>;
    if (input.todos && Array.isArray(input.todos)) {
      logger.info('TaskToolView', 'Found todos in input.todos', { count: input.todos.length });
      return input.todos.map((todo: any) => ({
        content: todo.content || 'Unnamed',
        status: (todo.status || 'pending') as 'pending' | 'in_progress' | 'completed',
        activeForm: todo.activeForm,
        id: todo.id
      }));
    }
  }

  // 4. 尝试从 output 中解析（兼容旧格式）
  const output = props.toolCall.body?.output as string;
  if (output) {
    logger.debug('TaskToolView', 'Parsing output for todos', { outputLength: output?.length });
    const todos: TodoItem[] = [];
    const lines = output.split('\n');
    let currentTodo: Partial<TodoItem> = {};

    for (const line of lines) {
      if (line.includes('Created todo item:') || line.startsWith('- [')) {
        if (currentTodo.content) {
          todos.push(currentTodo as TodoItem);
        }
        currentTodo = {};
        // 解析 markdown checkbox 格式：- [x] content
        const checkboxMatch = line.match(/- \[(.)\] (.+)/);
        if (checkboxMatch) {
          const checkbox = checkboxMatch[1];
          const content = checkboxMatch[2];
          currentTodo.content = content;
          currentTodo.status = checkbox === 'x' ? 'completed' : checkbox === '~' ? 'in_progress' : 'pending';
        }
      } else if (line.includes('Content:')) {
        currentTodo.content = line.replace('Content:', '').trim();
      } else if (line.includes('Status:')) {
        const statusStr = line.replace('Status:', '').trim().toLowerCase();
        if (statusStr.includes('pending')) currentTodo.status = 'pending';
        else if (statusStr.includes('progress')) currentTodo.status = 'in_progress';
        else if (statusStr.includes('completed')) currentTodo.status = 'completed';
      } else if (line.includes('ID:')) {
        currentTodo.id = line.replace('ID:', '').trim();
      }
    }

    if (currentTodo.content) {
      todos.push(currentTodo as TodoItem);
    }

    if (todos.length > 0) {
      logger.info('TaskToolView', 'Parsed todos from output', { count: todos.length });
      return todos;
    }
  }

  logger.debug('TaskToolView', 'No todos found, returning empty array');
  return [];
});

// 副标题：显示任务统计
const subtitle = computed(() => {
  if (!todos.value || todos.value.length === 0) {
    return 'No tasks';
  }
  const completed = todos.value.filter(t => t.status === 'completed').length;
  const inProgress = todos.value.filter(t => t.status === 'in_progress').length;
  const pending = todos.value.filter(t => t.status === 'pending').length;

  if (inProgress > 0) {
    return `${completed}/${todos.value.length} completed · ${inProgress} in progress`;
  }
  if (pending > 0) {
    return `${completed}/${todos.value.length} completed · ${pending} pending`;
  }
  return `${completed}/${todos.value.length} completed`;
});

// 错误文本
const errorText = computed(() => {
  if (props.toolCall.body?.error) {
    return String(props.toolCall.body.error);
  }
  if (props.toolCall.body?.message) {
    return String(props.toolCall.body.message);
  }
  return '';
});

// Input 内容（JSON 格式）
const inputContent = computed(() => {
  if (props.toolCall.body?.input) {
    return JSON.stringify(props.toolCall.body.input, null, 2);
  }
  return '';
});

const showInput = computed(() => {
  return !!inputContent.value;
});

// Output 内容
const outputContent = computed(() => {
  if (props.toolCall.body?.output) {
    if (typeof props.toolCall.body.output === 'string') {
      return props.toolCall.body.output;
    }
    return JSON.stringify(props.toolCall.body.output, null, 2);
  }
  return '';
});

const showOutput = computed(() => {
  return !!outputContent.value;
});

// 获取复选框符号
const getCheckboxSymbol = (status: string): string => {
  switch (status) {
    case 'completed':
      return '☑';  // 完成：带勾的框
    case 'in_progress':
      return '☐';  // 进行中：空框
    case 'pending':
    default:
      return '☐';  // 待处理：空框
  }
};

// 切换展开/收起
function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}
</script>

<style scoped>
.task-tool-view {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.75rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  transition: background 0.15s;
}

.tool-header:hover {
  background: #f3f4f6;
}

.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #dbeafe;
  flex-shrink: 0;
}

.tool-icon .icon {
  font-size: 1.25rem;
}

.tool-info {
  flex: 1;
  min-width: 0;
}

.tool-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: #111827;
}

.tool-subtitle {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.125rem;
}

.tool-status {
  display: flex;
  align-items: center;
}

.expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  color: #9ca3af;
  transition: transform 0.2s;
}

.expand-btn span {
  display: block;
  font-size: 1.25rem;
  line-height: 1;
}

.expand-btn span.rotated {
  transform: rotate(90deg);
}

.tool-content {
  padding: 0.75rem;
}

/* Todos 列表 */
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.15s;
}

.todo-item:hover {
  background: #f9fafb;
}

.todo-item.completed {
  opacity: 0.7;
}

.todo-checkbox {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-mark {
  font-size: 1rem;
  line-height: 1;
  font-weight: bold;
}

/* 状态颜色 */
.todo-item.pending .checkbox-mark {
  color: #9ca3af;  /* 灰色 */
}

.todo-item.in_progress .checkbox-mark {
  color: #3b82f6;  /* 蓝色 */
}

.todo-item.completed .checkbox-mark {
  color: #22c55e;  /* 绿色 */
}

.todo-content-text {
  flex: 1;
  min-width: 0;
}

.todo-text {
  font-size: 0.875rem;
  color: #111827;
  line-height: 1.5;
}

.todo-text.completed {
  text-decoration: line-through;
  color: #9ca3af;
}

.todo-active-form {
  font-size: 0.75rem;
  color: #3b82f6;
  margin-top: 0.25rem;
  font-style: italic;
}

/* 空状态 */
.todo-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  color: #9ca3af;
}

.empty-icon {
  font-size: 1.25rem;
}

.empty-text {
  font-size: 0.875rem;
  font-style: italic;
}

/* 错误信息 */
.todo-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
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

/* Input/Output 区域 */
.io-sections {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.io-section {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}

.io-header {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.io-label {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.input-label {
  background: #dbeafe;
  color: #1e40af;
}

.output-label {
  background: #dcfce7;
  color: #166534;
}

.io-content {
  padding: 0.75rem;
  font-size: 0.75rem;
  line-height: 1.5;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.input-section .io-content {
  background: #eff6ff;
  color: #1e3a8a;
}

.output-section .io-content {
  background: #f0fdf4;
  color: #166534;
}
</style>
