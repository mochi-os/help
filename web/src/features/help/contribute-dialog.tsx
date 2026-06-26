// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useEffect, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ConfirmDialog,
  Input,
  Label,
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  Textarea,
  getErrorMessage,
  shellNavigateExternal,
  toast,
  toastAction,
  useFormat,
} from '@mochi/web'
import { ArrowRight, Bug, CheckCircle, CircleAlert, HelpCircle, Lightbulb, Loader2, Sparkles, X } from 'lucide-react'
import { helpApi, type Kind } from '@/api/help'

// Mirrors BODY_MAX / BODY_MIN in help.star.
const BODY_MAX = 50000
const BODY_MIN = 20

const KIND_ICONS: Record<Kind, typeof Sparkles> = {
  intro: Sparkles,
  question: HelpCircle,
  bug: Bug,
  feature: Lightbulb,
}

const NEEDS_TITLE: Record<Kind, boolean> = {
  intro: false,
  question: true,
  bug: true,
  feature: true,
}

// Forum posts (intro/question) go to moderation; show in-app success instead of blind redirect.
const IS_FORUM_KIND: Record<Kind, boolean> = {
  intro: true,
  question: true,
  bug: false,
  feature: false,
}

interface CopyBundle {
  title: string
  description?: string
  bodyLabel?: string
  bodyPlaceholder: string
  titleLabel?: string
  titlePlaceholder?: string
  submit: string
  successMessage: string
}

type DestinationStatus =
  | { status: 'checking' }
  | { status: 'ready' }
  | { status: 'unavailable'; message: string }

function useCopy(kind: Kind): CopyBundle {
  const { t } = useLingui()
  switch (kind) {
    case 'intro':
      return {
        title: t`Introduce yourself`,
        bodyPlaceholder: t`Hi, I'm…`,
        submit: t`Post introduction`,
        successMessage: t`Your introduction has been submitted and will appear after moderation.`,
      }
    case 'question':
      return {
        title: t`Ask a question`,
        description: t`Ask the community on the Mochi users mailing list. Be specific about what you've tried so far.`,
        titleLabel: t`Question`,
        titlePlaceholder: t`What you want to ask, in one line`,
        bodyLabel: t`Details`,
        bodyPlaceholder: t`What have you tried, what did you expect, where are you stuck?`,
        submit: t`Post question`,
        successMessage: t`Your question has been submitted and will appear after moderation.`,
      }
    case 'bug':
      return {
        title: t`Report a bug`,
        description: t`Describe what went wrong. The Mochi development team will see it on the Mochi development project.`,
        titleLabel: t`Summary`,
        titlePlaceholder: t`Brief summary of the problem`,
        bodyLabel: t`What happened`,
        bodyPlaceholder: t`Steps to reproduce, what you expected, and what actually happened. Include your browser and device if relevant.`,
        submit: t`Report bug`,
        successMessage: t`Bug report submitted.`,
      }
    case 'feature':
      return {
        title: t`Suggest a new feature`,
        description: t`Tell the Mochi development team what you'd like Mochi to do.`,
        titleLabel: t`Summary`,
        titlePlaceholder: t`Short title for your idea`,
        bodyLabel: t`Details`,
        bodyPlaceholder: t`What would it do, who is it for, why does it matter?`,
        submit: t`Suggest feature`,
        successMessage: t`Feature request submitted.`,
      }
  }
}

export function ContributeDialog({
  kind,
  open,
  onOpenChange,
}: {
  kind: Kind
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useLingui()
  const { formatNumber } = useFormat()
  const copy = useCopy(kind)
  const needsTitle = NEEDS_TITLE[kind]
  const isForumKind = IS_FORUM_KIND[kind]
  const KindIcon = KIND_ICONS[kind]
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [redirectUrl, setRedirectUrl] = useState('')
  const [prepareAttempt, setPrepareAttempt] = useState(0)
  const [destinationStatus, setDestinationStatus] = useState<DestinationStatus>({
    status: 'checking',
  })

  const trimmedBody = body.trim()
  const trimmedTitle = title.trim()
  const bodyTooShort = trimmedBody.length < BODY_MIN
  const bodyTooLong = body.length > BODY_MAX
  const isDirty = title !== '' || body !== ''
  const destinationReady = destinationStatus.status === 'ready'
  const canSubmit =
    !submitting &&
    !bodyTooShort &&
    !bodyTooLong &&
    destinationReady &&
    (!needsTitle || trimmedTitle.length > 0)

  useEffect(() => {
    if (!open || submitted) return

    let cancelled = false

    const prepareDestination = async () => {
      setDestinationStatus({ status: 'checking' })
      try {
        const result = await helpApi.prepare(kind)
        if (cancelled) return
        if (result.available === false) {
          setDestinationStatus({
            status: 'unavailable',
            message: result.message || t`Please try again.`,
          })
          return
        }
        setDestinationStatus({ status: 'ready' })
      } catch (err) {
        if (cancelled) return
        setDestinationStatus({
          status: 'unavailable',
          message: getErrorMessage(err, t`Please try again.`),
        })
      }
    }

    void prepareDestination()

    return () => {
      cancelled = true
    }
  }, [kind, open, prepareAttempt, submitted, t])

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const result = await toastAction(
        helpApi.contribute(
          kind,
          trimmedBody,
          needsTitle ? trimmedTitle : undefined
        ),
        {
          loading: t`Submitting...`,
          success: false,
          error: (err) => getErrorMessage(err, t`Couldn't submit`),
        }
      )
      if (isForumKind) {
        // Forum posts go to moderation — show in-app success so the user isn't
        // redirected to a forum page where their post isn't visible yet.
        setRedirectUrl(result.redirect)
        setSubmitted(true)
      } else {
        // Project tickets (bug/feature) are immediately visible — navigate there.
        toast.success(t`Posted`, {
          description: t`Taking you there now.`,
        })
        shellNavigateExternal(result.redirect)
      }
    } catch {
      // toastAction already showed error
      setSubmitting(false)
    }
  }

  const requestClose = (next: boolean) => {
    if (next) {
      onOpenChange(true)
      return
    }
    if (submitting) return
    if (submitted) {
      onOpenChange(false)
      return
    }
    if (isDirty) {
      setDiscardOpen(true)
      return
    }
    onOpenChange(false)
  }

  const remaining = BODY_MAX - body.length
  const counterTone = bodyTooLong
    ? 'text-destructive'
    : remaining < 500
      ? 'text-amber-500'
      : 'text-muted-foreground'

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={requestClose}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              <span className='inline-flex items-center gap-2'>
                <KindIcon className='h-5 w-5' />
                {copy.title}
              </span>
            </ResponsiveDialogTitle>
            {copy.description && !submitted && (
              <ResponsiveDialogDescription>{copy.description}</ResponsiveDialogDescription>
            )}
          </ResponsiveDialogHeader>

          {submitted ? (
            /* In-app success state for forum posts */
            <div className='flex flex-col items-center gap-4 px-4 py-6 text-center sm:px-0'>
              <CheckCircle className='h-12 w-12 text-green-500' />
              <p className='text-base font-medium'><Trans>Submitted successfully</Trans></p>
              <p className='text-muted-foreground text-sm'>{copy.successMessage}</p>
            </div>
          ) : (
            <div className='flex flex-col gap-4 px-4 sm:px-0'>
              {destinationStatus.status === 'checking' && (
                <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  <Trans>Loading…</Trans>
                </div>
              )}
              {destinationStatus.status === 'unavailable' && (
                <Alert
                  variant='destructive'
                  className='border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-100'
                >
                  <CircleAlert className='text-amber-700 dark:text-amber-300' />
                  <AlertTitle><Trans>Couldn't reach the destination yet</Trans></AlertTitle>
                  <AlertDescription className='text-amber-800 dark:text-amber-200'>
                    <p>{destinationStatus.message}</p>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => {
                        setDestinationStatus({ status: 'checking' })
                        setPrepareAttempt((attempt) => attempt + 1)
                      }}
                    >
                      <Trans>Try again</Trans>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {needsTitle && (
                <div className='flex flex-col gap-2'>
                  <Label htmlFor='help-title'>{copy.titleLabel}</Label>
                  <Input
                    id='help-title'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={copy.titlePlaceholder}
                    autoFocus
                    disabled={submitting}
                  />
                </div>
              )}
              <div className='flex flex-col gap-2'>
                {copy.bodyLabel && <Label htmlFor='help-body'>{copy.bodyLabel}</Label>}
                <Textarea
                  id='help-body'
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={copy.bodyPlaceholder}
                  rows={10}
                  autoFocus={!needsTitle}
                  disabled={submitting}
                />
                <div className='flex items-center justify-between text-xs'>
                  <span className='text-muted-foreground'>
                    {bodyTooShort && body.length > 0 && (
                      <Trans>Add a bit more detail.</Trans>
                    )}
                  </span>
                  <span className={counterTone}>
                    {formatNumber(body.length)} / {formatNumber(BODY_MAX)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <ResponsiveDialogFooter>
            {submitted ? (
              <>
                <Button variant='outline' onClick={() => onOpenChange(false)}>
                  <Trans>Close</Trans>
                </Button>
                {redirectUrl && (
                  <Button onClick={() => shellNavigateExternal(redirectUrl)}>
                    <ArrowRight className='size-4' />
                    <Trans>Go to forum</Trans>
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant='outline' onClick={() => requestClose(false)} disabled={submitting}>
                  <X className='me-2 h-4 w-4' />
                  <Trans>Cancel</Trans>
                </Button>
                <Button onClick={handleSubmit} disabled={!canSubmit}>
                  {submitting ? (
                    <>
                      <Loader2 className='me-2 h-4 w-4 animate-spin' />
                      <Trans>Posting…</Trans>
                    </>
                  ) : (
                    <>
                      <KindIcon className='me-2 h-4 w-4' />
                      {copy.submit}
                    </>
                  )}
                </Button>
              </>
            )}
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t`Discard draft?`}
        desc={t`Your text will be lost.`}
        cancelBtnText={t`Keep editing`}
        confirmText={t`Discard`}
        destructive
        handleConfirm={() => {
          setDiscardOpen(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}
