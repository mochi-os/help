import { createFileRoute } from '@tanstack/react-router'
import { DocumentPage } from '@mochi/web'

export const Route = createFileRoute('/document/rules')({
  component: () => <DocumentPage name='rules' />,
})
