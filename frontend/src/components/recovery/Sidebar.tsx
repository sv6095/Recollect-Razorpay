'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WhatsAppIcon } from './WhatsAppIcon'

interface SidebarProps {
  escalationCount?: number
  onOpenChat?: () => void
  onOpenWhatsApp?: () => void
  onOpenVoiceCall?: () => void
  onOpenPipeline?: () => void
}

interface NavLink {
  icon: string
  label: string
  href: string
  badge?: boolean
  section?: string
}

const MAIN_LINKS: NavLink[] = [
  { icon: 'space_dashboard',  label: 'Dashboard',          href: '/',                     section: 'Overview' },
  { icon: 'receipt_long',     label: 'Recovery Pipeline',  href: '/partial-payment-links',section: 'Overview' },
  { icon: 'subscriptions',    label: 'Subscriptions',      href: '/subscriptions',        section: 'Overview' },
]

const WORKFLOW_LINKS: NavLink[] = [
  { icon: 'priority_high',    label: 'Escalations',        href: '/escalations', badge: true, section: 'Workflows' },
  { icon: 'account_tree',     label: 'Agent Workflows',    href: '/agent-workflows',       section: 'Workflows' },
  { icon: 'verified_user',    label: 'Compliance Log',     href: '/escalations',           section: 'Workflows' },
]

const SETTINGS_LINKS: NavLink[] = [
  { icon: 'tune',             label: 'Recovery Settings',  href: '/escalations',           section: 'Settings' },
  { icon: 'webhook',          label: 'Webhooks',           href: '/escalations',           section: 'Settings' },
]

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1.5">
      <span className="eyebrow" style={{ letterSpacing: '0.12em', fontSize: 10, color: 'var(--color-text-4)' }}>
        {label}
      </span>
    </div>
  )
}

interface CommButtonProps {
  icon?: string
  customIcon?: React.ReactNode
  label: string
  onClick?: () => void
  gradient: string
  iconColor: string
  dotColor?: string
}

function CommButton({ icon, customIcon, label, onClick, gradient, iconColor, dotColor }: CommButtonProps) {
  return (
    <button
      onClick={onClick}
      className="mx-2 flex items-center gap-2.5 p-2 rounded-xl transition-all group overflow-hidden border border-slate-200/80 hover:border-slate-300 shadow-sm"
      style={{
        background: gradient,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(16,24,40,0.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(16,24,40,0.05)'
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden"
        style={{ background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        {customIcon ? (
          customIcon
        ) : (
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, color: iconColor, fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
        )}
        {dotColor && (
          <span
            className="absolute top-0 right-0 w-2 h-2 rounded-full"
            style={{ background: dotColor, boxShadow: '0 0 0 1.5px #fff' }}
          />
        )}
      </div>
      <div className="flex flex-col leading-tight min-w-0 flex-1 text-left">
        <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--color-text)' }}>
          {label}
        </span>
        <span className="text-[10px] text-slate-500">
          Open panel →
        </span>
      </div>
    </button>
  )
}

export function Sidebar({ escalationCount, onOpenChat, onOpenWhatsApp, onOpenVoiceCall, onOpenPipeline }: SidebarProps) {
  const pathname = usePathname()
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)

  const renderLinks = (links: NavLink[], section: string) => {
    const grouped = links.filter((l) => l.section === section)
    if (grouped.length === 0) return null
    return (
      <>
        <SectionLabel label={section} />
        {grouped.map(({ icon, label, href, badge }) => {
          const active = isActive(href)
          const count = badge && escalationCount && escalationCount > 0 ? escalationCount : null
          const isAgentWorkflows = label === 'Agent Workflows' && !!onOpenPipeline

          if (isAgentWorkflows) {
            return (
              <button
                key={href + label}
                type="button"
                onClick={onOpenPipeline}
                className="nav-item mx-2 w-[calc(100%-16px)] text-left cursor-pointer transition-all"
                style={{
                  borderRadius: 9,
                  borderLeft: '3px solid transparent',
                  paddingLeft: '12px',
                }}
              >
                <span
                  className="material-symbols-outlined shrink-0"
                  style={{
                    fontSize: 18,
                    color: 'var(--color-brand-700)',
                  }}
                >
                  {icon}
                </span>
                <span className="flex-1 text-[13px] font-medium text-[var(--color-text)]">{label}</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: 'var(--color-brand-50)',
                    color: 'var(--color-brand-700)',
                    border: '1px solid var(--color-brand-100)',
                  }}
                >
                  Live
                </span>
              </button>
            )
          }

          return (
            <Link
              key={href + label}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`nav-item mx-2 ${active ? 'active font-semibold shadow-xs' : ''}`}
              style={{
                borderRadius: 9,
                borderLeft: active ? '3px solid var(--color-brand-600)' : '3px solid transparent',
                paddingLeft: active ? '9px' : '12px',
              }}
            >
              <span
                className="material-symbols-outlined shrink-0"
                style={{
                  fontSize: 18,
                  color: active ? 'var(--color-brand-700)' : 'var(--color-text-4)',
                }}
              >
                {icon}
              </span>
              <span className="flex-1 text-[13px]">{label}</span>
              {count != null && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: 'var(--color-rose-50)',
                    color: 'var(--color-rose-700)',
                    border: '1px solid var(--color-rose-100)',
                  }}
                >
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </>
    )
  }

  return (
    <aside
      className="app-sidebar flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight: '1px solid var(--color-border-soft)',
      }}
    >
      <nav className="flex flex-col flex-1 overflow-y-auto py-2 gap-0.5">
        {renderLinks(MAIN_LINKS, 'Overview')}
        {renderLinks(WORKFLOW_LINKS, 'Workflows')}
        {renderLinks(SETTINGS_LINKS, 'Settings')}

        {/* Communication Center */}
        <SectionLabel label="Communication Center" />
        <div className="flex flex-col gap-1.5 px-1">
          <CommButton
            icon="chat_bubble"
            label="Live Chat"
            onClick={onOpenChat}
            gradient="linear-gradient(135deg, #EFF6FF 0%, #fff 100%)"
            iconColor="var(--color-brand-700)"
            dotColor="var(--color-green-500)"
          />
          <CommButton
            customIcon={<WhatsAppIcon size={16} color="#027A48" />}
            label="WhatsApp"
            onClick={onOpenWhatsApp}
            gradient="linear-gradient(135deg, #ECFDF3 0%, #fff 100%)"
            iconColor="#027A48"
          />
          <CommButton
            icon="call"
            label="Voice Agent Call"
            onClick={onOpenVoiceCall}
            gradient="linear-gradient(135deg, #F5F0FF 0%, #fff 100%)"
            iconColor="var(--color-violet-600)"
          />
        </div>
      </nav>
    </aside>
  )
}
