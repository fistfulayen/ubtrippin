function TimelineSkeletonCard() {
  return (
    <div className="animate-pulse rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="h-4 w-24 rounded-full bg-gray-200" />
      <div className="mt-4 h-8 w-56 rounded-lg bg-gray-200" />
      <div className="mt-3 flex flex-wrap gap-3">
        <div className="h-4 w-28 rounded-full bg-gray-200" />
        <div className="h-4 w-36 rounded-full bg-gray-200" />
        <div className="h-4 w-20 rounded-full bg-gray-200" />
      </div>
      <div className="mt-5 h-24 rounded-2xl bg-gray-200" />
    </div>
  )
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex animate-pulse items-center gap-3">
        <div className="h-4 w-4 rounded-full bg-gray-200" />
        <div className="h-4 w-28 rounded-lg bg-gray-200" />
      </div>

      <div className="animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="h-52 bg-gradient-to-r from-gray-100 to-gray-50 p-6 sm:p-8">
          <div className="mt-16 h-10 w-64 rounded-xl bg-gray-200" />
          <div className="mt-5 flex flex-wrap gap-4">
            <div className="h-5 w-36 rounded-full bg-gray-200" />
            <div className="h-5 w-44 rounded-full bg-gray-200" />
            <div className="h-5 w-32 rounded-full bg-gray-200" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <TimelineSkeletonCard />
        <TimelineSkeletonCard />
        <TimelineSkeletonCard />
        <TimelineSkeletonCard />
      </div>

      <section className="space-y-4 rounded-[28px] border border-gray-200 bg-[#f7fbff] p-5 animate-pulse">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-lg bg-gray-200" />
          <div className="h-4 w-72 rounded-lg bg-gray-200" />
        </div>
        <div className="h-24 rounded-2xl bg-gray-200" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="h-40 rounded-2xl bg-gray-200" />
          <div className="h-40 rounded-2xl bg-gray-200" />
          <div className="h-40 rounded-2xl bg-gray-200" />
        </div>
      </section>
    </div>
  )
}
