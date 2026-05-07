'use client'

import { useState, useEffect } from 'react'
import { UserPlus, ShieldOff, KeyRound, Check } from 'lucide-react'

export default function SettingsPage() {
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null)
  const [savingReg, setSavingReg] = useState(false)

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((d) => setRegistrationOpen(d.registrationOpen))
  }, [])

  async function toggleRegistration() {
    setSavingReg(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationOpen: !registrationOpen }),
    })
    const data = await res.json()
    setRegistrationOpen(data.registrationOpen)
    setSavingReg(false)
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (pwForm.next !== pwForm.confirm) {
      setPwError('New passwords do not match.')
      return
    }

    setSavingPw(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
    })
    const data = await res.json()

    if (!res.ok) {
      setPwError(data.error ?? 'Something went wrong.')
    } else {
      setPwSuccess(true)
      setPwForm({ current: '', next: '', confirm: '' })
    }
    setSavingPw(false)
  }

  const inputClass =
    'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-white">Settings</h1>

      {/* Change Password */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={18} className="text-gray-400" />
          <h2 className="text-white font-medium">Change Password</h2>
        </div>

        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Current Password</label>
            <input
              type="password"
              required
              value={pwForm.current}
              onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={pwForm.next}
              onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
              className={inputClass}
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              value={pwForm.confirm}
              onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>

          {pwError && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded px-3 py-2">{pwError}</p>
          )}
          {pwSuccess && (
            <p className="text-green-400 text-sm bg-green-950 border border-green-800 rounded px-3 py-2 flex items-center gap-2">
              <Check size={14} /> Password updated successfully.
            </p>
          )}

          <button
            type="submit"
            disabled={savingPw}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
          >
            {savingPw ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Registration toggle */}
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
            onClick={toggleRegistration}
            disabled={savingReg || registrationOpen === null}
            className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
              registrationOpen
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : 'bg-green-700 hover:bg-green-600 text-white'
            }`}
          >
            {savingReg ? 'Saving…' : registrationOpen ? 'Disable' : 'Enable'}
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
