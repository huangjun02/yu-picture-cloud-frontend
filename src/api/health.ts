import { get } from './request'

/** GET /api/health → "ok" */
export function getHealth(): Promise<string> {
  return get<string>('/health')
}
