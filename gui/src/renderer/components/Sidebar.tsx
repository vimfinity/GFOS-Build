import { Link } from '@tanstack/react-router';
import { LayoutDashboard, History, BotIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/history', icon: <History size={18} />, label: 'History' },
];

export function Sidebar() {
  return (
    <aside className="flex flex-col w-14 bg-zinc-900 border-r border-zinc-800 shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center h-12 border-b border-zinc-800">
        <BotIcon size={22} className="text-violet-400" />
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-1.5 flex-1 pt-2">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 px-1 rounded-md text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors duration-150 group relative',
            )}
            activeProps={{ className: 'text-violet-400 bg-zinc-800/70 hover:bg-zinc-800' }}
          >
            {item.icon}
            <span className="text-[9px] leading-none">{item.label}</span>

            {/* Tooltip on hover */}
            <span className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 text-zinc-100 text-xs rounded border border-zinc-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
              {item.label}
            </span>
          </Link>
        ))}
      </nav>

      {/* Version */}
      <div className="flex items-center justify-center h-10 border-t border-zinc-800">
        <span className="text-[9px] text-zinc-600 font-mono">v2</span>
      </div>
    </aside>
  );
}
