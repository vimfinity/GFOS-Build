import { useEffect, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { FolderOpen, Plus, Trash2, ArrowRight, ArrowLeft, Check, Wrench } from 'lucide-react';
import { pickDirectory } from '@/api/bridge';

interface OnboardingDialogProps {
  open: boolean;
  dismissible?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialConfig?: {
    roots: Record<string, string>;
    maven: { executable: string; defaultGoals: string[]; defaultFlags: string[] };
    jdkRegistry: Record<string, string>;
  };
  onComplete: (config: {
    roots: Record<string, string>;
    maven: { executable: string; defaultGoals: string[]; defaultFlags: string[] };
    jdkRegistry: Record<string, string>;
  }) => void;
}

export function OnboardingDialog({
  open,
  dismissible = true,
  onOpenChange,
  initialConfig,
  onComplete,
}: OnboardingDialogProps) {
  const [step, setStep] = useState(0);
  const [mavenExe, setMavenExe] = useState('mvn');
  const [defaultGoals, setDefaultGoals] = useState('clean install');
  const [defaultFlags, setDefaultFlags] = useState('');
  const [jdks, setJdks] = useState<Array<{ version: string; path: string }>>([]);
  const [roots, setRoots] = useState<Array<{ name: string; path: string }>>([]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setMavenExe(initialConfig?.maven.executable ?? 'mvn');
    setDefaultGoals(initialConfig?.maven.defaultGoals.join(' ') ?? 'clean install');
    setDefaultFlags(initialConfig?.maven.defaultFlags.join(' ') ?? '');
    setJdks(
      Object.entries(initialConfig?.jdkRegistry ?? {}).map(([version, path]) => ({
        version,
        path,
      })),
    );
    setRoots(
      Object.entries(initialConfig?.roots ?? {}).map(([name, path]) => ({
        name,
        path,
      })),
    );
  }, [open, initialConfig]);

  function addJdk() {
    setJdks((items) => [...items, { version: '', path: '' }]);
  }
  function removeJdk(index: number) {
    setJdks((items) => items.filter((_, i) => i !== index));
  }
  function updateJdk(index: number, field: 'version' | 'path', value: string) {
    setJdks((items) => items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addRoot() {
    setRoots((items) => [...items, { name: '', path: '' }]);
  }
  function removeRoot(index: number) {
    setRoots((items) => items.filter((_, i) => i !== index));
  }
  function updateRoot(index: number, field: 'name' | 'path', value: string) {
    setRoots((items) => items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function browseDirectory(callback: (dir: string) => void) {
    const dir = await pickDirectory();
    if (dir) callback(dir);
  }

  function handleFinish() {
    const rootsObj: Record<string, string> = {};
    for (const root of roots) {
      if (root.name.trim() && root.path.trim()) rootsObj[root.name.trim()] = root.path.trim();
    }
    const jdkObj: Record<string, string> = {};
    for (const jdk of jdks) {
      if (jdk.version.trim() && jdk.path.trim()) jdkObj[jdk.version.trim()] = jdk.path.trim();
    }
    onComplete({
      roots: rootsObj,
      maven: {
        executable: mavenExe || 'mvn',
        defaultGoals: defaultGoals.split(/\s+/).filter(Boolean),
        defaultFlags: defaultFlags.split(/\s+/).filter(Boolean),
      },
      jdkRegistry: jdkObj,
    });
    onOpenChange?.(false);
  }

  function helperText(text: string) {
    return <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>;
  }

  const steps: Array<{ title: string; description: string; content: ReactNode }> = [
    {
      title: 'Welcome to GFOS Build',
      description: 'Let’s get your build station set up in a few quick steps.',
      content: (
        <div className="rounded-[24px] border border-border bg-secondary/40 p-5">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
            <Wrench size={12} />
            About a minute to finish
          </div>
          <p className="text-base font-semibold text-foreground">Local workstation setup</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            We’ll set the core defaults once so future scans, ad-hoc runs, and pipelines start
            from a sane baseline instead of a blank slate.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[18px] border border-border/80 bg-card/40 px-4 py-4">
              <p className="text-sm font-medium text-foreground">Maven defaults</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Pick the executable, common goals, and extra flags new runs should inherit.
              </p>
            </div>
            <div className="rounded-[18px] border border-border/80 bg-card/40 px-4 py-4">
              <p className="text-sm font-medium text-foreground">Optional JDK versions</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Register local JDKs so pipeline steps can target a specific Java version later.
              </p>
            </div>
            <div className="rounded-[18px] border border-border/80 bg-card/40 px-4 py-4">
              <p className="text-sm font-medium text-foreground">Project roots</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Tell GFOS where your Maven and npm codebases live so scanning knows where to look.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Maven configuration',
      description: 'Choose the default executable and command arguments for new runs.',
      content: (
        <div className="flex flex-col gap-3.5">
          <div>
            <Input
              label="Maven executable"
              placeholder="mvn"
              value={mavenExe}
              onChange={(e) => setMavenExe(e.target.value)}
            />
            {helperText('Executable name or absolute path used when GFOS starts Maven builds.')}
          </div>
          <div>
            <Input
              label="Default goals"
              placeholder="clean install"
              value={defaultGoals}
              onChange={(e) => setDefaultGoals(e.target.value)}
            />
            {helperText('Pre-filled goals for ad-hoc Maven runs and Maven pipeline steps.')}
          </div>
          <div>
            <Input
              label="Default flags"
              placeholder="-DskipTests -T 2C"
              value={defaultFlags}
              onChange={(e) => setDefaultFlags(e.target.value)}
            />
            {helperText('Optional Maven flags appended to new runs by default.')}
          </div>
        </div>
      ),
    },
    {
      title: 'JDK registry',
      description: 'Register JDK installations for per-step JAVA_HOME overrides.',
      content: (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm text-muted-foreground">
            Leave this empty if you want to use the system Java installation.
          </p>
          {jdks.map((jdk, index) => (
            <div key={index} className="rounded-[20px] border border-border bg-secondary/45 p-3">
              <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_auto_auto]">
                <div>
                  <Input
                    label="Version"
                    placeholder="17"
                    value={jdk.version}
                    onChange={(e) => updateJdk(index, 'version', e.target.value)}
                  />
                  {helperText('Key used later when choosing a Java version for a pipeline step.')}
                </div>
                <div>
                  <Input
                    label="JAVA_HOME path"
                    placeholder="C:\\Program Files\\Java\\jdk-17"
                    value={jdk.path}
                    onChange={(e) => updateJdk(index, 'path', e.target.value)}
                  />
                  {helperText('Absolute JAVA_HOME directory for this installed JDK.')}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void browseDirectory((dir) => updateJdk(index, 'path', dir))}
                  className="self-end"
                >
                  <FolderOpen size={14} />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => removeJdk(index)}
                  className="self-end"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addJdk} className="self-start">
            <Plus size={14} />
            Add JDK
          </Button>
        </div>
      ),
    },
    {
      title: 'Project roots',
      description: 'Add the directories that should be scanned for projects.',
      content: (
        <div className="flex flex-col gap-2.5">
          {roots.map((root, index) => (
            <div key={index} className="rounded-[20px] border border-border bg-secondary/45 p-3">
              <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)_auto_auto]">
                <div>
                  <Input
                    label="Name"
                    placeholder="monorepo"
                    value={root.name}
                    onChange={(e) => updateRoot(index, 'name', e.target.value)}
                  />
                  {helperText('Short label used in project grouping and pickers inside the app.')}
                </div>
                <div>
                  <Input
                    label="Path"
                    placeholder="C:\\dev\\projects"
                    value={root.path}
                    onChange={(e) => updateRoot(index, 'path', e.target.value)}
                  />
                  {helperText('Directory GFOS scans for Maven and npm projects under this root.')}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void browseDirectory((dir) => updateRoot(index, 'path', dir))}
                  className="self-end"
                >
                  <FolderOpen size={14} />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => removeRoot(index)}
                  className="self-end"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRoot} className="self-start">
            <Plus size={14} />
            Add root
          </Button>
        </div>
      ),
    },
  ];

  const current = steps[step]!;
  const isLast = step === steps.length - 1;
  const canFinish = roots.some((root) => root.name.trim() && root.path.trim());

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => dismissible && onOpenChange?.(nextOpen)}>
      <DialogContent className="max-w-3xl p-0" showCloseButton={dismissible}>
        <div className="flex h-[min(37.5rem,calc(100vh-2rem))] flex-col">
          <div className="shrink-0 px-6 pt-6 md:px-7 md:pt-7">
            <div className="flex items-center gap-2">
              {steps.map((item, index) => (
                <div key={item.title} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium transition-colors',
                      index <= step
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-border bg-card/70 text-muted-foreground',
                    )}
                  >
                    {index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        'h-px w-8 sm:w-12',
                        index < step ? 'bg-primary/25' : 'bg-border',
                      )}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6">
              <DialogTitle>{current.title}</DialogTitle>
              <DialogDescription>{current.description}</DialogDescription>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-4 md:px-7">
              {current.content}
            </div>

            <div className="shrink-0 px-6 pb-6 md:px-7 md:pb-7">
              <Separator />
              <div className="flex items-center justify-between pt-5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep((value) => value - 1)}
                  disabled={step === 0}
                >
                  <ArrowLeft size={14} />
                  Back
                </Button>
                {isLast ? (
                  <Button size="sm" onClick={handleFinish} disabled={!canFinish}>
                    <Check size={14} />
                    Save & finish
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setStep((value) => value + 1)}>
                    Next
                    <ArrowRight size={14} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
