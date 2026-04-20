'use client'

interface TableDef {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  floor: string
}

const TABLES: TableDef[] = [
  { id: 't1', label: 'T1', x: 40, y: 40, width: 50, height: 36, floor: 'terrace' },
  { id: 't2', label: 'T2', x: 110, y: 40, width: 50, height: 36, floor: 'terrace' },
  { id: 't3', label: 'T3', x: 180, y: 40, width: 50, height: 36, floor: 'terrace' },
  { id: 't4', label: 'T4', x: 40, y: 96, width: 50, height: 36, floor: 'terrace' },
  { id: 't5', label: 'T5', x: 110, y: 96, width: 50, height: 36, floor: 'terrace' },
  { id: 't6', label: 'T6', x: 180, y: 96, width: 80, height: 36, floor: 'terrace' },
  { id: 'f1t1', label: 'F1', x: 300, y: 40, width: 50, height: 36, floor: 'floor1' },
  { id: 'f1t2', label: 'F2', x: 370, y: 40, width: 50, height: 36, floor: 'floor1' },
  { id: 'f1t3', label: 'F3', x: 440, y: 40, width: 50, height: 36, floor: 'floor1' },
  { id: 'f1t4', label: 'F4', x: 510, y: 40, width: 50, height: 36, floor: 'floor1' },
  { id: 'f1t5', label: 'F5', x: 300, y: 96, width: 50, height: 36, floor: 'floor1' },
  { id: 'f1t6', label: 'F6', x: 370, y: 96, width: 50, height: 36, floor: 'floor1' },
  { id: 'f1t7', label: 'F7', x: 440, y: 96, width: 60, height: 36, floor: 'floor1' },
  { id: 'f1t8', label: 'F8', x: 510, y: 96, width: 60, height: 36, floor: 'floor1' },
  { id: 'f2t1', label: '21', x: 40, y: 200, width: 50, height: 36, floor: 'floor2' },
  { id: 'f2t2', label: '22', x: 110, y: 200, width: 50, height: 36, floor: 'floor2' },
  { id: 'f2t3', label: '23', x: 180, y: 200, width: 50, height: 36, floor: 'floor2' },
  { id: 'f2t4', label: '24', x: 250, y: 200, width: 50, height: 36, floor: 'floor2' },
  { id: 'f2t5', label: '25', x: 40, y: 256, width: 50, height: 36, floor: 'floor2' },
  { id: 'f2t6', label: '26', x: 110, y: 256, width: 50, height: 36, floor: 'floor2' },
  { id: 'f2t7', label: '27', x: 180, y: 256, width: 80, height: 36, floor: 'floor2' },
  { id: 'p1', label: 'Private', x: 400, y: 200, width: 120, height: 80, floor: 'private' },
]

type TableStatus = 'available' | 'booked' | 'seated'

const STATUS_COLOR: Record<TableStatus, { fill: string; stroke: string; text: string }> = {
  available: { fill: '#d1fae5', stroke: '#10b981', text: '#065f46' },
  booked: { fill: '#fef3c7', stroke: '#f59e0b', text: '#92400e' },
  seated: { fill: '#ffe4e6', stroke: '#f43f5e', text: '#9f1239' },
}

const SECTION_BG = [
  { x: 24, y: 24, w: 258, h: 120, label: 'TERRACE' },
  { x: 284, y: 24, w: 310, h: 120, label: 'FLOOR 1' },
  { x: 24, y: 180, w: 258, h: 128, label: 'FLOOR 2' },
  { x: 384, y: 180, w: 160, h: 128, label: 'PRIVATE' },
]

export function FloorMap({ tableStates }: { tableStates: Record<string, TableStatus> }) {
  return (
    <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-6">
      <h2 className="text-base font-semibold text-foreground mb-4">Floor Map</h2>
      <div className="flex gap-5 mb-5">
        {[
          { color: '#10b981', label: 'Available' },
          { color: '#f59e0b', label: 'Booked' },
          { color: '#f43f5e', label: 'Seated' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
            <span className="text-xs text-muted-foreground font-medium">{l.label}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg width="620" height="320" className="font-sans">
          {SECTION_BG.map(s => (
            <g key={s.label}>
              <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={10} fill="#f0f9f8" fillOpacity={0.6} stroke="#1C4A5A" strokeOpacity={0.12} strokeWidth={1} />
              <text x={s.x + 10} y={s.y + 14} fill="#1C4A5A" fontSize="9" fontWeight="700" letterSpacing="1.5" opacity={0.6}>{s.label}</text>
            </g>
          ))}
          {TABLES.map(table => {
            const status = tableStates[table.id] ?? 'available'
            const c = STATUS_COLOR[status]
            return (
              <g key={table.id}>
                <rect x={table.x} y={table.y} width={table.width} height={table.height} rx={8} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                <text x={table.x + table.width / 2} y={table.y + table.height / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={c.text}>
                  {table.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <p className="text-xs text-muted-foreground mt-2">Showing bookings in the next 2 hours.</p>
    </div>
  )
}
