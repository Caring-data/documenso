'use client';

import { useEffect, useState } from 'react';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Button } from '@react-email/button';
import { Img } from '@react-email/img';
import { Section } from '@react-email/section';

import { NEXT_PUBLIC_WEBAPP_URL, WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { authenticateWithLaravelClient } from '@documenso/lib/laravel-auth/client-auth-laravel';
import type { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentAndSender = Awaited<ReturnType<typeof getDocumentAndSenderByToken>>;

export default function PreSigningPage() {
  const { _ } = useLingui();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const token = searchParams?.get('token') || pathname?.split('/')[2] || '';
  const assetBaseUrl = WEBAPP_BASE_URL;

  const [documentDetails, setDocumentDetails] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // console.log('trueeee pre-sign');
    // try {
    //   const storedData = sessionStorage.getItem('preSigningData');

    //   if (storedData) {
    //     const parsedData = JSON.parse(storedData);
    //     setDocumentDetails(parsedData);
    //     setLoading(false);
    //   }
    // } catch (err) {
    //   console.error('Error parsing document details:', err);
    //   toast({
    //     title: _(msg`Error`),
    //     description: _(msg`Failed to fetch document details`),
    //     variant: 'destructive',
    //   });
    //   setLoading(false);
    // }

    const checkAndLogin = async () => {
      const token = localStorage.getItem('laravel_jwt');

      if (!token) {
        try {
          await authenticateWithLaravelClient();
        } catch (error) {
          console.error('❌ Authentication error with Laravel:', error);
          toast({
            title: _(msg`Error`),
            description: _(msg`Could not authenticate with the system.`),
            variant: 'destructive',
          });
        }
      }
    };

    void checkAndLogin();
  }, []);

  const signDocumentUrl = new URL(`${NEXT_PUBLIC_WEBAPP_URL()}/sign/${token}`);
  signDocumentUrl.searchParams.set('accessed', 'true');

  const rejectDocumentUrl = new URL(signDocumentUrl);
  rejectDocumentUrl.searchParams.set('reject', 'true');

  const getAssetUrl = (path: string) => new URL(path, assetBaseUrl).toString();

  const Loader = dynamic(async () => import('lucide-react').then((mod) => mod.Loader), {
    ssr: false,
  });

  return (
    <Section>
      {loading && (
        <div className="flex h-screen items-center justify-center text-gray-700">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      )}
      <div className="fixed left-0 top-0 flex h-screen w-screen items-center justify-center overflow-hidden pb-11 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${getAssetUrl('/static/pre-signature-image.jpg')})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/50 to-blue-300/50" />

        <div className="relative z-10 mt-20 flex flex-col items-center justify-center text-center sm:mt-28 lg:mt-10">
          <div className="mb-6 flex items-center justify-center">
            <Img
              src={getAssetUrl('/static/logo-cd-white.png')}
              alt="Logo - Caring Data"
              className="h-16 w-auto md:h-28"
            />
          </div>

          <div className="mb-10 flex w-11/12 max-w-lg flex-col items-center justify-center gap-6 rounded-lg bg-white p-6 text-center shadow-md md:w-full md:p-8">
            <div className="item-center flex w-full flex-col gap-4">
              <div className="flex w-full flex-col items-center justify-center gap-4">
                <Img
                  src={getAssetUrl('/static/file-pen-line.png')}
                  alt="file pen line"
                  className="h-8 flex-shrink-0"
                />
              </div>

              <p className="w-full text-center text-xl font-semibold leading-6 text-zinc-600">
                You have been requested by:{' '}
                <span className="text-brand-accent">{documentDetails?.facilityAdministrator}</span>{' '}
                from <span className="text-brand-accent">{documentDetails?.locationName}</span> to
                sign documents electronically
              </p>
            </div>

            <div className="max-w-l flex h-auto w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-3">
              <span className="text-brand-accent text-sm font-medium">
                <a
                  href="https://rise.caringdata.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-accent text-sm font-semibold underline hover:text-blue-900"
                >
                  www.rise.caringdata.com
                </a>{' '}
                would like to use your current location to ensure secure and accurate document
                processing.
              </span>
            </div>
            <hr className="w-full border-t border-gray-300 bg-gray-300" />
            <div>
              <p className="text-xs font-normal leading-4 text-zinc-600">
                By clicking the <strong>"I ACCEPT"</strong> button, you agree to review the
                documents and provide your electronic signature. You acknowledge that your
                electronic signature will have the same legal validity and effect as a handwritten
                signature, ensuring the document is complete and legally binding.
              </p>
            </div>

            <div className="flex w-full flex-col gap-4 md:flex-row">
              <Button
                className="!flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-zinc-700 hover:bg-zinc-200"
                onClick={() => (window.location.href = rejectDocumentUrl.toString())}
              >
                I Decline
              </Button>
              <Button
                className="bg-brand !flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md px-20 py-8 text-white hover:bg-blue-700"
                onClick={() => (window.location.href = signDocumentUrl.toString())}
              >
                I Accept
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
