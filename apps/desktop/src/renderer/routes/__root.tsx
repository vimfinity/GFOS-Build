import { createRootRoute, Outlet, Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { healthQuery, configQuery, useSaveConfig } from '@/api/queries';
import { OnboardingDialog } from '@/components/OnboardingDialog';
import { TooltipProvider, Tooltip, ShortcutKey } from '@/components/ui/tooltip';
import { ServerCrash, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { OPEN_ONBOARDING_EVENT } from '@/lib/onboarding';
import {
  applyThemePreference,
  getStoredThemePreference,
  THEME_EVENT,
} from '@/lib/theme';

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

const NAV_TABS: Array<{ to: string; label: string; exact: boolean; shortcut: string }> = [
  { to: '/', label: 'Home', exact: true, shortcut: 'Ctrl+1' },
  { to: '/pipelines', label: 'Pipelines', exact: false, shortcut: 'Ctrl+2' },
  { to: '/projects', label: 'Projects', exact: false, shortcut: 'Ctrl+3' },
  { to: '/builds', label: 'Builds', exact: false, shortcut: 'Ctrl+4' },
  { to: '/stats', label: 'Stats', exact: false, shortcut: 'Ctrl+5' },
];

const SETTINGS_TAB = { to: '/settings', label: 'Settings', exact: false, shortcut: 'Ctrl+6' } as const;

// ---------------------------------------------------------------------------
// NavTab
// ---------------------------------------------------------------------------

function NavTab({
  to,
  label,
  exact,
  shortcut,
  showShortcut,
}: {
  to: string;
  label: string;
  exact: boolean;
  shortcut?: string;
  showShortcut?: boolean;
}) {
  const base =
    'inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:text-foreground focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]';
  const active = cn(
    'inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
    'bg-primary/10 text-primary',
  );

  return (
    <Tooltip
      content={label}
      shortcut={shortcut ? <ShortcutKey>{shortcut}</ShortcutKey> : undefined}
      side="bottom"
    >
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Link
          to={to as any}
          className={base}
          activeProps={{ className: active }}
          activeOptions={{ exact }}
        >
          <span>{label}</span>
          {shortcut ? (
            <ShortcutKey
              className={cn(
                'overflow-hidden transition-[max-width,opacity,margin,padding] duration-160 ease-out',
                showShortcut ? 'ml-1.5 max-w-14 opacity-100' : 'ml-0 max-w-0 px-0 opacity-0',
              )}
            >
              {shortcut}
            </ShortcutKey>
          ) : null}
        </Link>
      }
    </Tooltip>
  );
}

function SettingsNavButton({
  shortcut,
}: {
  shortcut: string;
}) {
  const base =
    'inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:text-foreground focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]';
  const active =
    'inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]';

  return (
    <Tooltip
      content="Settings"
      shortcut={<ShortcutKey>{shortcut}</ShortcutKey>}
      side="bottom"
    >
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Link
          to={SETTINGS_TAB.to as any}
          className={base}
          activeProps={{ className: active }}
          activeOptions={{ exact: SETTINGS_TAB.exact }}
          aria-label="Settings"
        >
          <Settings size={15} />
        </Link>
      }
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Health indicator dot
// ---------------------------------------------------------------------------

function HealthDot() {
  const { data, isError } = useQuery(healthQuery);

  const dotClass = cn(
    'h-2.5 w-2.5 rounded-full flex-shrink-0 cursor-default transition-colors',
    isError
      ? 'bg-destructive ring-2 ring-destructive/20'
      : data
        ? 'bg-success ring-2 ring-success/20'
        : 'bg-muted-foreground animate-pulse',
  );

  const tooltip = isError
    ? 'Runtime unavailable. Restart the app after fixing the local state or startup error.'
    : data
      ? `Runtime v${data.version} · uptime ${Math.round(data.uptime)}s · ${data.platform}`
      : 'Starting local runtime…';

  return (
    <Tooltip content={tooltip} side="bottom">
      <div aria-label={tooltip} role="status" className={dotClass} />
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Runtime offline overlay — shown in main content area only
// ---------------------------------------------------------------------------

function RuntimeOfflineOverlay() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 h-full text-center px-6">
      <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center ring-1 ring-destructive/20">
        <ServerCrash size={26} className="text-destructive" />
      </div>
      <div className="flex flex-col gap-2 max-w-sm">
        <p className="text-sm font-semibold text-foreground">Local runtime failed to start</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The desktop runtime could not be initialized. Check the local state, then restart the app.
          The status dot in the top-right turns green once the runtime is ready again.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

function RootLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queryClient = useQueryClient();
  const { data: configData } = useQuery(configQuery);
  const { isError: runtimeOffline } = useQuery(healthQuery);
  const saveConfig = useSaveConfig();
  const isLiveBuildRoute = /^\/builds\/[^/]+$/.test(pathname);
  const isMac = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPad/.test(navigator.platform),
    [],
  );
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const primaryModifierLabel = isMac ? '⌘' : 'Ctrl';

  useEffect(() => {
    applyThemePreference(getStoredThemePreference());

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      if (getStoredThemePreference() === 'system') {
        applyThemePreference('system');
      }
    };
    const handleThemeEvent = () => {
      applyThemePreference(getStoredThemePreference());
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      setShowShortcuts(isMac ? event.metaKey : event.ctrlKey);
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (event.target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          return;
        }
      }

      const index = Number(event.key);
      if (!Number.isInteger(index) || index < 1 || index > 6) return;

      const target = index <= NAV_TABS.length ? NAV_TABS[index - 1] : SETTINGS_TAB;
      if (!target) return;

      event.preventDefault();
      void navigate({ to: target.to as never });
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      setShowShortcuts(isMac ? event.metaKey : event.ctrlKey);
    };
    const handleBlur = () => setShowShortcuts(false);
    const handleOpenOnboarding = () => setOnboardingOpen(true);

    media.addEventListener('change', handleMediaChange);
    window.addEventListener(THEME_EVENT, handleThemeEvent);
    window.addEventListener('storage', handleThemeEvent);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener(OPEN_ONBOARDING_EVENT, handleOpenOnboarding);
    document.addEventListener('visibilitychange', handleBlur);
    return () => {
      media.removeEventListener('change', handleMediaChange);
      window.removeEventListener(THEME_EVENT, handleThemeEvent);
      window.removeEventListener('storage', handleThemeEvent);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener(OPEN_ONBOARDING_EVENT, handleOpenOnboarding);
      document.removeEventListener('visibilitychange', handleBlur);
    };
  }, [navigate, isMac]);

  // Show onboarding whenever no project roots are configured
  const needsOnboarding =
    !runtimeOffline &&
    configData !== undefined &&
    Object.keys(configData.config.roots).length === 0;

  useEffect(() => {
    if (needsOnboarding) {
      setOnboardingOpen(true);
    }
  }, [needsOnboarding]);

  async function handleOnboardingComplete(config: {
    roots: Record<string, string>;
    maven: { executable: string; defaultGoals: string[]; defaultOptionKeys: string[]; defaultExtraOptions: string[] };
    jdkRegistry: Record<string, string>;
  }) {
    await saveConfig.mutateAsync(config);
    void queryClient.invalidateQueries({ queryKey: ['config'] });
    void queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    void queryClient.invalidateQueries({ queryKey: ['scan'] });
    setOnboardingOpen(false);
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden flex-col text-foreground">
      <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div className="pointer-events-auto flex h-12 max-w-full items-center gap-1 rounded-full border px-2 text-foreground backdrop-blur-xl [background:var(--nav-bg)] [border-color:var(--nav-border)] [box-shadow:var(--nav-shadow)]">
          <Tooltip content="Home" shortcut={<ShortcutKey>{`${primaryModifierLabel} 1`}</ShortcutKey>} side="bottom">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-foreground transition-colors focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]"
            >
              <span className="text-primary">
                <GfosLogo size={18} />
              </span>
              <span className="text-[13px] font-semibold tracking-[-0.01em]">GFOS Build</span>
            </Link>
          </Tooltip>

          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_TABS.map((tab) => (
              <NavTab
                key={tab.to}
                {...tab}
                shortcut={`${primaryModifierLabel} ${tab.shortcut.slice(-1)}`}
                showShortcut={showShortcuts}
              />
            ))}
          </nav>

          <div className="mx-1 h-5 w-px bg-border" />

          <div className="flex items-center gap-1">
            <SettingsNavButton
              shortcut={`${primaryModifierLabel} 6`}
            />
            <div className="mx-1 h-2 w-2 rounded-full">
              <HealthDot />
            </div>
          </div>
        </div>
      </header>

      <main
        className={cn(
          'flex min-h-0 flex-1 flex-col px-4 pt-24 pb-6 sm:px-6 sm:pb-8 lg:px-8',
          isLiveBuildRoute ? 'overflow-hidden' : 'overflow-auto',
        )}
      >
        {runtimeOffline ? (
          <div className="mx-auto flex h-full max-w-4xl items-center justify-center">
            <div className="glass-card w-full max-w-lg rounded-[24px] border border-border p-10">
              <RuntimeOfflineOverlay />
            </div>
          </div>
        ) : (
          <div className={cn('flex min-h-0 flex-1 flex-col pb-2 sm:pb-3', isLiveBuildRoute && 'overflow-hidden')}>
            <Outlet />
            {!isLiveBuildRoute && <div className="h-8 shrink-0 sm:h-10" aria-hidden="true" />}
          </div>
        )}
      </main>

      {onboardingOpen && (
        <OnboardingDialog
          open={onboardingOpen}
          dismissible={!needsOnboarding}
          onOpenChange={setOnboardingOpen}
          initialConfig={configData?.config}
          onComplete={(config) => void handleOnboardingComplete(config)}
        />
      )}
      </div>
    </TooltipProvider>
  );
}
