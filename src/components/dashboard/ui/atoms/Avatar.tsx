const COLORS = [
  'bg-brand-3/20 text-brand-3',
  'bg-amber-500/20 text-amber-400',
  'bg-sky-500/20 text-sky-400',
  'bg-fuchsia-500/20 text-fuchsia-400',
  'bg-orange-500/20 text-orange-400',
]

function initials(name?: string | null) {
  const clean = (name || '').trim()
  if (!clean) return '?'
  const parts = clean.split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || clean[0].toUpperCase()
}

// Color estable por nombre: mismo lead siempre pinta el mismo color.
function colorFor(name?: string | null) {
  const key = (name || '').trim()
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % COLORS.length
  return COLORS[hash] || COLORS[0]
}

type AvatarProps = {
  name?: string | null
}

export default function Avatar({ name }: AvatarProps) {
  return (
    <span
      className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold ${colorFor(name)}`}
    >
      {initials(name)}
    </span>
  )
}
