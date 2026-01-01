'use client'

/**
 * Admin Contact Messages Page
 *
 * Allows admin users to view and manage contact form submissions
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/supabase-client'

interface ContactMessage {
  id: string
  email: string
  message: string
  status: 'unread' | 'read' | 'replied' | 'archived'
  created_at: string
  updated_at: string
  admin_notes: string | null
}

export default function ContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true)
      const supabase = createClient()

      let query = supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching messages:', error)
        setLoading(false)
        return
      }

      setMessages(data || [])
      setLoading(false)
    }

    fetchMessages()
  }, [filter, refreshTrigger])

  const updateMessageStatus = async (id: string, status: ContactMessage['status']) => {
    const supabase = createClient()
    const { error } = await supabase.from('contact_messages').update({ status }).eq('id', id)

    if (!error) {
      setRefreshTrigger(prev => prev + 1)
      if (selectedMessage?.id === id) {
        setSelectedMessage({ ...selectedMessage, status })
      }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Contact Messages</h1>
          <p className="text-slate-600">View and manage contact form submissions</p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2">
          {['all', 'unread', 'read', 'replied', 'archived'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === tab
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'all' && ` (${messages.length})`}
              {tab === 'unread' && ` (${messages.filter(m => m.status === 'unread').length})`}
            </button>
          ))}
        </div>

        {/* Messages Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Messages List */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Messages</h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-500">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No messages found</div>
              ) : (
                messages.map(message => (
                  <div
                    key={message.id}
                    onClick={() => setSelectedMessage(message)}
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                      selectedMessage?.id === message.id ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium text-slate-900">{message.email}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          message.status === 'unread'
                            ? 'bg-blue-100 text-blue-700'
                            : message.status === 'read'
                              ? 'bg-slate-100 text-slate-700'
                              : message.status === 'replied'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {message.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{message.message}</p>
                    <p className="text-xs text-slate-400 mt-2">{formatDate(message.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Message Detail */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Message Details</h2>
            </div>
            {selectedMessage ? (
              <div className="p-6">
                <div className="mb-4">
                  <label className="text-xs font-semibold text-slate-500 uppercase">From</label>
                  <p className="text-slate-900 font-medium">{selectedMessage.email}</p>
                </div>

                <div className="mb-4">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Received</label>
                  <p className="text-slate-700">{formatDate(selectedMessage.created_at)}</p>
                </div>

                <div className="mb-4">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                  <select
                    value={selectedMessage.status}
                    onChange={e =>
                      updateMessageStatus(
                        selectedMessage.id,
                        e.target.value as ContactMessage['status']
                      )
                    }
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                    <option value="replied">Replied</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Message</label>
                  <div className="mt-2 p-4 bg-slate-50 rounded-lg">
                    <p className="text-slate-900 whitespace-pre-wrap">{selectedMessage.message}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <a
                    href={`mailto:${selectedMessage.email}?subject=Re: Your Contact Message`}
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Reply via Email
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">Select a message to view details</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
