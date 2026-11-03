import { Gamepad2, Heart, House, LayoutGrid } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn';

const tabs = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/games', label: 'Games', icon: Gamepad2, end: false },
  { to: '/categories', label: 'Categories', icon: LayoutGrid, end: false },
  { to: '/favorites', label: 'Saved', icon: Heart, end: false },
];

export function MobileTabBar() {
  return (
    <nav
      aria-label="Mobile quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="grid grid-cols-4">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'mx-1 my-1 flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition',
                isActive ? 'bg-ink text-surface' : 'text-muted',
              )
            }
          >
            {({ isActive }) => (
              <>
                <tab.icon className={cn('h-5 w-5', isActive && 'scale-105')} aria-hidden="true" />
                {tab.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
