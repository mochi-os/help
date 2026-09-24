// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useNavigate } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Main, PageHeader } from '@mochi/web'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='space-y-2'>
      <h2 className='text-lg font-medium'>{title}</h2>
      {children}
    </section>
  )
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className='list-decimal space-y-1 pl-6'>{children}</ol>
}

/**
 * How to put contacts and calendars on a phone, tablet or computer: the
 * Connect device flow in People or Calendars hands out one password for the
 * device, and each client takes it in its own way.
 */
export function Devices() {
  const { t } = useLingui()
  const navigate = useNavigate()
  return (
    <div className='flex h-full flex-col'>
      <PageHeader
        title={t`Connect your phone`}
        actions={
          <Button variant='outline' size='sm' onClick={() => void navigate({ to: '/' })}>
            <ArrowLeft className='size-4' />
            {t`Help`}
          </Button>
        }
      />
      <Main className='flex flex-1 flex-col'>
        <div className='mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-6 sm:px-6 lg:px-8'>
          <p>
            <Trans>
              Your contacts and calendars sync to your phone, tablet and computer over CardDAV and CalDAV, which every major contacts and calendar app speaks.
            </Trans>
          </p>
          <Section title={t`Get a password for the device`}>
            <Steps>
              <li>
                <Trans>Open Calendars or People and choose Connect device.</Trans>
              </li>
              <li>
                <Trans>Name the device, for example your phone's name, and create its password.</Trans>
              </li>
              <li>
                <Trans>Copy the server address, the username and the password into the device. The password is shown once.</Trans>
              </li>
            </Steps>
            <p>
              <Trans>One password serves both contacts and calendars. Each device gets its own, and removing a device under Connect device stops its password at once.</Trans>
            </p>
          </Section>
          <Section title={t`Android`}>
            <p>
              <Trans>The Mochi app shows your contacts and calendars itself. To put them into the phone's own Contacts and Calendar apps, use DAVx5.</Trans>
            </p>
            <Steps>
              <li>
                <Trans>Install DAVx5 and add an account with "Login with URL and user name".</Trans>
              </li>
              <li>
                <Trans>Enter the server address, the username and the password.</Trans>
              </li>
              <li>
                <Trans>DAVx5 finds both your address books and your calendars. Turn on the ones to sync.</Trans>
              </li>
            </Steps>
          </Section>
          <Section title={t`iPhone and iPad`}>
            <Steps>
              <li>
                <Trans>For contacts: Settings, Contacts, Accounts, Add Account, Other, Add CardDAV Account.</Trans>
              </li>
              <li>
                <Trans>For calendars: Settings, Calendar, Accounts, Add Account, Other, Add CalDAV Account.</Trans>
              </li>
              <li>
                <Trans>Enter the server address, the username and the password in each.</Trans>
              </li>
            </Steps>
          </Section>
          <Section title={t`Mac`}>
            <Steps>
              <li>
                <Trans>System Settings, Internet Accounts, Add Other Account, then CardDAV Account for contacts or CalDAV Account for calendars.</Trans>
              </li>
              <li>
                <Trans>Choose the account type Manual and enter the username, the password and the server address.</Trans>
              </li>
            </Steps>
          </Section>
          <Section title={t`Thunderbird`}>
            <Steps>
              <li>
                <Trans>For contacts: Address Book, New Address Book, Add CardDAV Address Book, with the username and the server address.</Trans>
              </li>
              <li>
                <Trans>For calendars: Calendar, New Calendar, On the Network, with the username and the server address.</Trans>
              </li>
              <li>
                <Trans>Enter the password when asked, and choose the address books and calendars to add.</Trans>
              </li>
            </Steps>
          </Section>
        </div>
      </Main>
    </div>
  )
}
