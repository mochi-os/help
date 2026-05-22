import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DocumentPage } from '@mochi/web'

function RulesPage() {
  const navigate = useNavigate()
  return (
    <DocumentPage
      name='rules'
      back={{ label: 'Help', onFallback: () => void navigate({ to: '/' }) }}
    />
  )
}

export const Route = createFileRoute('/_authenticated/document/rules')({
  component: RulesPage,
})
