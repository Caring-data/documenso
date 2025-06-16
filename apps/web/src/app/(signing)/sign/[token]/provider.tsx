'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import { DocumentSignatureType } from '@documenso/lib/constants/document';

import type { SignaturePadValue } from './signature-pad';

export type SigningContextValue = {
  fullName: string;
  setFullName: (_value: string) => void;
  email: string;
  setEmail: (_value: string) => void;
  signature: SignaturePadValue | null;
  setSignature: (_value: SignaturePadValue | null) => void;
  signatureValid: boolean;
  setSignatureValid: (_valid: boolean) => void;
};

const SigningContext = createContext<SigningContextValue | null>(null);

export const useSigningContext = () => {
  return useContext(SigningContext);
};

export const useRequiredSigningContext = () => {
  const context = useSigningContext();

  if (!context) {
    throw new Error('Signing context is required');
  }

  return context;
};

export interface SigningProviderProps {
  fullName?: string | null;
  email?: string | null;
  signature?: string | null;
  children: React.ReactNode;
}

export const SigningProvider = ({
  fullName: initialFullName,
  email: initialEmail,
  signature: initialSignature,
  children,
}: SigningProviderProps) => {
  const [fullName, setFullName] = useState(initialFullName || '');
  const [email, setEmail] = useState(initialEmail || '');
  const [signature, setSignature] = useState<SignaturePadValue | null>(null);

  const [signatureValid, setSignatureValid] = useState(true);

  useEffect(() => {
    if (initialSignature) {
      const isBase64Image = initialSignature.startsWith('data:image');

      setSignature({
        type: isBase64Image ? DocumentSignatureType.DRAW : DocumentSignatureType.TYPE,
        value: initialSignature,
      });
    }
  }, [initialSignature]);

  return (
    <SigningContext.Provider
      value={{
        fullName,
        setFullName,
        email,
        setEmail,
        signature,
        setSignature,
        signatureValid,
        setSignatureValid,
      }}
    >
      {children}
    </SigningContext.Provider>
  );
};

SigningProvider.displayName = 'SigningProvider';
