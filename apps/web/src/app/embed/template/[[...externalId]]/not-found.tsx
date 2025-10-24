import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import NotFoundPartial from '~/components/partials/not-found';

export default async function NotFound() {
  await setupI18nSSR();

  return <NotFoundPartial showGoBackButton={false} />;
}
