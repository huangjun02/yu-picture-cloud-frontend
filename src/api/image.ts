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

/** 分页查询图片：普通用户只能看到自己的，管理员可查全部（后端强制，不靠前端传参） */
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
