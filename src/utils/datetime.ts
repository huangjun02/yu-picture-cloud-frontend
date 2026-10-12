/**
 * 时间格式化：把后端返回的 ISO 字符串按**本机时区**渲染。
 *
 * <p><b>为什么不能直接切字符串</b>：后端返回的是带时区的标准 ISO
 * （形如 `2026-10-12T09:40:48.000+00:00`，Java 的 Date 按 UTC 序列化）。
 * 用 `value.slice(0, 19)` 截出来的 09:40 **是 UTC 的墙上时间**，
 * 在东八区就整整差 8 小时 —— 用户看到"刚上传的图显示早上九点"，
 * 而数据库里的时刻其实是对的（同一时刻的 UTC 表示）。
 *
 * <p>正解是交给 Date 解析（它能识别结尾的时区偏移），再取本地时间字段。
 * 后端改时区、换机器都不需要动这里。
 */
export function formatDateTime(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  // 解析失败（拿到非 ISO 的脏数据）时退化成"把 T 换空格"，别把整列变成 Invalid Date
  if (Number.isNaN(date.getTime())) {
    return String(value).replace('T', ' ').slice(0, 19)
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}
