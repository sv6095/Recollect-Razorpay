'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SidebarProps {
  escalationCount?: number
}

const links = [
  { icon: 'bolt',               label: 'Recovery Console',  href: '/' },
  { icon: 'link',               label: 'Payment Links',     href: '/partial-payment-links' },
  { icon: 'autorenew',          label: 'Subscriptions',     href: '/subscriptions' },
  { icon: 'person_raised_hand', label: 'Escalations',       href: '/escalations', badge: true },
  { icon: 'verified_user',      label: 'Compliance',        href: '/escalations' },
]

export function Sidebar({ escalationCount }: SidebarProps) {
  const pathname = usePathname()
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <aside
      className="layout-sidebar flex flex-col"
      style={{ background: '#0B0E14', borderRight: '1px solid #181E2C' }}
    >
      <nav className="flex flex-col flex-1 overflow-y-auto py-3 px-2 gap-0.5">
        {links.map(({ icon, label, href, badge }) => {
          const active = isActive(href)
          const count = badge && escalationCount && escalationCount > 0 ? escalationCount : null

          return (
            <Link
              key={href + label}
              href={href}
              aria-current={active ? 'page' : undefined}
              className="flex items-center justify-between px-3 py-2 rounded text-[13px] font-medium transition-colors"
              style={{
                background: active ? '#19212E' : 'transparent',
                color: active ? '#FFFFFF' : '#4A5568',
                borderLeft: active ? '2px solid #2B51D6' : '2px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = '#C4CBDB'
                  e.currentTarget.style.background = '#111722'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = '#4A5568'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="material-symbols-outlined text-[15px]"
                  style={{
                    color: active ? '#2B51D6' : '#3F4A5F',
                    fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {icon}
                </span>
                {label}
              </div>
              {count != null && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: '#B91C1C22',
                    color: '#F87171',
                    border: '1px solid #B91C1C40',
                  }}
                >
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Subtle bottom divider only */}
      <div className="px-4 py-3 flex items-center gap-1.5" style={{ borderTop: '1px solid #181E2C' }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#15803D' }} />
        <span className="text-[10px] font-mono" style={{ color: '#2C3547' }}>
          System active
        </span>
      </div>
    </aside>
  )
}
