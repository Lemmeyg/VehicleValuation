import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db/supabase'

/**
 * POST /api/contact
 *
 * Handles contact form submissions from the footer
 * Stores messages in Supabase for admin review
 */
export async function POST(request: NextRequest) {
  try {
    const { email, message } = await request.json()

    // Validation
    if (!email || !message) {
      return NextResponse.json({ error: 'Email and message are required' }, { status: 400 })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Message length validation
    if (message.length < 10) {
      return NextResponse.json({ error: 'Message must be at least 10 characters' }, { status: 400 })
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'Message must be less than 2000 characters' },
        { status: 400 }
      )
    }

    // Use simple server-side supabase client for contact form (no auth needed)

    // Insert contact message into database
    const { error: insertError } = await supabase.from('contact_messages').insert({
      email,
      message,
      status: 'unread',
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error('[Contact API] Database error:', insertError)
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
    }

    return NextResponse.json(
      { success: true, message: 'Message sent successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Contact API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
