<template>
  <a-card title="我的图片">
    <!-- 搜索：目前后端只支持按名称模糊查 -->
    <a-form layout="inline" :model="query">
      <a-form-item label="图片名称">
        <a-input
          v-model:value="query.name"
          placeholder="输入名称搜索"
          allow-clear
          style="width: 220px"
          @press-enter="handleSearch"
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
          <a-image :src="record.url" :width="72" :height="72" style="object-fit: cover" />
        </template>
        <template v-else-if="column.dataIndex === 'picSize'">{{ formatSize(record.picSize) }}</template>
        <template v-else-if="column.dataIndex === 'dimension'">
          {{ record.picWidth && record.picHeight ? `${record.picWidth} × ${record.picHeight}` : '-' }}
        </template>
        <template v-else-if="column.dataIndex === 'createTime'">
          {{ formatTime(record.createTime) }}
        </template>
        <template v-else-if="column.dataIndex === 'action'">
          <a-space>
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
import { message, type TableProps } from 'ant-design-vue'

import {
  deleteImage,
  listImageByPage,
  updateImage,
  type ImageQueryRequest,
  type ImageUpdateRequest,
  type ImageVO,
} from '@/api/image'

const loading = ref(false)
const records = ref<ImageVO[]>([])
const total = ref(0)

const query = reactive<ImageQueryRequest>({
  pageNum: 1,
  pageSize: 10,
  name: '',
})

const columns: TableProps['columns'] = [
  { title: '图片', dataIndex: 'url', width: 100 },
  { title: '名称', dataIndex: 'name', ellipsis: true },
  { title: '简介', dataIndex: 'introduction', ellipsis: true },
  { title: '格式', dataIndex: 'picFormat', width: 80 },
  { title: '大小', dataIndex: 'picSize', width: 100 },
  { title: '尺寸', dataIndex: 'dimension', width: 110 },
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
    const page = await listImageByPage({ ...query })
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

// ---- 展示格式化 ----
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
