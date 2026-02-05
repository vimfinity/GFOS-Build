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
        className="fixed inset-0 z-50 flex items-center justify-center bg-dark-900/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setIsShortcutsHelpOpen(false)}
      >
        <motion.div 
          className="w-full max-w-lg mx-4 bg-white dark:bg-dark-800 rounded-2xl shadow-2xl border border-light-200 dark:border-dark-700 overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-light-200 dark:border-dark-700">
            <div className="flex items-center gap-3">
              <Keyboard size={24} className="text-petrol-500" />
              <h2 className="text-lg font-semibold text-dark-500 dark:text-light-100">Tastenkürzel</h2>
            </div>
            <button 
              className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:bg-light-200 dark:hover:bg-dark-700 transition-colors"
              onClick={() => setIsShortcutsHelpOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          {/* Shortcuts List */}
          <div className="p-5 max-h-[60vh] overflow-y-auto">
            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="text-xs font-semibold text-dark-300 dark:text-light-400 uppercase tracking-wide mb-3">{categoryLabels[category] || category}</h3>
                <div className="space-y-2">
                  {shortcuts.map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <span className="text-sm text-dark-500 dark:text-light-100">
                        {shortcut.description}
                      </span>
                      <kbd className="inline-flex items-center gap-1 px-2.5 py-1 bg-light-200 dark:bg-dark-700 text-dark-400 dark:text-light-300 text-xs font-mono rounded-lg border border-light-300 dark:border-dark-600">
                        {formatShortcutKeys(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center p-4 bg-light-100 dark:bg-dark-700/50 border-t border-light-200 dark:border-dark-700">
            <span className="text-sm text-dark-300 dark:text-light-400">Drücke <kbd className="inline-flex items-center px-1.5 py-0.5 mx-1 bg-light-200 dark:bg-dark-700 text-dark-400 dark:text-light-300 text-xs font-mono rounded border border-light-300 dark:border-dark-600">?</kbd> um diese Hilfe anzuzeigen</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
