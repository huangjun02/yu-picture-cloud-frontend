<template>
  <div class="auth-shell">
    <!-- 左侧品牌区：窄屏会整块隐藏（见下方 media query），表单始终可用 -->
    <aside class="brand">
      <div class="brand-body">
        <div class="brand-logo">
          <PictureOutlined />
          <span>云图库</span>
        </div>

        <h1 class="brand-slogan">
          让每一张图<br />
          都待在它该在的地方
        </h1>

        <p class="brand-desc">上传、检索、管理 —— 一个只为自己的图片而生的空间。</p>

        <ul class="brand-points">
          <li>
            <CloudUploadOutlined />
            <span>拖拽上传，秒级入库</span>
          </li>
          <li>
            <SearchOutlined />
            <span>按名称 / 分类 / 时间多维检索</span>
          </li>
          <li>
            <SafetyCertificateOutlined />
            <span>登录态由后端 Sa-Token 统一把关</span>
          </li>
        </ul>
      </div>

      <!-- 纯装饰的光斑，不参与布局也不接收点击 -->
      <span class="glow glow-a" aria-hidden="true" />
      <span class="glow glow-b" aria-hidden="true" />
    </aside>

    <!-- 右侧表单区：内容由调用方用默认插槽填 -->
    <main class="panel">
      <div class="panel-card">
        <header class="panel-head">
          <h2 class="panel-title">{{ title }}</h2>
          <p v-if="subtitle" class="panel-sub">{{ subtitle }}</p>
        </header>

        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  CloudUploadOutlined,
  PictureOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'

defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<style scoped>
.auth-shell {
  display: flex;
  min-height: 100vh;
  background: #fff;
}

/* ==================== 左：品牌区 ==================== */
.brand {
  position: relative;
  flex: 1 1 46%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(140deg, #1d39c4 0%, #1677ff 52%, #40a9ff 100%);
}

.brand-body {
  position: relative;
  z-index: 1;
  max-width: 400px;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 1px;
}

.brand-slogan {
  margin: 40px 0 16px;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 1px;
}

.brand-desc {
  margin: 0 0 32px;
  font-size: 14px;
  line-height: 1.8;
  color: rgb(255 255 255 / 78%);
}

.brand-points {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 14px;
  color: rgb(255 255 255 / 92%);
}

.brand-points li {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 装饰光斑：position + blur，纯视觉 */
.glow {
  position: absolute;
  border-radius: 50%;
  background: rgb(255 255 255 / 16%);
  filter: blur(2px);
  pointer-events: none;
}

.glow-a {
  width: 320px;
  height: 320px;
  top: -120px;
  right: -100px;
}

.glow-b {
  width: 220px;
  height: 220px;
  bottom: -80px;
  left: -60px;
  background: rgb(255 255 255 / 10%);
}

/* ==================== 右：表单区 ==================== */
.panel {
  flex: 1 1 54%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
}

.panel-card {
  width: 100%;
  max-width: 380px;
}

.panel-head {
  margin-bottom: 28px;
}

.panel-title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 600;
  color: rgb(0 0 0 / 88%);
}

.panel-sub {
  margin: 0;
  font-size: 14px;
  color: rgb(0 0 0 / 45%);
}

/* ==================== 插槽内容的通用样式 ==================== */
/*
 * 插槽内容是在「调用方」的模板里编译的，带的是调用方的 scoped 标记，
 * 所以本组件的 scoped 样式默认命不中它 —— 必须 :deep() 穿透。
 * 放这儿是因为登录页和注册页都要用，抽一次省得各写一遍。
 */
:deep(.auth-extra) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  font-size: 14px;
}

:deep(.auth-switch) {
  color: rgb(0 0 0 / 45%);
}

:deep(.auth-switch a) {
  margin-left: 4px;
  font-weight: 500;
}

/* 窄屏：品牌区整块让位给表单（不是缩成一条，避免半截文案难看） */
@media (max-width: 900px) {
  .brand {
    display: none;
  }
}
</style>
