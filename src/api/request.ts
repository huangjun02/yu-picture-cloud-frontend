import axios, { type AxiosInstance } from 'axios'
import { message } from 'ant-design-vue'

import type { BaseResponse } from '@/types/api'

const request: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15000,
  // 带上 satoken cookie（后端用 Sa-Token 存登录态）
  withCredentials: true,
})

// 响应拦截器：把后端的 { code, data, message } 拆开
// - code === 0  → 直接把 data 交给页面（页面里不用再写 res.data.data）
// - code !== 0  → 弹错误提示并 reject
request.interceptors.response.use(
  (response) => {
    const res = response.data as BaseResponse
    if (res.code !== 0) {
      message.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || 'Error'))
    }
    return res.data as never
  },
  (error) => {
    message.error('网络异常：' + (error?.message ?? '未知错误'))
    return Promise.reject(error)
  },
)

export function get<T>(url: string, params?: object): Promise<T> {
  return request.get(url, { params }) as unknown as Promise<T>
}

export function post<T>(url: string, data?: object): Promise<T> {
  return request.post(url, data) as unknown as Promise<T>
}

export default request
