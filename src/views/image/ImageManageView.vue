<template>
  <a-card title="图片管理">
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
      <a-form-item label="审核状态">
        <a-select
          v-model:value="reviewStatusFilter"
          style="width: 120px"
          :options="reviewStatusOptions"
        />
      </a-form-item>
      <a-form-item>
        <a-space>
          <a-button type="primary" @click="handleSearch">搜索</a-button>
          <a-button @click="handleReset">重置</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <!--
      批量操作条：有勾选才出现（v-if），平时不占地方。
      Popconfirm 二次确认带数量 —— 批量删除清的是存储上的文件，误触代价高。
    -->
    <a-space v-if="selectedIds.length > 0" style="margin-top: 16px">
      <span>已选 {{ selectedIds.length }} 张</span>
      <a-popconfirm
        :title="`确定删除选中的 ${selectedIds.length} 张图片？存储上的文件会一并清除`"
        ok-text="删除"
        cancel-text="取消"
        @confirm="handleBatchDelete"
      >
        <a-button danger>批量删除</a-button>
      </a-popconfirm>
      <a-button @click="openBatchEdit">批量改分类/标签</a-button>
      <a-button type="link" size="small" @click="clearSelection">取消选择</a-button>
    </a-space>

    <a-table
      row-key="id"
      table-layout="fixed"
      :row-selection="rowSelection"
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
          {{ formatDateTime(record.createTime) }}
        </template>
        <template v-else-if="column.dataIndex === 'reviewStatus'">
          <a-tag :color="reviewMeta(record.reviewStatus).color">{{ reviewMeta(record.reviewStatus).text }}</a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'action'">
          <a-space :size="0" wrap>
            <a-button type="link" size="small" @click="goDetail(record)">详情</a-button>
            <!-- 管理员就地审核：看完缩略图和名称就能判，不必跳去审核页再找一遍 -->
            <a-button v-if="isAdmin" type="link" size="small" @click="openReview(record)">审核</a-button>
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

  <!-- 审核弹窗：与详情页/审核工作台共用同一个组件 -->
  <ImageReviewModal v-model:open="reviewOpen" :image="reviewTarget" @reviewed="load" />

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
        <!--
          用 tags 模式的选择器而不是纯文本框：文本框里填「测试」会原样落库成 `测试`
          （不是 JSON 数组），后端解析不了 —— 主页标签栏里它就不见了。
          这里既能从候选里挑，也能直接敲新标签，回车即添加。
        -->
        <a-select
          v-model:value="editTags"
          mode="tags"
          placeholder="选择或输入标签，回车添加"
          :options="tagOptions"
          :max-tag-count="8"
          style="width: 100%"
        />
      </a-form-item>
    </a-form>
  </a-modal>

  <!-- 批量编辑弹窗：分类是「设置」（覆盖），标签是「追加」（并入去重），语义在标题里写清 -->
  <a-modal
    v-model:open="batchEditOpen"
    :title="`批量编辑（已选 ${selectedIds.length} 张）`"
    :confirm-loading="batchEditSubmitting"
    @ok="handleBatchEditSubmit"
  >
    <a-form layout="vertical">
      <a-form-item label="分类（留空 = 不改）">
        <a-select
          v-model:value="batchEditCategory"
          placeholder="选择目标分类"
          allow-clear
          :options="categoryOptions"
        />
      </a-form-item>
      <a-form-item label="追加标签（并入每张图已有的标签，不会清掉原有标签）">
        <a-select
          v-model:value="batchEditTags"
          mode="tags"
          placeholder="选择或输入标签，回车添加"
          :options="tagOptions"
          :max-tag-count="8"
        />
      </a-form-item>
    </a-form>
  </a-modal>

</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, type TableProps } from 'ant-design-vue'

import ImageReviewModal from '@/components/ImageReviewModal.vue'

import { useUserStore } from '@/stores/user'
import { PRESET_CATEGORIES, PRESET_TAGS, mergeOptions } from '@/constants/filters'
import { parseTags, stringifyTags } from '@/utils/tags'
import { formatDateTime } from '@/utils/datetime'
import {
  batchDeleteImages,
  batchUpdateImages,
  deleteImage,
  listImageByPage,
  listImageOptions,
  notifyBatchResult,
  updateImage,
  type ImageQueryRequest,
  type ImageUpdateRequest,
  type ImageVO,
} from '@/api/image'

const router = useRouter()
const userStore = useUserStore()

/** 管理员才看得到审核入口（权威校验在后端 /image/review，这里只管「要不要显示」） */
const isAdmin = computed(() => userStore.loginUser?.userRole === 'admin')

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
 * 审核状态筛选。
 *
 * ⚠️ 「全部」用 -1 表示，但 **-1 只是个前端哨兵值，绝不能发给后端**
 * （后端只认 null / 1 / 2，传 -1 会被当成非法状态）。发请求时把 -1 翻译成 undefined。
 */
const reviewStatusFilter = ref<number>(-1)
const reviewStatusOptions = [
  { label: '全部', value: -1 },
  { label: '待审核', value: 0 },
  { label: '已通过', value: 1 },
  { label: '已拒绝', value: 2 },
]

/**
 * 分类/标签的候选项 = 预设常用值 ∪ 接口给的（已通过图上的）∪ 当前页数据里的。
 *
 * <p>三段各自补一个洞：预设让筛选栏一进来就有东西可点；接口给的是"全库都有哪些分类"，
 * 比只看当前页强（原来翻到第 3 页才出现的分类，在第 1 页选不到）；
 * 当前页再兜一层，保证「自己这张待审核图上的分类」也能选出来。
 */
const filterOptions = ref<{ categories: string[]; tags: string[] }>({ categories: [], tags: [] })

const categoryOptions = computed(() => {
  const fromPage = records.value.map((r) => r.category)
  return mergeOptions(PRESET_CATEGORIES, [...filterOptions.value.categories, ...fromPage]).map((c) => ({
    label: c,
    value: c,
  }))
})

const tagOptions = computed(() => {
  // 用共享的 parseTags（容错版）：库里存在"裸字符串"这种历史脏数据，
  // 这里再写一次 JSON.parse 的话，脏数据到选项里就断了
  const fromPage = records.value.flatMap((r) => parseTags(r.tags))
  return mergeOptions(PRESET_TAGS, [...filterOptions.value.tags, ...fromPage]).map((t) => ({
    label: t,
    value: t,
  }))
})

async function loadFilterOptions() {
  try {
    const data = await listImageOptions()
    filterOptions.value = { categories: data.categories ?? [], tags: data.tags ?? [] }
  } catch {
    // 候选项拿不到不影响列表：预设值仍然在，够用
  }
}

/**
 * 列宽一律显式给出（配 table-layout="fixed"）：
 * auto 布局下「名称/简介」会按内容的最小宽度撑开，列宽之和恒定大于容器，
 * 结果不管屏幕多宽底部都挂着一条横向滚动条 —— 显式列宽 + fixed 布局才收得住。
 *
 * ⚠️ 开了 row-selection 后表格会多出一列勾选框（约 32~60px），fixed 布局下
 * 表格总宽仍是 100%，勾选列的开销由所有列按比例分摊 —— 操作列按钮最多、
 * 最容易被压到裁掉「删除」。所以操作列宽度按真实按钮宽度给（含 buffer），
 * 再从可压缩的「简介」列（有 ellipsis）把这份预算扣回来，列宽总和不变。
 * 操作列的 a-space 另加 wrap：极端窄窗口下按钮换行兜底，而不是被静默裁掉。
 */
const columns = computed<TableProps['columns']>(() => [
  { title: '图片', dataIndex: 'url', width: 80 },
  { title: '名称', dataIndex: 'name', ellipsis: true, width: 150 },
  { title: '简介', dataIndex: 'introduction', ellipsis: true, width: 140 },
  { title: '格式', dataIndex: 'picFormat', width: 70 },
  { title: '大小', dataIndex: 'picSize', width: 90 },
  { title: '尺寸', dataIndex: 'dimension', width: 100 },
  { title: '状态', dataIndex: 'reviewStatus', width: 80 },
  { title: '创建时间', dataIndex: 'createTime', width: 150 },
  { title: '操作', dataIndex: 'action', width: isAdmin.value ? 190 : 150 },
])

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
    // 可见性靠这个字段区分（后端规则）：
    //  - 普通用户传自己的 userId → 「我的图」视角，能看见自己的待审核 / 被拒（否则刚传的图当场"消失"）
    //  - 管理员不传 → 全库数据，可按审核状态筛待办
    if (!isAdmin.value && userStore.loginUser?.id) {
      params.userId = userStore.loginUser.id
    }
    // 哨兵值 -1（全部）翻译成 undefined：前端 UI 的「全部」不是后端的合法状态值
    params.reviewStatus = reviewStatusFilter.value === -1 ? undefined : reviewStatusFilter.value
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
  clearSelection()
  load()
}

function handleReset() {
  query.name = ''
  query.category = undefined
  selectedTags.value = []
  reviewStatusFilter.value = -1
  query.pageNum = 1
  clearSelection()
  load()
}

const handleTableChange: TableProps['onChange'] = (pag) => {
  query.pageNum = pag.current ?? 1
  query.pageSize = pag.pageSize ?? 10
  // 翻页清空勾选：不做跨页记忆（selectedIds 注释里有理由）
  clearSelection()
  load()
}

// ---- 编辑 ----
const editOpen = ref(false)
const editSubmitting = ref(false)
const editForm = reactive<ImageUpdateRequest>({})
/** 标签在 UI 上是数组，提交时才序列化成后端约定的 JSON 数组字符串 */
const editTags = ref<string[]>([])

function openEdit(record: ImageVO) {
  editForm.id = record.id
  editForm.name = record.name ?? ''
  editForm.introduction = record.introduction ?? ''
  editForm.category = record.category ?? ''
  editTags.value = parseTags(record.tags)
  editOpen.value = true
}

async function handleEditSubmit() {
  editSubmitting.value = true
  try {
    await updateImage({ ...editForm, tags: stringifyTags(editTags.value) })
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

// ---- 批量操作（部分成功语义） ----

/** 选中的图片 id（跨页不保留：筛选/翻页语义一变，旧勾选对应的可能是另一批图，容易误操作） */
const selectedIds = ref<string[]>([])

/**
 * 不做跨页记忆是有意的：翻页后 selectedIds 里残留的 id 对用户已不可见，
 * 「批量删除」会删掉眼前看不见的图 —— 比多勾一次省的功夫危险得多。
 */
const rowSelection = computed(() => ({
  selectedRowKeys: selectedIds.value,
  onChange: (keys: (string | number)[]) => {
    selectedIds.value = keys.map(String)
  },
}))

function clearSelection() {
  selectedIds.value = []
}

async function handleBatchDelete() {
  if (selectedIds.value.length === 0) return
  try {
    const result = await batchDeleteImages({ imageIds: selectedIds.value })
    if (notifyBatchResult(result, '删除')) {
      await load()
    }
    clearSelection()
  } catch {
    // 拦截器已提示（空列表 / 超限等整批错误）
  }
}

// ---- 批量编辑（分类「设置」+ 标签「追加」）----
const batchEditOpen = ref(false)
const batchEditSubmitting = ref(false)
const batchEditCategory = ref<string | undefined>(undefined)
const batchEditTags = ref<string[]>([])

function openBatchEdit() {
  batchEditCategory.value = undefined
  batchEditTags.value = []
  batchEditOpen.value = true
}

async function handleBatchEditSubmit() {
  if (!batchEditCategory.value && batchEditTags.value.length === 0) {
    message.warning('请填写要修改的分类或要追加的标签')
    return
  }
  batchEditSubmitting.value = true
  try {
    const result = await batchUpdateImages({
      imageIds: selectedIds.value,
      ...(batchEditCategory.value ? { category: batchEditCategory.value } : {}),
      ...(batchEditTags.value.length > 0 ? { appendTags: batchEditTags.value } : {}),
    })
    if (notifyBatchResult(result, '编辑')) {
      batchEditOpen.value = false
      await load()
    }
    clearSelection()
  } catch {
    // 拦截器已提示
  } finally {
    batchEditSubmitting.value = false
  }
}

// ---- 详情：跳独立详情页（原弹窗已由 ImageDetailView 取代）----
function goDetail(record: ImageVO) {
  router.push({ path: `/image/detail/${record.id}`, query: { from: 'manage' } })
}

// ---- 审核（管理员）----
const reviewOpen = ref(false)
const reviewTarget = ref<ImageVO | null>(null)

function openReview(record: ImageVO) {
  reviewTarget.value = record
  reviewOpen.value = true
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


onMounted(() => {
  load()
  loadFilterOptions()
})
</script>
