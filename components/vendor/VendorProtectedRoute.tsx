'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ADMIN_EMAIL } from '@/lib/constants';

export default function VendorProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (loading) return;
      if (!user) {
        router.replace('/vendedor/login');
        return;
      }
      // Impedir acceso con cuenta admin
      if (user.email && user.email.toLowerCase() === ADMIN_EMAIL) {
        router.replace('/admin');
        return;
      }
      try {
        const q = query(collection(db, 'vendors'), where('email', '==', user.email ?? ''), limit(1));
        const snap = await getDocs(q);
        const d0 = snap.docs[0];
        if (d0 && (d0.data() as any).active) {
          setAllowed(true);
        } else {
          setAllowed(false);
          router.replace('/vendedor/login');
        }
      } finally {
        setChecking(false);
      }
    };
    check();
  }, [loading, user, router]);

  if (loading || checking) return <>{children}</>;
  if (!allowed) return null;
  return <>{children}</>;
}
