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

        <!-- 用户区：头像 + 昵称 + 身份，点开是下拉菜单 -->
        <a-dropdown placement="bottomRight">
          <div class="user-trigger">
            <a-avatar :style="{ backgroundColor: avatarColor }" :size="34">
              {{ avatarText }}
            </a-avatar>
            <div class="user-meta">
              <span class="user-name">{{ displayName }}</span>
              <span class="user-role">{{ roleLabel }}</span>
            </div>
            <DownOutlined class="user-arrow" />
          </div>

          <template #overlay>
            <a-menu>
              <a-menu-item key="account" disabled>
                <IdcardOutlined />
                账号：{{ loginUser?.userAccount ?? '-' }}
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="logout" danger @click="handleLogout">
                <LogoutOutlined />
                退出登录
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
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
import {
  CloudUploadOutlined,
  DownOutlined,
  IdcardOutlined,
  LogoutOutlined,
  PictureOutlined,
} from '@ant-design/icons-vue'

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

const displayName = computed(
  () => loginUser.value?.userName ?? loginUser.value?.userAccount ?? '未登录',
)

const roleLabel = computed(() => (isAdmin.value ? '管理员' : '普通用户'))

/**
 * 头像文字：取昵称首字。中文取第一个字足够辨识，
 * 英文（如 huangjun）取首字母更符合头像惯例。
 */
const avatarText = computed(() => {
  const name = displayName.value.trim()
  const first = name.charAt(0)
  // 只在「纯 ASCII 且是小写」时转大写，避免把中文字符瞎折腾
  return /^[a-z]$/.test(first) ? first.toUpperCase() : first
})

// 管理员用金色、普通用户用主色 —— 身份差异一眼可见，比一个小 tag 更省地方
const avatarColor = computed(() => (isAdmin.value ? '#fa8c16' : '#1677ff'))

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

.user-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 10px 0 6px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-trigger:hover {
  background-color: rgb(0 0 0 / 4%);
}

.user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.user-name {
  font-size: 14px;
  color: rgb(0 0 0 / 88%);
}

.user-role {
  font-size: 12px;
  color: rgb(0 0 0 / 45%);
}

.user-arrow {
  font-size: 12px;
  color: rgb(0 0 0 / 45%);
}

.content {
  padding: 24px;
  background: #f5f5f5;
}
</style>
