<template>
  <div class="skills-view">
    <div v-if="skills && skills.length > 0" class="skills-list">
      <div class="skills-header">
        <span class="header-icon">🎯</span>
        <span class="header-title">Skills</span>
        <span class="header-count">{{ skills.length }} 个技能</span>
      </div>

      <div class="search-bar" v-if="showSearch">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="搜索技能..."
          class="search-input"
        />
      </div>

      <div class="skills-body">
        <div v-for="skill in filteredSkills" :key="skill.name" class="skill-item">
          <div class="skill-header">
            <span v-if="skill.metadata?.emoji" class="skill-emoji">{{ skill.metadata.emoji }}</span>
            <span class="skill-name">{{ skill.name }}</span>
            <span v-if="skill.directory" class="skill-source" :title="skill.directory">
              {{ getSkillSource(skill.directory) }}
            </span>
          </div>

          <div class="skill-description">{{ skill.description }}</div>

          <div v-if="skill.metadata?.homepage" class="skill-homepage">
            <a :href="skill.metadata.homepage" target="_blank" rel="noopener">
              🔗 {{ skill.metadata.homepage }}
            </a>
          </div>

          <div class="skill-actions">
            <button
              v-if="skill.installed"
              class="btn btn-uninstall"
              @click="$emit('uninstall', skill.name)">
              卸载
            </button>
            <button
              v-else
              class="btn btn-install"
              @click="$emit('install', skill.name)">
              安装
            </button>
            <button
              class="btn btn-details"
              @click="$emit('details', skill.name)">
              详情
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="searchQuery" class="empty-search">
      <span class="empty-icon">🔍</span>
      <span>未找到匹配的技能</span>
    </div>

    <div v-else class="empty-state">
      <span class="empty-icon">🎯</span>
      <span>暂无技能</span>
      <span class="empty-hint">使用 /skills install &lt;skill&gt; 安装技能</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Skill {
  name: string
  description: string
  directory?: string
  installed?: boolean
  metadata?: {
    emoji?: string
    homepage?: string
    always?: boolean
  }
}

const props = defineProps<{
  skills: Skill[]
  showSearch?: boolean
}>()

defineEmits<{
  install: [name: string]
  uninstall: [name: string]
  details: [name: string]
}>()

const searchQuery = ref('')

const filteredSkills = computed(() => {
  if (!searchQuery.value) {
    return props.skills
  }
  const query = searchQuery.value.toLowerCase()
  return props.skills.filter(skill =>
    skill.name.toLowerCase().includes(query) ||
    skill.description.toLowerCase().includes(query)
  )
})

const getSkillSource = (directory: string) => {
  if (directory.includes('.openclaw')) return 'global'
  if (directory.includes('.agents')) return 'agent'
  if (directory.includes('skills')) return 'workspace'
  return 'local'
}
</script>

<style scoped>
.skills-view {
  padding: 8px 0;
}

.skills-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skills-header {
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

.search-bar {
  padding: 0 12px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.skills-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.skill-item {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.skill-emoji {
  font-size: 16px;
}

.skill-name {
  flex: 1;
  font-weight: 500;
  color: #111827;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}

.skill-source {
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  color: #6b7280;
  text-transform: uppercase;
}

.skill-description {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
  line-height: 1.4;
}

.skill-homepage {
  font-size: 11px;
  margin-bottom: 8px;
}

.skill-homepage a {
  color: #3b82f6;
  text-decoration: none;
}

.skill-homepage a:hover {
  text-decoration: underline;
}

.skill-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid transparent;
  cursor: pointer;
}

.btn-install {
  background: #16a34a;
  color: white;
}

.btn-install:hover {
  background: #15803d;
}

.btn-uninstall {
  background: #dc2626;
  color: white;
}

.btn-uninstall:hover {
  background: #b91c1c;
}

.btn-details {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-details:hover {
  background: #e5e7eb;
}

.empty-search,
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

.empty-hint {
  font-size: 11px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 4px;
}
</style>
