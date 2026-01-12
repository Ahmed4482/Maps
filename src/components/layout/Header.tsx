import { Link, useRouterState } from '@tanstack/react-router';
import { Menu, Ship } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', key: 'dashboard' },
  { label: 'Shipments', href: '/shipments', key: 'shipments' },
  { label: 'Support', href: '#', key: 'support' },
];

export function Header() {
  const routerState = useRouterState();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isActive = (href: string) => routerState.location.pathname.startsWith(href);

  return (
    <header className="w-full border-b-2 border-[#0A5C3A]/20 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A5C3A]/10 text-[#0A5C3A]">
            <Ship className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <p className="text-xs uppercase tracking-[0.2em] text-[#0A5C3A]">Logistics</p>
            <p className="text-lg font-semibold text-[#0A5C3A]">Maalbardaar</p>
          </div>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              to={item.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 hover:text-[#0A5C3A]',
                isActive(item.href) ? 'text-[#0A5C3A] bg-[#0A5C3A]/10' : 'text-gray-600'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Button variant="outline" className="border-[#0A5C3A]/30 text-[#0A5C3A] hover:bg-[#0A5C3A]/10">
            Track New
          </Button>
          <Button className="bg-[#0A5C3A] text-white hover:bg-[#0a5c3a]/90">Upgrade</Button>
        </div>

        <button
          onClick={() => setIsMobileOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 transition hover:bg-gray-100 md:hidden"
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {isMobileOpen && (
        <div className="border-t-2 border-[#0A5C3A]/20 bg-white px-4 pb-4 md:hidden">
          <div className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                to={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 hover:text-[#0A5C3A]',
                  isActive(item.href) ? 'text-[#0A5C3A] bg-[#0A5C3A]/10' : 'text-gray-600'
                )}
              >
                {item.label}
              </Link>
            ))}
            <Button variant="outline" className="border-[#0A5C3A]/30 text-[#0A5C3A] hover:bg-[#0A5C3A]/10">
              Track New
            </Button>
            <Button className="bg-[#0A5C3A] text-white hover:bg-[#0a5c3a]/90">Upgrade</Button>
          </div>
        </div>
      )}
    </header>
  );
}

