import endpoints from '@/api/endpoints'
import { requestHelpers } from '@mochi/web'

export type Kind = 'intro' | 'question' | 'bug' | 'feature'

export interface PrepareResponse {
  fingerprint?: string
  already_subscribed?: boolean
}

export interface ContributeResponse {
  redirect: string
}

const visit = async (): Promise<void> => {
  await requestHelpers.post(endpoints.visit, {})
}

const prepare = async (kind: Kind): Promise<PrepareResponse> => {
  const body = new URLSearchParams()
  body.append('kind', kind)
  return requestHelpers.post<PrepareResponse>(endpoints.prepare, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

const contribute = async (
  kind: Kind,
  body: string,
  title?: string,
): Promise<ContributeResponse> => {
  const params = new URLSearchParams()
  params.append('kind', kind)
  params.append('body', body)
  if (title) {
    params.append('title', title)
  }
  return requestHelpers.post<ContributeResponse>(endpoints.contribute, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

export const helpApi = {
  visit,
  prepare,
  contribute,
}
