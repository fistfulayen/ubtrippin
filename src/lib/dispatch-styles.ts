/** Shared Tailwind prose classes for rendered dispatch HTML */
export const dispatchProseClasses = [
  'text-lg leading-8 text-slate-800',
  '[&_a]:text-[#312e81] [&_a]:underline [&_a]:underline-offset-4',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic',
  '[&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-semibold',
  '[&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold',
  '[&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold',
  '[&_li]:my-2',
  '[&_ol]:my-6 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_p]:my-5',
  '[&_ul]:my-6 [&_ul]:list-disc [&_ul]:pl-6',
  // Tables
  '[&_table]:my-8 [&_table]:w-full [&_table]:border-collapse [&_table]:text-base',
  '[&_th]:border-b-2 [&_th]:border-slate-300 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-900',
  '[&_td]:border-b [&_td]:border-slate-200 [&_td]:px-4 [&_td]:py-2 [&_td]:text-slate-700',
  '[&_thead]:bg-slate-50',
  '[&_tr:last-child_td]:border-b-0',
].join(' ')
