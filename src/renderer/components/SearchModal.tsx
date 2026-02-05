/**
 * SearchModal - Global Command Palette Style Search
 * Ctrl+K to open, search across projects, builds, pipelines
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, FolderGit2, Play, Workflow, Coffee,
  ArrowRight
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { SearchResult } from '../types';

export default function SearchModal() {
  const {
    isSearchOpen,
    setIsSearchOpen,
    searchResults,
    performSearch,
    setActiveView,
    setSelectedProject,
    setSelectedJobId,
    setSelectedPipelineId,
    projects
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isSearchOpen]);

  // Perform search on query change
  useEffect(() => {
    performSearch(query);
    setSelectedIndex(0);
  }, [query, performSearch]);

  const handleSelect = useCallback((result: SearchResult) => {
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, searchResults, selectedIndex, setIsSearchOpen, handleSelect]);

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'project': return <FolderGit2 size={18} />;
      case 'build': return <Play size={18} />;
      case 'pipeline': return <Workflow size={18} />;
      case 'jdk': return <Coffee size={18} />;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'project': return 'Projekt';
      case 'build': return 'Build';
      case 'pipeline': return 'Pipeline';
      case 'jdk': return 'JDK';
    }
  };

  if (!isSearchOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="gfos-search-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setIsSearchOpen(false)}
      >
        <motion.div 
          className="gfos-search-modal"
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="gfos-search-input-container">
            <Search size={20} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche nach Projekten, Builds, Pipelines..."
              className="gfos-search-input"
            />
            <div className="gfos-search-shortcut">
              <kbd>Esc</kbd>
            </div>
          </div>

          {/* Results */}
          <div className="gfos-search-results">
            {query && searchResults.length === 0 ? (
              <div className="gfos-search-empty">
                <Search size={32} />
                <p>Keine Ergebnisse für "{query}"</p>
              </div>
            ) : query ? (
              searchResults.map((result, index) => (
                <div
                  key={`${result.type}-${result.id}`}
                  className={`gfos-search-result ${index === selectedIndex ? 'gfos-search-selected' : ''}`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="gfos-search-result-icon">
                    {getIcon(result.type)}
                  </div>
                  <div className="gfos-search-result-content">
                    <span className="gfos-search-result-title">{result.title}</span>
                    {result.subtitle && (
                      <span className="gfos-search-result-subtitle">{result.subtitle}</span>
                    )}
                  </div>
                  <span className="gfos-search-result-type">{getTypeLabel(result.type)}</span>
                  <ArrowRight size={16} className="gfos-search-result-arrow" />
                </div>
              ))
            ) : (
              <div className="gfos-search-hints">
                <p className="gfos-search-hints-title">Schnellzugriff</p>
                <div className="gfos-search-hint-item" onClick={() => { setActiveView('projects'); setIsSearchOpen(false); }}>
                  <FolderGit2 size={18} />
                  <span>Projekte</span>
                  <kbd>Ctrl+2</kbd>
                </div>
                <div className="gfos-search-hint-item" onClick={() => { setActiveView('builds'); setIsSearchOpen(false); }}>
                  <Play size={18} />
                  <span>Builds</span>
                  <kbd>Ctrl+3</kbd>
                </div>
                <div className="gfos-search-hint-item" onClick={() => { setActiveView('pipelines'); setIsSearchOpen(false); }}>
                  <Workflow size={18} />
                  <span>Pipelines</span>
                  <kbd>Ctrl+5</kbd>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="gfos-search-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigieren</span>
            <span><kbd>↵</kbd> Auswählen</span>
            <span><kbd>Esc</kbd> Schließen</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
