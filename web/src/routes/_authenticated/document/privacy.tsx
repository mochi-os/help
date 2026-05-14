import { createFileRoute } from '@tanstack/react-router'
import { DocumentPage } from '@mochi/web'

export const Route = createFileRoute('/_authenticated/document/privacy')({
  component: () => <DocumentPage name='privacy' />,
})
