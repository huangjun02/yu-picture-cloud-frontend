<template>
  <a-card title="创建图片">
    <!-- 三种传图方式：本地文件 / 远端 URL / 网络抓取（管理员）。单选按钮切换，按模式渲染 -->
    <a-radio-group v-model:value="mode" button-style="solid" style="margin-bottom: 24px">
      <a-radio-button value="file">
        <FileImageOutlined />
        本地文件
      </a-radio-button>
      <a-radio-button value="url">
        <LinkOutlined />
        URL 导入
      </a-radio-button>
      <!-- 管理员专属：抓取会往库里灌数据，普通用户看不到入口（后端仍是权威） -->
      <a-radio-button v-if="isAdmin" value="crawl">
        <GlobalOutlined />
        网络抓取
      </a-radio-button>
    </a-radio-group>

    <!-- ========== 网络抓取（管理员）========== -->
    <template v-if="mode === 'crawl'">
      <a-form layout="vertical" :model="crawlForm" style="max-width: 680px">
        <a-form-item label="检索关键词" required>
          <a-input
            v-model:value="crawlForm.query"
            placeholder="例如：风景 / 猫 / 星空 / poster"
            allow-clear
            :maxlength="32"
            @press-enter="handleCrawl"
          />
          <div class="field-hint">
            从 <b>Openverse</b>（CC 授权内容聚合库）检索并抓回入库，每张都会带上作者与许可信息（署名是这类许可的硬要求）。
            一次最多 {{ CRAWL_MAX }} 张，抓完即入库 —— 管理员上传自动过审，不用再去审核一遍。
          </div>
        </a-form-item>

        <a-form-item label="抓取数量">
          <a-input-number v-model:value="crawlForm.count" :min="1" :max="CRAWL_MAX" />
          <span class="field-hint" style="margin-left: 12px">
            每张要「下载 → 压缩 → 生成缩略图 → 传 COS」，大约 1~2 秒一张
          </span>
        </a-form-item>

        <a-form-item label="分类 / 标签">
          <a-space :size="12" wrap>
            <a-select
              v-model:value="crawlForm.category"
              placeholder="分类（默认用关键词）"
              :options="categorySelectOptions"
              show-search
              :filter-option="filterOption"
              allow-clear
              style="width: 220px"
            />
            <a-select
              v-model:value="crawlTags"
              mode="tags"
              placeholder="标签，回车添加"
              :options="tagSelectOptions"
              :max-tag-count="6"
              style="min-width: 260px"
            />
          </a-space>
        </a-form-item>

        <a-form-item>
          <a-space>
            <a-button type="primary" :loading="crawling" @click="handleCrawl">
              {{ crawling ? '抓取中…' : '开始抓取' }}
            </a-button>
            <a-button :disabled="crawling" @click="resetCrawl">清空</a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <!-- 结果：逐条状态，而不是只给一个成功数 —— 少的那几张到底怎么了，用户要看得见 -->
      <div v-if="crawlResult" class="crawl-result">
        <a-alert
          :type="(crawlResult.successCount ?? 0) > 0 ? 'success' : 'warning'"
          show-icon
          :message="`关键词「${crawlResult.query}」：成功 ${crawlResult.successCount ?? 0} 张，跳过 ${crawlResult.skipCount ?? 0} 张，失败 ${crawlResult.failCount ?? 0} 张（候选 ${crawlResult.candidateCount ?? 0} 条）`"
        />
        <a-table
          class="crawl-table"
          :data-source="crawlResult.items"
          :columns="crawlColumns"
          :pagination="false"
          row-key="sourceUrl"
          size="small"
          table-layout="fixed"
          :scroll="{ y: 320 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'status'">
              <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'sourceUrl'">
              <span class="crawl-url">{{ record.sourceUrl }}</span>
            </template>
          </template>
        </a-table>
        <a-space style="margin-top: 12px">
          <a-button type="primary" @click="router.push('/image/manage')">去图片管理看看</a-button>
          <a-button @click="router.push('/')">去主页看看</a-button>
        </a-space>
      </div>
    </template>

    <a-form v-else layout="vertical" :model="formState" style="max-width: 640px">
      <!-- ========== 本地文件 ========== -->
      <template v-if="mode === 'file'">
        <a-form-item label="图片文件" required>
          <a-upload-dragger
            v-model:fileList="fileList"
            :max-count="1"
            :before-upload="beforeUpload"
            list-type="picture"
            accept="image/jpeg,image/png,image/webp"
          >
            <p class="ant-upload-drag-icon"><CloudUploadOutlined /></p>
            <p class="ant-upload-text">点击或拖拽图片到此处</p>
            <p class="ant-upload-hint">支持 jpg / png / webp，单个文件不超过 5MB</p>
          </a-upload-dragger>
        </a-form-item>
      </template>

      <!-- ========== URL 导入 ========== -->
      <template v-else>
        <a-form-item label="图片地址" required>
          <a-input
            v-model:value="formState.fileUrl"
            placeholder="https://example.com/photo.jpg"
            allow-clear
            @press-enter="handleSubmit"
          >
            <template #prefix><LinkOutlined /></template>
          </a-input>
          <div class="field-hint">
            服务器替你把这个地址的图片拉下来入库。仅支持公网 http / https 地址 ——
            内网、本机地址会被后端拦下（防止拿服务器当跳板去摸内网）。
          </div>
        </a-form-item>

        <!-- 地址填了就顺手预览一下：地址打不开的话，点提交前就该知道 -->
        <a-form-item v-if="formState.fileUrl" label="地址预览">
          <div class="url-preview">
            <img v-if="!previewFailed" :src="formState.fileUrl" @error="previewFailed = true" />
            <div v-else class="url-preview-error">
              <CloseCircleOutlined />
              地址加载不出来（可能不允许外链、或地址已失效）—— 后端拉取时也会失败
            </div>
          </div>
        </a-form-item>
      </template>

      <a-form-item label="图片名称">
        <a-input
          v-model:value="formState.name"
          :placeholder="mode === 'file' ? '不填则默认用原文件名' : '不填则从地址里取文件名'"
          allow-clear
          :maxlength="80"
        />
      </a-form-item>

      <a-form-item>
        <a-space>
          <a-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ mode === 'file' ? '开始上传' : '开始导入' }}
          </a-button>
          <a-button @click="handleReset">清空</a-button>
        </a-space>
      </a-form-item>
    </a-form>
  </a-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, type UploadFile } from 'ant-design-vue'
import {
  CloseCircleOutlined,
  CloudUploadOutlined,
  FileImageOutlined,
  GlobalOutlined,
  LinkOutlined,
} from '@ant-design/icons-vue'

import {
  crawlImages,
  listImageOptions,
  uploadImage,
  uploadImageByUrl,
  type ImageCrawlResultVO,
} from '@/api/image'
import { PRESET_CATEGORIES, PRESET_TAGS, mergeOptions } from '@/constants/filters'
import { useUserStore } from '@/stores/user'
import { stringifyTags } from '@/utils/tags'

const router = useRouter()
const userStore = useUserStore()

/** 抓取是管理员操作：前端只决定「看不看得见入口」，权威校验在后端 /image/crawl */
const isAdmin = computed(() => userStore.loginUser?.userRole === 'admin')

const mode = ref<'file' | 'url' | 'crawl'>('file')
const fileList = ref<UploadFile[]>([])
const submitting = ref(false)
const formState = reactive<{ name: string; fileUrl: string }>({ name: '', fileUrl: '' })

/** 地址预览失败标记：换地址要重置，否则改好了也一直显示旧错误 */
const previewFailed = ref(false)
watch(
  () => formState.fileUrl,
  () => {
    previewFailed.value = false
  },
)

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

/**
 * 返回 false 表示「拦住 a-upload 自己的上传行为」—— 我们要手动调后端接口，
 * 不能让它自己 POST 到一个不存在的地址。
 *
 * 这里的校验只是「提前拦一道，省一次网络往返」，**权威校验永远在后端**：
 * 前端校验能被绕过（改 JS、直接发请求），真正的后缀白名单 + 文件头魔数校验在
 * ImageUtils#checkUploadFile 里。两层都要有，但边界要清楚。
 */
function beforeUpload(file: File) {
  const okType = ALLOWED.includes(file.type)
  if (!okType) {
    message.error('只支持 jpg / png / webp 格式')
    return false
  }
  if (file.size > MAX_SIZE) {
    message.error('文件大小不能超过 5MB')
    return false
  }
  return false
}

function handleReset() {
  fileList.value = []
  formState.name = ''
  formState.fileUrl = ''
  previewFailed.value = false
}

// ==================== 网络抓取（管理员） ====================

/** 与后端 yupicture.crawl.max-count 对应：前端只是提前拦住，后端仍会再夹一次 */
const CRAWL_MAX = 20

const crawlForm = reactive<{ query: string; count: number; category?: string }>({
  query: '',
  count: 10,
  category: undefined,
})
/** 标签在 UI 上是数组，提交时才序列化成后端约定的 JSON 数组字符串 */
const crawlTags = ref<string[]>([])
const crawling = ref(false)
const crawlResult = ref<ImageCrawlResultVO | null>(null)

/** 分类/标签候选 = 预设 ∪ 库里真实值（理由见 constants/filters.ts） */
const categoryOptions = ref<string[]>([...PRESET_CATEGORIES])
const tagOptions = ref<string[]>([...PRESET_TAGS])
const categorySelectOptions = computed(() =>
  categoryOptions.value.map((c) => ({ label: c, value: c })),
)
const tagSelectOptions = computed(() => tagOptions.value.map((t) => ({ label: t, value: t })))
/** show-search 下默认只按 label 过滤，敲新分类会被过滤成空 —— 要放开 */
const filterOption = (input: string, option: { label?: string } | undefined) =>
  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())

const crawlColumns = [
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '名称', dataIndex: 'name', width: 200, ellipsis: true },
  { title: '说明', dataIndex: 'reason', width: 220, ellipsis: true },
  { title: '源地址', dataIndex: 'sourceUrl', ellipsis: true },
]

function statusText(status?: string) {
  return status === 'SUCCESS' ? '已入库' : status === 'SKIP' ? '已跳过' : '失败'
}

function statusColor(status?: string) {
  return status === 'SUCCESS' ? 'green' : status === 'SKIP' ? 'orange' : 'red'
}

async function loadFilterOptions() {
  try {
    const data = await listImageOptions()
    categoryOptions.value = mergeOptions(PRESET_CATEGORIES, data.categories ?? [])
    tagOptions.value = mergeOptions(PRESET_TAGS, data.tags ?? [])
  } catch {
    // 拿不到候选不影响抓取：退回预设值（拦截器已提示过）
  }
}

function resetCrawl() {
  crawlForm.query = ''
  crawlForm.count = 10
  crawlForm.category = undefined
  crawlTags.value = []
  crawlResult.value = null
}

/**
 * 开始抓取。
 *
 * 这里是**同步等待**（而不是后台任务 + 轮询）：一次最多 20 张、十几秒返回，
 * 加个轮询只会让首屏多一堆状态；真要到几百张的规模再上异步，那时"进度条"才有意义。
 */
async function handleCrawl() {
  const query = crawlForm.query.trim()
  if (!query) {
    message.warning('请先填写检索关键词')
    return
  }
  crawling.value = true
  crawlResult.value = null
  try {
    const result = await crawlImages({
      query,
      count: crawlForm.count,
      category: crawlForm.category || undefined,
      tags: crawlTags.value.length ? stringifyTags(crawlTags.value) : undefined,
    })
    crawlResult.value = result
    // 生成的类型里计数字段是可选的（后端 int 没标 required）—— 用 ?? 0 收口，
    // 别为了少写两个字符去改生成代码
    if ((result.successCount ?? 0) > 0) {
      message.success(`抓取完成：成功 ${result.successCount} 张`)
      await loadFilterOptions()
    } else {
      message.warning('这次一张都没入库，看看下面的逐条说明')
    }
  } catch {
    // 拦截器已提示（关键词为空、无权限、检索失败都会在这里报出来）
  } finally {
    crawling.value = false
  }
}

onMounted(loadFilterOptions)

async function handleSubmit() {
  if (mode.value === 'file') {
    const file = fileList.value[0]?.originFileObj as File | undefined
    if (!file) {
      message.warning('请先选择一张图片')
      return
    }
    submitting.value = true
    try {
      const vo = await uploadImage(file, formState.name || undefined)
      message.success(`上传成功：${vo.name ?? ''}`)
      handleReset()
      await router.push('/image/manage')
    } catch {
      // 错误提示由 axios 拦截器统一弹出，这里不重复
    } finally {
      submitting.value = false
    }
    return
  }

  // ---- URL 导入 ----
  const url = formState.fileUrl.trim()
  if (!url) {
    message.warning('请先填写图片地址')
    return
  }
  // 只做「看着像不像地址」的前置提示；能不能拉、是不是内网，都由后端判定
  if (!/^https?:\/\//i.test(url)) {
    message.error('地址必须以 http:// 或 https:// 开头')
    return
  }

  submitting.value = true
  try {
    const vo = await uploadImageByUrl(url, formState.name || undefined)
    message.success(`导入成功：${vo.name ?? ''}`)
    handleReset()
    await router.push('/image/manage')
  } catch {
    // 拦截器已提示（内网地址、拉取失败、非图片内容都会在这里报出来）
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
:deep(.ant-upload-drag-icon) {
  margin-bottom: 8px;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: rgb(0 0 0 / 45%);
}

.url-preview {
  padding: 8px;
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  background: #fafafa;
  text-align: center;
}

.url-preview img {
  max-width: 100%;
  max-height: 240px;
  border-radius: 6px;
}

.url-preview-error {
  padding: 24px 8px;
  font-size: 13px;
  color: rgb(0 0 0 / 45%);
}

.crawl-result {
  margin-top: 8px;
}

.crawl-table {
  margin-top: 12px;
}

/* 源地址很长且没有空格，必须强行省略，否则会把列宽撑开（fixed 布局也拦不住长串） */
.crawl-url {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgb(0 0 0 / 45%);
  font-size: 12px;
}
</style>
