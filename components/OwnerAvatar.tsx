import { getInitials } from '@/lib/utils'

const colors = [
  'bg-violet-600',
  'bg-emerald-600',
  'bg-orange-600',
  'bg-sky-600',
]

export function OwnerAvatar({ name }: { name: string }) {
  const idx = name.charCodeAt(0) % colors.length
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${colors[idx]}`}
      title={name}
    >
      {getInitials(name)}
    </span>
  )
}
