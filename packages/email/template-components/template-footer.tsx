import { Trans } from '@lingui/macro';

import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';

import { Img, Link, Section, Text } from '../components';
import { useBranding } from '../providers/branding';

export type TemplateFooterProps = {
  isDocument?: boolean;
};

export const TemplateFooter = ({ isDocument = true }: TemplateFooterProps) => {
  const branding = useBranding();
  const assetBaseUrl = WEBAPP_BASE_URL;

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Section>
      {isDocument && !branding.brandingHidePoweredBy && (
        <Text className="my-4 text-center text-xs font-medium leading-4 text-zinc-500">
          <Trans>
            uses <span className="font-semibold text-[#508EEB]">Caring Data</span> to manage
            communication and documentation in their facility. Caring Data respects your privacy. To
            learn more, read our{' '}
            <Link
              className="text-[#508EEB] underline decoration-solid decoration-auto underline-offset-auto"
              href="https://home.caringdata.com/index.php/privacy-policy/"
            >
              Privacy Statement
            </Link>
          </Trans>
        </Text>
      )}

      {branding.brandingCompanyDetails ? (
        <Text className="my-8 text-xs text-slate-400">
          {branding.brandingCompanyDetails.split('\n').map((line, idx) => {
            return (
              <>
                {idx > 0 && <br />}
                {line}
              </>
            );
          })}
        </Text>
      ) : (
        <div className="w-full items-center justify-center text-center">
          <Text className="font-montserrat text-xs font-medium text-zinc-500">
            Visit{' '}
            <a
              href="https://www.caringdata.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#508EEB]"
            >
              www.caringdata.com
            </a>{' '}
            to learn more.
            <br />
            <span className="font-montserrat text-[10px] font-medium text-zinc-500">
              2025 Caring Data, LLC. All rights reserved.
            </span>
          </Text>
          {branding.brandingEnabled && branding.brandingLogo && (
            <Img src={branding.brandingLogo} alt="Logo - Caring Data" className="mb-4 h-6" />
          )}
          <Img
            src={getAssetUrl('/static/file-pen-line.png')}
            alt="icon image - file pen line"
            className="mb-4 h-8"
          />
        </div>
      )}
    </Section>
  );
};

export default TemplateFooter;
