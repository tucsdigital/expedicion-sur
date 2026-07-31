'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getReservas } from '@/lib/reservas';
import { getExperiencias } from '@/lib/experiencias';
import type { Reservation } from '@/components/landing-reserva/types';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Package,
  FolderKanban,
  MessageSquare,
  Mail,
  CheckCircle2,
  CalendarCheck,
  Compass,
  ArrowRight,
  Loader2,
  Users,
} from 'lucide-react';

const RESERVAS_LIMIT = 200;
const RECENT_RESERVAS = 10;

function formatReservationDate(dateStr: string): string {
  if (!dateStr || dateStr === 'sin-fecha') return 'A coordinar';
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatAmount(amountTotal: number, currency: string): string {
  const value = amountTotal / 100;
  const c = (currency || 'ars').toLowerCase();
  if (c === 'ars') return `$ ${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
  if (c === 'brl') return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
  if (c === 'usd') return `USD ${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `${value.toFixed(2)} ${currency}`;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    categorias: 0,
    paquetes: 0,
    consultas: 0,
    newsletter: 0,
  });

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [
          categoriasSnap,
          paquetesSnap,
          consultasSnap,
          newsletterSnap,
        ] = await Promise.all([
          getDocs(collection(db, 'categorias')),
          getDocs(collection(db, 'paquetes')),
          getDocs(query(collection(db, 'consultas'), where('leida', '==', false))),
          getDocs(collection(db, 'newsletter')),
        ]);

        setStats({
          categorias: categoriasSnap.size,
          paquetes: paquetesSnap.size,
          consultas: consultasSnap.size,
          newsletter: newsletterSnap.size,
        });
      } catch (error) {
        console.error('Error fetching dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const cards = [
    {
      label: 'Excursiones',
      value: stats.paquetes,
      icon: Package,
      accent: 'from-sky-500/20 to-transparent',
      iconClass: 'bg-sky-100 text-sky-700',
      href: '/admin/paquetes',
    },
    {
      label: 'Categorías',
      value: stats.categorias,
      icon: FolderKanban,
      accent: 'from-emerald-500/20 to-transparent',
      iconClass: 'bg-emerald-100 text-emerald-700',
      href: '/admin/categorias',
    },
    {
      label: 'Consultas sin leer',
      value: stats.consultas,
      icon: MessageSquare,
      accent: 'from-rose-500/20 to-transparent',
      iconClass: 'bg-rose-100 text-rose-700',
      href: '/admin/consultas',
    },
    {
      label: 'Newsletter',
      value: stats.newsletter,
      icon: Mail,
      accent: 'from-slate-500/20 to-transparent',
      iconClass: 'bg-slate-100 text-slate-700',
      href: '/admin/newsletter',
    },
  ];

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">Resumen del panel de administración</p>
          </div>

          {loading ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={`card-skel-${i}`}
                    className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4"
                  >
                    <div className="h-4 w-28 bg-gray-200 rounded-md animate-pulse" />
                    <div className="mt-4 h-8 w-20 bg-gray-200 rounded-md animate-pulse" />
                    <div className="mt-2 h-3 w-24 bg-gray-200 rounded-md animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white mt-6">
                <div className="border-b border-gray-200 px-4 py-3">
                  <div className="h-5 w-32 bg-gray-200 rounded-md animate-pulse" />
                </div>
                <div className="p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          {['Experiencia', 'Fecha', 'Personas', 'Cliente', 'Monto'].map((h) => (
                            <th key={h} className="pb-2 pr-3 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 6 }).map((_, i) => (
                          <tr key={`row-skel-${i}`} className="border-b border-gray-100 last:border-0">
                            <td className="py-3 pr-3">
                              <div className="h-4 w-64 bg-gray-200 rounded-md animate-pulse" />
                            </td>
                            <td className="py-3 pr-3">
                              <div className="h-4 w-24 bg-gray-200 rounded-md animate-pulse" />
                            </td>
                            <td className="py-3 pr-3">
                              <div className="h-4 w-16 bg-gray-200 rounded-md animate-pulse" />
                            </td>
                            <td className="py-3 pr-3">
                              <div className="h-4 w-40 bg-gray-200 rounded-md animate-pulse" />
                            </td>
                            <td className="py-3">
                              <div className="ml-auto h-4 w-20 bg-gray-200 rounded-md animate-pulse" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((card) => {
                  const Icon = card.icon;
                  const content = (
                    <Card
                      key={card.label}
                      className="group relative overflow-hidden border border-gray-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-r ${card.accent}`} />
                      <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-semibold text-gray-700">
                          {card.label}
                        </CardTitle>
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.iconClass}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                      </CardHeader>
                      <CardContent className="relative">
                        <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                        {'sub' in card && typeof card.sub === 'string' && (
                          <p className="mt-0.5 text-xs text-gray-500">{card.sub}</p>
                        )}
                        {(!('sub' in card) || !card.sub) && card.href && (
                          <p className="mt-1 text-xs text-gray-500">Ver listado</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                  return card.href ? (
                    <Link key={card.label} href={card.href} className="block">
                      {content}
                    </Link>
                  ) : (
                    content
                  );
                })}
              </div>

              <Card className="border border-gray-200/80 bg-white shadow-sm mt-6">
                <CardHeader>
                  <CardTitle className="text-base">Inicio rápido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">Accesos directos:</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { text: 'Crear y editar categorías', href: '/admin/categorias' },
                      { text: 'Gestionar excursiones', href: '/admin/paquetes' },
                      { text: 'Consultas y mensajes', href: '/admin/consultas' },
                      { text: 'Suscripciones al Newsletter', href: '/admin/newsletter' },
                    ].map((item) => (
                      <Link key={item.href} href={item.href}>
                        <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3 transition hover:border-gray-300 hover:bg-gray-50">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <p className="text-sm text-gray-700">{item.text}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
