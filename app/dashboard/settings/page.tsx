'use client'

import { useState, useEffect } from 'react'
import { UserPlus, ShieldOff } from 'lucide-react'

export default function SettingsPage() {
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => setRegistrationOpen(d.registrationOpen))
  }, [])

  async function toggle() {
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationOpen: !registrationOpen }),
    })
    const data = await res.json()
    setRegistrationOpen(data.registrationOpen)
    setSaving(false)
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-white">Settings</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-medium mb-4">Access Control</h2>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {registrationOpen ? (
              <UserPlus className="text-green-400 mt-0.5 shrink-0" size={20} />
            ) : (
              <ShieldOff className="text-red-400 mt-0.5 shrink-0" size={20} />
            )}
            <div>
              <p className="text-white text-sm font-medium">
                {registrationOpen ? 'Registration is open' : 'Registration is disabled'}
              </p>
              <p className="text-gray-400 text-sm mt-0.5">
                {registrationOpen
                  ? 'Anyone with the URL can create an account at /register.'
                  : 'New signups are blocked. Existing users can still log in.'}
              </p>
            </div>
          </div>

          <button
            onClick={toggle}
            disabled={saving || registrationOpen === null}
            className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
              registrationOpen
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : 'bg-green-700 hover:bg-green-600 text-white'
            }`}
          >
            {saving ? 'Saving…' : registrationOpen ? 'Disable' : 'Enable'}
          </button>
        </div>

        {registrationOpen && (
          <div className="mt-4 bg-gray-800 rounded-lg px-4 py-3 text-sm text-gray-300">
            Share this link:{' '}
            <span className="font-mono text-blue-400">
              {typeof window !== 'undefined' ? `${window.location.origin}/register` : '/register'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
