'use client';

import { createContext, useContext } from 'react';

export type VendorProfile = {
  id: string;
  name: string;
  email: string;
  dni: string;
  mustChangePassword: boolean;
  defaultCommission: { type: 'percent' | 'fixed'; value: number; currency: string } | null;
  allowedExperiences: string[] | null;
};

const VendorContext = createContext<VendorProfile | null>(null);

export const VendorContextProvider = VendorContext.Provider;

export function useVendor(): VendorProfile {
  const ctx = useContext(VendorContext);
  if (!ctx) throw new Error('useVendor debe usarse dentro de <VendorProtectedRoute>');
  return ctx;
}
