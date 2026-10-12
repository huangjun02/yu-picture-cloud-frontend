<template>
  <div class="detail-page">
    <!-- 页面级操作条：返回 + 面包屑感的标题，避免用户进来就「无路可退」 -->
    <div class="page-bar">
      <a-button type="text" @click="goBack">
        <ArrowLeftOutlined />
        {{ backLabel }}
      </a-button>
      <span class="page-bar-title">图片详情</span>
    </div>

    <a-spin :spinning="loading">
      <a-empty v-if="!loading && !record" description="图片不存在或已被删除" />

      <!--
        参考「左预览 + 右信息」的双栏范式：
        左栏给图（主角色），右栏给属性和操作。小屏（<992px）自动叠成一列。
      -->
      <div v-else-if="record" class="detail-grid">
        <!-- ========== 左：预览 ========== -->
        <section class="card preview-card">
          <header class="card-head">图片预览</header>
          <div class="preview-stage">
            <a-image
              :src="displaySrc"
              :fallback="record.url"
              :preview="{ src: record.webpUrl ?? record.url }"
              @error="onImgError"
            />
          </div>
          <footer class="preview-foot">
            优先展示 WebP 副本（更小）；点图可放大查看原图
          </footer>
        </section>

        <!-- ========== 右：信息 + 操作 ========== -->
        <aside class="card info-card">
          <h2 class="img-name">{{ record.name || '未命名图片' }}</h2>
          <p class="img-intro">{{ record.introduction || '暂无简介' }}</p>

          <a-divider class="divider" />

          <div class="meta-list">
            <div class="meta-row">
              <span class="meta-label">作者</span>
              <span class="meta-value">
                <a-avatar :size="22" :style="{ backgroundColor: isMine ? '#1677ff' : '#8c8c8c', fontSize: '12px' }">
                  {{ authorText.charAt(0) }}
                </a-avatar>
                {{ authorText }}
              </span>
            </div>
            <div class="meta-row">
              <span class="meta-label">分类</span>
              <span class="meta-value">{{ record.category || '-' }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">格式</span>
              <a-tag>{{ (record.picFormat || '-').toUpperCase() }}</a-tag>
            </div>
            <div class="meta-row">
              <span class="meta-label">宽度</span>
              <span class="meta-value">{{ record.picWidth ?? '-' }} px</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">高度</span>
              <span class="meta-value">{{ record.picHeight ?? '-' }} px</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">宽高比</span>
              <span class="meta-value">{{ record.picScale ? record.picScale.toFixed(2) : '-' }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">大小</span>
              <span class="meta-value">{{ formatSize(record.picSize) }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">上传时间</span>
              <span class="meta-value">{{ formatDateTime(record.createTime) }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">审核状态</span>
              <a-tag :color="reviewMeta.color">{{ reviewMeta.text }}</a-tag>
            </div>
            <div v-if="record.reviewMessage" class="meta-row">
              <span class="meta-label">审核意见</span>
              <span class="meta-value">{{ record.reviewMessage }}</span>
            </div>
          </div>

          <div class="tag-block">
            <div class="meta-label" style="margin-bottom: 8px">标签</div>
            <a-space v-if="tags.length" wrap>
              <a-tag v-for="tag in tags" :key="tag" color="blue">{{ tag }}</a-tag>
            </a-space>
            <span v-else class="meta-value">-</span>
          </div>

          <a-divider class="divider" />

          <div class="action-col">
            <a-button
              type="primary"
              block
              size="large"
              :loading="downloading"
              @click="handleDownload"
            >
              <DownloadOutlined />
              下载原图
            </a-button>
            <!-- 管理员就地审核：从审核工作台点进来看图时，不该还要退出去才能改状态 -->
            <a-button v-if="isAdmin" block @click="openReview">
              <AuditOutlined />
              审核
            </a-button>
            <a-space v-if="canOperate" style="width: 100%">
              <a-button block @click="openEdit">
                <EditOutlined />
                编辑
              </a-button>
              <a-popconfirm
                title="确定删除这张图片？存储上的文件会一起清掉"
                ok-text="删除"
                cancel-text="取消"
                @confirm="handleDelete"
              >
                <a-button block danger>
                  <DeleteOutlined />
                  删除
                </a-button>
              </a-popconfirm>
            </a-space>
          </div>
        </aside>
      </div>
    </a-spin>

    <!-- 审核弹窗：与列表页/审核工作台共用同一个组件 -->
    <ImageReviewModal v-model:open="reviewOpen" :image="record" @reviewed="load" />

    <!-- 编辑弹窗：字段与列表页一致（只有名称/简介/分类/标签可改） -->
    <a-modal
      v-model:open="editOpen"
      title="编辑图片"
      :confirm-loading="editSubmitting"
      @ok="handleEditSubmit"
    >
      <a-form layout="vertical" :model="editForm">
        <a-form-item label="名称">
          <a-input v-model:value="editForm.name" :maxlength="80" />
        </a-form-item>
        <a-form-item label="简介">
          <a-textarea v-model:value="editForm.introduction" :rows="3" :maxlength="500" />
        </a-form-item>
        <a-form-item label="分类">
          <a-input v-model:value="editForm.category" :maxlength="50" />
        </a-form-item>
        <a-form-item label="标签">
          <a-input v-model:value="editForm.tags" placeholder="多个标签用逗号分隔" :maxlength="200" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  AuditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
} from '@ant-design/icons-vue'

import ImageReviewModal from '@/components/ImageReviewModal.vue'

import {
  deleteImage,
  downloadImage,
  getImage,
  updateImage,
  type ImageUpdateRequest,
  type ImageVO,
} from '@/api/image'
import { useUserStore } from '@/stores/user'
import { formatDateTime } from '@/utils/datetime'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const imageId = String(route.params.id ?? '')
const loading = ref(false)
const record = ref<ImageVO | null>(null)

/**
 * 展示用地址：优先 WebP 副本（同尺寸更小），没有就原图。
 * 缩略图在这里不能用 —— 详情页要的是清晰度，200×200 的缩略图放大就糊了。
 */
const displaySrc = computed(() => record.value?.webpUrl ?? record.value?.url ?? '')

const isMine = computed(() => !!record.value?.userId && record.value.userId === userStore.loginUser?.id)
const authorText = computed(() => {
  if (!record.value) return '-'
  if (isMine.value) return userStore.loginUser?.userName ?? '我'
  // VO 里只有 userId（没做「查作者昵称」的聚合），落库的是雪花 id：截断显示，够定位到人
  return `用户 ${String(record.value.userId).slice(-6)}`
})

const tags = computed<string[]>(() => {
  const raw = record.value?.tags
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : []
  } catch {
    return []
  }
})

/** 审核状态的可视映射：三态在页面里都要有自己的颜色，不能只靠文字 */
const reviewMeta = computed(() => {
  switch (record.value?.reviewStatus) {
    case 1:
      return { text: '已通过', color: 'success' }
    case 2:
      return { text: '已拒绝', color: 'error' }
    default:
      return { text: '待审核', color: 'warning' }
  }
})

async function load() {
  if (!imageId) return
  loading.value = true
  try {
    record.value = await getImage(imageId)
  } catch {
    record.value = null
  } finally {
    loading.value = false
  }
}

const isAdmin = computed(() => userStore.loginUser?.userRole === 'admin')

/**
 * 返回哪一页由「来处」决定（路由 query 里的 from）。
 *
 * <p>详情页有三个入口（主页图墙 / 我的图片 / 审核工作台），返回时各回各家 ——
 * 一刀切回某一个列表的话，管理员审到一半返回就掉进"我的图片"，还得重新点侧栏、
 * 重新等他刚才那批待办。
 *
 * <p>不带 from（直接粘 URL、外链进来）按主页处理：主页是所有入口里最"公共"的那个。
 */
const HOME_BACK = { label: '返回主页', path: '/' }
const BACK_TARGETS: Record<string, { label: string; path: string }> = {
  home: HOME_BACK,
  manage: { label: '返回列表', path: '/image/manage' },
  review: { label: '返回审核', path: '/image/review' },
}
// 兜底用独立的常量而不是 BACK_TARGETS.home：索引访问在 noUncheckedIndexedAccess 下
// 类型是 T | undefined，拿它兜底等于没兜（TS 仍然按可能 undefined 报错）
const backTarget = computed(() => BACK_TARGETS[String(route.query.from ?? 'home')] ?? HOME_BACK)
const backLabel = computed(() => backTarget.value.label)

function goBack() {
  router.push(backTarget.value.path)
}

/**
 * 能不能编辑/删除这张图：本人或管理员。
 *
 * <p>主页图墙让「别人的已通过图」也能被打开，所以这两个按钮不能无条件显示 ——
 * 不然普通用户点进去就是一排 40101 报错。前端隐藏只是体验，后端 checkImageOwner 仍是权威。
 */
const canOperate = computed(() => isMine.value || isAdmin.value)

// ---- 审核（管理员）----
const reviewOpen = ref(false)

function openReview() {
  reviewOpen.value = true
}

/** WebP 副本 404（存量旧图）→ 退回原图；原图挂了就没得退，交给 fallback */
function onImgError(event: Event) {
  const img = event.target as HTMLImageElement
  const url = record.value?.url
  if (url && record.value?.webpUrl && img.src !== url) {
    img.src = url
  }
}

// ---- 下载 ----
const downloading = ref(false)
async function handleDownload() {
  if (!record.value?.id || downloading.value) return
  downloading.value = true
  try {
    await downloadImage(record.value.id, (record.value.name ?? '图片') + '.' + (record.value.picFormat ?? 'jpg'))
  } finally {
    downloading.value = false
  }
}

// ---- 编辑 ----
const editOpen = ref(false)
const editSubmitting = ref(false)
const editForm = reactive<ImageUpdateRequest>({})

function openEdit() {
  if (!record.value) return
  editForm.id = record.value.id
  editForm.name = record.value.name ?? ''
  editForm.introduction = record.value.introduction ?? ''
  editForm.category = record.value.category ?? ''
  editForm.tags = record.value.tags ?? ''
  editOpen.value = true
}

async function handleEditSubmit() {
  editSubmitting.value = true
  try {
    await updateImage({ ...editForm })
    message.success('修改成功')
    editOpen.value = false
    await load()
  } catch {
    // 拦截器已提示
  } finally {
    editSubmitting.value = false
  }
}

// ---- 删除 ----
async function handleDelete() {
  if (!record.value?.id) return
  try {
    await deleteImage(record.value.id)
    message.success('删除成功')
    // 删除也按来源回：从审核页进来的，删完继续审下一张
    await router.push(backTarget.value.path)
  } catch {
    // 拦截器已提示
  }
}

// ---- 展示格式化 ----
function formatSize(bytes?: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}


onMounted(load)
</script>

<style scoped>
.detail-page {
  max-width: 1280px;
  margin: 0 auto;
}

.page-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.page-bar-title {
  font-size: 16px;
  font-weight: 600;
  color: rgb(0 0 0 / 85%);
}

/* 双栏：左给图（弹性），右给信息（固定宽度，保证字段对齐成一条竖线） */
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 20px;
  align-items: start;
}

@media (max-width: 992px) {
  .detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 3%), 0 4px 12px rgb(0 0 0 / 4%);
  overflow: hidden;
}

.card-head {
  padding: 16px 20px;
  font-size: 15px;
  font-weight: 600;
  border-bottom: 1px solid #f0f0f0;
}

/* 预览舞台：浅灰底 + 内边距，图片 contain 居中，不裁切不留奇怪白边 */
.preview-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  max-height: 68vh;
  padding: 24px;
  background: linear-gradient(0deg, #fafafa, #fafafa), repeating-conic-gradient(#f5f5f5 0% 25%, #fafafa 0% 50%) 50% / 20px 20px;
}

.preview-stage :deep(.ant-image) {
  max-width: 100%;
}

.preview-stage :deep(img) {
  max-width: 100%;
  max-height: calc(68vh - 48px);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 10%);
  object-fit: contain;
}

.preview-foot {
  padding: 10px 20px 16px;
  font-size: 12px;
  color: rgb(0 0 0 / 45%);
}

.info-card {
  padding: 20px;
}

.img-name {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  color: rgb(0 0 0 / 88%);
  word-break: break-all;
}

.img-intro {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: rgb(0 0 0 / 55%);
  white-space: pre-wrap;
}

.divider {
  margin: 16px 0;
}

.meta-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.meta-label {
  flex: 0 0 72px;
  color: rgb(0 0 0 / 45%);
  font-size: 13px;
}

.meta-value {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: rgb(0 0 0 / 85%);
  word-break: break-all;
}

.tag-block {
  margin-top: 16px;
}

.action-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
