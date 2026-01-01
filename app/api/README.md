# API Routes

This directory contains Next.js API routes for the application.

## Structure

- `/auth` - Authentication endpoints (login, register, logout)
- `/reports` - Vehicle valuation report endpoints (create, retrieve, update)
- `/payments` - Stripe payment processing endpoints
- `/webhooks` - Stripe webhook handlers

## Authentication

All API routes (except public endpoints) should be protected with Supabase authentication middleware.

## Example

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Your route logic here
}
```
