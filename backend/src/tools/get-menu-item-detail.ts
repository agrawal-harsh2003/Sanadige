import { supabase } from '../lib/supabase'

export async function getMenuItemDetail(itemName: string): Promise<string> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('name, description, price, allergens, spice_level, is_available')
    .ilike('name', `%${itemName}%`)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return `No menu item found matching "${itemName}". Check the menu for available dishes.`

  return data.map((item: Record<string, unknown>) => {
    const allergens = Array.isArray(item.allergens) ? (item.allergens as string[]).join(', ') : 'none'
    const spice = item.spice_level ?? 'unrated'
    return `${item.name}: ${item.description}. Price: ₹${item.price}. Spice: ${spice}/5. Allergens: ${allergens}. ${item.is_available ? 'Available' : 'Not available today'}.`
  }).join('\n')
}

export const getMenuItemDetailDefinition = {
  name: 'get_menu_item_detail',
  description: 'Get detailed information about a specific menu item including description, price, allergens, and spice level. Call when a customer asks about a specific dish not covered by the catch system.',
  input_schema: {
    type: 'object' as const,
    properties: {
      item_name: { type: 'string', description: 'Name of the dish to look up' },
    },
    required: ['item_name'],
  },
}
