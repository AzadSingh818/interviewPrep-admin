'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/interviewers', label: 'Interviewers' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/config', label: 'Config' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login/admin');
      router.refresh();
      setLoggingOut(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="dashboard-grid">
        <aside className="sidebar panel">
          <div className="brand">
            <div className="brand-mark">A</div>
            <div>
              <p className="eyebrow">InterviewPrep Live</p>
              <h2 className="section-title">Admin Panel</h2>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${pathname === item.href ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="sidebar-footer">
            <p className="section-subtitle">Full platform control for operations and review.</p>
            <button className="ghost-button" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </aside>

        <main className="content-shell panel">{children}</main>
      </div>
    </div>
  );
}
