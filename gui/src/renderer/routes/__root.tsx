import { createRootRoute, Outlet, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { healthQuery } from '@/api/queries';
import { LayoutDashboard, Workflow, FolderSearch, Hammer, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Route = createRootRoute({
  component: RootLayout,
});

const NAV_TABS: Array<{ to: string; icon: React.ElementType; label: string; exact: boolean }> = [
  { to: '/', icon: LayoutDashboard, label: 'Home', exact: true },
  { to: '/pipelines', icon: Workflow, label: 'Pipelines', exact: false },
  { to: '/projects', icon: FolderSearch, label: 'Projects', exact: false },
  { to: '/builds', icon: Hammer, label: 'Builds', exact: false },
];

function NavTab({ to, icon: Icon, label, exact }: { to: string; icon: React.ElementType; label: string; exact: boolean }) {
  return (
    <Link
      to={to}
      className="relative flex items-center gap-1.5 px-3 h-full text-sm font-medium transition-colors text-muted-foreground hover:text-foreground"
      activeProps={{
        className: cn(
          'relative flex items-center gap-1.5 px-3 h-full text-sm font-medium transition-colors',
          'text-foreground',
          'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary after:rounded-t-sm',
        ),
      }}
      activeOptions={{ exact }}
    >
      <Icon size={15} />
      {label}
    </Link>
  );
}

function HealthDot() {
  const { data } = useQuery(healthQuery);
  return (
    <div
      title={data ? `Server v${data.version} · uptime ${data.uptime}s` : 'Connecting to server…'}
      className={cn(
        'w-2 h-2 rounded-full flex-shrink-0 transition-colors',
        data ? 'bg-success' : 'bg-border animate-pulse',
      )}
    />
  );
}

function RootLayout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Top header */}
      <header className="flex items-center h-[52px] border-b border-border bg-card/40 shrink-0 px-4 gap-0">
        {/* Brand */}
        <div className="flex items-center gap-2 select-none mr-3 shrink-0">
          <Wrench size={18} className="text-primary" strokeWidth={2.2} />
          <span className="text-sm font-semibold tracking-tight text-foreground">GFOS Build</span>
        </div>

        {/* Vertical divider */}
        <div className="w-px h-5 bg-border mr-2 shrink-0" />

        {/* Nav tabs — flush with header bottom via h-full + after: pseudo-element */}
        <nav className="flex items-center h-full gap-0.5">
          {NAV_TABS.map((tab) => (
            <NavTab key={tab.to} {...tab} />
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Health indicator */}
        <HealthDot />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
