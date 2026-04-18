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

const STATUS_COLOR: Record<TableStatus, string> = {
  available: '#22c55e',
  booked: '#f59e0b',
  seated: '#ef4444',
}

export function FloorMap({ tableStates }: { tableStates: Record<string, TableStatus> }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <h2 className="text-sm font-semibold text-[#1a2e1a] mb-4">Floor Map</h2>
      <div className="flex gap-4 mb-4">
        {[
          { color: '#22c55e', label: 'Available' },
          { color: '#f59e0b', label: 'Booked' },
          { color: '#ef4444', label: 'Seated' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
            <span className="text-xs text-text-muted">{l.label}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg width="620" height="320" className="font-sans">
          <text x="40" y="26" fill="#9ca3af" fontSize="10" fontWeight="700" letterSpacing="1">TERRACE</text>
          <text x="300" y="26" fill="#9ca3af" fontSize="10" fontWeight="700" letterSpacing="1">FLOOR 1</text>
          <text x="40" y="185" fill="#9ca3af" fontSize="10" fontWeight="700" letterSpacing="1">FLOOR 2</text>
          <text x="400" y="185" fill="#9ca3af" fontSize="10" fontWeight="700" letterSpacing="1">PRIVATE</text>
          {TABLES.map(table => {
            const status = tableStates[table.id] ?? 'available'
            const fill = STATUS_COLOR[status]
            return (
              <g key={table.id}>
                <rect
                  x={table.x} y={table.y}
                  width={table.width} height={table.height}
                  rx={6}
                  fill={fill} fillOpacity={0.18}
                  stroke={fill} strokeWidth={2}
                />
                <text
                  x={table.x + table.width / 2}
                  y={table.y + table.height / 2 + 4}
                  textAnchor="middle"
                  fontSize="11" fontWeight="600" fill={fill}
                >
                  {table.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
