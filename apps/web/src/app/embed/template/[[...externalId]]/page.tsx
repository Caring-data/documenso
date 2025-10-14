import { notFound } from 'next/navigation';

import { getTemplateByExternalId } from '@documenso/lib/server-only/template/get-template-by-external-id';

import { EmbedTemplateClientPage } from './client';

export type EmbedTemplatePageProps = {
  params: {
    externalId: string;
  };
};

export default async function EmbedTemplatePage({ params }: EmbedTemplatePageProps) {
  if (params.externalId.length !== 1) {
    return notFound();
  }

  const [externalId] = params.externalId;

  const template = await getTemplateByExternalId({
    externalId,
  }).catch(() => null);

  if (!template || !template.templateDocumentData) {
    return notFound();
  }

  return (
    <EmbedTemplateClientPage
      templateId={template.id}
      externalId={externalId}
      documentData={template.templateDocumentData}
      initialTemplate={template}
    />
  );
}
