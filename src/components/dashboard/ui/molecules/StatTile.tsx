type StatTileProps = {
  label: string
  value: string
  sub?: string
}

export default function StatTile({ label, value, sub }: StatTileProps) {
  return (
    <div className="bg-neutral-900 p-4 flex-1 min-w-[160px]">
      <p className="-ft-2 tracking-wide text-neutral-400">{label}</p>
      <p className="ft-4 font-bold text-neutral-200 mt-1">{value}</p>
      {sub && <p className="-ft-4 text-neutral-400 mt-1">{sub}</p>}
    </div>
  )
}
