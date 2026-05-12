import { createFileRoute } from '@tanstack/react-router'
import { AuthenticatedLayout, useAuthStore } from '@mochi/web'
import { t } from '@lingui/core/macro'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const store = useAuthStore.getState()
    if (!store.isInitialized) {
      await store.initialize()
    }
  },
  component: () => (
    <AuthenticatedLayout mobileTitle={<span className='text-base font-medium'>{t`Help`}</span>} />
  ),
})
