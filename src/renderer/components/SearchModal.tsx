/**
 * SearchModal - Global Command Palette Style Search with Fuzzy Search
 * Ctrl+K to open, search across projects, builds, pipelines, modules
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, FolderGit2, Play, Workflow, Coffee, Box,
  ArrowRight, Command
} from 'lucide-react';
import Fuse from 'fuse.js';
import { useAppStore } from '../store/useAppStore';
import type { SearchResult } from '../types';

// Extended search result type for modules
interface ExtendedSearchResult extends SearchResult {
  projectId?: string;
  modulePath?: string;
}

export default function SearchModal() {
  const {
    isSearchOpen,
    setIsSearchOpen,
    projects,
    buildJobs,
    pipelines,
    jdks,
    setActiveView,
    setSelectedProject,
    setSelectedJobId,
    setSelectedPipelineId,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [category, setCategory] = useState<'all' | 'projects' | 'builds' | 'pipelines' | 'jdks' | 'modules'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Create fuzzy search instances
  const projectsFuse = useMemo(() => new Fuse(projects, {
    keys: ['name', 'path', 'branch', 'jdk'],
    threshold: 0.4,
    includeScore: true,
  }), [projects]);

  const buildsFuse = useMemo(() => new Fuse(buildJobs, {
    keys: ['projectName', 'goals', 'jdk', 'status'],
    threshold: 0.4,
    includeScore: true,
  }), [buildJobs]);

  const pipelinesFuse = useMemo(() => new Fuse(pipelines, {
    keys: ['name', 'steps.name', 'steps.goals'],
    threshold: 0.4,
    includeScore: true,
  }), [pipelines]);

  const jdksFuse = useMemo(() => new Fuse(jdks, {
    keys: ['version', 'vendor', 'path'],
    threshold: 0.4,
    includeScore: true,
  }), [jdks]);

  // Perform fuzzy search
  const searchResults = useMemo((): ExtendedSearchResult[] => {
    if (!query.trim()) return [];

    const results: ExtendedSearchResult[] = [];

    // Search projects
    if (category === 'all' || category === 'projects') {
      const projectResults = projectsFuse.search(query).slice(0, 5);
      projectResults.forEach(({ item }) => {
        results.push({
          id: item.id,
          type: 'project',
          title: item.name,
          subtitle: item.path,
        });
      });
    }

    // Search builds
    if (category === 'all' || category === 'builds') {
      const buildResults = buildsFuse.search(query).slice(0, 5);
      buildResults.forEach(({ item }) => {
        results.push({
          id: item.id,
          type: 'build',
          title: item.projectName,
          subtitle: `${item.goals} - ${item.status}`,
        });
      });
    }

    // Search pipelines
    if (category === 'all' || category === 'pipelines') {
      const pipelineResults = pipelinesFuse.search(query).slice(0, 5);
      pipelineResults.forEach(({ item }) => {
        results.push({
          id: item.id,
          type: 'pipeline',
          title: item.name,
          subtitle: `${item.steps.length} Schritte`,
        });
      });
    }

    // Search JDKs
    if (category === 'all' || category === 'jdks') {
      const jdkResults = jdksFuse.search(query).slice(0, 5);
      jdkResults.forEach(({ item }) => {
        results.push({
          id: item.id,
          type: 'jdk',
          title: `Java ${item.version}`,
          subtitle: `${item.vendor} - ${item.path}`,
        });
      });
    }

    return results.slice(0, 15);
  }, [query, category, projectsFuse, buildsFuse, pipelinesFuse, jdksFuse]);

  // Focus input when opened
  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
      setCategory('all');
    }
  }, [isSearchOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedEl = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = useCallback((result: ExtendedSearchResult) => {
    switch (result.type) {
      case 'project': {
        const project = projects.find(p => p.id === result.id);
        if (project) setSelectedProject(project);
        setActiveView('projects');
        break;
      }
      case 'build':
        setSelectedJobId(result.id);
        setActiveView('job-log');
        break;
      case 'pipeline':
        setSelectedPipelineId(result.id);
        setActiveView('pipelines');
        break;
      case 'jdk':
        setActiveView('jdks');
        break;
    }
    setIsSearchOpen(false);
  }, [projects, setSelectedProject, setActiveView, setSelectedJobId, setSelectedPipelineId, setIsSearchOpen]);

  const searchCategories = useMemo<
    ('all' | 'projects' | 'builds' | 'pipelines' | 'jdks' | 'modules')[]
  >(() => ['all', 'projects', 'builds', 'pipelines', 'jdks', 'modules'], []);

  // Keyboard navigation
  useEffect(() => {
    if (!isSearchOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, searchResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (searchResults[selectedIndex]) {
            handleSelect(searchResults[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsSearchOpen(false);
          break;
        case 'Tab': {
          e.preventDefault();
          // Cycle through categories
          const currentIdx = searchCategories.indexOf(category);
          setCategory(searchCategories[(currentIdx + 1) % searchCategories.length]);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, searchResults, selectedIndex, setIsSearchOpen, handleSelect, category, searchCategories]);

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'project': return <FolderGit2 size={18} />;
      case 'build': return <Play size={18} />;
      case 'pipeline': return <Workflow size={18} />;
      case 'jdk': return <Coffee size={18} />;
      default: return <Box size={18} />;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'project': return 'Projekt';
      case 'build': return 'Build';
      case 'pipeline': return 'Pipeline';
      case 'jdk': return 'JDK';
      default: return '';
    }
  };

  const categoryLabels = {
    all: 'Alle',
    projects: 'Projekte',
    builds: 'Builds',
    pipelines: 'Pipelines',
    jdks: 'JDKs',
    modules: 'Module',
  };

  if (!isSearchOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 bg-dark-900/40 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setIsSearchOpen(false)}
      >
        <motion.div 
          className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-light-300 dark:border-dark-600"
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-light-300 dark:border-dark-600">
            <Search size={20} className="text-dark-300 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche nach Projekten, Builds, Pipelines, Modulen..."
              className="flex-1 bg-transparent text-dark-500 dark:text-light-100 placeholder:text-dark-300 outline-none text-base"
            />
            <kbd className="flex items-center gap-1 px-2 py-1 text-xs bg-light-200 dark:bg-dark-600 text-dark-400 rounded border border-light-400 dark:border-dark-500">
              Esc
            </kbd>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 px-4 py-2 border-b border-light-300 dark:border-dark-600 bg-light-100 dark:bg-dark-700/50">
            {(Object.keys(categoryLabels) as (keyof typeof categoryLabels)[]).filter(k => k !== 'modules').map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  category === cat
                    ? 'bg-petrol-500 text-white'
                    : 'text-dark-400 dark:text-light-400 hover:bg-light-200 dark:hover:bg-dark-600'
                }`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
            <span className="ml-auto text-xs text-dark-300 flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-light-200 dark:bg-dark-600 rounded">Tab</kbd>
              zum Wechseln
            </span>
          </div>

          {/* Results */}
          <div ref={resultsRef} className="max-h-80 overflow-y-auto">
            {query && searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-dark-300">
                <Search size={32} className="mb-3 opacity-50" />
                <p className="text-sm">Keine Ergebnisse für "<span className="font-medium text-dark-500 dark:text-light-100">{query}</span>"</p>
              </div>
            ) : query ? (
              searchResults.map((result, index) => (
                <div
                  key={`${result.type}-${result.id}`}
                  className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-all ${
                    index === selectedIndex 
                      ? 'bg-petrol-50 dark:bg-petrol-900/30' 
                      : 'hover:bg-light-100 dark:hover:bg-dark-700'
                  }`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${
                    index === selectedIndex 
                      ? 'bg-petrol-100 dark:bg-petrol-800/50 text-petrol-600' 
                      : 'bg-light-200 dark:bg-dark-600 text-dark-400 dark:text-light-400'
                  }`}>
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-dark-500 dark:text-light-100 truncate">
                      {result.title}
                    </span>
                    {result.subtitle && (
                      <span className="block text-xs text-dark-300 dark:text-light-400 truncate">
                        {result.subtitle}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-dark-300 px-2 py-0.5 bg-light-200 dark:bg-dark-600 rounded">
                    {getTypeLabel(result.type)}
                  </span>
                  <ArrowRight size={16} className={`transition-opacity ${index === selectedIndex ? 'opacity-100 text-petrol-500' : 'opacity-0'}`} />
                </div>
              ))
            ) : (
              <div className="p-4">
                <p className="text-xs font-medium text-dark-300 mb-3 px-1">Schnellzugriff</p>
                <div className="space-y-1">
                  <QuickAction 
                    icon={<FolderGit2 size={18} />} 
                    label="Projekte" 
                    shortcut="Ctrl+2"
                    onClick={() => { setActiveView('projects'); setIsSearchOpen(false); }}
                  />
                  <QuickAction 
                    icon={<Play size={18} />} 
                    label="Builds" 
                    shortcut="Ctrl+3"
                    onClick={() => { setActiveView('builds'); setIsSearchOpen(false); }}
                  />
                  <QuickAction 
                    icon={<Coffee size={18} />} 
                    label="JDKs" 
                    shortcut="Ctrl+4"
                    onClick={() => { setActiveView('jdks'); setIsSearchOpen(false); }}
                  />
                  <QuickAction 
                    icon={<Workflow size={18} />} 
                    label="Pipelines" 
                    shortcut="Ctrl+5"
                    onClick={() => { setActiveView('pipelines'); setIsSearchOpen(false); }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-light-300 dark:border-dark-600 bg-light-100 dark:bg-dark-700/50 text-xs text-dark-300">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-light-200 dark:bg-dark-600 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-light-200 dark:bg-dark-600 rounded">↓</kbd>
                Navigieren
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-light-200 dark:bg-dark-600 rounded">↵</kbd>
                Auswählen
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Command size={12} />K zum Öffnen
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function QuickAction({ icon, label, shortcut, onClick }: { 
  icon: React.ReactNode; 
  label: string; 
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <div 
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-light-200 dark:hover:bg-dark-600 transition-colors"
      onClick={onClick}
    >
      <div className="text-dark-400 dark:text-light-400">{icon}</div>
      <span className="flex-1 text-sm text-dark-500 dark:text-light-100">{label}</span>
      <kbd className="px-2 py-0.5 text-xs bg-light-200 dark:bg-dark-600 text-dark-400 rounded border border-light-400 dark:border-dark-500">
        {shortcut}
      </kbd>
    </div>
  );
}
