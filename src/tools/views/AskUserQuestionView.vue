<template>
  <div class="ask-user-question-view">
    <!-- 已提交状态 -->
    <div v-if="isSubmitted || toolCall.body?.status === 'completed'" class="submitted-container">
      <div v-for="(question, qIndex) in questions" :key="qIndex" class="submitted-item">
        <span class="submitted-header">{{ question.header }}:</span>
        <span class="submitted-value">{{ getAnswer(qIndex) }}</span>
      </div>
    </div>

    <!-- 问题选择状态 -->
    <template v-else>
      <div v-for="(question, qIndex) in questions" :key="qIndex" class="question-section">
        <!-- 问题头部标签 -->
        <div v-if="question.header" class="header-chip">
          {{ question.header }}
        </div>

        <!-- 问题文本 -->
        <div class="question-text">{{ question.question }}</div>

        <!-- 选项列表 -->
        <div class="options-container">
          <div
            v-for="(option, oIndex) in question.options"
            :key="oIndex"
            :class="['option-item', getOptionClass(qIndex, oIndex)]"
            @click="handleOptionToggle(qIndex, oIndex, question.multiSelect)"
          >
            <!-- 单选/多选图标 -->
            <div v-if="question.multiSelect" :class="['checkbox', { selected: isSelected(qIndex, oIndex) }]">
              <span v-if="isSelected(qIndex, oIndex)" class="checkmark">✓</span>
            </div>
            <div v-else :class="['radio', { selected: isSelected(qIndex, oIndex) }]">
              <div v-if="isSelected(qIndex, oIndex)" class="radio-dot"></div>
            </div>

            <!-- 选项内容 -->
            <div class="option-content">
              <div class="option-label">{{ option.label }}</div>
              <div v-if="option.description" class="option-description">{{ option.description }}</div>
              <div v-if="option.preview" class="option-preview">{{ option.preview }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 提交按钮 -->
      <div v-if="canInteract" class="actions-container">
        <button
          :class="['submit-button', { disabled: !canSubmit || isSubmitting }]"
          @click="handleSubmit"
          :disabled="!canSubmit || isSubmitting"
        >
          <span v-if="isSubmitting" class="loading-spinner">⏳</span>
          <span v-else>提交选择</span>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ToolCallArtifact } from '@/types/happy-protocol'

interface QuestionOption {
  label: string
  description: string
  preview?: string
}

interface Question {
  question: string
  header: string
  options: QuestionOption[]
  multiSelect: boolean
}

const props = defineProps<{
  toolCall: ToolCallArtifact
}>()

// 解析问题
const questions = computed(() => {
  const metadata = props.toolCall.body?.metadata
  if (metadata && Array.isArray(metadata.questions)) {
    return metadata.questions as Question[]
  }
  return []
})

// 用户选择状态
const selections = ref<Map<number, Set<number>>>(new Map())
const isSubmitting = ref(false)
const isSubmitted = ref(false)

// 初始化选择
questions.value.forEach((_, qIndex) => {
  selections.value.set(qIndex, new Set())
})

// 是否可以选择（工具处于运行状态）
const canInteract = computed(() => {
  const status = props.toolCall.body?.status
  return status === 'started' || status === 'in_progress'
})

// 是否所有问题都有答案
const allQuestionsAnswered = computed(() => {
  return questions.value.every((_, qIndex) => {
    const selected = selections.value.get(qIndex)
    return selected && selected.size > 0
  })
})

// 是否可以提交
const canSubmit = computed(() => {
  return allQuestionsAnswered.value && !isSubmitting.value
})

// 获取选项样式类
const getOptionClass = (qIndex: number, oIndex: number) => {
  return {
    'selected': isSelected(qIndex, oIndex),
    'disabled': !canInteract.value
  }
}

// 检查是否选中
const isSelected = (qIndex: number, oIndex: number): boolean => {
  const selected = selections.value.get(qIndex)
  return selected ? selected.has(oIndex) : false
}

// 处理选项点击
const handleOptionToggle = (qIndex: number, oIndex: number, multiSelect: boolean) => {
  if (!canInteract.value) return

  const currentSet = selections.value.get(qIndex) || new Set()
  const newSet = new Set(currentSet)

  if (multiSelect) {
    // 多选：切换
    if (newSet.has(oIndex)) {
      newSet.delete(oIndex)
    } else {
      newSet.add(oIndex)
    }
  } else {
    // 单选：替换
    newSet.clear()
    newSet.add(oIndex)
  }

  selections.value.set(qIndex, newSet)
}

// 获取答案文本
const getAnswer = (qIndex: number): string => {
  const question = questions.value[qIndex]
  if (!question) return '-'

  const selected = selections.value.get(qIndex)
  if (!selected || selected.size === 0) return '-'

  return Array.from(selected)
    .map(oIndex => question.options[oIndex]?.label)
    .filter(Boolean)
    .join(', ')
}

// 提交答案
const handleSubmit = async () => {
  if (!canSubmit.value) return

  isSubmitting.value = true
  isSubmitted.value = true

  // 格式化答案
  const responseLines: string[] = []
  questions.value.forEach((q, qIndex) => {
    const selected = selections.value.get(qIndex)
    if (selected && selected.size > 0) {
      const selectedLabels = Array.from(selected)
        .map(oIndex => q.options[oIndex]?.label)
        .filter(Boolean)
        .join(', ')
      responseLines.push(`${q.header}: ${selectedLabels}`)
    }
  })

  const responseText = responseLines.join('\n')
  console.log('用户回答:', responseText)

  // TODO: 调用后端 API 提交答案
  // await sync.sendMessage(sessionId, responseText)

  isSubmitting.value = false
}
</script>

<style scoped>
.ask-user-question-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 已提交状态 */
.submitted-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.submitted-item {
  display: flex;
  gap: 8px;
  font-size: 14px;
}

.submitted-header {
  font-weight: 600;
  color: #6b7280;
}

.submitted-value {
  flex: 1;
  color: #111827;
}

/* 问题区域 */
.question-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.header-chip {
  align-self: flex-start;
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
}

.question-text {
  font-size: 15px;
  font-weight: 500;
  color: #111827;
}

/* 选项列表 */
.options-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.option-item:hover {
  border-color: #d1d5db;
  background: #f3f4f6;
}

.option-item.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.option-item.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 单选/多选图标 */
.radio,
.checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid #6b7280;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
  transition: all 0.15s ease;
}

.checkbox {
  border-radius: 4px;
}

.radio.selected,
.checkbox.selected {
  border-color: #3b82f6;
  background: #3b82f6;
}

.checkbox.selected .checkmark {
  color: #fff;
  font-size: 14px;
  font-weight: bold;
}

.radio-dot {
  width: 10px;
  height: 10px;
  border-radius: 5px;
  background: #fff;
}

/* 选项内容 */
.option-content {
  flex: 1;
  min-width: 0;
}

.option-label {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.option-description {
  font-size: 13px;
  color: #6b7280;
  margin-top: 2px;
}

.option-preview {
  font-size: 12px;
  color: #4b5563;
  background: #f3f4f6;
  padding: 8px;
  border-radius: 4px;
  margin-top: 8px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 操作按钮 */
.actions-container {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.submit-button {
  background: #3b82f6;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
}

.submit-button:hover:not(.disabled) {
  background: #2563eb;
}

.submit-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  font-size: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
