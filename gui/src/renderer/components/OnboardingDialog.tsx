import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { FolderOpen, Plus, Trash2, ArrowRight, ArrowLeft, Check, Wrench } from 'lucide-react';

interface OnboardingDialogProps {
  open: boolean;
  onComplete: (config: {
    roots: Record<string, string>;
    maven: { executable: string; defaultGoals: string[]; defaultFlags: string[] };
    jdkRegistry: Record<string, string>;
  }) => void;
}

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const [step, setStep] = useState(0);

  // Maven state
  const [mavenExe, setMavenExe] = useState('mvn');
  const [defaultGoals, setDefaultGoals] = useState('clean install');
  const [defaultFlags, setDefaultFlags] = useState('');

  // JDK registry state
  const [jdks, setJdks] = useState<Array<{ version: string; path: string }>>([]);

  // Roots state
  const [roots, setRoots] = useState<Array<{ name: string; path: string }>>([]);

  function addJdk() {
    setJdks((j) => [...j, { version: '', path: '' }]);
  }
  function removeJdk(index: number) {
    setJdks((j) => j.filter((_, i) => i !== index));
  }
  function updateJdk(index: number, field: 'version' | 'path', value: string) {
    setJdks((j) => j.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addRoot() {
    setRoots((r) => [...r, { name: '', path: '' }]);
  }
  function removeRoot(index: number) {
    setRoots((r) => r.filter((_, i) => i !== index));
  }
  function updateRoot(index: number, field: 'name' | 'path', value: string) {
    setRoots((r) => r.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function browseDirectory(callback: (dir: string) => void) {
    if (window.electronAPI?.openDirectory) {
      const dir = await window.electronAPI.openDirectory();
      if (dir) callback(dir);
    }
  }

  function handleFinish() {
    const rootsObj: Record<string, string> = {};
    for (const r of roots) {
      if (r.name.trim() && r.path.trim()) rootsObj[r.name.trim()] = r.path.trim();
    }
    const jdkObj: Record<string, string> = {};
    for (const j of jdks) {
      if (j.version.trim() && j.path.trim()) jdkObj[j.version.trim()] = j.path.trim();
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
  }

  const steps: Array<{ title: string; description: string; content: ReactNode }> = [
    // Panel 0: Welcome
    {
      title: 'Welcome to GFOS Build',
      description: 'Configure your workspace in a few steps.',
      content: (
        <div className="flex flex-col gap-3 mt-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
            <Wrench size={20} className="text-primary shrink-0" />
            <p className="text-sm text-muted-foreground">
              Set up Maven, JDK paths, and project roots. This config will be saved locally and can
              be edited later.
            </p>
          </div>
        </div>
      ),
    },

    // Panel 1: Maven Setup
    {
      title: 'Maven Configuration',
      description: 'Configure Maven defaults for your build pipelines.',
      content: (
        <div className="flex flex-col gap-4 mt-4">
          <Input
            label="Maven executable"
            placeholder="mvn"
            value={mavenExe}
            onChange={(e) => setMavenExe(e.target.value)}
          />
          <Input
            label="Default goals"
            placeholder="clean install"
            value={defaultGoals}
            onChange={(e) => setDefaultGoals(e.target.value)}
          />
          <Input
            label="Default flags (optional)"
            placeholder="-DskipTests -T 2C"
            value={defaultFlags}
            onChange={(e) => setDefaultFlags(e.target.value)}
          />
        </div>
      ),
    },

    // Panel 2: JDK Registry
    {
      title: 'JDK Registry',
      description: 'Register JDK installations to override JAVA_HOME per pipeline step.',
      content: (
        <div className="flex flex-col gap-3 mt-4">
          <p className="text-xs text-muted-foreground">
            Leave empty to use the system JAVA_HOME. You can add JDKs later in the config file.
          </p>
          {jdks.map((jdk, i) => (
            <div key={i} className="flex items-end gap-2">
              <Input
                label="Version"
                placeholder="e.g. 17"
                value={jdk.version}
                onChange={(e) => updateJdk(i, 'version', e.target.value)}
                className="w-24"
              />
              <div className="flex-1 flex items-end gap-1">
                <Input
                  label="JAVA_HOME path"
                  placeholder="C:\\Program Files\\Java\\jdk-17"
                  value={jdk.path}
                  onChange={(e) => updateJdk(i, 'path', e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void browseDirectory((d) => updateJdk(i, 'path', d))}
                  className="shrink-0 mb-px"
                >
                  <FolderOpen size={14} />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeJdk(i)}
                className="shrink-0 mb-px text-destructive"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addJdk} className="self-start">
            <Plus size={14} /> Add JDK
          </Button>
        </div>
      ),
    },

    // Panel 3: Project Roots
    {
      title: 'Project Roots',
      description:
        'Add directories containing your projects. Reference as name:relative/path in pipeline steps.',
      content: (
        <div className="flex flex-col gap-3 mt-4">
          {roots.map((root, i) => (
            <div key={i} className="flex items-end gap-2">
              <Input
                label="Name"
                placeholder="e.g. monorepo"
                value={root.name}
                onChange={(e) => updateRoot(i, 'name', e.target.value)}
                className="w-32"
              />
              <div className="flex-1 flex items-end gap-1">
                <Input
                  label="Path"
                  placeholder="C:\\dev\\projects"
                  value={root.path}
                  onChange={(e) => updateRoot(i, 'path', e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void browseDirectory((d) => updateRoot(i, 'path', d))}
                  className="shrink-0 mb-px"
                >
                  <FolderOpen size={14} />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeRoot(i)}
                className="shrink-0 mb-px text-destructive"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRoot} className="self-start">
            <Plus size={14} /> Add root
          </Button>
        </div>
      ),
    },
  ];

  const current = steps[step]!;
  const isLast = step === steps.length - 1;
  const canFinish = roots.some((r) => r.name.trim() && r.path.trim());

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>

        <DialogTitle>{current.title}</DialogTitle>
        <DialogDescription>{current.description}</DialogDescription>
        {current.content}

        <Separator className="mt-6" />
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
          >
            <ArrowLeft size={14} /> Back
          </Button>
          {isLast ? (
            <Button size="sm" onClick={handleFinish} disabled={!canFinish}>
              <Check size={14} /> Save & Finish
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>
              Next <ArrowRight size={14} />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
