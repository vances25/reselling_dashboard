'use client'

import { signOut, useSession } from 'next-auth/react'
import { Menu, LogOut } from 'lucide-react'

interface TopbarProps {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { data: session } = useSession()

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-400 hover:text-white"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-300">{session?.user?.name}</span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  )
}
