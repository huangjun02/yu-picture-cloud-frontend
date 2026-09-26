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

    <a-card title="当前登录用户" style="margin-top: 16px">
      <a-descriptions v-if="loginUser" bordered size="small" :column="1">
        <!-- id 显示的是字符串：后端用雪花算法生成 19 位 id，转 number 会丢精度 -->
        <a-descriptions-item label="id">{{ loginUser.id }}</a-descriptions-item>
        <a-descriptions-item label="账号">{{ loginUser.userAccount }}</a-descriptions-item>
        <a-descriptions-item label="昵称">{{ loginUser.userName ?? '-' }}</a-descriptions-item>
        <a-descriptions-item label="角色">{{ loginUser.userRole ?? '-' }}</a-descriptions-item>
      </a-descriptions>
      <a-empty v-else description="未登录" />
      <a-button danger style="margin-top: 12px" :loading="loggingOut" @click="handleLogout">
        退出登录
      </a-button>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'

import { getHealth } from '@/api/health'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const loginUser = computed(() => userStore.loginUser)

const status = ref<'loading' | 'ok' | 'fail'>('loading')
const result = ref<string | null>(null)
const loggingOut = ref(false)

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

async function handleLogout() {
  loggingOut.value = true
  try {
    await userStore.logout()
    message.success('已退出登录')
    await router.push('/user/login')
  } finally {
    loggingOut.value = false
  }
}

onMounted(check)
</script>

<style scoped>
.page {
  padding: 24px;
}
</style>
