import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
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
  shellNavigateTop,
  toast,
} from '@mochi/web'
import { Bug, HelpCircle, Lightbulb, Loader2, Sparkles, X } from 'lucide-react'
import { helpApi, type Kind } from '@/api/help'

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
        bodyPlaceholder: t`What did you do, what did you expect, what happened instead?`,
        submit: t`Report bug`,
      }
    case 'feature':
      return {
        title: t`Suggest a feature`,
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
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!body.trim()) return
    if (needsTitle && !title.trim()) return
    setSubmitting(true)
    try {
      const result = await helpApi.contribute(kind, body.trim(), needsTitle ? title.trim() : undefined)
      shellNavigateTop(result.redirect)
    } catch (err) {
      toast.error(t`Couldn't submit`, {
        description: getErrorMessage(err, t`Please try again.`),
      })
      setSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
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
          <div className='flex flex-col gap-2'>
            {copy.bodyLabel && <Label htmlFor='help-body'>{copy.bodyLabel}</Label>}
            <Textarea
              id='help-body'
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={copy.bodyPlaceholder}
              rows={8}
              autoFocus={!needsTitle}
              disabled={submitting}
            />
          </div>
        </div>

        <ResponsiveDialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={submitting}>
            <X className='mr-2 h-4 w-4' />
            <Trans>Cancel</Trans>
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !body.trim() || (needsTitle && !title.trim())}
          >
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
  )
}
