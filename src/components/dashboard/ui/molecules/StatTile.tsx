type StatTileProps = {
  label: string
  value: string
  sub?: string
}

export default function StatTile({ label, value, sub }: StatTileProps) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 flex-1 min-w-[160px]">
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="ft-3 font-bold text-brand-1 mt-1">{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
    </div>
  )
}
