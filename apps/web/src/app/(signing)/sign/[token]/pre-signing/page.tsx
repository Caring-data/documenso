'use client';

import { useMemo } from 'react';

import { usePathname } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

import { Button } from '@react-email/button';
import { Img } from '@react-email/img';

import { NEXT_PUBLIC_WEBAPP_URL, WEBAPP_BASE_URL } from '@documenso/lib/constants/app';

export default function PreSigningPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const token = searchParams?.get('token') || pathname?.split('/')[2] || '';
  const assetBaseUrl = WEBAPP_BASE_URL;

  const signDocumentUrl = useMemo(() => {
    const url = new URL(`${NEXT_PUBLIC_WEBAPP_URL()}/sign/${token}`);
    url.searchParams.set('accessed', 'true');
    return url;
  }, [token]);

  const signDocumentLink = signDocumentUrl.toString();

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  const rejectDocumentLink = useMemo(() => {
    const rejectUrl = new URL(signDocumentUrl);
    rejectUrl.searchParams.set('reject', 'true');
    return rejectUrl.toString();
  }, [signDocumentUrl]);

  return (
    <div className="fixed left-0 top-0 flex h-screen w-screen items-center justify-center overflow-hidden pb-11 text-white">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${getAssetUrl('/static/pre-signature-image.jpg')})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/50 to-blue-300/50" />

      <div className="relative z-10 mt-4 flex flex-col text-center sm:mt-0">
        <div className="mb-6 flex items-center justify-center">
          <Img
            src={getAssetUrl('/static/logo-caring-data.png')}
            alt="Logo - Caring Data"
            className="mb-4 h-16 w-16 flex-shrink-0 sm:h-28 sm:w-28 md:h-36 md:w-44"
          />
        </div>

        <div className="ml-4 flex w-11/12 max-w-lg flex-col items-center justify-center gap-6 rounded-lg bg-white p-6 text-center shadow-md md:w-full md:p-8">
          <div className="item-center flex w-full flex-col gap-4">
            <div className="flex w-full flex-col items-center justify-center gap-4">
              <Img
                src={getAssetUrl('/static/file-pen-line.png')}
                alt="file pen line"
                className="h-8 flex-shrink-0"
              />
            </div>

            <p className="w-full text-center text-xl font-semibold leading-6 text-zinc-600">
              You have been requested by: <span className="text-brand-accent">Ivonne Meader</span>{' '}
              from <span className="text-brand-accent">Caring Homes</span> to eSign documents
            </p>
          </div>

          <div className="max-w-l flex h-auto w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-3">
            <span className="text-brand-accent text-sm font-medium">
              The website,{' '}
              <a
                href="https://caringdata.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-accent text-sm font-semibold underline hover:text-blue-900"
              >
                caringdata.com
              </a>{' '}
              would like to use your current location.
            </span>
          </div>

          <div>
            <p className="text-xs font-normal leading-4 text-zinc-600">
              By clicking the <strong>"I ACCEPT"</strong> button, you are accepting the invitation
              to review the documents. By signing electronically, you agree that your electronic
              signature has the same legal validity and effect as your handwritten signature.
            </p>
          </div>

          <div className="flex w-full flex-col gap-4 md:flex-row">
            <Button
              className="!flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-zinc-700 hover:bg-zinc-200"
              onClick={() => (window.location.href = rejectDocumentLink)}
            >
              I Decline
            </Button>
            <Button
              className="bg-brand !flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md px-20 py-8 text-white hover:bg-blue-700"
              onClick={() => (window.location.href = signDocumentLink)}
            >
              I Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
