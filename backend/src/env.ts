import { z } from 'zod'

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  WHATSAPP_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  INSTAGRAM_PAGE_ACCESS_TOKEN: z.string().min(1),
  INSTAGRAM_VERIFY_TOKEN: z.string().min(1),
  SWIFTBOOK_API_KEY: z.string().min(1).optional(),
  SWIFTBOOK_PROPERTY_ID: z.string().min(1).optional(),
  MANAGER_PHONE: z.string().min(1).optional(),
  PORT: z.coerce.number().default(3000),
})

export const env = schema.parse(process.env)
