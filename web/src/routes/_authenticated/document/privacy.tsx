import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { DocumentPage } from '@mochi/web'

function PrivacyPage() {
  const navigate = useNavigate()
  const { t } = useLingui()
  return (
    <DocumentPage
      name='privacy'
      back={{ label: t`Help`, onFallback: () => void navigate({ to: '/' }) }}
    />
  )
}

export const Route = createFileRoute('/_authenticated/document/privacy')({
  component: PrivacyPage,
})
