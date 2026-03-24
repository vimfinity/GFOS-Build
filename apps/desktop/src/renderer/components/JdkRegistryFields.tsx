import { useState } from 'react';
import { FolderOpen, Search, Plus, Trash2 } from 'lucide-react';
import { pickDirectory } from '@/api/bridge';
import { useDetectJdks } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface JdkRegistryEntry {
  version: string;
  path: string;
  source?: 'manual' | 'detected';
}

interface JdkRegistryFieldsProps {
  entries: JdkRegistryEntry[];
  onChange: (entries: JdkRegistryEntry[]) => void;
  emptyMessage: string;
}

function sortEntries(entries: JdkRegistryEntry[]): JdkRegistryEntry[] {
  return [...entries].sort((left, right) => {
    const leftVersion = Number(left.version);
    const rightVersion = Number(right.version);

    if (!Number.isNaN(leftVersion) && !Number.isNaN(rightVersion) && left.version && right.version) {
      return leftVersion - rightVersion;
    }

    if (!left.version.trim()) return 1;
    if (!right.version.trim()) return -1;
    return left.version.localeCompare(right.version);
  });
}

export function JdkRegistryFields({
  entries,
  onChange,
  emptyMessage,
}: JdkRegistryFieldsProps) {
  const detectJdks = useDetectJdks();
  const [status, setStatus] = useState<{ tone: 'success' | 'warning' | 'destructive'; text: string } | null>(null);

  function updateEntry(index: number, field: 'version' | 'path', value: string) {
    onChange(
      entries.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              [field]: value,
              source: 'manual',
            }
          : entry,
      ),
    );
  }

  function addEntry() {
    onChange([...entries, { version: '', path: '', source: 'manual' }]);
  }

  function removeEntry(index: number) {
    onChange(entries.filter((_, entryIndex) => entryIndex !== index));
  }

  async function browseJdk(index: number) {
    const directory = await pickDirectory();
    if (!directory) return;
    updateEntry(index, 'path', directory);
  }

  async function detectFromFolder() {
    const directory = await pickDirectory();
    if (!directory) return;

    setStatus(null);

    try {
      const result = await detectJdks.mutateAsync(directory);
      if (result.jdks.length === 0) {
        setStatus({
          tone: 'warning',
          text: `No JDK homes were detected under ${result.baseDir}. Select a parent directory like J:\\dev\\java or a single JDK home like J:\\dev\\java\\jdk21.`,
        });
        return;
      }

      const merged = [...entries];
      let added = 0;
      let skipped = 0;

      for (const detected of result.jdks) {
        const version = detected.version.trim();
        const existingIndex = merged.findIndex((entry) => entry.version.trim() === version);

        if (existingIndex >= 0) {
          skipped += 1;
          continue;
        }

        merged.push({
          version,
          path: detected.path,
          source: 'detected',
        });
        added += 1;
      }

      onChange(sortEntries(merged));
      setStatus({
        tone: added > 0 ? 'success' : 'warning',
        text:
          added > 0
            ? `Detected ${result.jdks.length} JDK ${result.jdks.length === 1 ? 'home' : 'homes'} from ${result.baseDir}. Added ${added}${skipped > 0 ? ` and skipped ${skipped} already-registered version${skipped === 1 ? '' : 's'}` : ''}.`
            : `Detected ${result.jdks.length} JDK ${result.jdks.length === 1 ? 'home' : 'homes'} from ${result.baseDir}, but every detected major version already exists in the registry.`,
      });
    } catch (error) {
      setStatus({
        tone: 'destructive',
        text: error instanceof Error ? error.message : 'Could not detect JDKs from that folder.',
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[18px] border border-border bg-card/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Add the <span className="font-mono text-foreground">JDK home</span> itself, not its
        {' '}
        <span className="font-mono text-foreground">bin</span> folder.
        {' '}
        A valid entry looks like <span className="font-mono text-foreground">J:\dev\java\jdk21</span>
        {' '}
        and should contain a top-level <span className="font-mono text-foreground">release</span> file plus
        {' '}
        <span className="font-mono text-foreground">bin\javac.exe</span>.
        {' '}
        If you keep several JDKs under one parent like <span className="font-mono text-foreground">J:\dev\java</span>,
        use <span className="font-medium text-foreground">Detect from folder</span> to import them.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void detectFromFolder()}
          disabled={detectJdks.isPending}
        >
          <Search size={13} className={cn(detectJdks.isPending && 'animate-pulse')} />
          Detect from folder
        </Button>
        <Button variant="outline" size="sm" onClick={addEntry}>
          <Plus size={13} />
          Add JDK
        </Button>
      </div>

      {status ? (
        <div
          className={cn(
            'rounded-[18px] border px-4 py-3 text-xs leading-relaxed',
            status.tone === 'success' && 'border-success/20 bg-success/8 text-muted-foreground',
            status.tone === 'warning' && 'border-warning/20 bg-warning/8 text-warning',
            status.tone === 'destructive' && 'border-destructive/20 bg-destructive/8 text-destructive',
          )}
        >
          {status.text}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry, index) => (
            <div key={`${entry.version}:${entry.path}:${index}`} className="rounded-[18px] border border-border bg-secondary/45 p-3">
              <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_auto_auto]">
                <Input
                  placeholder="e.g. 17"
                  value={entry.version}
                  onChange={(event) => updateEntry(index, 'version', event.target.value)}
                />
                <Input
                  placeholder="J:\dev\java\jdk17"
                  value={entry.path}
                  onChange={(event) => updateEntry(index, 'path', event.target.value)}
                />
                <Tooltip content="Browse JDK home" side="bottom">
                  <Button variant="outline" size="icon" onClick={() => void browseJdk(index)} aria-label="Browse JDK home">
                    <FolderOpen size={14} />
                  </Button>
                </Tooltip>
                <Tooltip content="Remove JDK entry" side="bottom">
                  <Button variant="destructive" size="icon" onClick={() => removeEntry(index)} aria-label="Remove JDK entry">
                    <Trash2 size={14} />
                  </Button>
                </Tooltip>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] leading-relaxed text-muted-foreground/72">
                  Use the major version only, for example <span className="font-mono">17</span> or <span className="font-mono">21</span>.
                </span>
                {entry.source === 'detected' ? (
                  <span className="pill-meta rounded-full bg-success/10 text-success">Detected</span>
                ) : (
                  <span className="pill-meta rounded-full bg-secondary text-muted-foreground">Manual</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
