'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getReservas } from '@/lib/reservas';
import type { Reservation } from '@/components/landing-reserva/types';
import { buildVentaStatuses } from '@/lib/sales/status';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Package,
  FolderKanban,
  MessageSquare,
  Mail,
  CheckCircle2,
  CalendarCheck,
  Receipt,
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
    ventasConfirmadas: 0,
    ventasPendientes: 0,
    ingresosConfirmados: 0,
    ingresosTotales: 0,
  });
  const [recentVentas, setRecentVentas] = useState<Reservation[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [
          categoriasSnap,
          paquetesSnap,
          consultasSnap,
          newsletterSnap,
          reservas,
        ] = await Promise.all([
          getDocs(collection(db, 'categorias')),
          getDocs(collection(db, 'paquetes')),
          getDocs(query(collection(db, 'consultas'), where('leida', '==', false))),
          getDocs(collection(db, 'newsletter')),
          getReservas({ limit: RESERVAS_LIMIT }),
        ]);

        const ventas = Array.isArray(reservas) ? reservas : [];
        const computed = ventas.reduce(
          (acc, r) => {
            const statuses = buildVentaStatuses(r);
            const isCancelled = statuses.commercialStatus === 'cancelled';
            if (statuses.commercialStatus === 'confirmed') {
              acc.ventasConfirmadas += 1;
              acc.ingresosConfirmados += Number(r.amountTotal ?? 0) || 0;
            }
            if (statuses.commercialStatus === 'pending_payment') {
              acc.ventasPendientes += 1;
            }
            if (!isCancelled) {
              acc.ingresosTotales += Number(r.amountTotal ?? 0) || 0;
            }
            return acc;
          },
          {
            ventasConfirmadas: 0,
            ventasPendientes: 0,
            ingresosConfirmados: 0,
            ingresosTotales: 0,
          }
        );

        setStats({
          categorias: categoriasSnap.size,
          paquetes: paquetesSnap.size,
          consultas: consultasSnap.size,
          newsletter: newsletterSnap.size,
          ventasConfirmadas: computed.ventasConfirmadas,
          ventasPendientes: computed.ventasPendientes,
          ingresosConfirmados: computed.ingresosConfirmados,
          ingresosTotales: computed.ingresosTotales,
        });
        setRecentVentas(ventas.slice(0, RECENT_RESERVAS));
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
      label: 'Paquetes',
      value: stats.paquetes,
      icon: Package,
      accent: 'from-[#CBBBA0]/35 to-transparent',
      iconClass: 'bg-[#F7F2EA] text-[#8E6B45]',
      href: '/admin/experiencias',
    },
    {
      label: 'Ventas confirmadas',
      value: stats.ventasConfirmadas,
      icon: CheckCircle2,
      accent: 'from-emerald-500/20 to-transparent',
      iconClass: 'bg-emerald-100 text-emerald-700',
      href: '/admin/ventas',
    },
    {
      label: 'Ingresos confirmados',
      value: formatAmount(stats.ingresosConfirmados, 'ars'),
      icon: Receipt,
      accent: 'from-[#E30613]/20 to-transparent',
      iconClass: 'bg-[#FFF1F1] text-[#E30613]',
      href: '/admin/ventas',
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
    {
      label: 'Ventas pendientes',
      value: stats.ventasPendientes,
      icon: CalendarCheck,
      accent: 'from-amber-500/20 to-transparent',
      iconClass: 'bg-amber-100 text-amber-700',
      href: '/admin/ventas',
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
                          {['Paquete', 'Fecha', 'Personas', 'Cliente', 'Monto'].map((h) => (
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
                  <CardTitle className="text-base">Ventas recientes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recentVentas.length === 0 ? (
                    <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-600">Sin ventas.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-gray-500">
                            {['Código', 'Paquete', 'Fecha', 'Pax', 'Cliente', 'Monto'].map((h) => (
                              <th key={h} className="pb-2 pr-3 font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {recentVentas.map((r) => (
                            <tr key={r.id} className="border-b border-gray-100 last:border-0">
                              <td className="py-3 pr-3 font-mono text-xs text-gray-700">{String((r as any).reservationCode ?? r.id).slice(0, 16)}</td>
                              <td className="py-3 pr-3">
                                <Link href={`/admin/ventas/${r.id}`} className="font-semibold text-gray-900 hover:underline">
                                  {r.packageTitle || r.experienceTitle || '—'}
                                </Link>
                              </td>
                              <td className="py-3 pr-3">{formatReservationDate(r.date)}</td>
                              <td className="py-3 pr-3">{r.people}</td>
                              <td className="py-3 pr-3">{r.customerName || r.customerEmail || '—'}</td>
                              <td className="py-3">{formatAmount(Number(r.amountTotal ?? 0) || 0, String(r.currency ?? 'ars'))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-gray-200/80 bg-white shadow-sm mt-6">
                <CardHeader>
                  <CardTitle className="text-base">Inicio rápido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">Accesos directos:</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { text: 'Ver ventas / reservas', href: '/admin/ventas' },
                      { text: 'Gestionar experiencias', href: '/admin/experiencias' },
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
