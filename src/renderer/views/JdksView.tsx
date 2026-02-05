/**
 * JDKs View - JDK Version Management
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Coffee, Plus, Trash2, Star, FolderOpen,
  Check, ExternalLink
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { ConfirmDialog } from '../components/shared';

export default function JdksView() {
  const { jdks, setDefaultJdk, removeJdk, addJdk } = useAppStore();
  
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; jdkId: string | null }>({
    isOpen: false,
    jdkId: null
  });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newJdk, setNewJdk] = useState({ version: '', vendor: '', path: '' });

  const handleDelete = () => {
    if (deleteDialog.jdkId) {
      removeJdk(deleteDialog.jdkId);
      setDeleteDialog({ isOpen: false, jdkId: null });
    }
  };

  const handleAddJdk = () => {
    if (newJdk.version && newJdk.path) {
      addJdk({
        id: Date.now().toString(),
        version: newJdk.version,
        vendor: newJdk.vendor || 'Unknown',
        path: newJdk.path,
        isDefault: jdks.length === 0,
      });
      setNewJdk({ version: '', vendor: '', path: '' });
      setIsAddingNew(false);
    }
  };

  const defaultJdk = jdks.find(j => j.isDefault);

  return (
    <>
      {/* Page Header */}
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <Coffee size={28} />
          <div>
            <h1 className="text-2xl font-bold text-dark-500 dark:text-light-100">JDK Versionen</h1>
            <p className="text-sm text-dark-300 dark:text-light-400">{jdks.length} JDK{jdks.length !== 1 ? 's' : ''} konfiguriert</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors">
            <FolderOpen size={18} />
            <span>Automatisch erkennen</span>
          </button>
          <button 
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors"
            onClick={() => setIsAddingNew(true)}
          >
            <Plus size={18} />
            <span>JDK hinzufügen</span>
          </button>
        </div>
      </motion.div>

      {/* Default JDK Info */}
      {defaultJdk && (
        <motion.div 
          className="flex items-center gap-4 mt-6 p-4 bg-petrol-50 dark:bg-petrol-900/20 rounded-xl border border-petrol-200 dark:border-petrol-800"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-petrol-100 dark:bg-petrol-900/40 text-petrol-500">
            <Star size={20} />
          </div>
          <div className="flex-1">
            <span className="text-xs font-medium text-petrol-600 dark:text-petrol-400 uppercase tracking-wide">Standard JDK</span>
            <span className="block text-dark-500 dark:text-light-100 font-medium">
              {defaultJdk.vendor} {defaultJdk.version}
            </span>
          </div>
          <code className="px-3 py-1.5 bg-white/60 dark:bg-dark-800/60 rounded-lg text-sm text-dark-400 dark:text-light-300">{defaultJdk.path}</code>
        </motion.div>
      )}

      {/* JDKs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <AnimatePresence>
          {/* Add New JDK Form */}
          {isAddingNew && (
            <motion.div
              className="bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border-2 border-dashed border-petrol-300 dark:border-petrol-700 p-6"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="space-y-4">
                <h3 className="font-semibold text-dark-500 dark:text-light-100">Neues JDK hinzufügen</h3>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-dark-400 dark:text-light-300">Version</label>
                  <input
                    type="text"
                    placeholder="z.B. 21.0.2"
                    value={newJdk.version}
                    onChange={(e) => setNewJdk({ ...newJdk, version: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-dark-400 dark:text-light-300">Hersteller</label>
                  <input
                    type="text"
                    placeholder="z.B. Eclipse Temurin"
                    value={newJdk.vendor}
                    onChange={(e) => setNewJdk({ ...newJdk, vendor: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-dark-400 dark:text-light-300">Pfad (JAVA_HOME)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="C:\dev\java\jdk21"
                      value={newJdk.path}
                      onChange={(e) => setNewJdk({ ...newJdk, path: e.target.value })}
                      className="flex-1 px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                    />
                    <button className="flex items-center justify-center w-10 h-10 rounded-xl bg-light-200 dark:bg-dark-700 text-dark-400 hover:bg-light-300 dark:hover:bg-dark-600 transition-colors">
                      <FolderOpen size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors"
                    onClick={() => {
                      setIsAddingNew(false);
                      setNewJdk({ version: '', vendor: '', path: '' });
                    }}
                  >
                    Abbrechen
                  </button>
                  <button 
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors disabled:opacity-50"
                    onClick={handleAddJdk}
                    disabled={!newJdk.version || !newJdk.path}
                  >
                    <Check size={18} />
                    <span>Hinzufügen</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* JDK Cards */}
          {jdks.map((jdk, i) => (
            <motion.div
              key={jdk.id}
              className={`bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border ${jdk.isDefault ? 'border-petrol-300 dark:border-petrol-700 ring-1 ring-petrol-200 dark:ring-petrol-800' : 'border-gray-200/50 dark:border-white/10'} shadow-sm p-6`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              layout
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-petrol-100 dark:bg-petrol-900/30 text-petrol-500">
                  <Coffee size={28} />
                </div>
                {jdk.isDefault && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-petrol-100 dark:bg-petrol-900/30 text-petrol-600 dark:text-petrol-400">
                    <Star size={12} />
                    Standard
                  </span>
                )}
              </div>

              <div className="mb-4">
                <h3 className="text-xl font-bold text-dark-500 dark:text-light-100">{jdk.version}</h3>
                <span className="text-sm text-dark-300 dark:text-light-400">{jdk.vendor}</span>
              </div>

              <div className="flex items-center gap-2 mb-4 p-2 bg-light-100 dark:bg-dark-700 rounded-lg">
                <code className="flex-1 text-xs text-dark-400 dark:text-light-400 truncate">{jdk.path}</code>
                <button className="flex items-center justify-center w-6 h-6 text-dark-300 hover:text-petrol-500 transition-colors" title="Im Explorer öffnen">
                  <ExternalLink size={14} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!jdk.isDefault && (
                  <button 
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 text-sm font-medium rounded-lg hover:bg-light-300 dark:hover:bg-dark-600 transition-colors"
                    onClick={() => setDefaultJdk(jdk.id)}
                  >
                    <Star size={16} />
                    <span>Als Standard</span>
                  </button>
                )}
                <button 
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400 hover:bg-error-200 dark:hover:bg-error-900/50 transition-colors disabled:opacity-50"
                  onClick={() => setDeleteDialog({ isOpen: true, jdkId: jdk.id })}
                  disabled={jdk.isDefault}
                  title={jdk.isDefault ? 'Standard-JDK kann nicht entfernt werden' : 'Entfernen'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {jdks.length === 0 && !isAddingNew && (
          <motion.div 
            className="col-span-full flex flex-col items-center justify-center py-16 text-center text-dark-300"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Coffee size={48} className="mb-4 text-dark-200" />
            <h3 className="text-lg font-semibold text-dark-400 dark:text-light-200 mb-2">Keine JDKs konfiguriert</h3>
            <p className="text-dark-300 dark:text-light-400 mb-6">Füge ein JDK hinzu um Builds auszuführen.</p>
            <button 
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors"
              onClick={() => setIsAddingNew(true)}
            >
              <Plus size={18} />
              <span>JDK hinzufügen</span>
            </button>
          </motion.div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="JDK entfernen"
        message="Möchtest du dieses JDK wirklich entfernen? Projekte die dieses JDK verwenden müssen neu konfiguriert werden."
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, jdkId: null })}
      />
    </>
  );
}
