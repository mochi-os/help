// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

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
