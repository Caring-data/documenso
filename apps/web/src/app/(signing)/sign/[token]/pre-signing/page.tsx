import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';

type PreSigningPageProps = {
  token: string;
};

export default function PreSigningPage({ token }: PreSigningPageProps) {
  const assetBaseUrl = WEBAPP_BASE_URL;
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <div className="fixed left-0 top-0 flex h-screen w-screen items-center justify-center overflow-hidden text-white">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${getAssetUrl('/static/pre-signature-image.jpg')})`,
        }}
      />

      {/* Overlay con degradado */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/50 to-blue-300/50" />

      {/* Contenido */}
      <div className="relative z-10 text-center">
        <h1 className="text-3xl font-bold">Review the Document Before Signing</h1>
        <button className="mt-4 rounded-lg bg-white px-6 py-2 font-semibold text-blue-600 shadow-md">
          Continue to Signing
        </button>
      </div>
    </div>
  );
}
