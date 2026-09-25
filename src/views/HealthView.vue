<template>
  <div class="page">
    <a-card title="后端联调检查">
      <a-space direction="vertical" style="width: 100%">
        <a-alert :type="status === 'ok' ? 'success' : 'error'" :message="alertMessage" show-icon />
        <a-button type="primary" :loading="status === 'loading'" @click="check">
          重新检查
        </a-button>
        <a-descriptions bordered size="small" :column="1">
          <a-descriptions-item label="接口">GET /api/health</a-descriptions-item>
          <a-descriptions-item label="返回值">{{ result ?? '-' }}</a-descriptions-item>
        </a-descriptions>
      </a-space>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { getHealth } from '@/api/health'

const status = ref<'loading' | 'ok' | 'fail'>('loading')
const result = ref<string | null>(null)

const alertMessage = computed(() => {
  if (status.value === 'ok') return '联调成功：前端 → Vite 代理 → 后端 8123 已打通'
  if (status.value === 'loading') return '请求中…'
  return '联调失败：确认后端 8123 已启动'
})

async function check() {
  status.value = 'loading'
  try {
    result.value = await getHealth()
    status.value = 'ok'
  } catch {
    result.value = null
    status.value = 'fail'
  }
}

onMounted(check)
</script>

<style scoped>
.page {
  padding: 24px;
}
</style>
