/** 后端统一返回结构（对应 Java 的 BaseResponse<T>） */
export interface BaseResponse<T = unknown> {
  code: number
  data: T
  message: string
}
