import { Skeleton } from "@/components/ui/skeleton";

export function OrdersSkeleton({ detail = false }: { detail?: boolean }) {
  return <div role="status" aria-busy="true">
    <span className="sr-only">{detail ? "Cargando pedido" : "Cargando pedidos"}</span>
    {detail ? <>
      <div className="mb-6 flex gap-3"><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-44" /></div>
      <div className="mb-6 grid gap-5 md:grid-cols-2">{[0, 1].map((item) => <div key={item} className="rounded-xl border border-slate-200 bg-white p-6"><Skeleton className="mb-4 h-3 w-28" /><Skeleton className={`h-5 ${item ? "w-5/6" : "w-1/2"}`} /></div>)}</div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5"><Skeleton className="h-6 w-44" /></div>
        <div className="flex justify-between gap-6 bg-slate-50 px-6 py-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-20" /></div>
        {[0, 1, 2].map((item) => <div key={item} className="flex items-center justify-between gap-6 border-t border-slate-100 px-6 py-5"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-5 w-8" /><Skeleton className="h-5 w-20" /></div>)}
        <div className="ml-auto max-w-sm space-y-5 px-6 py-6"><div className="flex justify-between gap-24"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-12" /></div><div className="flex justify-between border-t border-slate-200 pt-4"><Skeleton className="h-6 w-16" /><Skeleton className="h-8 w-28" /></div></div>
      </div>
    </> : <>
      <div className="mb-5 flex items-end justify-between gap-4"><div className="w-full max-w-sm"><Skeleton className="mb-2 h-4 w-24" /><Skeleton className="h-10 w-full" /></div><Skeleton className="hidden h-4 w-24 sm:block" /></div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[1.1fr_1.3fr_.6fr_.6fr_.7fr] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 md:grid">{[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-4 w-3/4" />)}</div>
        {[0, 1, 2, 3, 4].map((item) => <div key={item} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-100 px-5 py-5 last:border-0 md:grid-cols-[1.1fr_1.3fr_.6fr_.6fr_.7fr] md:gap-4 md:px-6">
          <div><Skeleton className="h-5 w-24" /><Skeleton className="mt-1 h-3 w-32" /></div>
          <Skeleton className="order-3 h-5 w-3/4 md:order-none" /><Skeleton className="hidden h-5 w-8 md:block" /><Skeleton className="order-4 h-6 w-16 justify-self-end md:order-none md:justify-self-start" /><Skeleton className="h-5 w-20 justify-self-end" />
        </div>)}
      </div>
    </>}
  </div>;
}
