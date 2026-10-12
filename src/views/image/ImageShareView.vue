<template>
  <div class="share-page">
    <a-spin :spinning="loading">
      <a-empty v-if="!loading && !record" description="分享的图片不存在或已失效" />
      <div v-else-if="record" class="share-card">
        <div class="share-stage">
          <a-image
            :src="displaySrc"
            :fallback="record.url"
            :preview="{ src: record.webpUrl ?? record.url }"
            @error="onImgError"
          />
        </div>
        <div class="share-info">
          <h1 class="share-name">{{ record.name || '未命名图片' }}</h1>
          <p class="share-intro">{{ record.introduction || '暂无简介' }}</p>
          <div class="share-meta">
            <span>作者：用户 {{ String(record.userId ?? '').slice(-6) }}</span>
            <span>上传时间：{{ formatDateTime(record.createTime) }}</span>
          </div>
          <a-button type="primary" block @click="goHome">进入图库</a-button>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getSharedImage, type ImageVO } from '@/api/image'
import { formatDateTime } from '@/utils/datetime'

const route = useRoute()
const router = useRouter()

const shareCode = String(route.params.code ?? '')
const loading = ref(false)
const record = ref<ImageVO | null>(null)

/** 优先 WebP 副本（更小），没有就原图 —— 与详情页同一策略 */
const displaySrc = computed(() => record.value?.webpUrl ?? record.value?.url ?? '')

/** WebP 副本 404（存量旧图）→ 回退原图 */
function onImgError(event: Event) {
  const img = event.target as HTMLImageElement
  const url = record.value?.url
  if (url && record.value?.webpUrl && img.src !== url) {
    img.src = url
  }
}

function goHome() {
  router.push('/')
}

onMounted(async () => {
  if (!shareCode) return
  loading.value = true
  try {
    record.value = await getSharedImage(shareCode)
  } catch {
    // 拦截器已弹提示；页面走空态
    record.value = null
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.share-page {
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  background: #f5f6f8;
}

.share-card {
  width: 100%;
  max-width: 720px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 3%), 0 4px 16px rgb(0 0 0 / 6%);
  overflow: hidden;
}

.share-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  padding: 24px;
  background: #fafafa;
}

.share-stage :deep(img) {
  max-width: 100%;
  max-height: 62vh;
  border-radius: 8px;
  object-fit: contain;
}

.share-info {
  padding: 20px 24px 24px;
}

.share-name {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: rgb(0 0 0 / 88%);
  word-break: break-all;
}

.share-intro {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.7;
  color: rgb(0 0 0 / 55%);
  white-space: pre-wrap;
}

.share-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
  font-size: 13px;
  color: rgb(0 0 0 / 45%);
}
</style>
