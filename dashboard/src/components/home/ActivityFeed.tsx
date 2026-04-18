interface Activity {
  id: string
  description: string
  event_type: string
  created_at: string
}

const EVENT_ICONS: Record<string, string> = {
  catch_update: '🐟',
  booking_new: '📋',
  booking_status: '✓',
  staff_change: '👤',
  whatsapp_query: '💬',
}

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-sm font-semibold text-[#1a2e1a] mb-4">Activity</p>
      <div className="space-y-3">
        {activities.map(a => (
          <div key={a.id} className="flex items-start gap-3">
            <span className="text-base">{EVENT_ICONS[a.event_type] ?? '•'}</span>
            <div>
              <p className="text-sm text-[#1a2e1a]">{a.description}</p>
              <p className="text-xs text-text-muted">
                {new Date(a.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {activities.length === 0 && <p className="text-sm text-text-muted">No recent activity</p>}
      </div>
    </div>
  )
}
