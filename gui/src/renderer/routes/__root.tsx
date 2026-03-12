import { createRootRoute, Outlet, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { healthQuery, configQuery, useSaveConfig } from '@/api/queries';
import { OnboardingDialog } from '@/components/OnboardingDialog';
import {
  LayoutDashboard,
  Workflow,
  FolderSearch,
  Hammer,
  ServerCrash,
  BarChart3,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export const Route = createRootRoute({
  component: RootLayout,
});

// ---------------------------------------------------------------------------
// GFOS Logo (inline SVG)
// ---------------------------------------------------------------------------

function GfosLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 272.13 272.13"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="m181.42,90.71c50.1,0,90.71-40.61,90.71-90.71H0v226.79c0,25.04,20.3,45.33,45.33,45.33h226.79V90.71c-50.1,0-90.71,40.61-90.71,90.71h-68.13c-12.47,0-22.58-10.11-22.58-22.58v-68.12h90.71Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Nav tab definitions
// ---------------------------------------------------------------------------

const NAV_TABS: Array<{ to: string; icon: React.ElementType; label: string; exact: boolean }> = [
  { to: '/',          icon: LayoutDashboard, label: 'Home',      exact: true  },
  { to: '/pipelines', icon: Workflow,        label: 'Pipelines', exact: false },
  { to: '/projects',  icon: FolderSearch,    label: 'Projects',  exact: false },
  { to: '/builds',    icon: Hammer,          label: 'Builds',    exact: false },
  { to: '/stats',     icon: BarChart3,       label: 'Stats',     exact: false },
  { to: '/settings',  icon: Settings,        label: 'Settings',  exact: false },
];

// ---------------------------------------------------------------------------
// NavTab
// ---------------------------------------------------------------------------

function NavTab({
  to,
  icon: Icon,
  label,
  exact,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  exact: boolean;
}) {
  const base =
    'relative flex items-center gap-1.5 px-3 h-full text-sm font-medium transition-colors text-muted-foreground hover:text-foreground';
  const active = cn(
    'relative flex items-center gap-1.5 px-3 h-full text-sm font-medium transition-colors',
    'text-foreground',
    'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary after:rounded-t-sm',
  );

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Link to={to as any} className={base} activeProps={{ className: active }} activeOptions={{ exact }}>
      <Icon size={15} />
      {label}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Theme toggle — persists to / reads from localStorage
// ---------------------------------------------------------------------------

function applyThemeAttr(t: 'dark' | 'light'): void {
  if (t === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Apply persisted theme once on mount
  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const initial: 'dark' | 'light' = stored === 'light' ? 'light' : 'dark';
    setTheme(initial);
    applyThemeAttr(initial);
  }, []);

  function toggle() {
    const next: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    applyThemeAttr(next);
  }

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Health indicator dot
// ---------------------------------------------------------------------------

function HealthDot() {
  const { data, isError } = useQuery(healthQuery);

  const dotClass = cn(
    'w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors cursor-default',
    isError
      ? 'bg-destructive ring-2 ring-destructive/20 ring-offset-1 ring-offset-background'
      : data
        ? 'bg-success ring-2 ring-success/20 ring-offset-1 ring-offset-background'
        : 'bg-muted-foreground animate-pulse',
  );

  const tooltip = isError
    ? 'Server unreachable — check terminal for errors, then restart the app'
    : data
      ? `Server v${data.version} · uptime ${Math.round(data.uptime)}s · ${data.platform}`
      : 'Connecting to server…';

  return (
    <div
      title={tooltip}
      aria-label={tooltip}
      role="status"
      className={dotClass}
    />
  );
}

// ---------------------------------------------------------------------------
// Server offline overlay — shown in main content area only
// ---------------------------------------------------------------------------

function ServerOfflineOverlay() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 h-full text-center px-6">
      <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center ring-1 ring-destructive/20">
        <ServerCrash size={26} className="text-destructive" />
      </div>
      <div className="flex flex-col gap-2 max-w-sm">
        <p className="text-sm font-semibold text-foreground">Server failed to start</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The background server process could not be reached. Check the terminal for error output,
          then restart the app. The health indicator in the top-right will turn green when the
          connection is restored.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

function RootLayout() {
  const queryClient = useQueryClient();
  const { data: configData } = useQuery(configQuery);
  const { isError: serverOffline } = useQuery(healthQuery);
  const saveConfig = useSaveConfig();

  // Show onboarding whenever no project roots are configured
  const needsOnboarding =
    !serverOffline &&
    configData !== undefined &&
    Object.keys(configData.config.roots).length === 0;

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
      {/* ── Top navigation bar ─────────────────────────────────────────── */}
      <header className="flex items-center h-[52px] border-b border-border bg-card/40 shrink-0 px-4 gap-0">
        {/* Brand wordmark */}
        <div className="flex items-center gap-2 select-none mr-3 shrink-0">
          <span className="text-primary">
            <GfosLogo size={18} />
          </span>
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

        {/* Right-side controls */}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="w-px h-4 bg-border" />
          <HealthDot />
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto min-w-0">
        {serverOffline ? <ServerOfflineOverlay /> : <Outlet />}
      </main>

      {/* ── Global onboarding wizard ────────────────────────────────────── */}
      {needsOnboarding && (
        <OnboardingDialog
          open={true}
          onComplete={(config) => void handleOnboardingComplete(config)}
        />
      )}
    </div>
  );
}
