import { StaffMember } from './staff'
import { IncomingMessage } from '../webhooks/normalise'
import { sendWhatsAppMessage, sendButtons, sendList, sendBookingConfirmationTemplate } from '../lib/whatsapp'
import { supabase } from '../lib/supabase'
import { env } from '../env'
import { notifyStaffOfBooking } from './reminder'

// ── Session ───────────────────────────────────────────────────────────────────

interface Session {
  step: string
  data: Record<string, string>
}

const sessions = new Map<string, Session>()

const getSession = (phone: string): Session =>
  sessions.get(phone) ?? { step: 'idle', data: {} }

const advance = (phone: string, step: string, extra: Record<string, string> = {}): void => {
  const prev = sessions.get(phone) ?? { step: 'idle', data: {} }
  sessions.set(phone, { step, data: { ...prev.data, ...extra } })
}

const reset = (phone: string): void => {
  sessions.set(phone, { step: 'idle', data: {} })
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const istDate = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

function generateRef(): string {
  return 'SND-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}


function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${(h % 12 || 12)}:${m.toString().padStart(2, '0')} ${ampm}`
}

function fmtDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function statusLabel(s: string): string {
  return s === 'available' ? '✅ Available' : s === 'sold_out' ? '❌ Sold Out' : '🔜 Tomorrow'
}

function floorLabel(f: string): string {
  const map: Record<string, string> = { terrace: 'Terrace', floor1: 'Floor 1', floor2: 'Floor 2', private: 'Private Room' }
  return map[f] ?? f
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function handleStaffMenu(msg: IncomingMessage, staff: StaffMember): Promise<void> {
  const id = msg.interactiveId ?? ''
  const text = msg.text.trim().toLowerCase()
  const session = getSession(msg.senderId)

  // Global reset — any of these words sends staff back to main menu
  if (['menu', 'hi', 'hello', 'home', 'start', '/menu', '0'].includes(text) || id === 'back_main') {
    reset(msg.senderId)
    return showMainMenu(msg.senderId, staff)
  }

  try {
    switch (session.step) {
      case 'idle':           return handleIdle(msg, id, staff)
      case 'catch_item':     return handleCatchItem(msg, id, session, staff)
      case 'catch_status':   return handleCatchStatus(msg, id, session, staff)
      case 'staff_sub':      return handleStaffSub(msg, id, staff)
      case 'staff_add_role': return handleAddRole(msg, id, session, staff)
      case 'staff_add_name': return handleAddName(msg, session, staff)
      case 'staff_add_phone':return handleAddPhone(msg, session, staff)
      case 'staff_rem_pick': return handleRemovePick(msg, id, session, staff)
      case 'staff_rem_ok':   return handleRemoveOk(msg, id, session, staff)
      case 'book_sub':       return handleBookSub(msg, id, staff)
      case 'book_name':      return handleBookName(msg, session, staff)
      case 'book_phone':     return handleBookPhone(msg, session, staff)
      case 'book_party':     return handleBookParty(msg, id, session, staff)
      case 'book_date':      return handleBookDate(msg, id, session, staff)
      case 'book_time':      return handleBookTime(msg, id, session, staff)
      case 'book_floor':     return handleBookFloor(msg, id, session, staff)
      case 'book_confirm':   return handleBookConfirm(msg, id, session, staff)
      default:
        reset(msg.senderId)
        return showMainMenu(msg.senderId, staff)
    }
  } catch (err) {
    console.error('[staff-menu]', err)
    reset(msg.senderId)
    await sendWhatsAppMessage(msg.senderId, '❌ Something went wrong. Returning to main menu.')
    return showMainMenu(msg.senderId, staff)
  }
}

// ── Main Menu ─────────────────────────────────────────────────────────────────

async function showMainMenu(to: string, staff: StaffMember): Promise<void> {
  const greet = `👋 Hi ${staff.name}!`

  if (staff.role === 'chef') {
    return sendButtons(to, `${greet}\n\nWhat would you like to do?`, [
      { id: 'main_catch', title: 'Update Catch' },
      { id: 'main_help', title: 'Help & Guide' },
    ])
  }

  if (staff.role === 'host') {
    return sendButtons(to, `${greet}\n\nWhat would you like to do?`, [
      { id: 'main_bookings', title: 'Bookings' },
      { id: 'main_help', title: 'Help & Guide' },
    ])
  }

  if (staff.role === 'waiter') {
    return sendButtons(to, `${greet}\n\nWhat would you like to do?`, [
      { id: 'main_bookings', title: 'View Bookings' },
      { id: 'main_help', title: 'Help & Guide' },
    ])
  }

  // manager — list message fits more options
  return sendList(to, `${greet}\n\nWhat would you like to do?`, 'Open Menu', [
    {
      title: 'Operations',
      rows: [
        { id: 'main_catch', title: "Today's Catch", description: 'Update fish availability' },
        { id: 'main_bookings', title: 'Bookings', description: 'View or create bookings' },
        { id: 'main_staff', title: 'Staff', description: 'Add, remove, or view staff' },
      ],
    },
    {
      title: 'Other',
      rows: [{ id: 'main_help', title: 'Help & Guide', description: 'How to use this panel' }],
    },
  ])
}

async function handleIdle(msg: IncomingMessage, id: string, staff: StaffMember): Promise<void> {
  if (id === 'main_catch') return showCatchList(msg.senderId, staff)
  if (id === 'main_bookings') return showBookingsSub(msg.senderId, staff)
  if (id === 'bk_view') return viewBookings(msg.senderId, staff)
  if (id === 'bk_create') return startBooking(msg.senderId)
  if (id === 'main_staff' && staff.role === 'manager') return showStaffSub(msg.senderId)
  if (id === 'ss_add') return startAddStaff(msg.senderId)
  if (id === 'ss_remove') return startRemoveStaff(msg.senderId)
  if (id === 'ss_view') return showStaffView(msg.senderId, staff)
  if (id === 'main_help') return showHelp(msg.senderId, staff)
  return showMainMenu(msg.senderId, staff)
}

// ── Help ──────────────────────────────────────────────────────────────────────

async function showHelp(to: string, staff: StaffMember): Promise<void> {
  const guide: Record<string, string> = {
    waiter: `📖 *Waiter Guide*\n\n*View bookings:*\nTap "View Bookings" → "View Today" to see tonight's reservations — guest name, table, party size, and time.\n\n*Taking an order:*\nUse the QR menu orders board on the dashboard to see incoming orders and update their status.\n\n*Status colours (dashboard):*\n🟡 Confirmed — guest not yet arrived\n🟢 Seated — guest is at the table\n\n*Dashboard:* dashboard.sanadige.in\n\nType *menu* anytime to come back here.`,
    chef: `📖 *Chef Guide*\n\n*Update today's catch:*\nTap "Update Catch" → choose a fish from the list → choose its status:\n✅ Available — in stock today\n❌ Sold Out — ran out\n🔜 Tomorrow — arriving tomorrow\n\nYou can update the same fish multiple times a day.\n\n*Dashboard:* dashboard.sanadige.in\n\nType *menu* anytime to come back here.`,
    host: `📖 *Host Guide*\n\n*View bookings:*\nTap "Bookings" → "View Today" to see all bookings.\n\n*Create a booking:*\nTap "Bookings" → "New Booking" and follow the steps — guest name, phone, party size, date, time, and area.\n\n*Status colours (dashboard):*\n🟡 Confirmed — not yet arrived\n🟢 Seated — guest is at the table\n🔴 Cancelled\n\n*Dashboard:* dashboard.sanadige.in (full floor map + booking management)\n\nType *menu* anytime to come back here.`,
    manager: `📖 *Manager Guide*\n\n*Today's Catch:* Mark fish available, sold out, or arriving tomorrow.\n\n*Bookings:* View today's bookings or create a new one step by step.\n\n*Staff:*\n• Add Staff — pick a role, enter name + number. They'll get an automatic welcome message.\n• Remove Staff — choose from the team list and confirm.\n• View Staff — full team roster.\n\n*Dashboard:* dashboard.sanadige.in — Mission Control, analytics, floor map, full management UI.\n\nType *menu* anytime to come back here.`,
  }

  await sendWhatsAppMessage(to, guide[staff.role])
  return sendButtons(to, 'What would you like to do?', [{ id: 'back_main', title: 'Main Menu' }])
}

// ── Catch ─────────────────────────────────────────────────────────────────────

async function showCatchList(to: string, staff: StaffMember): Promise<void> {
  const today = istDate()
  const [itemsRes, availRes] = await Promise.all([
    supabase.from('catch_items').select('id, name').order('name'),
    supabase.from('daily_availability').select('catch_item_id, status').eq('date', today),
  ])

  const items = itemsRes.data ?? []
  if (items.length === 0) {
    await sendWhatsAppMessage(to, 'No items in the catalogue. Add fish via the dashboard first.')
    reset(to)
    return sendButtons(to, 'What would you like to do?', [{ id: 'back_main', title: 'Main Menu' }])
  }

  const statusMap = new Map((availRes.data ?? []).map(a => [a.catch_item_id, a.status as string]))

  advance(to, 'catch_item')
  return sendList(to, `🐟 *Today's Catch*\n\nSelect a fish to update its status:`, 'Choose Fish', [{
    title: 'Catalogue',
    rows: items.slice(0, 10).map(item => ({
      id: `ci_${item.id}`,
      title: item.name.slice(0, 24),
      description: statusMap.has(item.id) ? statusLabel(statusMap.get(item.id)!) : 'Not set today',
    })),
  }])
}

async function handleCatchItem(
  msg: IncomingMessage, id: string, _session: Session, staff: StaffMember
): Promise<void> {
  if (!id.startsWith('ci_')) {
    await sendWhatsAppMessage(msg.senderId, '⚠️ Please choose a fish from the list.')
    return showCatchList(msg.senderId, staff)
  }

  const catchItemId = id.replace('ci_', '')
  const { data } = await supabase.from('catch_items').select('name').eq('id', catchItemId).single()
  if (!data) {
    await sendWhatsAppMessage(msg.senderId, '❌ Fish not found.')
    return showCatchList(msg.senderId, staff)
  }

  advance(msg.senderId, 'catch_status', { catchItemId, catchItemName: data.name })
  return sendButtons(msg.senderId,
    `*${data.name}*\n\nWhat is its status today?`,
    [
      { id: 'cs_available', title: 'Available' },
      { id: 'cs_sold_out', title: 'Sold Out' },
      { id: 'cs_tomorrow', title: 'Tomorrow' },
    ]
  )
}

async function handleCatchStatus(
  msg: IncomingMessage, id: string, session: Session, staff: StaffMember
): Promise<void> {
  const map: Record<string, string> = { cs_available: 'available', cs_sold_out: 'sold_out', cs_tomorrow: 'tomorrow' }
  const status = map[id]
  if (!status) {
    return sendButtons(msg.senderId,
      `*${session.data.catchItemName}* — choose status:`,
      [
        { id: 'cs_available', title: 'Available' },
        { id: 'cs_sold_out', title: 'Sold Out' },
        { id: 'cs_tomorrow', title: 'Tomorrow' },
      ]
    )
  }

  const { error } = await supabase.from('daily_availability').upsert(
    {
      catch_item_id: session.data.catchItemId,
      date: istDate(),
      status,
      updated_by: msg.senderId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'catch_item_id,date' }
  )
  if (error) throw error

  await sendWhatsAppMessage(msg.senderId, `✓ *${session.data.catchItemName}* → ${statusLabel(status)}`)
  reset(msg.senderId)
  return sendButtons(msg.senderId, 'What next?', [
    { id: 'main_catch', title: 'Update Another' },
    { id: 'back_main', title: 'Main Menu' },
  ])
}

// ── Staff ─────────────────────────────────────────────────────────────────────

async function showStaffSub(to: string): Promise<void> {
  advance(to, 'staff_sub')
  return sendButtons(to, '👥 *Staff Management*\n\nWhat would you like to do?', [
    { id: 'ss_add', title: 'Add Staff' },
    { id: 'ss_remove', title: 'Remove Staff' },
    { id: 'ss_view', title: 'View All Staff' },
  ])
}

async function handleStaffSub(msg: IncomingMessage, id: string, staff: StaffMember): Promise<void> {
  if (id === 'ss_add') return startAddStaff(msg.senderId)
  if (id === 'ss_remove') return startRemoveStaff(msg.senderId)
  if (id === 'ss_view') return showStaffView(msg.senderId, staff)
  return showStaffSub(msg.senderId)
}

// View
async function showStaffView(to: string, staff: StaffMember): Promise<void> {
  const { data } = await supabase.from('staff').select('name, role, phone').order('role')
  if (!data || data.length === 0) {
    await sendWhatsAppMessage(to, 'No staff registered yet.')
  } else {
    const icon: Record<string, string> = { manager: '👔', chef: '👨‍🍳', host: '🙋', waiter: '🍽️' }
    const lines = data.map(s => `${icon[s.role] ?? '•'} *${s.name}* (${s.role})\n   ${s.phone}`)
    await sendWhatsAppMessage(to, `👥 *Team (${data.length})*\n\n${lines.join('\n\n')}`)
  }
  reset(to)
  return sendButtons(to, 'What would you like to do?', [
    { id: 'main_staff', title: 'Staff Menu' },
    { id: 'back_main', title: 'Main Menu' },
  ])
}

// Add — step 1: role
async function startAddStaff(to: string): Promise<void> {
  advance(to, 'staff_add_role')
  return sendList(to, '➕ *Add Staff*\n\nWhat role will this person have?', 'Choose Role', [{
    title: 'Roles',
    rows: [
      { id: 'role_chef', title: 'Chef', description: 'Updates catch availability' },
      { id: 'role_host', title: 'Host', description: 'Manages bookings & floor' },
      { id: 'role_waiter', title: 'Waiter', description: 'Takes orders, views bookings' },
      { id: 'role_manager', title: 'Manager', description: 'Full access' },
    ],
  }])
}

async function handleAddRole(
  msg: IncomingMessage, id: string, _session: Session, _staff: StaffMember
): Promise<void> {
  const roles: Record<string, string> = { role_chef: 'chef', role_host: 'host', role_manager: 'manager', role_waiter: 'waiter' }
  const role = roles[id]
  if (!role) return startAddStaff(msg.senderId)

  advance(msg.senderId, 'staff_add_name', { newRole: role })
  await sendWhatsAppMessage(msg.senderId, `What is the new *${role}'s full name*?`)
}

// Add — step 2: name
async function handleAddName(msg: IncomingMessage, session: Session, _staff: StaffMember): Promise<void> {
  const name = msg.text.trim()
  if (name.length < 2) {
    await sendWhatsAppMessage(msg.senderId, '⚠️ Please enter a valid name.')
    return sendButtons(msg.senderId, `What is the new *${session.data.newRole}'s full name*?`, [
      { id: 'back_main', title: 'Main Menu' },
    ])
  }

  advance(msg.senderId, 'staff_add_phone', { newName: name })
  await sendWhatsAppMessage(
    msg.senderId,
    `What is *${name}'s WhatsApp number*?\n\nEnter with country code, digits only.\nExample: *919876543210*\n\nType *menu* to cancel.`
  )
}

// Add — step 3: phone → save + notify
async function handleAddPhone(msg: IncomingMessage, session: Session, staff: StaffMember): Promise<void> {
  const phone = msg.text.trim().replace(/[\s\-\+()]/g, '')
  if (!/^\d{10,15}$/.test(phone)) {
    await sendWhatsAppMessage(
      msg.senderId,
      '⚠️ Invalid number. Digits only with country code (e.g. *919876543210*).'
    )
    return sendButtons(msg.senderId, `What is *${session.data.newName}'s WhatsApp number*?`, [
      { id: 'back_main', title: 'Main Menu' },
    ])
  }

  const { newName, newRole } = session.data
  const { error } = await supabase
    .from('staff')
    .upsert({ phone, name: newName, role: newRole, added_by: msg.senderId }, { onConflict: 'phone' })
  if (error) throw error

  await sendWhatsAppMessage(msg.senderId, `✅ *${newName}* added as *${newRole}*.`)

  // Welcome message to new staff member
  const welcome: Record<string, string> = {
    chef: `👋 Hi ${newName}! Welcome to *Sanadige Delhi*.\n\nYou've been added as *Chef* 👨‍🍳\n\n*What you can do here:*\nUpdate today's catch availability directly from WhatsApp — no app needed.\n\n*How it works:*\nJust type *menu* to open your panel. You'll see a list of fish and can mark each one as available, sold out, or arriving tomorrow — all with buttons.\n\n*Dashboard (web):* dashboard.sanadige.in\nAsk your manager for login help if needed.\n\nType *menu* to get started! 🐟`,
    host: `👋 Hi ${newName}! Welcome to *Sanadige Delhi*.\n\nYou've been added as *Host* 🙋\n\n*What you can do here:*\n• View today's bookings\n• Create new bookings step by step\n\nType *menu* to open your panel.\n\n*Dashboard (web):* dashboard.sanadige.in — full booking management, floor map, and more.\n\nType *menu* to get started!`,
    waiter: `👋 Hi ${newName}! Welcome to *Sanadige Delhi*.\n\nYou've been added as *Waiter* 🍽️\n\n*What you can do here:*\n• View tonight's reservations by table\n• Check incoming QR menu orders on the dashboard\n\nType *menu* to open your panel.\n\n*Dashboard (web):* dashboard.sanadige.in\n\nType *menu* to get started!`,
    manager: `👋 Hi ${newName}! Welcome to *Sanadige Delhi*.\n\nYou've been added as *Manager* 👔\n\n*You have full access:*\n🐟 Update today's catch\n📋 View and create bookings\n👥 Add, remove, and view staff\n\nType *menu* to open your panel.\n\n*Dashboard (web):* dashboard.sanadige.in — Mission Control, analytics, floor map, and everything else.\n\nType *menu* to get started!`,
  }
  // Fire and forget — new staff may not have messaged the bot yet (WhatsApp 24h window)
  sendWhatsAppMessage(phone, welcome[newRole ?? 'host']).catch(() =>
    console.warn(`[staff-menu] Could not send welcome to ${phone} — they may need to message the bot first`)
  )

  reset(msg.senderId)
  return sendButtons(msg.senderId, 'What next?', [
    { id: 'ss_add', title: 'Add Another' },
    { id: 'main_staff', title: 'Staff Menu' },
    { id: 'back_main', title: 'Main Menu' },
  ])
}

// Remove — step 1: pick person
async function startRemoveStaff(to: string): Promise<void> {
  const { data } = await supabase.from('staff').select('phone, name, role').order('role')
  const removable = (data ?? []).filter(s => s.phone !== env.MANAGER_PHONE)

  if (removable.length === 0) {
    await sendWhatsAppMessage(to, 'No staff to remove (the primary manager cannot be removed).')
    reset(to)
    return sendButtons(to, 'What would you like to do?', [{ id: 'back_main', title: 'Main Menu' }])
  }

  advance(to, 'staff_rem_pick')
  return sendList(to, '🗑️ *Remove Staff*\n\nSelect the person to remove:', 'Choose Staff', [{
    title: 'Team',
    rows: removable.slice(0, 10).map(s => ({
      id: `rem_${s.phone}`,
      title: s.name.slice(0, 24),
      description: s.role,
    })),
  }])
}

async function handleRemovePick(
  msg: IncomingMessage, id: string, _session: Session, _staff: StaffMember
): Promise<void> {
  if (!id.startsWith('rem_')) {
    await sendWhatsAppMessage(msg.senderId, '⚠️ Please choose a person from the list.')
    return startRemoveStaff(msg.senderId)
  }

  const phone = id.replace('rem_', '')
  const { data } = await supabase.from('staff').select('name, role').eq('phone', phone).single()
  if (!data) {
    await sendWhatsAppMessage(msg.senderId, '❌ Staff member not found.')
    return startRemoveStaff(msg.senderId)
  }

  advance(msg.senderId, 'staff_rem_ok', { removePhone: phone, removeName: data.name, removeRole: data.role })
  return sendButtons(msg.senderId,
    `Remove *${data.name}* (${data.role}) from the team?\n\nThis cannot be undone.`,
    [
      { id: 'rem_yes', title: 'Yes, Remove' },
      { id: 'rem_cancel', title: 'Cancel' },
    ]
  )
}

async function handleRemoveOk(
  msg: IncomingMessage, id: string, session: Session, staff: StaffMember
): Promise<void> {
  if (id === 'rem_cancel') {
    await sendWhatsAppMessage(msg.senderId, '↩️ Cancelled.')
    reset(msg.senderId)
    return showMainMenu(msg.senderId, staff)
  }
  if (id !== 'rem_yes') {
    return sendButtons(msg.senderId,
      `Remove *${session.data.removeName}*?`,
      [{ id: 'rem_yes', title: 'Yes, Remove' }, { id: 'rem_cancel', title: 'Cancel' }]
    )
  }

  const { error } = await supabase.from('staff').delete().eq('phone', session.data.removePhone)
  if (error) throw error

  await sendWhatsAppMessage(msg.senderId, `✅ *${session.data.removeName}* has been removed.`)
  reset(msg.senderId)
  return sendButtons(msg.senderId, 'What next?', [
    { id: 'main_staff', title: 'Staff Menu' },
    { id: 'back_main', title: 'Main Menu' },
  ])
}

// ── Bookings ──────────────────────────────────────────────────────────────────

async function showBookingsSub(to: string, _staff: StaffMember): Promise<void> {
  advance(to, 'book_sub')
  return sendButtons(to, '📋 *Bookings*', [
    { id: 'bk_view', title: 'View Today' },
    { id: 'bk_create', title: 'New Booking' },
  ])
}

async function handleBookSub(
  msg: IncomingMessage, id: string, staff: StaffMember
): Promise<void> {
  if (id === 'bk_view') return viewBookings(msg.senderId, staff)
  if (id === 'bk_create') return startBooking(msg.senderId)
  return showBookingsSub(msg.senderId, staff)
}

async function viewBookings(to: string, staff: StaffMember): Promise<void> {
  const today = istDate()
  const { data } = await supabase
    .from('bookings')
    .select('booking_ref, guest_name, party_size, datetime, floor, status')
    .gte('datetime', `${today}T00:00:00`)
    .lte('datetime', `${today}T23:59:59`)
    .order('datetime')

  if (!data || data.length === 0) {
    await sendWhatsAppMessage(to, '📋 No bookings for today yet.')
  } else {
    const icon: Record<string, string> = { confirmed: '🟡', seated: '🟢', cancelled: '🔴', no_show: '⚫' }
    const lines = data.map(b => {
      const t = fmtTime(b.datetime.split('T')[1]?.slice(0, 5) ?? '00:00')
      return `${icon[b.status] ?? '•'} *${b.guest_name}* × ${b.party_size} | ${t}\n   ${b.floor} · ${b.booking_ref}`
    })
    await sendWhatsAppMessage(to, `📋 *Today's Bookings (${data.length})*\n\n${lines.join('\n\n')}`)
  }

  reset(to)
  return sendButtons(to, 'What next?', [
    { id: 'bk_create', title: 'New Booking' },
    { id: 'back_main', title: 'Main Menu' },
  ])
}

// Create Booking — 6 steps
async function startBooking(to: string): Promise<void> {
  advance(to, 'book_name')
  await sendWhatsAppMessage(to, '📝 *New Booking*\n\n*Step 1 of 6*\nWhat is the guest\'s full name?')
}

async function handleBookName(msg: IncomingMessage, session: Session, _staff: StaffMember): Promise<void> {
  const name = msg.text.trim()
  if (name.length < 2) {
    await sendWhatsAppMessage(msg.senderId, '⚠️ Please enter a valid name.')
    return sendButtons(msg.senderId, '*Step 1 of 6*\nWhat is the guest\'s full name?', [
      { id: 'back_main', title: 'Main Menu' },
    ])
  }
  advance(msg.senderId, 'book_phone', { bkName: name })
  await sendWhatsAppMessage(
    msg.senderId,
    `*Step 2 of 6*\nGuest's WhatsApp number?\n\nDigits only with country code.\nExample: *919876543210*\n\nType *menu* to cancel.`
  )
}

async function handleBookPhone(msg: IncomingMessage, session: Session, _staff: StaffMember): Promise<void> {
  const phone = msg.text.trim().replace(/[\s\-\+()]/g, '')
  if (!/^\d{10,15}$/.test(phone)) {
    await sendWhatsAppMessage(msg.senderId, '⚠️ Invalid number. Digits only with country code.')
    return sendButtons(msg.senderId, `*Step 2 of 6*\nGuest's WhatsApp number? (e.g. *919876543210*)`, [
      { id: 'back_main', title: 'Main Menu' },
    ])
  }
  advance(msg.senderId, 'book_party', { bkPhone: phone })
  return sendList(msg.senderId, `*Step 3 of 6*\nHow many guests?`, 'Select', [
    {
      title: 'Small Party',
      rows: [
        { id: 'ps_1', title: '1 person' },
        { id: 'ps_2', title: '2 people' },
        { id: 'ps_3', title: '3 people' },
        { id: 'ps_4', title: '4 people' },
        { id: 'ps_5', title: '5 people' },
      ],
    },
    {
      title: 'Large Party',
      rows: [
        { id: 'ps_6', title: '6 people' },
        { id: 'ps_7', title: '7 people' },
        { id: 'ps_8', title: '8 people' },
        { id: 'ps_10', title: '10 people' },
        { id: 'ps_12', title: '12 people' },
      ],
    },
  ])
}

async function handleBookParty(
  msg: IncomingMessage, id: string, session: Session, _staff: StaffMember
): Promise<void> {
  const pMap: Record<string, string> = {
    ps_1: '1', ps_2: '2', ps_3: '3', ps_4: '4', ps_5: '5',
    ps_6: '6', ps_7: '7', ps_8: '8', ps_10: '10', ps_12: '12',
  }

  const party = pMap[id]
  if (!party) {
    return sendList(msg.senderId, `*Step 3 of 6*\nHow many guests?`, 'Select', [
      {
        title: 'Small Party',
        rows: [
          { id: 'ps_1', title: '1 person' },
          { id: 'ps_2', title: '2 people' },
          { id: 'ps_3', title: '3 people' },
          { id: 'ps_4', title: '4 people' },
          { id: 'ps_5', title: '5 people' },
        ],
      },
      {
        title: 'Large Party',
        rows: [
          { id: 'ps_6', title: '6 people' },
          { id: 'ps_7', title: '7 people' },
          { id: 'ps_8', title: '8 people' },
          { id: 'ps_10', title: '10 people' },
          { id: 'ps_12', title: '12 people' },
        ],
      },
    ])
  }

  advance(msg.senderId, 'book_date', { bkParty: party })
  return showDatePicker(msg.senderId)
}

function showDatePicker(to: string): Promise<void> {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const rows = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const iso = d.toLocaleDateString('en-CA')
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    return { id: `bd_${iso}`, title: label }
  })
  return sendList(to, `*Step 4 of 6*\nWhat date is the booking?`, 'Select Date', [{
    title: 'Upcoming Dates',
    rows,
  }])
}

async function handleBookDate(
  msg: IncomingMessage, id: string, session: Session, _staff: StaffMember
): Promise<void> {
  if (!id.startsWith('bd_')) return showDatePicker(msg.senderId)

  const date = id.replace('bd_', '')
  advance(msg.senderId, 'book_time', { bkDate: date })
  return showTimePicker(msg.senderId)
}

function showTimePicker(to: string): Promise<void> {
  return sendList(to, `*Step 5 of 6*\nWhat time?`, 'Select Time', [
    {
      title: 'Lunch',
      rows: [
        { id: 'bt_12:00', title: '12:00 PM (noon)' },
        { id: 'bt_12:30', title: '12:30 PM' },
        { id: 'bt_13:00', title: '1:00 PM' },
        { id: 'bt_13:30', title: '1:30 PM' },
      ],
    },
    {
      title: 'Dinner',
      rows: [
        { id: 'bt_19:00', title: '7:00 PM' },
        { id: 'bt_19:30', title: '7:30 PM' },
        { id: 'bt_20:00', title: '8:00 PM' },
        { id: 'bt_20:30', title: '8:30 PM' },
        { id: 'bt_21:00', title: '9:00 PM' },
        { id: 'bt_21:30', title: '9:30 PM' },
      ],
    },
  ])
}

async function handleBookTime(
  msg: IncomingMessage, id: string, session: Session, _staff: StaffMember
): Promise<void> {
  if (!id.startsWith('bt_')) return showTimePicker(msg.senderId)

  const time = id.replace('bt_', '')
  advance(msg.senderId, 'book_floor', { bkTime: time })
  return sendList(msg.senderId, `*Step 6 of 6*\nWhich area?`, 'Select Area', [{
    title: 'Seating Areas',
    rows: [
      { id: 'fl_terrace', title: 'Terrace', description: '25 seats · open air' },
      { id: 'fl_floor1', title: 'Floor 1', description: '40 seats · indoor' },
      { id: 'fl_floor2', title: 'Floor 2', description: '35 seats · indoor' },
      { id: 'fl_private', title: 'Private Room', description: '12 seats · private' },
    ],
  }])
}

async function handleBookFloor(
  msg: IncomingMessage, id: string, session: Session, _staff: StaffMember
): Promise<void> {
  const floorMap: Record<string, string> = {
    fl_terrace: 'terrace',
    fl_floor1: 'floor1',
    fl_floor2: 'floor2',
    fl_private: 'private',
  }
  const floor = floorMap[id]
  if (!floor) {
    await sendWhatsAppMessage(msg.senderId, '⚠️ Please select an area from the list.')
    return sendList(msg.senderId, `*Step 6 of 6*\nWhich area?`, 'Select Area', [{
      title: 'Seating Areas',
      rows: [
        { id: 'fl_terrace', title: 'Terrace', description: '25 seats · open air' },
        { id: 'fl_floor1', title: 'Floor 1', description: '40 seats · indoor' },
        { id: 'fl_floor2', title: 'Floor 2', description: '35 seats · indoor' },
        { id: 'fl_private', title: 'Private Room', description: '12 seats · private' },
      ],
    }])
  }

  advance(msg.senderId, 'book_confirm', { bkFloor: floor })
  const { bkName, bkPhone, bkParty, bkDate, bkTime } = session.data
  const dispDate = fmtDate(bkDate)
  const dispTime = fmtTime(bkTime)

  return sendButtons(msg.senderId,
    `*Booking Summary*\n\n👤 ${bkName}\n📱 ${bkPhone}\n👥 ${bkParty} guests\n📅 ${dispDate}\n🕐 ${dispTime}\n📍 ${floorLabel(floor)}\n\nConfirm?`,
    [
      { id: 'bk_confirm', title: 'Confirm Booking' },
      { id: 'bk_discard', title: 'Discard' },
    ]
  )
}

async function handleBookConfirm(
  msg: IncomingMessage, id: string, session: Session, staff: StaffMember
): Promise<void> {
  if (id === 'bk_discard') {
    await sendWhatsAppMessage(msg.senderId, '↩️ Booking discarded.')
    reset(msg.senderId)
    return showMainMenu(msg.senderId, staff)
  }

  if (id !== 'bk_confirm') {
    return sendButtons(msg.senderId, 'Confirm this booking?', [
      { id: 'bk_confirm', title: 'Confirm Booking' },
      { id: 'bk_discard', title: 'Discard' },
    ])
  }

  const { bkName, bkPhone, bkParty, bkDate, bkTime, bkFloor } = session.data
  const bookingRef = generateRef()

  const { error } = await supabase.from('bookings').insert({
    booking_ref: bookingRef,
    guest_name: bkName,
    phone: bkPhone,
    whatsapp_id: bkPhone,
    party_size: parseInt(bkParty),
    datetime: `${bkDate}T${bkTime}:00`,
    floor: bkFloor,
    status: 'confirmed',
  })
  if (error) throw error

  const dispDate = fmtDate(bkDate)
  const dispTime = fmtTime(bkTime)

  await sendWhatsAppMessage(
    msg.senderId,
    `✅ Booking confirmed!\n\n*Ref:* ${bookingRef}\n👤 ${bkName} × ${bkParty}\n📅 ${dispDate} at ${dispTime}\n📍 ${floorLabel(bkFloor)}`
  )

  // Guest confirmation via approved template — works even if guest has never messaged the bot
  sendBookingConfirmationTemplate(bkPhone, {
    name: bkName,
    date: dispDate,
    time: dispTime,
    party: bkParty,
    floor: floorLabel(bkFloor),
    ref: bookingRef,
  }).catch(err => console.warn('[staff-menu] Guest confirmation failed:', err?.message ?? err))

  // Notify other managers/hosts of the new booking
  notifyStaffOfBooking({
    guestName: bkName,
    partySize: bkParty,
    date: dispDate,
    time: dispTime,
    floor: bkFloor,
    ref: bookingRef,
    createdBy: staff.name,
  }).catch(() => {})

  reset(msg.senderId)
  return sendButtons(msg.senderId, 'What next?', [
    { id: 'bk_create', title: 'New Booking' },
    { id: 'back_main', title: 'Main Menu' },
  ])
}
