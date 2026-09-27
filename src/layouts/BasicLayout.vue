<template>
  <a-layout class="basic-layout">
    <a-layout-sider v-model:collapsed="collapsed" collapsible theme="light">
      <div class="logo">
        <span v-if="!collapsed">云图库</span>
        <span v-else>图</span>
      </div>

      <a-menu v-model:selectedKeys="selectedKeys" mode="inline" @click="handleMenuClick">
        <a-menu-item key="/">
          <template #icon><PictureOutlined /></template>
          <span>我的图片</span>
        </a-menu-item>
        <a-menu-item key="/image/upload">
          <template #icon><CloudUploadOutlined /></template>
          <span>上传图片</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-header class="header">
        <span class="header-title">智能协同云图库</span>
        <a-space>
          <a-typography-text>
            {{ loginUser?.userName ?? loginUser?.userAccount ?? '未登录' }}
          </a-typography-text>
          <a-tag v-if="isAdmin" color="gold">管理员</a-tag>
          <a-button type="link" danger @click="handleLogout">退出</a-button>
        </a-space>
      </a-layout-header>

      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { CloudUploadOutlined, PictureOutlined } from '@ant-design/icons-vue'

import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const collapsed = ref(false)
const loginUser = computed(() => userStore.loginUser)

// 菜单选中态必须由「当前路由」推导，不能自己存一份状态：
// 存两份的话，用户用浏览器前进/后退时菜单高亮就会和页面内容对不上。
const selectedKeys = ref<string[]>([route.path])

watch(
  () => route.path,
  (path) => {
    selectedKeys.value = [path]
  },
)

// 用路由跳转而不是 a-menu 自带的跳转，避免和 vue-router 的守卫脱节
function handleMenuClick({ key }: { key: string | number }) {
  router.push(String(key))
}

const isAdmin = computed(() => loginUser.value?.userRole === 'admin')

async function handleLogout() {
  await userStore.logout()
  message.success('已退出登录')
  await router.push('/user/login')
}
</script>

<style scoped>
.basic-layout {
  min-height: 100vh;
}

.logo {
  height: 48px;
  margin: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: #1677ff;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
}

.content {
  padding: 24px;
  background: #f5f5f5;
}
</style>
