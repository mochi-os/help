import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DocumentPage } from '@mochi/web'

function TermsPage() {
  const navigate = useNavigate()
  return (
    <DocumentPage
      name='terms'
      back={{ label: 'Help', onFallback: () => void navigate({ to: '/' }) }}
    />
  )
}

export const Route = createFileRoute('/_authenticated/document/terms')({
  component: TermsPage,
})
