import { useEffect, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { Bug, HelpCircle, Lightbulb, Sparkles } from 'lucide-react'
import {
  Card,
  Main,
  PageHeader,
  ServerDocumentsFooter,
  toast,
  getErrorMessage,
} from '@mochi/web'
import { helpApi, type Kind } from '@/api/help'
import { ContributeDialog } from '@/features/help/contribute-dialog'

interface CardConfig {
  kind: Kind
  icon: typeof Sparkles
  title: string
  description: string
}

function useCards(): CardConfig[] {
  const { t } = useLingui()
  return [
    {
      kind: 'intro',
      icon: Sparkles,
      title: t`Introduce yourself`,
      description: t`Say hello on the Mochi users mailing list and tell everyone a little about yourself.`,
    },
    {
      kind: 'question',
      icon: HelpCircle,
      title: t`Ask a question`,
      description: t`Stuck on something? Ask the community on the Mochi users mailing list.`,
    },
    {
      kind: 'bug',
      icon: Bug,
      title: t`Report a bug`,
      description: t`Spotted something broken? File a bug ticket on the Mochi development project.`,
    },
    {
      kind: 'feature',
      icon: Lightbulb,
      title: t`Suggest a new feature`,
      description: t`Got an idea? Open a feature request on the Mochi development project.`,
    },
  ]
}

export function Help() {
  const { t } = useLingui()
  const cards = useCards()
  const [openKind, setOpenKind] = useState<Kind | null>(null)

  useEffect(() => {
    helpApi.visit().catch(() => {
      // Best-effort — failure here just leaves the home highlight in place.
    })
  }, [])

  const handleCardClick = (kind: Kind) => {
    setOpenKind(kind)
    helpApi.prepare(kind).catch((err) => {
      toast.warning(t`Couldn't reach the destination yet`, {
        description: getErrorMessage(err, t`We'll try again when you submit.`),
      })
    })
  }

  return (
    <div className='flex h-full flex-col'>
      <PageHeader
        title={t`Help`}
        description={t`Welcome to Mochi. Here's how to get started.`}
      />
      <Main className='flex flex-1 flex-col'>
        <div className='mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 lg:px-8'>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            {cards.map((card) => (
              <button
                key={card.kind}
                type='button'
                onClick={() => handleCardClick(card.kind)}
                className='text-left'
              >
                <Card className='hover:border-primary/40 hover:bg-hover h-full p-6 transition-all duration-200'>
                  <div className='mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                    <card.icon className='h-5 w-5' />
                  </div>
                  <h3 className='mb-1 text-lg font-medium'>{card.title}</h3>
                  <p className='text-muted-foreground text-sm'>{card.description}</p>
                </Card>
              </button>
            ))}
          </div>
        </div>
        <ServerDocumentsFooter />
      </Main>

      {openKind && (
        <ContributeDialog
          kind={openKind}
          open={openKind !== null}
          onOpenChange={(open) => {
            if (!open) setOpenKind(null)
          }}
        />
      )}
    </div>
  )
}
