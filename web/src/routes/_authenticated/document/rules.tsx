import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { DocumentPage } from '@mochi/web'

function RulesPage() {
  const navigate = useNavigate()
  const { t } = useLingui()
  return (
    <DocumentPage
      name='rules'
      back={{ label: t`Help`, onFallback: () => void navigate({ to: '/' }) }}
    />
  )
}

export const Route = createFileRoute('/_authenticated/document/rules')({
  component: RulesPage,
})
