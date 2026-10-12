<template>
  <a-card title="我的图片">
    <!-- 搜索：名称模糊 + 分类精确 + 标签多选（AND 语义） -->
    <a-form layout="inline" :model="query">
      <a-form-item label="图片名称">
        <a-input
          v-model:value="query.name"
          placeholder="输入名称搜索"
          allow-clear
          style="width: 200px"
          @press-enter="handleSearch"
        />
      </a-form-item>
      <a-form-item label="分类">
        <a-select
          v-model:value="query.category"
          placeholder="全部分类"
          allow-clear
          style="width: 140px"
          :options="categoryOptions"
        />
      </a-form-item>
      <a-form-item label="标签">
        <a-select
          v-model:value="selectedTags"
          mode="multiple"
          placeholder="可多选（同时满足）"
          allow-clear
          style="min-width: 220px"
          :options="tagOptions"
        />
      </a-form-item>
      <a-form-item>
        <a-space>
          <a-button type="primary" @click="handleSearch">搜索</a-button>
          <a-button @click="handleReset">重置</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-table
      row-key="id"
      :columns="columns"
      :data-source="records"
      :loading="loading"
      :pagination="pagination"
      style="margin-top: 16px"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'url'">
          <!--
            列表格子里优先用缩略图（后端生成的 200×200 小图，比原图小一个数量级）；
            缩略图 404（存量旧图没有派生文件）时回退原图 —— onError 里把 src 换掉。
            点开预览优先 webp 副本（同尺寸更小），没有就用原图。
          -->
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
        <template v-else-if="column.dataIndex === 'dimension'">
          {{ record.picWidth && record.picHeight ? `${record.picWidth} × ${record.picHeight}` : '-' }}
        </template>
        <template v-else-if="column.dataIndex === 'createTime'">
          {{ formatTime(record.createTime) }}
        </template>
        <template v-else-if="column.dataIndex === 'reviewStatus'">
          <a-tag :color="reviewMeta(record.reviewStatus).color">{{ reviewMeta(record.reviewStatus).text }}</a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="goDetail(record)">详情</a-button>
            <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-popconfirm
              title="确定删除这张图片？存储上的文件会一起清掉"
              ok-text="删除"
              cancel-text="取消"
              @confirm="handleDelete(record)"
            >
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
  </a-card>

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

</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, type TableProps } from 'ant-design-vue'

import {
  deleteImage,
  listImageByPage,
  updateImage,
  type ImageQueryRequest,
  type ImageUpdateRequest,
  type ImageVO,
} from '@/api/image'

const router = useRouter()

const loading = ref(false)
const records = ref<ImageVO[]>([])
const total = ref(0)

const query = reactive<ImageQueryRequest>({
  pageNum: 1,
  pageSize: 10,
  name: '',
})

/** 标签多选的中间状态：UI 上是数组，发请求时序列化成后端约定的 JSON 数组字符串 */
const selectedTags = ref<string[]>([])

/**
 * 分类/标签候选项：从当前页数据里现收（不去后端专门拉字典 —— 图库规模小，
 * 「翻几页后选项就全了」比多一个接口实在。数据量大后再换后端字典接口）。
 */
const categoryOptions = computed(() =>
  [...new Set(records.value.map((r) => r.category).filter(Boolean))].map((c) => ({
    label: c as string,
    value: c as string,
  })),
)
const tagOptions = computed(() => {
  const tags = new Set<string>()
  for (const r of records.value) {
    if (!r.tags) continue
    try {
      const arr = JSON.parse(r.tags)
      if (Array.isArray(arr)) arr.forEach((t) => t && tags.add(String(t)))
    } catch {
      // 单条脏数据不影响整体选项
    }
  }
  return [...tags].map((t) => ({ label: t, value: t }))
})

const columns: TableProps['columns'] = [
  { title: '图片', dataIndex: 'url', width: 100 },
  { title: '名称', dataIndex: 'name', ellipsis: true },
  { title: '简介', dataIndex: 'introduction', ellipsis: true },
  { title: '格式', dataIndex: 'picFormat', width: 80 },
  { title: '大小', dataIndex: 'picSize', width: 100 },
  { title: '尺寸', dataIndex: 'dimension', width: 110 },
  { title: '审核状态', dataIndex: 'reviewStatus', width: 100 },
  { title: '创建时间', dataIndex: 'createTime', width: 170 },
  { title: '操作', dataIndex: 'action', width: 140 },
]

/**
 * 每页条数上限锁在 20：后端 PageRequest 里 MAX_PAGE_SIZE = 20，
 * 传更大的值会被静默夹到 20（不是报错）—— 前端就别给出 50/100 这种
 * 「选了也没用、还让人以为生效了」的选项。
 */
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
    // 标签多选序列化成后端约定的 JSON 数组字符串；没选就不带这个字段
    const params: ImageQueryRequest = { ...query }
    if (selectedTags.value.length > 0) {
      params.tags = JSON.stringify(selectedTags.value)
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

function handleReset() {
  query.name = ''
  query.category = undefined
  selectedTags.value = []
  query.pageNum = 1
  load()
}

const handleTableChange: TableProps['onChange'] = (pag) => {
  query.pageNum = pag.current ?? 1
  query.pageSize = pag.pageSize ?? 10
  load()
}

// ---- 编辑 ----
const editOpen = ref(false)
const editSubmitting = ref(false)
const editForm = reactive<ImageUpdateRequest>({})

function openEdit(record: ImageVO) {
  editForm.id = record.id
  editForm.name = record.name ?? ''
  editForm.introduction = record.introduction ?? ''
  editForm.category = record.category ?? ''
  editForm.tags = record.tags ?? ''
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
async function handleDelete(record: ImageVO) {
  if (!record.id) return
  try {
    await deleteImage(record.id)
    message.success('删除成功')
    // 删掉当前页最后一条时往前退一页，否则会停在一个空白页上
    if (records.value.length === 1 && (query.pageNum ?? 1) > 1) {
      query.pageNum = (query.pageNum ?? 1) - 1
    }
    await load()
  } catch {
    // 拦截器已提示
  }
}

// ---- 详情：跳独立详情页（原弹窗已由 ImageDetailView 取代）----
function goDetail(record: ImageVO) {
  router.push(`/image/detail/${record.id}`)
}

/** 审核状态三态文案 + 颜色，列表里扫一眼就知道哪些还没审 */
function reviewMeta(status?: number) {
  switch (status) {
    case 1:
      return { text: '已通过', color: 'success' }
    case 2:
      return { text: '已拒绝', color: 'error' }
    default:
      return { text: '待审核', color: 'warning' }
  }
}

/** tags 存的是 JSON 数组字符串，展示时拆开；脏数据当没有标签处理 */
function parsedTags(tags?: string): string[] {
  if (!tags) return []
  try {
    const arr = JSON.parse(tags)
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

// ---- 展示格式化 ----

/**
 * 缩略图 404 兜底（存量旧图没有派生文件）：把 img 的 src 换成原图。
 * 只对"当前显示的是缩略图"的记录生效，原图挂了就不用再兜（没得退）。
 * event.target 是原生 img 元素 —— a-image 的 @error 转发的是 img 的事件。
 */
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
  // 后端返回 ISO 格式（2026-09-27T18:47:49），直接展示太啰嗦，替换成空格更易读
  return value ? value.replace('T', ' ').slice(0, 19) : '-'
}

onMounted(load)
</script>
