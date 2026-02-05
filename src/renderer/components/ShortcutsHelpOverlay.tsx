/**
 * ShortcutsHelpOverlay - Keyboard Shortcuts Reference
 * Shows all available keyboard shortcuts
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';
import { useKeyboardShortcuts, formatShortcutKeys } from '../hooks/useKeyboardShortcuts';

export default function ShortcutsHelpOverlay() {
  const { groupedShortcuts, isShortcutsHelpOpen, setIsShortcutsHelpOpen } = useKeyboardShortcuts();

  if (!isShortcutsHelpOpen) return null;

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    action: 'Aktionen',
    dialog: 'Dialoge',
  };

  return (
    <AnimatePresence>
      <motion.div 
        className="gfos-shortcuts-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setIsShortcutsHelpOpen(false)}
      >
        <motion.div 
          className="gfos-shortcuts-modal"
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="gfos-shortcuts-header">
            <div className="gfos-shortcuts-title">
              <Keyboard size={24} />
              <h2>Tastenkürzel</h2>
            </div>
            <button 
              className="gfos-icon-btn-sm"
              onClick={() => setIsShortcutsHelpOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          {/* Shortcuts List */}
          <div className="gfos-shortcuts-content">
            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category} className="gfos-shortcuts-category">
                <h3>{categoryLabels[category] || category}</h3>
                <div className="gfos-shortcuts-list">
                  {shortcuts.map((shortcut, index) => (
                    <div key={index} className="gfos-shortcut-item">
                      <span className="gfos-shortcut-description">
                        {shortcut.description}
                      </span>
                      <kbd className="gfos-shortcut-keys">
                        {formatShortcutKeys(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="gfos-shortcuts-footer">
            <span>Drücke <kbd>?</kbd> um diese Hilfe anzuzeigen</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
