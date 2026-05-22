import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DocumentPage } from '@mochi/web'

function PrivacyPage() {
  const navigate = useNavigate()
  return (
    <DocumentPage
      name='privacy'
      back={{ label: 'Help', onFallback: () => void navigate({ to: '/' }) }}
    />
  )
}

export const Route = createFileRoute('/_authenticated/document/privacy')({
  component: PrivacyPage,
})
