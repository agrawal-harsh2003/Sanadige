import { getTodayCatchDefinition } from './get-today-catch'
import { checkFloorAvailabilityDefinition } from './check-floor-availability'
import { createBookingDefinition } from './create-booking'
import { getMenuItemDetailDefinition } from './get-menu-item-detail'

export const toolDefinitions = [
  getTodayCatchDefinition,
  checkFloorAvailabilityDefinition,
  createBookingDefinition,
  getMenuItemDetailDefinition,
]

export { getTodayCatch } from './get-today-catch'
export { checkFloorAvailability } from './check-floor-availability'
export { createBooking } from './create-booking'
export { getMenuItemDetail } from './get-menu-item-detail'
