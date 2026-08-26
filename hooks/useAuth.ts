'use client';

import { useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { SessionManager } from '@/lib/auth/sessionManager';
import { configureAuthPersistence } from '@/lib/auth/authConfig';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionManager] = useState(() => SessionManager.getInstance());

  // Función para cerrar sesión de forma segura
  const logout = useCallback(async () => {
    try {
      const auth = getAuthInstance();
      sessionManager.clearSession();
      await signOut(auth);
      console.log('✅ Sesión cerrada correctamente');
    } catch (error) {
      console.error('❌ Error cerrando sesión:', error);
    }
  }, [sessionManager]);

  useEffect(() => {
    const auth = getAuthInstance();
    configureAuthPersistence(auth, true).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [sessionManager]);

  return { 
    user, 
    loading, 
    logout,
    sessionManager 
  };
}

