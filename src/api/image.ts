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
 * 删除图片：逻辑删除数据库记录 + 同步清理 COS 上的文件。
 *
 * ⚠️ 参数走 URL 而不是请求体（同 getImage）。写成 JSON body 的话后端
 * @RequestParam 收不到 id，报出来的是「系统内部异常 50000」——
 * 完全看不出是参数位置错了，这个坑得靠端到端跑才暴露。
 */
export function deleteImage(id: string): Promise<boolean> {
  return post<boolean>(`/image/delete?id=${encodeURIComponent(id)}`)
}
