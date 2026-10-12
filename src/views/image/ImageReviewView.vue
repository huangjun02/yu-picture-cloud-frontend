<template>
  <a-card title="图片审核">
    <template #extra>
      <a-button size="small" @click="load">
        <ReloadOutlined />
        刷新
      </a-button>
    </template>

    <!--
      状态筛选走数据库（后端 reviewStatus 条件），不是「拿当前页自己过滤」——
      前端过滤的话，第 1 页显示 3 条待审核、翻到第 2 页又冒出 5 条，
      跟真实待办数对不上，管理员会以为审完了。
    -->
    <a-radio-group v-model:value="statusFilter" button-style="solid" @change="handleSearch">
      <a-radio-button :value="0">
        待审核
      </a-radio-button>
      <a-radio-button :value="1">已通过</a-radio-button>
      <a-radio-button :value="2">已拒绝</a-radio-button>
      <a-radio-button :value="-1">全部</a-radio-button>
    </a-radio-group>

    <a-table
      row-key="id"
      table-layout="fixed"
      :columns="columns"
      :data-source="records"
      :loading="loading"
      :pagination="pagination"
      style="margin-top: 16px"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'url'">
          <a-image
            :src="record.thumbnailUrl ?? record.url"
            :preview="{ src: record.webpUrl ?? record.url }"
            :width="72"
            :height="72"
            style="object-fit: cover"
            @error="onImgError(record, $event)"
          />
        </template>
        <template v-else-if="column.dataIndex === 'picSize'">{{ formatSize(record.picSize) }}</template>
        <template v-else-if="column.dataIndex === 'createTime'">{{ formatTime(record.createTime) }}</template>
        <template v-else-if="column.dataIndex === 'reviewStatus'">
          <a-tag :color="statusMeta(record.reviewStatus).color">{{ statusMeta(record.reviewStatus).text }}</a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'reviewMessage'">
          {{ record.reviewMessage || '-' }}
        </template>
        <template v-else-if="column.dataIndex === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="goDetail(record)">查看</a-button>
            <!-- 已拒绝的图仍可改判通过：审核不是终审，看走眼了要能纠正 -->
            <a-button
              v-if="record.reviewStatus !== 1"
              type="link"
              size="small"
              @click="handlePass(record)"
            >
              通过
            </a-button>
            <a-button
              v-if="record.reviewStatus !== 2"
              type="link"
              size="small"
              danger
              @click="openReview(record)"
            >
              拒绝
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </a-card>

  <!-- 审核弹窗：与列表页/详情页共用同一个组件（拒绝必填原因的规则只有一份） -->
  <ImageReviewModal v-model:open="reviewOpen" :image="reviewTarget" @reviewed="load" />
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, type TableProps } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'

import { listImageByPage, reviewImage, type ImageQueryRequest, type ImageVO } from '@/api/image'
import ImageReviewModal from '@/components/ImageReviewModal.vue'

const router = useRouter()

const loading = ref(false)
const records = ref<ImageVO[]>([])
const total = ref(0)

/** -1 是「全部」的哨兵值：undefined 不好绑在 radio 上，也容易被当成「没选」 */
const statusFilter = ref<number>(-1)

const query = reactive<ImageQueryRequest>({ pageNum: 1, pageSize: 10, reviewStatus: 0 })

/**
 * 列宽一律显式给出（配 table-layout="fixed"）：
 * auto 布局下带 ellipsis 的文本列仍按内容最小宽度撑开，列宽之和恒定大于容器，
 * 底部就永远挂着一条横向滚动条（用 1400/1920 两种视口都实测到过）。
 */
const columns: TableProps['columns'] = [
  { title: '图片', dataIndex: 'url', width: 100 },
  { title: '名称', dataIndex: 'name', ellipsis: true, width: 180 },
  { title: '分类', dataIndex: 'category', width: 100, ellipsis: true },
  { title: '大小', dataIndex: 'picSize', width: 100 },
  { title: '上传时间', dataIndex: 'createTime', width: 160 },
  { title: '审核状态', dataIndex: 'reviewStatus', width: 90 },
  { title: '审核意见', dataIndex: 'reviewMessage', ellipsis: true, width: 200 },
  { title: '操作', dataIndex: 'action', width: 150 },
]

const pagination = computed(() => ({
  current: query.pageNum,
  pageSize: query.pageSize,
  total: total.value,
  showSizeChanger: true,
  pageSizeOptions: ['5', '10', '20'],
  showTotal: (t: number) => `共 ${t} 条`,
}))

async function load() {
  loading.value = true
  try {
    // 「全部」= 不带这个条件；后端用 null 判断「没筛」
    const params: ImageQueryRequest = {
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      ...(statusFilter.value === -1 ? {} : { reviewStatus: statusFilter.value }),
    }
    const page = await listImageByPage(params)
    records.value = page.records ?? []
    total.value = page.total ?? 0
  } catch {
    records.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.pageNum = 1
  load()
}

const handleTableChange: TableProps['onChange'] = (pag) => {
  query.pageNum = pag.current ?? 1
  query.pageSize = pag.pageSize ?? 10
  load()
}

function statusMeta(status?: number) {
  switch (status) {
    case 1:
      return { text: '已通过', color: 'success' }
    case 2:
      return { text: '已拒绝', color: 'error' }
    default:
      return { text: '待审核', color: 'warning' }
  }
}

/**
 * 通过走「一键直过」而不是弹窗：审核工作台是批处理场景，
 * 大多数待审图都是「看一眼就过」，多一层弹窗纯属加点击。
 * 拒绝则必然要写原因，所以走共用弹窗。
 */
async function handlePass(record: ImageVO) {
  if (!record.id) return
  try {
    await reviewImage({ id: record.id, reviewStatus: 1 })
    message.success('已通过')
    await load()
  } catch {
    // 拦截器已提示
  }
}

// ---- 拒绝：打开共用弹窗（原因必填的校验在组件里）----
const reviewOpen = ref(false)
const reviewTarget = ref<ImageVO | null>(null)

function openReview(record: ImageVO) {
  reviewTarget.value = record
  reviewOpen.value = true
}

/**
 * 进详情带上 from=review：详情页的「返回」才知道该回审核页，
 * 否则管理员审到一半返回会掉到图片管理列表，得重新点进来找那批待办。
 */
function goDetail(record: ImageVO) {
  router.push({ path: `/image/detail/${record.id}`, query: { from: 'review' } })
}

function onImgError(record: ImageVO, event: Event) {
  const img = event.target as HTMLImageElement
  if (record.thumbnailUrl && record.url && img.src === record.thumbnailUrl) {
    img.src = record.url
  }
}

function formatSize(bytes?: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 19) : '-'
}

onMounted(load)
</script>
