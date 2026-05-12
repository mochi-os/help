import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
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
  cn,
  getErrorMessage,
  shellNavigateTop,
  toast,
} from '@mochi/web'
import { Bug, HelpCircle, Lightbulb, Loader2, Sparkles, X } from 'lucide-react'
import { helpApi, type Kind, type Priority } from '@/api/help'

// Mirrors BODY_MAX / BODY_MIN in help.star.
const BODY_MAX = 50000
const BODY_MIN = 20

const PRIORITY_STYLES: Record<Priority, { base: string; active: string }> = {
  low: {
    base: 'border-border text-muted-foreground hover:border-muted-foreground/50',
    active: 'border-slate-400 bg-slate-400/10 text-slate-300',
  },
  medium: {
    base: 'border-border text-muted-foreground hover:border-amber-500/50',
    active: 'border-amber-500 bg-amber-500/10 text-amber-400',
  },
  high: {
    base: 'border-border text-muted-foreground hover:border-red-500/50',
    active: 'border-red-500 bg-red-500/10 text-red-400',
  },
}

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

interface CopyBundle {
  title: string
  description?: string
  bodyLabel?: string
  bodyPlaceholder: string
  titleLabel?: string
  titlePlaceholder?: string
  submit: string
}

function useCopy(kind: Kind): CopyBundle {
  const { t } = useLingui()
  switch (kind) {
    case 'intro':
      return {
        title: t`Introduce yourself`,
        bodyPlaceholder: t`Hi, I'm…`,
        submit: t`Post introduction`,
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
  const copy = useCopy(kind)
  const needsTitle = NEEDS_TITLE[kind]
  const KindIcon = KIND_ICONS[kind]
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  const trimmedBody = body.trim()
  const trimmedTitle = title.trim()
  const bodyTooShort = trimmedBody.length < BODY_MIN
  const bodyTooLong = body.length > BODY_MAX
  const isDirty = title !== '' || body !== ''
  const canSubmit =
    !submitting &&
    !bodyTooShort &&
    !bodyTooLong &&
    (!needsTitle || trimmedTitle.length > 0)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const result = await helpApi.contribute(
        kind,
        trimmedBody,
        needsTitle ? trimmedTitle : undefined,
        kind === 'bug' ? priority : undefined,
      )
      toast.success(t`Posted`, {
        description: t`Taking you there now.`,
      })
      shellNavigateTop(result.redirect)
    } catch (err) {
      toast.error(t`Couldn't submit`, {
        description: getErrorMessage(err, t`Please try again.`),
      })
      setSubmitting(false)
    }
  }

  const requestClose = (next: boolean) => {
    if (next) {
      onOpenChange(true)
      return
    }
    if (submitting) return
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
            {copy.description && (
              <ResponsiveDialogDescription>{copy.description}</ResponsiveDialogDescription>
            )}
          </ResponsiveDialogHeader>

          <div className='flex flex-col gap-4 px-4 sm:px-0'>
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
            {kind === 'bug' && (
              <div className='flex flex-col gap-2'>
                <Label><Trans>Priority</Trans></Label>
                <div className='flex gap-2'>
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      type='button'
                      disabled={submitting}
                      onClick={() => setPriority(p)}
                      className={cn(
                        'flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
                        priority === p
                          ? PRIORITY_STYLES[p].active
                          : PRIORITY_STYLES[p].base,
                      )}
                    >
                      {p === 'low' && <Trans>Low</Trans>}
                      {p === 'medium' && <Trans>Medium</Trans>}
                      {p === 'high' && <Trans>High</Trans>}
                    </button>
                  ))}
                </div>
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
                  {body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <ResponsiveDialogFooter>
            <Button variant='outline' onClick={() => requestClose(false)} disabled={submitting}>
              <X className='mr-2 h-4 w-4' />
              <Trans>Cancel</Trans>
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  <Trans>Posting…</Trans>
                </>
              ) : (
                <>
                  <KindIcon className='mr-2 h-4 w-4' />
                  {copy.submit}
                </>
              )}
            </Button>
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
