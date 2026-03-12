import { createRootRoute, Outlet, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { healthQuery, configQuery, useSaveConfig } from '@/api/queries';
import { OnboardingDialog } from '@/components/OnboardingDialog';
import { LayoutDashboard, Workflow, FolderSearch, Hammer, Wrench, ServerCrash } from 'lucide-react';
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
  const { data, isError } = useQuery(healthQuery);
  return (
    <div
      title={
        isError
          ? 'Server unreachable — check terminal for errors'
          : data
            ? `Server v${data.version} · uptime ${data.uptime}s`
            : 'Connecting to server…'
      }
      className={cn(
        'w-2 h-2 rounded-full flex-shrink-0 transition-colors',
        isError ? 'bg-destructive' : data ? 'bg-success' : 'bg-border animate-pulse',
      )}
    />
  );
}

function ServerOfflineOverlay() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-6">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <ServerCrash size={24} className="text-destructive" />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-foreground">Server failed to start</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          The background server process could not be reached. Check the terminal for error output, then restart the app.
        </p>
      </div>
    </div>
  );
}

function RootLayout() {
  const queryClient = useQueryClient();
  const { data: configData } = useQuery(configQuery);
  const { isError: serverOffline } = useQuery(healthQuery);
  const saveConfig = useSaveConfig();

  // Show onboarding whenever config has no roots configured (regardless of route)
  const needsOnboarding = !serverOffline && configData !== undefined && Object.keys(configData.config.roots).length === 0;

  async function handleOnboardingComplete(config: {
    roots: Record<string, string>;
    maven: { executable: string; defaultGoals: string[]; defaultFlags: string[] };
    jdkRegistry: Record<string, string>;
  }) {
    await saveConfig.mutateAsync(config);
    void queryClient.invalidateQueries({ queryKey: ['config'] });
    void queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    void queryClient.invalidateQueries({ queryKey: ['scan'] });
  }

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

        {/* Nav tabs */}
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
        {serverOffline ? <ServerOfflineOverlay /> : <Outlet />}
      </main>

      {/* Global onboarding wizard — shown whenever no roots are configured */}
      {needsOnboarding && (
        <OnboardingDialog
          open={true}
          onComplete={(config) => void handleOnboardingComplete(config)}
        />
      )}
    </div>
  );
}
