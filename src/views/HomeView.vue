<template>
  <div class="home">
    <!-- 搜索区：居中的大搜索框（参考官方主页的第一屏主视觉）+ 以图搜图入口 -->
    <div class="search-wrap">
      <a-input-search
        v-model:value="query.name"
        class="search-input"
        size="large"
        placeholder="从海量图片中搜索"
        enter-button="搜索"
        allow-clear
        @search="handleSearch"
      />
      <a-upload
        class="similar-upload"
        accept="image/jpeg,image/png,image/webp"
        :show-upload-list="false"
        :before-upload="handleSimilarSearch"
      >
        <a-button size="large" :loading="similarLoading">
          <template #icon><PictureOutlined /></template>
          以图搜图
        </a-button>
      </a-upload>
    </div>

    <!-- 以图搜图结果提示：结果不参与分页，给一个明确的「退出」口 -->
    <div v-if="similarMode" class="similar-banner">
      <span>以图搜图结果：{{ records.length }} 张（最像的排在最前）</span>
      <a-button type="link" size="small" @click="clearSimilarSearch">清除，回到浏览</a-button>
    </div>

    <!-- 分类：横向 tab。候选项来自后端（数据里出现过哪些分类），不是写死的清单 -->
    <a-tabs
      v-model:activeKey="activeCategory"
      class="category-tabs"
      @change="handleCategoryChange"
    >
      <a-tab-pane key="" tab="全部" />
      <a-tab-pane v-for="category in categoryOptions" :key="category" :tab="category" />
    </a-tabs>

    <!-- 标签：多选（AND 语义由后端保证：同时带这几个标签的才出来） -->
    <div v-if="tagOptions.length" class="tag-row">
      <span class="tag-row-label">标签：</span>
      <a-checkable-tag
        v-for="tag in tagOptions"
        :key="tag"
        :checked="selectedTags.includes(tag)"
        @change="toggleTag(tag)"
      >
        {{ tag }}
      </a-checkable-tag>
    </div>

    <!-- 颜色：单选色板（按色系筛选，再点一次取消） -->
    <div class="tag-row color-row">
      <span class="tag-row-label">颜色：</span>
      <button
        v-for="preset in PRESET_COLORS"
        :key="preset.value"
        class="color-swatch"
        :class="{ active: selectedColor === preset.value }"
        :title="preset.name"
        :style="{ backgroundColor: preset.value }"
        @click="toggleColor(preset.value)"
      />
    </div>

    <a-spin :spinning="loading || similarLoading">
      <a-empty
        v-if="!records.length && !loading && !similarLoading"
        class="empty"
        :description="similarMode ? '图库里没有找到相似的图片' : '没有找到符合条件的图片'"
      />

      <div v-else class="grid">
        <div
          v-for="image in records"
          :key="image.id"
          class="card"
          @click="goDetail(image.id)"
        >
          <div class="card-cover">
            <img
              :src="image.thumbnailUrl ?? image.url"
              :alt="image.name"
              loading="lazy"
              @error="onImgError(image, $event)"
            />
          </div>
          <div class="card-body">
            <div class="card-name" :title="image.name">{{ image.name || '未命名图片' }}</div>
            <div class="card-meta">
              <a-tag v-if="image.category" color="green">{{ image.category }}</a-tag>
              <span class="card-size">{{ sizeText(image.picSize) }}</span>
            </div>
          </div>
        </div>
      </div>
    </a-spin>

    <!-- 分页只在浏览态出现：以图搜图的结果是一次性的相似度排序，没有页码可翻 -->
    <div v-if="!similarMode" class="pager">
      <a-pagination
        v-model:current="pageNum"
        :total="total"
        :page-size="pageSize"
        :show-size-changer="false"
        :show-total="(t: number) => `共 ${t} 张`"
        @change="loadImages"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, type UploadProps } from 'ant-design-vue'
import { PictureOutlined } from '@ant-design/icons-vue'

import { listImageByPage, listImageOptions, searchSimilarImage, type ImageVO } from '@/api/image'
import { PRESET_CATEGORIES, PRESET_TAGS, mergeOptions } from '@/constants/filters'
import { PRESET_COLORS } from '@/constants/colors'

/**
 * 主页 = 已通过审核的图片墙（官方流程第 4 条「内容可见性」）。
 *
 * <p>三条筛选条件（搜索名称 / 分类 / 标签）**全部下推到数据库**：
 * 前端只筛当前页的话，「第 1 页显示 3 张、翻页又冒出 5 张」，
 * 用户看到的数量跟真实结果永远对不上。
 *
 * <p>分类与标签的候选项走后端 `/image/options`（来自已通过图上的真实值），
 * 不在前端写死清单 —— 写死的话用户自己填的分类在主页反而筛不出来。
 */
const router = useRouter()

const query = reactive({ name: '' })
const activeCategory = ref('')
const selectedTags = ref<string[]>([])
const selectedColor = ref('')
const options = ref<{ categories: string[]; tags: string[] }>({ categories: [], tags: [] })

/**
 * 筛选栏的候选项 = 预设常用值 ∪ 库里出现过的值。
 *
 * <p>只用库里的值，库空着时整条筛选栏就是空白；只用预设值，用户自己填的分类
 * 又筛不出来。取并集：一进来就有东西可点，填过的也一定在。详见 constants/filters.ts。
 */
const categoryOptions = computed(() => mergeOptions(PRESET_CATEGORIES, options.value.categories))
const tagOptions = computed(() => mergeOptions(PRESET_TAGS, options.value.tags))

const records = ref<ImageVO[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const loading = ref(false)

/** 是否处于「以图搜图结果」态：此时列表是相似度排序的结果，不分页、不受筛选影响 */
const similarMode = ref(false)
const similarLoading = ref(false)

async function loadImages() {
  loading.value = true
  try {
    const page = await listImageByPage({
      name: query.name.trim() || undefined,
      category: activeCategory.value || undefined,
      // 后端约定：数组以 JSON 字符串形式传（它按 JSON 解析后逐个匹配，AND 语义）
      tags: selectedTags.value.length ? JSON.stringify(selectedTags.value) : undefined,
      // 主色筛选：精确匹配（后端归一化大小写），空串不传
      picColor: selectedColor.value || undefined,
      // 主页钉死「只看已通过」：管理员在主页也该看到跟普通用户一样的图墙，
      // 审核工作台才是管理员看全部数据的地方
      reviewStatus: 1,
      pageNum: pageNum.value,
      pageSize: pageSize.value,
    })
    records.value = page.records ?? []
    total.value = Number(page.total ?? 0)
  } catch {
    // 拦截器已统一提示；这里保持列表为空即可
  } finally {
    loading.value = false
  }
}

async function loadOptions() {
  try {
    const data = await listImageOptions()
    options.value = {
      categories: data.categories ?? [],
      tags: data.tags ?? [],
    }
  } catch {
    // 筛选项拿不到不该挡住浏览：分类/标签栏空着，图照常看
  }
}

/** 换筛选条件必须回到第 1 页 —— 停在第 5 页筛完只剩 2 条，用户会以为"筛出来是空的" */
function resetAndLoad() {
  // 任何一次筛选 / 搜索都退出「以图搜图结果」态：否则用户点了分类，看到的是
  // 「筛选条件 + 相似度结果」这种谁也不是的状态
  similarMode.value = false
  pageNum.value = 1
  return loadImages()
}

function handleSearch() {
  resetAndLoad()
}

function handleCategoryChange() {
  resetAndLoad()
}

function toggleTag(tag: string) {
  const index = selectedTags.value.indexOf(tag)
  if (index >= 0) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
  }
  resetAndLoad()
}

/** 颜色单选：再点同一个色块取消筛选 */
function toggleColor(value: string) {
  selectedColor.value = selectedColor.value === value ? '' : value
  resetAndLoad()
}

/**
 * 以图搜图：选一张本地图 → 调接口 → 用返回结果替换图墙。
 *
 * ⚠️ `beforeUpload` 必须返回 false：返回 false 才会「只触发这个回调、不上传」——
 * antd 的 a-upload 默认会自己发一个 POST 到 action，不拦住就会多一个无用请求。
 */
const handleSimilarSearch: UploadProps['beforeUpload'] = async (file) => {
  similarLoading.value = true
  try {
    const list = await searchSimilarImage(file as File)
    similarMode.value = true
    pageNum.value = 1
    records.value = list
    total.value = list.length
    if (!list.length) {
      message.info('图库里没有找到相似的图片')
    }
  } catch {
    // 拦截器已统一提示
  } finally {
    similarLoading.value = false
  }
  return false
}

/** 退出以图搜图态，回到正常浏览（分页 + 筛选都恢复） */
function clearSimilarSearch() {
  similarMode.value = false
  resetAndLoad()
}

/**
 * 缩略图 404 时回退原图。
 *
 * <p>为什么必须兜这一道：`thumbnailUrl` 是**推导**出来的（`xxx_thumb.jpg`），
 * 而派生文件是 M4 上线后才开始生成的 —— 存量旧图、以及源图本身是 webp 的图
 * 都没有缩略图文件。没有这个兜底，卡片就是一排裂图（列表页早先就有这个兜底，
 * 主页是后写的，漏了）。
 *
 * <p>回退是幂等的：已经回退过（src 已经是原图）就不再折腾，避免死循环。
 */
function onImgError(image: ImageVO, event: Event) {
  const img = event.target as HTMLImageElement
  const fallback = image.url
  if (fallback && img.src !== fallback) {
    img.src = fallback
  }
}

function goDetail(id?: string) {
  if (!id) return
  // 带来源标记：详情页的「返回」据此回到主页，而不是一股脑回列表
  router.push({ path: `/image/detail/${id}`, query: { from: 'home' } })
}

/** 文件大小：超过 1MB 用 MB，否则 KB —— 与列表页展示口径保持一致 */
function sizeText(size?: number) {
  if (!size) return ''
  return size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`
}

onMounted(() => {
  loadImages()
  loadOptions()
})
</script>

<style scoped>
.home {
  max-width: 1400px;
  margin: 0 auto;
}

.search-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0 20px;
}

.search-input {
  max-width: 640px;
}

/* 以图搜图按钮紧贴搜索框（按钮本体由 a-upload 包着，间距给在外层） */
.similar-upload {
  margin-left: 8px;
}

/* 以图搜图结果提示条 */
.similar-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #f0f5ff;
  font-size: 13px;
  color: rgb(0 0 0 / 65%);
}

/* tab 栏去掉下划线感的边距，跟标签行贴紧一点 */
.category-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 8px;
}

.tag-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-bottom: 16px;
  font-size: 13px;
}

/* 色板：小圆色块，选中时描边 + 微放大 */
.color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--border, #d9d9d9);
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s, box-shadow 0.15s;
}

.color-swatch:hover {
  transform: scale(1.15);
}

.color-swatch.active {
  /* 描边用主色而不是跟色块同色（白色/浅色块看不出选中），阴影强化可点感 */
  box-shadow: 0 0 0 2px #1677ff;
  border-color: #fff;
  transform: scale(1.1);
}

.tag-row-label {
  color: rgb(0 0 0 / 45%);
}

/* 自适应网格：窗口越宽每行放越多，卡片宽度保持在一个舒适区间 */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
}

.card {
  overflow: hidden;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgb(0 0 0 / 12%);
}

/*
 * 封面统一 1:1 + object-fit: cover：
 * 网格对齐优先 —— 高度参差的话每行都会被最高的那张撑开，留一堆空洞；
 * 要按原比例看整张图，详情页才是那个场景（那边不裁切）。
 */
.card-cover {
  aspect-ratio: 1 / 1;
  background: #f5f5f5;
}

.card-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-body {
  padding: 10px 12px 12px;
}

.card-name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  color: rgb(0 0 0 / 88%);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  min-height: 22px;
}

.card-meta :deep(.ant-tag) {
  margin-inline-end: 0;
}

.card-size {
  font-size: 12px;
  color: rgb(0 0 0 / 45%);
}

.empty {
  padding: 60px 0;
}

.pager {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>
