import { z } from 'zod'

const schema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),
  WHATSAPP_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  MANAGER_PHONE: z.string().min(1).optional(),
  MANAGER_NAME: z.string().min(1).optional(),
  PORT: z.coerce.number().default(3000),
})

export const env = schema.parse(process.env)
