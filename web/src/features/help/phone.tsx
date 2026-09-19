// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { Main, PageHeader, usePageTitle } from '@mochi/web'
import { Smartphone } from 'lucide-react'

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className='mt-8 mb-3 text-xl font-semibold'>{title}</h2>
      {children}
    </section>
  )
}

const listClass = 'my-3 ms-6 space-y-1 [&_li]:leading-relaxed'

// How to sync the People app's address books to a phone, tablet or computer
// over CardDAV. The credential comes from People's own "Connect a device"
// dialog; this page only explains where to put it.
export function ConnectPhone() {
  const navigate = useNavigate()
  const { t } = useLingui()
  const title = t`Connect your phone`
  usePageTitle(title)

  return (
    <>
      <PageHeader
        title={title}
        icon={<Smartphone className='size-4 md:size-5' />}
        back={{ label: t`Help`, onFallback: () => void navigate({ to: '/' }) }}
      />
      <Main>
        <div className='mx-auto w-full max-w-3xl'>
          <p className='my-3 leading-relaxed'>
            <Trans>
              Mochi keeps your contacts in the People app. Any phone, tablet or
              computer that supports CardDAV can sync them.
            </Trans>
          </p>

          <Section title={<Trans>Create a credential for the device</Trans>}>
            <ol className={`${listClass} list-decimal`}>
              <li>
                <Trans>
                  In People, choose <strong>Connect a device</strong> in the
                  sidebar.
                </Trans>
              </li>
              <li>
                <Trans>
                  Name the device and create the credential. The dialog shows
                  the server, the address book URL, the username and a
                  password.
                </Trans>
              </li>
              <li>
                <Trans>
                  The password is shown only once, so copy it into the device
                  before closing the dialog. If it is lost, delete the device
                  under <strong>Manage devices</strong> and create a new one.
                </Trans>
              </li>
              <li>
                <Trans>
                  Create a separate credential for each device, so a lost device
                  can be revoked without affecting the others.
                </Trans>
              </li>
            </ol>
          </Section>

          <Section title={<Trans>Which details to enter</Trans>}>
            <ul className={`${listClass} list-disc`}>
              <li>
                <Trans>
                  Clients that find the server by name, such as iPhone, iPad,
                  Mac Contacts and DAVx5 on Android, need the server, the
                  username and the password.
                </Trans>
              </li>
              <li>
                <Trans>
                  Clients that ask for a URL, such as Thunderbird and most
                  others, take the address book URL instead of the server.
                </Trans>
              </li>
            </ul>
          </Section>

          <Section title={<Trans>iPhone and iPad</Trans>}>
            <ol className={`${listClass} list-decimal`}>
              <li>
                <Trans>
                  Open Settings › Contacts › Accounts › Add Account › Other ›
                  Add CardDAV Account.
                </Trans>
              </li>
              <li>
                <Trans>
                  Enter the server, your username and the password, and a
                  description such as Mochi.
                </Trans>
              </li>
              <li>
                <Trans>
                  On a Mac, open Contacts › Settings › Accounts, add an account,
                  choose Other Contacts Account, then CardDAV and Manual, and
                  enter the same details.
                </Trans>
              </li>
            </ol>
          </Section>

          <Section title={<Trans>Android</Trans>}>
            <ol className={`${listClass} list-decimal`}>
              <li>
                <Trans>Install DAVx5 from F-Droid or Google Play.</Trans>
              </li>
              <li>
                <Trans>
                  Choose Login with URL and user name, enter the address book
                  URL as the base URL, then the username and the password.
                </Trans>
              </li>
              <li>
                <Trans>
                  Enable the address books it finds. Your contacts then appear
                  in the phone's Contacts app.
                </Trans>
              </li>
            </ol>
          </Section>

          <Section title={<Trans>Thunderbird</Trans>}>
            <ol className={`${listClass} list-decimal`}>
              <li>
                <Trans>
                  Open Address Book › New Address Book › Add CardDAV Address
                  Book.
                </Trans>
              </li>
              <li>
                <Trans>
                  Enter the username, and the address book URL as the location.
                  Enter the password when asked.
                </Trans>
              </li>
              <li>
                <Trans>Choose the address books to add.</Trans>
              </li>
            </ol>
          </Section>

          <Section title={<Trans>What syncs</Trans>}>
            <ul className={`${listClass} list-disc`}>
              <li>
                <Trans>
                  Every address book listed in the People sidebar is offered to
                  the device.
                </Trans>
              </li>
              <li>
                <Trans>
                  Changes made on the device appear in People, and changes made
                  in People appear on the device.
                </Trans>
              </li>
              <li>
                <Trans>
                  Deleting a friend's card on the device removes the contact and
                  ends the friendship, exactly as deleting it in People does.
                </Trans>
              </li>
            </ul>
          </Section>

          <Section title={<Trans>Sharing with others</Trans>}>
            <p className='my-3 leading-relaxed'>
              <Trans>
                Address books are private to your account, so there is nothing
                to give to someone who is not a Mochi user.
              </Trans>
            </p>
          </Section>
        </div>
      </Main>
    </>
  )
}
