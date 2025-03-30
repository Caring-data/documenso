import React from 'react';

import { redirect } from 'next/navigation';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { APP_I18N_OPTIONS, ZSupportedLanguageCodeSchema } from '@documenso/lib/constants/i18n';
import { RECIPIENT_ROLE_SIGNING_REASONS } from '@documenso/lib/constants/recipient-roles';
import { getEntireDocument } from '@documenso/lib/server-only/admin/get-entire-document';
import { decryptSecondaryData } from '@documenso/lib/server-only/crypto/decrypt';
import { getDocumentCertificateAuditLogs } from '@documenso/lib/server-only/document/get-document-certificate-audit-logs';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { dynamicActivate } from '@documenso/lib/utils/i18n';
import { FieldType } from '@documenso/prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';

import '../../../certificate-print.css';

type SigningCertificateProps = {
  searchParams: {
    d: string;
  };
};

const FRIENDLY_SIGNING_REASONS = {
  ['__OWNER__']: msg`I am the owner of this document`,
  ...RECIPIENT_ROLE_SIGNING_REASONS,
};

/**
 * DO NOT USE TRANS. YOU MUST USE _ FOR THIS FILE AND ALL CHILDREN COMPONENTS.
 *
 * Cannot use dynamicActivate by itself to translate this specific page and all
 * children components because `not-found.tsx` page runs and overrides the i18n.
 */
export default async function SigningCertificate({ searchParams }: SigningCertificateProps) {
  const { i18n } = await setupI18nSSR();
  const assetBaseUrl = WEBAPP_BASE_URL;

  const { _ } = useLingui();

  const { d } = searchParams;

  if (typeof d !== 'string' || !d) {
    return redirect('/');
  }

  const rawDocumentId = decryptSecondaryData(d);

  if (!rawDocumentId || isNaN(Number(rawDocumentId))) {
    return redirect('/');
  }

  const documentId = Number(rawDocumentId);

  const document = await getEntireDocument({
    id: documentId,
  }).catch(() => null);

  if (!document) {
    return redirect('/');
  }

  const documentLanguage = ZSupportedLanguageCodeSchema.parse(document.documentMeta?.language);

  await dynamicActivate(i18n, documentLanguage);

  const auditLogs = await getDocumentCertificateAuditLogs({
    id: documentId,
  });

  const getAuthenticationLevel = (recipientId: number) => {
    const recipient = document.recipients.find((recipient) => recipient.id === recipientId);

    if (!recipient) {
      return 'Unknown';
    }

    const extractedAuthMethods = extractDocumentAuthMethods({
      documentAuth: document.authOptions,
      recipientAuth: recipient.authOptions,
    });

    let authLevel = match(extractedAuthMethods.derivedRecipientActionAuth)
      .with('ACCOUNT', () => _(msg`Account Re-Authentication`))
      .with('TWO_FACTOR_AUTH', () => _(msg`Two-Factor Re-Authentication`))
      .with('PASSKEY', () => _(msg`Passkey Re-Authentication`))
      .with('EXPLICIT_NONE', () => _(msg`Email`))
      .with(null, () => null)
      .exhaustive();

    if (!authLevel) {
      authLevel = match(extractedAuthMethods.derivedRecipientAccessAuth)
        .with('ACCOUNT', () => _(msg`Account Authentication`))
        .with(null, () => _(msg`Email`))
        .exhaustive();
    }

    return authLevel;
  };

  const getRecipientAuditLogs = (recipientId: number) => {
    return {
      [DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT]: auditLogs[DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT && log.data.recipientId === recipientId,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED]: auditLogs[
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED
      ].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED &&
          log.data.recipientId === recipientId,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED]: auditLogs[
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED
      ].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED &&
          log.data.recipientId === recipientId,
      ),
    };
  };

  const getRecipientSignatureField = (recipientId: number) => {
    return document.recipients
      .find((recipient) => recipient.id === recipientId)
      ?.fields.find(
        (field) => field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE,
      );
  };

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  const backgroundUrl = getAssetUrl('/static/background-certificate.png');

  const getFinalCompletionDate = () => {
    const allCompletionDates: Date[] = [];

    for (const recipient of document.recipients) {
      const log = auditLogs[DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED].find(
        (log) => log.data.recipientId === recipient.id,
      );

      if (log?.createdAt instanceof Date) {
        allCompletionDates.push(log.createdAt);
      }
    }

    if (allCompletionDates.length !== document.recipients.length) return null;

    return allCompletionDates.reduce((latest, current) => (current > latest ? current : latest));
  };

  return (
    <div
      className="relative min-h-[100vh] w-full bg-cover bg-center bg-no-repeat print:overflow-hidden"
      style={{ backgroundImage: `url('${backgroundUrl}')` }}
    >
      <div className="print-provider pointer-events-none w-full print:mx-0 print:w-full print:max-w-none print:p-0">
        <div className="border-brand m-3 flex min-h-[calc(100vh-24px)] flex-col justify-between border p-5 print:m-3 print:min-h-[calc(100vh-24px)] print:p-5">
          <div className="flex-1">
            <div className="mb-12 mt-12 flex items-center justify-center">
              <h1 className="text-brand flex h-6 w-full flex-col justify-center text-2xl font-bold leading-4">
                {_(msg`Signature Certificate`)}
              </h1>
            </div>

            <Table className="w-full border-collapse border-0" overflowHidden>
              <TableHeader>
                <TableRow className="border-b border-zinc-200">
                  <TableHead className="text-brand w-1/3 text-xs font-semibold leading-4">
                    {_(msg`Signer Events`)}
                  </TableHead>
                  <TableHead className="text-brand w-1/3 text-xs font-semibold leading-4">
                    {_(msg`Timestamp`)}
                  </TableHead>
                  <TableHead className="text-brand w-1/3 text-xs font-semibold leading-4">
                    {_(msg`Signature`)}
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="print:text-xs">
                {document.recipients.map((recipient, i) => {
                  const logs = getRecipientAuditLogs(recipient.id);
                  const signature = getRecipientSignatureField(recipient.id);
                  return (
                    <TableRow
                      key={i}
                      className="h-[1px] border-b border-zinc-200 print:break-inside-avoid"
                    >
                      <TableCell
                        truncate={false}
                        className="w-[min-content] max-w-[220px] align-top"
                      >
                        <div className="hyphens-auto break-words text-sm font-semibold leading-4 text-zinc-700">
                          {recipient.name}
                        </div>
                        <div className="break-all text-[11px] font-medium leading-4 text-zinc-600">
                          Email: {recipient.email}
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-zinc-700 print:text-xs">
                          <p>
                            <span className="font-medium">{_(msg`Sent`)}:</span>
                          </p>
                          <p>
                            <span className="font-medium">{_(msg`Viewed`)}:</span>
                          </p>
                          <p>
                            <span className="font-medium">{_(msg`Signed`)}:</span>
                          </p>
                        </div>
                        <p className="text-muted-foreground mt-2 text-sm print:text-xs">
                          <span className="font-medium">{_(msg`Recipient Verification`)}:</span>{' '}
                          <span className="flex items-center gap-1 text-[10px] font-medium leading-[18px] text-[#16A34A]">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              fill="none"
                            >
                              <path
                                d="M13.3334 4L6.00008 11.3333L2.66675 8"
                                stroke="#16A34A"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {getAuthenticationLevel(recipient.id)} {_(msg`Verified`)}
                          </span>
                        </p>
                      </TableCell>

                      <TableCell truncate={false} className="w-[min-content] align-top">
                        <p className="invisible text-sm leading-4 print:text-xs">Placeholder</p>
                        <p className="invisible text-sm leading-4 print:text-xs">Placeholder</p>
                        <div className="mt-2 space-y-1">
                          <p className="text-muted-foreground text-sm print:text-xs">
                            <span className="inline-block">
                              {logs.EMAIL_SENT[0]
                                ? DateTime.fromJSDate(logs.EMAIL_SENT[0].createdAt)
                                    .setLocale(APP_I18N_OPTIONS.defaultLocale)
                                    .toFormat('dd LLL yyyy hh:mm:ss a (ZZZZ)')
                                : _(msg`Unknown`)}
                            </span>
                          </p>

                          <p className="text-muted-foreground text-sm print:text-xs">
                            <span className="inline-block">
                              {logs.DOCUMENT_OPENED[0]
                                ? DateTime.fromJSDate(logs.DOCUMENT_OPENED[0].createdAt)
                                    .setLocale(APP_I18N_OPTIONS.defaultLocale)
                                    .toFormat('dd LLL yyyy hh:mm:ss a (ZZZZ)')
                                : _(msg`Unknown`)}
                            </span>
                          </p>

                          <p className="text-muted-foreground text-sm print:text-xs">
                            <span className="inline-block">
                              {logs.DOCUMENT_RECIPIENT_COMPLETED[0]
                                ? DateTime.fromJSDate(
                                    logs.DOCUMENT_RECIPIENT_COMPLETED[0].createdAt,
                                  )
                                    .setLocale(APP_I18N_OPTIONS.defaultLocale)
                                    .toFormat('dd LLL yyyy hh:mm:ss a (ZZZZ)')
                                : _(msg`Unknown`)}
                            </span>
                          </p>
                        </div>
                        <p className="text-muted-foreground mt-2 text-sm print:text-xs">
                          <span className="inline-block">
                            {logs.DOCUMENT_RECIPIENT_COMPLETED[0]
                              ? DateTime.fromJSDate(logs.DOCUMENT_RECIPIENT_COMPLETED[0].createdAt)
                                  .setLocale(APP_I18N_OPTIONS.defaultLocale)
                                  .toFormat('dd LLL yyyy hh:mm:ss a (ZZZZ)')
                              : _(msg`Unknown`)}
                          </span>
                        </p>
                      </TableCell>

                      <TableCell truncate={false} className="align-top">
                        {signature ? (
                          <>
                            <div className="flex h-[73px] w-full items-center justify-center rounded-sm border border-zinc-200 bg-white p-1">
                              {signature.signature?.signatureImageAsBase64 && (
                                <img
                                  src={`${signature.signature?.signatureImageAsBase64}`}
                                  alt="Signature"
                                  className="max-h-12 max-w-full object-contain"
                                />
                              )}

                              {signature.signature?.typedSignature && (
                                <p className="font-signature text-center text-sm">
                                  {signature.signature?.typedSignature}
                                </p>
                              )}
                            </div>

                            <p className="mt-2 flex h-4 flex-col justify-center self-stretch">
                              <span className="text-[10px] font-medium leading-4 text-zinc-600">
                                {_(msg`IP address`)}:
                              </span>{' '}
                              <span className="text-[10px] font-normal leading-4 text-zinc-600">
                                {logs.DOCUMENT_RECIPIENT_COMPLETED[0]?.ipAddress ?? _(msg`Unknown`)}
                              </span>
                            </p>
                          </>
                        ) : (
                          <p className="text-muted-foreground">N/A</p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mb-9 flex items-start gap-4">
            <div className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-full bg-white">
              <img
                src={getAssetUrl('/static/logo-bg-white.png')}
                alt="Logo - Caring Data"
                className="h-9 w-auto pt-1"
              />
            </div>

            <div className="text-sm font-medium leading-[18px] text-zinc-700 print:text-xs">
              <p>{_(msg`Document Completed by all parties on`)}:</p>
              <p>
                {(() => {
                  const finalDate = getFinalCompletionDate();
                  return finalDate
                    ? DateTime.fromJSDate(finalDate)
                        .setLocale(APP_I18N_OPTIONS.defaultLocale)
                        .toFormat('dd LLL yyyy hh:mm:ss a (ZZZZ)')
                    : _(msg`Unknown`);
                })()}
              </p>
              <p>
                {_(msg`Page`)} 1 {_(msg`of`)} 1
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
