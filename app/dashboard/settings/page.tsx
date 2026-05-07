'use client'

import { useState, useEffect } from 'react'
import { UserPlus, ShieldOff, KeyRound, Check, Server, Eye, EyeOff, Copy, RefreshCw, Zap, ZapOff } from 'lucide-react'

export default function SettingsPage() {
  // ── Registration ─────────────────────────────────────────────────────────
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null)
  const [savingReg, setSavingReg] = useState(false)

  // ── Change password ──────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  // ── MCP ──────────────────────────────────────────────────────────────────
  const [mcpEnabled, setMcpEnabled] = useState(false)
  const [mcpToken, setMcpToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [savingMcp, setSavingMcp] = useState(false)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [copied, setCopied] = useState<'token' | 'url' | null>(null)

  const mcpUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp'

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((d) => setRegistrationOpen(d.registrationOpen))
    fetch('/api/mcp/token').then((r) => r.json()).then((d) => {
      setMcpEnabled(d.enabled ?? false)
      setMcpToken(d.token ?? '')
    })
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
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match.'); return }
    setSavingPw(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
    })
    const data = await res.json()
    if (!res.ok) setPwError(data.error ?? 'Something went wrong.')
    else { setPwSuccess(true); setPwForm({ current: '', next: '', confirm: '' }) }
    setSavingPw(false)
  }

  async function toggleMcp() {
    setSavingMcp(true)
    const next = !mcpEnabled
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcpEnabled: next }),
    })
    setMcpEnabled(next)
    setSavingMcp(false)
  }

  async function generateToken() {
    setGeneratingToken(true)
    const res = await fetch('/api/mcp/token', { method: 'POST' })
    const data = await res.json()
    setMcpToken(data.token)
    setShowToken(true)
    setGeneratingToken(false)
  }

  function copyText(text: string, which: 'token' | 'url') {
    navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  const inputClass =
    'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-white">Settings</h1>

      {/* ── MCP Server ─────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-gray-400" />
            <h2 className="text-white font-medium">MCP Server</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${mcpEnabled ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
              {mcpEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <button
            onClick={toggleMcp}
            disabled={savingMcp}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
              mcpEnabled ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-green-700 hover:bg-green-600 text-white'
            }`}
          >
            {mcpEnabled ? <ZapOff size={14} /> : <Zap size={14} />}
            {savingMcp ? 'Saving…' : mcpEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        <p className="text-sm text-gray-400">
          Read-only MCP server — lets AI assistants (Claude, Cursor, etc.) query your orders, analytics, listings, and per-user stats via the Model Context Protocol.
        </p>

        {/* Server URL */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Server URL</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-blue-300 font-mono truncate">
              {mcpUrl}
            </code>
            <button
              onClick={() => copyText(mcpUrl, 'url')}
              className="shrink-0 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
              title="Copy URL"
            >
              {copied === 'url' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* API Token */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">API Token</label>
          {mcpToken ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                <code className="flex-1 text-sm font-mono text-gray-300 truncate">
                  {showToken ? mcpToken : '•'.repeat(32)}
                </code>
                <button onClick={() => setShowToken(!showToken)} className="text-gray-500 hover:text-white shrink-0">
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={() => copyText(mcpToken, 'token')}
                className="shrink-0 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                title="Copy token"
              >
                {copied === 'token' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
              <button
                onClick={generateToken}
                disabled={generatingToken}
                className="shrink-0 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-amber-400 transition-colors disabled:opacity-50"
                title="Regenerate token (invalidates old one)"
              >
                <RefreshCw size={14} className={generatingToken ? 'animate-spin' : ''} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">No token generated yet.</p>
              <button
                onClick={generateToken}
                disabled={generatingToken}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {generatingToken ? 'Generating…' : 'Generate Token'}
              </button>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1.5">
            Pass as <code className="text-gray-400">Authorization: Bearer &lt;token&gt;</code> header. Rotating the token instantly invalidates the old one.
          </p>
        </div>

        {/* Available tools */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Available Tools</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: 'get_analytics', desc: 'Totals, profit trend, counts' },
              { name: 'get_orders', desc: 'All orders with filters' },
              { name: 'get_user_stats', desc: 'Per-seller breakdown' },
              { name: 'get_listings', desc: 'Active inventory' },
            ].map((t) => (
              <div key={t.name} className="px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
                <p className="text-xs font-mono text-blue-400">{t.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Claude Desktop config snippet */}
        {mcpToken && mcpEnabled && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Claude Desktop config snippet</label>
            <pre className="px-3 py-3 bg-gray-950 border border-gray-700 rounded-lg text-xs text-gray-300 overflow-x-auto whitespace-pre">
{`{
  "mcpServers": {
    "reselling": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${mcpUrl}"],
      "env": {
        "MCP_BEARER_TOKEN": "${showToken ? mcpToken : '<your-token>'}"
      }
    }
  }
}`}
            </pre>
          </div>
        )}
      </div>

      {/* ── Change Password ───────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={18} className="text-gray-400" />
          <h2 className="text-white font-medium">Change Password</h2>
        </div>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Current Password</label>
            <input type="password" required value={pwForm.current} onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))} className={inputClass} placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">New Password</label>
            <input type="password" required minLength={8} value={pwForm.next} onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))} className={inputClass} placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Confirm New Password</label>
            <input type="password" required value={pwForm.confirm} onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} className={inputClass} placeholder="••••••••" />
          </div>
          {pwError && <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded px-3 py-2">{pwError}</p>}
          {pwSuccess && (
            <p className="text-green-400 text-sm bg-green-950 border border-green-800 rounded px-3 py-2 flex items-center gap-2">
              <Check size={14} /> Password updated successfully.
            </p>
          )}
          <button type="submit" disabled={savingPw} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors font-medium">
            {savingPw ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* ── Registration ─────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-medium mb-4">Access Control</h2>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {registrationOpen
              ? <UserPlus className="text-green-400 mt-0.5 shrink-0" size={20} />
              : <ShieldOff className="text-red-400 mt-0.5 shrink-0" size={20} />}
            <div>
              <p className="text-white text-sm font-medium">
                {registrationOpen ? 'Registration is open' : 'Registration is disabled'}
              </p>
              <p className="text-gray-400 text-sm mt-0.5">
                {registrationOpen ? 'Anyone with the URL can create an account.' : 'New signups are blocked.'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleRegistration}
            disabled={savingReg || registrationOpen === null}
            className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${registrationOpen ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-green-700 hover:bg-green-600 text-white'}`}
          >
            {savingReg ? 'Saving…' : registrationOpen ? 'Disable' : 'Enable'}
          </button>
        </div>
        {registrationOpen && (
          <div className="mt-4 bg-gray-800 rounded-lg px-4 py-3 text-sm text-gray-300">
            Share: <span className="font-mono text-blue-400">{typeof window !== 'undefined' ? `${window.location.origin}/register` : '/register'}</span>
          </div>
        )}
      </div>
    </div>
  )
}
