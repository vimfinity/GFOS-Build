import { createRootRoute, Outlet, Link } from '@tanstack/react-router';
import { Workflow, Hammer } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Route = createRootRoute({
  component: RootLayout,
});

function NavTab({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium',
        'text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
      )}
      activeProps={{
        className: 'text-primary bg-primary/10 hover:text-primary hover:bg-primary/10',
      }}
      activeOptions={{ exact: to === '/' }}
    >
      {icon}
      {label}
    </Link>
  );
}

function RootLayout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Top header bar */}
      <header className="flex items-center gap-1 px-4 h-12 border-b border-border shrink-0 bg-card/50">
        <nav className="flex items-center gap-1">
          <NavTab to="/" icon={<Workflow size={16} />} label="Pipelines" />
          <NavTab to="/builds" icon={<Hammer size={16} />} label="Builds" />
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
