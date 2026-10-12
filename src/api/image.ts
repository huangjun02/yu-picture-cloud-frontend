import { message } from 'ant-design-vue'

import { post } from './request'
import type { components } from '@/api/generated/schema'

/**
 * 图片接口。
 *
 * 类型全部取自 `src/api/generated/schema.d.ts`（由 `npm run gen:api` 从后端
 * /v3/api-docs 生成）—— 后端改了字段，这里 type-check 立刻报错。
 *
 * ⚠️ 不要再手写一份 interface：两份定义会各自漂移，最后谁也说不清哪个对。
 * 这正是引入代码生成的意义所在。
 */
export type ImageVO = components['schemas']['ImageVO']
export type PageImageVO = components['schemas']['PageImageVO']
export type ImageQueryRequest = components['schemas']['ImageQueryRequest']
export type ImageUpdateRequest = components['schemas']['ImageUpdateRequest']
export type ImageReviewRequest = components['schemas']['ImageReviewRequest']
export type ImageOptionsVO = components['schemas']['ImageOptionsVO']
export type ImageCrawlRequest = components['schemas']['ImageCrawlRequest']
export type ImageCrawlResultVO = components['schemas']['ImageCrawlResultVO']

/**
 * 上传图片：multipart/form-data。
 * 不用手动设 Content-Type —— axios 遇到 FormData 会自动带上
 * `multipart/form-data; boundary=...`，手写反而会丢掉 boundary 导致后端解析失败。
 */
export function uploadImage(file: File, name?: string): Promise<ImageVO> {
  const formData = new FormData()
  formData.append('file', file)
  if (name) {
    formData.append('name', name)
  }
  return post<ImageVO>('/image/upload', formData)
}

/**
 * 分页查询图片（列表 / 主页共用）。
 *
 * <p>可见性由后端按「传不传自己的 userId」区分，前端只需选对用法：
 *  - **主页浏览**：不传 userId（后端自动只给已通过的图）—— 传 userId 会变成查那个人的全部
 *  - **我的图片**：显式传自己的 userId（普通用户），否则看不见自己的待审核 / 被拒图
 *  - **管理员图库管理**：不传 userId → 全部数据，配合 reviewStatus 筛待办
 */
export function listImageByPage(params: ImageQueryRequest): Promise<PageImageVO> {
  return post<PageImageVO>('/image/list/page', params)
}

/**
 * 查看图片详情。
 *
 * ⚠️ 是 POST + URL 参数，不是 GET。后端 ImageController 的约定是
 * 「单字段走 URL 参数、多字段走请求体」，但**方法一律是 POST** ——
 * 照直觉写成 GET + params 会直接 50000（@RequestParam 收不到 id）。
 */
export function getImage(id: string): Promise<ImageVO> {
  return post<ImageVO>(`/image/get?id=${encodeURIComponent(id)}`)
}

/** 编辑图片：只有名称 / 简介 / 分类 / 标签能改（多字段 → 请求体） */
export function updateImage(params: ImageUpdateRequest): Promise<boolean> {
  return post<boolean>('/image/update', params)
}

/**
 * 下载图片文件。
 *
 * ⚠️ 这个接口是「统一响应」的唯一例外：后端直接回二进制（不走 BaseResponse JSON 包装），
 * 所以这里必须用原生 fetch 而不是 axios 实例 —— axios 的响应拦截器会尝试解析 JSON，
 * 二进制体会被搅坏；而且 blob 响应也绕过拦截器的 code 检查逻辑。
 *
 * fetch 默认带同源 cookie（credentials: 'same-origin' 是默认值），登录态没问题。
 */
export async function downloadImage(id: string, fallbackName: string): Promise<void> {
  const resp = await fetch(`/api/image/download?id=${encodeURIComponent(id)}`, {
    credentials: 'same-origin',
  })
  if (!resp.ok) {
    // 二进制接口的错误也是二进制路径 —— 拿不到 JSON 错误信息，给通用提示
    message.error('下载失败，请稍后重试')
    return
  }
  const blob = await resp.blob()
  // 文件名优先取响应头（后端已按 RFC 5987 编码中文），拿不到再用图片名称兜底
  const disposition = resp.headers.get('Content-Disposition') ?? ''
  const starMatch = disposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i)
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i)
  let fileName = fallbackName
  if (starMatch && starMatch[1]) {
    fileName = decodeURIComponent(starMatch[1])
  } else if (plainMatch && plainMatch[1]) {
    fileName = plainMatch[1]
  }
  // 触发保存：a[download] 的 download 属性对同源 blob URL 有效（跨域才失效，这里正是同源）
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 删除图片：逻辑删除数据库记录 + 同步清理 COS 上的文件。
 *
 * ⚠️ 参数走 URL 而不是请求体（同 getImage）。写成 JSON body 的话后端
 * @RequestParam 收不到 id，报出来的是「系统内部异常 50000」——
 * 完全看不出是参数位置错了，这个坑得靠端到端跑才暴露。
 */
export function deleteImage(id: string): Promise<boolean> {
  return post<boolean>(`/image/delete?id=${encodeURIComponent(id)}`)
}

/**
 * URL 传图：服务器替用户拉远端图片（本人）。
 *
 * ⚠️ 两个坑都在这条 URL 上：
 * ① fileUrl 走 URL 参数（后端 @RequestParam），不是请求体；
 * ② 图片地址本身常带 `?token=xxx&expire=...`，必须 encodeURIComponent ——
 *    不编码的话 `&` 会被当成外层查询串的字段分隔符，后端只收到半截地址。
 */
export function uploadImageByUrl(fileUrl: string, name?: string): Promise<ImageVO> {
  const params = new URLSearchParams({ fileUrl })
  if (name) {
    params.set('name', name)
  }
  return post<ImageVO>(`/image/upload/url?${params.toString()}`)
}

/**
 * 主页筛选项：分类与标签候选。
 *
 * <p>不写死一份分类清单 —— 分类/标签来自用户上传时填的内容，写死会导致
 * 「用户填的分类在主页筛不出来」。只返回已通过审核图上的值（待审核图不泄露）。
 */
export function listImageOptions(): Promise<ImageOptionsVO> {
  return post<ImageOptionsVO>('/image/options')
}

/**
 * 审核图片（管理员）。
 *
 * 结论 1-通过 / 2-拒绝；**拒绝必须带 reviewMessage**（后端强制，没理由的拒绝会被 40000 打回）。
 *
 * <p>`resetReviewParams` 是重复审核时的开关（不传等价于 true）：
 *   - true  重置全部审核参数（审核人 / 时间 / 意见都以本次为准）
 *   - false 只改状态，保留上一次的审核信息当历史参考；此时不要求填原因（填了也不落库）
 */
export function reviewImage(params: ImageReviewRequest): Promise<boolean> {
  return post<boolean>('/image/review', params)
}

/**
 * 批量抓图（管理员）：按关键词从开放许可图库（Openverse）检索并入库。
 *
 * 为什么单独放宽超时：一次最多 20 张，每张都要「下载 → 压缩 → 生成缩略图 → 传 COS」，
 * 十几二十秒是正常的。用默认 15s 会出现「前端报超时、后端其实成功」的假失败——
 * 用户看到失败又点一次，结果抓了两遍。
 */
export function crawlImages(data: ImageCrawlRequest): Promise<ImageCrawlResultVO> {
  return post('/image/crawl', data, { timeout: 180000 })
}

/**
 * 生成分享短链（本人或管理员）。返回分享码。
 *
 * ⚠️ 是 POST + URL 参数（同 getImage / deleteImage）：@RequestParam 的参数塞进 body
 * 会因缺参被后端包成 50000「系统内部异常」，看着像后端 bug。
 *
 * 完整短链由前端拼：`${window.location.origin}/share/${code}` —— 链接格式属于前端路由知识。
 */
export function shareImage(id: string): Promise<string> {
  return post<string>(`/image/share?id=${encodeURIComponent(id)}`)
}

/**
 * 按分享码查看图片（**免登录** —— 后端已把 /image/share/view 加进白名单）。
 * 已通过的图游客可看；未通过/不存在/已删除 → 后端 40400，拦截器会弹提示，页面走空态。
 */
export function getSharedImage(shareCode: string): Promise<ImageVO> {
  return post<ImageVO>(`/image/share/view?shareCode=${encodeURIComponent(shareCode)}`)
}
