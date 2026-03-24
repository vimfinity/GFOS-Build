import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Loader2, ChevronDown } from 'lucide-react';
import type { Project } from '@gfos-build/contracts';
import { pickDirectory } from '@/api/bridge';
import { configQuery, scanQuery } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function getRelativeProjectPath(project: Project, roots: Record<string, string>): string {
  const rootPath = roots[project.rootName];
  if (!rootPath) return project.path;
  const norm = project.path.replace(/\\/g, '/');
  const rootNorm = rootPath.replace(/\\/g, '/').replace(/\/$/, '');
  return norm.startsWith(rootNorm) ? norm.slice(rootNorm.length + 1) : project.path;
}

interface ProjectPathPickerProps {
  value: string;
  onChange: (value: string) => void;
  onResolvedPath?: (path: string, project?: Project) => void;
  label?: string;
  description?: string;
  placeholder?: string;
  allowedBuildSystems?: Project['buildSystem'][];
  required?: boolean;
}

export function ProjectPathPicker({
  value,
  onChange,
  onResolvedPath,
  label = 'Project path',
  description,
  placeholder = 'Select a project...',
  allowedBuildSystems,
  required,
}: ProjectPathPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: scanData, isLoading: scanLoading } = useQuery(scanQuery);
  const { data: configData } = useQuery(configQuery);
  const roots = useMemo(() => configData?.config.roots ?? {}, [configData]);

  const displayValue = useMemo(() => {
    if (!value) return '';
    const match = scanData?.projects.find((project) => project.path === value);
    if (match) {
      const relPath = getRelativeProjectPath(match, roots);
      return `${match.name} (${match.rootName}:${relPath})`;
    }
    return value;
  }, [value, scanData, roots]);

  const filtered = useMemo(() => {
    if (!scanData?.projects) return [];
    const eligibleProjects =
      allowedBuildSystems && allowedBuildSystems.length > 0
        ? scanData.projects.filter((project) => allowedBuildSystems.includes(project.buildSystem))
        : scanData.projects;
    if (!query.trim()) return eligibleProjects.slice(0, 20);
    const q = query.toLowerCase();
    return eligibleProjects
      .filter(
        (project) =>
          project.name.toLowerCase().includes(q) ||
          project.path.toLowerCase().includes(q) ||
          (project.maven?.artifactId ?? '').toLowerCase().includes(q) ||
          (project.node?.name ?? '').toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [allowedBuildSystems, scanData, query]);

  useLayoutEffect(() => {
    if (!open) return;
    const inputEl = inputRef.current;
    const dropdownEl = dropdownRef.current;
    if (!inputEl || !dropdownEl) return;

    function applyPosition() {
      if (!inputEl || !dropdownEl) return;
      const rect = inputEl.getBoundingClientRect();
      const gap = 6;
      const maxHeight = 240;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      dropdownEl.style.left = `${rect.left}px`;
      dropdownEl.style.width = `${rect.width}px`;
      if (spaceBelow >= 120 || spaceBelow >= spaceAbove) {
        dropdownEl.style.top = `${rect.bottom + gap}px`;
        dropdownEl.style.bottom = '';
        dropdownEl.style.maxHeight = `${Math.max(Math.min(maxHeight, spaceBelow), 80)}px`;
      } else {
        dropdownEl.style.top = '';
        dropdownEl.style.bottom = `${window.innerHeight - rect.top + gap}px`;
        dropdownEl.style.maxHeight = `${Math.max(Math.min(maxHeight, spaceAbove), 80)}px`;
      }
    }

    applyPosition();
    window.addEventListener('scroll', applyPosition, { capture: true, passive: true });
    window.addEventListener('resize', applyPosition, { passive: true } as EventListenerOptions);
    return () => {
      window.removeEventListener(
        'scroll',
        applyPosition,
        { capture: true } as EventListenerOptions,
      );
      window.removeEventListener('resize', applyPosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  async function handleBrowse(event: React.MouseEvent) {
    event.preventDefault();
    const dir = await pickDirectory();
    if (dir) {
      onChange(dir);
      onResolvedPath?.(dir);
      setOpen(false);
      setQuery('');
    }
  }

  function selectProject(project: Project) {
    onChange(project.path);
    onResolvedPath?.(project.path, project);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (open) {
        event.nativeEvent.stopImmediatePropagation();
      }
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const trimmed = query.trim();
      if (trimmed && /^([A-Za-z]:[/\\]|\/)/.test(trimmed)) {
        onChange(trimmed);
        onResolvedPath?.(trimmed);
        setOpen(false);
        setQuery('');
      } else if (filtered.length > 0 && filtered[0]) {
        selectProject(filtered[0]);
      }
    }
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            value={open ? query : displayValue}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              setOpen(true);
              setQuery('');
            }}
            onClick={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={open ? 'Search projects or type an absolute path...' : placeholder}
            className="field-input h-11 w-full rounded-2xl border pl-4 pr-10 [background:var(--field-bg)] [border-color:var(--field-border)] focus:outline-none focus:border-ring focus:[box-shadow:0_0_0_1px_var(--color-ring)]"
          />
          <ChevronDown
            size={15}
            className={cn(
              'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </div>

        <Tooltip content="Browse directory" side="bottom">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={(event) => void handleBrowse(event)}
            aria-label="Browse directory"
          >
            <FolderOpen size={14} />
          </Button>
        </Tooltip>
      </div>
      {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}

      {open &&
        createPortal(
          <div ref={dropdownRef} className="glass-card listbox-panel fixed z-[9999] overflow-auto">
            {scanLoading ? (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                <Loader2 size={12} className="shrink-0 animate-spin" />
                Loading projects...
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted-foreground">
                {query.trim() ? 'No matching projects' : 'No projects found'}
              </div>
            ) : (
              filtered.map((project) => {
                const relPath = getRelativeProjectPath(project, roots);
                return (
                  <button
                    key={project.path}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectProject(project)}
                    className={cn(
                      'listbox-option transition-colors',
                      value === project.path && 'is-active',
                    )}
                  >
                    <span
                      className={cn(
                        'pill-meta font-semibold',
                        project.buildSystem === 'maven'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-success/10 text-success',
                      )}
                    >
                      {project.buildSystem === 'maven' ? 'Maven' : 'Node'}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-foreground">
                      {project.name}
                    </span>
                    <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                      {relPath}
                    </span>
                  </button>
                );
              })
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
