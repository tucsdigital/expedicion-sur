import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';

function Line({ w }: { w: string }) {
  return <div className={`h-3 rounded-full bg-[#DCEBFA] ${w}`} />;
}

function CardSkeleton() {
  return (
    <div className="rounded-3xl border border-[#D4E6F7] bg-white p-5 shadow-[0_14px_34px_rgba(15,66,116,0.08)]">
      <div className="animate-pulse space-y-3">
        <Line w="w-40" />
        <Line w="w-full" />
        <Line w="w-11/12" />
        <Line w="w-3/4" />
      </div>
    </div>
  );
}

function ShareSkeleton() {
  return (
    <div className="rounded-3xl border border-[#D4E6F7] bg-white p-5 shadow-[0_14px_34px_rgba(15,66,116,0.08)]">
      <div className="animate-pulse space-y-3">
        <Line w="w-32" />
        <div className="flex items-center gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-9 rounded-full bg-[#EAF3FC]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoadingExcursionDetail() {
  return (
    <div className="min-h-screen bg-[#F5FAFF]">
      <Navbar variant="homeMockup" reserveSpace />
      <main className="container mx-auto px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="h-3 w-72 animate-pulse rounded-full bg-[#DCEBFA]" />
        <section className="mt-4 overflow-hidden rounded-[28px] border border-[#D2E5F6] bg-white shadow-[0_16px_42px_rgba(15,66,116,0.14)] sm:rounded-[32px]">
          <div className="min-h-[240px] animate-pulse bg-gradient-to-r from-[#DCEBFA] via-[#ECF5FE] to-[#DCEBFA] sm:min-h-[320px] md:min-h-[420px] lg:min-h-[500px]" />
        </section>

        <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5">
            <div className="rounded-3xl border border-[#D4E6F7] bg-white p-6 shadow-[0_14px_34px_rgba(15,66,116,0.08)]">
              <div className="">
                <div className="animate-pulse space-y-3">
                  <div className="h-9 w-80 rounded bg-[#DCEBFA]" />
                  <Line w="w-96" />
                  <Line w="w-56" />
                  <Line w="w-full" />
                  <Line w="w-11/12" />
                  <Line w="w-10/12" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-[#E4F0FB]" />
                ))}
              </div>
            </div>

            <CardSkeleton />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="animate-pulse rounded-3xl border border-[#D8EFE0] bg-[#F5FFF7] p-5">
                <Line w="w-24" />
                <div className="mt-4 space-y-2">
                  <Line w="w-11/12" />
                  <Line w="w-10/12" />
                  <Line w="w-9/12" />
                </div>
              </div>
              <div className="animate-pulse rounded-3xl border border-[#F1DCDC] bg-[#FFF8F8] p-5">
                <Line w="w-28" />
                <div className="mt-4 space-y-2">
                  <Line w="w-11/12" />
                  <Line w="w-10/12" />
                  <Line w="w-9/12" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#D4E6F7] bg-white p-5 shadow-[0_14px_34px_rgba(15,66,116,0.08)]">
              <div className="animate-pulse space-y-3">
                <Line w="w-28" />
                <div className="aspect-[16/8] rounded-2xl bg-[#EAF3FC]" />
              </div>
            </div>

            <ShareSkeleton />
          </section>
          <aside className="space-y-4">
            <div className="rounded-3xl border border-[#D2E5F6] bg-white p-5 shadow-[0_18px_40px_rgba(14,63,110,0.1)]">
              <div className="animate-pulse space-y-3">
                <Line w="w-20" />
                <div className="h-12 w-44 rounded bg-[#DCEBFA]" />
                <Line w="w-36" />
                <div className="h-28 rounded-2xl bg-[#EAF3FC]" />
                <div className="h-11 rounded-2xl bg-[#F4D35C]" />
                <div className="h-11 rounded-2xl bg-[#E6FAEF]" />
              </div>
            </div>
            <div className="rounded-3xl border border-[#D2E5F6] bg-white p-5 shadow-[0_14px_30px_rgba(15,66,116,0.08)]">
              <div className="animate-pulse space-y-3">
                <Line w="w-24" />
                <Line w="w-40" />
                <Line w="w-32" />
              </div>
            </div>
          </aside>
        </div>
      </main>
      <HomeFooter />
    </div>
  );
}
