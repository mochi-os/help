import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { DocumentPage } from '@mochi/web'

function TermsPage() {
  const navigate = useNavigate()
  const { t } = useLingui()
  return (
    <DocumentPage
      name='terms'
      back={{ label: t`Help`, onFallback: () => void navigate({ to: '/' }) }}
    />
  )
}

export const Route = createFileRoute('/_authenticated/document/terms')({
  component: TermsPage,
})
