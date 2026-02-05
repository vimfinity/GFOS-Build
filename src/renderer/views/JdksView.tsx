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
        className="gfos-page-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="gfos-page-title">
          <Coffee size={28} />
          <div>
            <h1>JDK Versionen</h1>
            <p>{jdks.length} JDK{jdks.length !== 1 ? 's' : ''} konfiguriert</p>
          </div>
        </div>
        <div className="gfos-page-actions">
          <button className="gfos-secondary-btn">
            <FolderOpen size={18} />
            <span>Automatisch erkennen</span>
          </button>
          <button 
            className="gfos-primary-btn"
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
          className="gfos-default-jdk-banner"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="gfos-banner-icon">
            <Star size={20} />
          </div>
          <div className="gfos-banner-content">
            <span className="gfos-banner-label">Standard JDK</span>
            <span className="gfos-banner-value">
              {defaultJdk.vendor} {defaultJdk.version}
            </span>
          </div>
          <code className="gfos-banner-path">{defaultJdk.path}</code>
        </motion.div>
      )}

      {/* JDKs Grid */}
      <div className="gfos-jdks-grid-full">
        <AnimatePresence>
          {/* Add New JDK Form */}
          {isAddingNew && (
            <motion.div
              className="gfos-jdk-card-full gfos-jdk-new"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="gfos-jdk-form">
                <h3>Neues JDK hinzufügen</h3>
                
                <div className="gfos-form-group">
                  <label>Version</label>
                  <input
                    type="text"
                    placeholder="z.B. 21.0.2"
                    value={newJdk.version}
                    onChange={(e) => setNewJdk({ ...newJdk, version: e.target.value })}
                  />
                </div>
                
                <div className="gfos-form-group">
                  <label>Hersteller</label>
                  <input
                    type="text"
                    placeholder="z.B. Eclipse Temurin"
                    value={newJdk.vendor}
                    onChange={(e) => setNewJdk({ ...newJdk, vendor: e.target.value })}
                  />
                </div>
                
                <div className="gfos-form-group">
                  <label>Pfad (JAVA_HOME)</label>
                  <div className="gfos-input-with-btn">
                    <input
                      type="text"
                      placeholder="C:\dev\java\jdk21"
                      value={newJdk.path}
                      onChange={(e) => setNewJdk({ ...newJdk, path: e.target.value })}
                    />
                    <button className="gfos-icon-btn-sm">
                      <FolderOpen size={16} />
                    </button>
                  </div>
                </div>

                <div className="gfos-form-actions">
                  <button 
                    className="gfos-secondary-btn"
                    onClick={() => {
                      setIsAddingNew(false);
                      setNewJdk({ version: '', vendor: '', path: '' });
                    }}
                  >
                    Abbrechen
                  </button>
                  <button 
                    className="gfos-primary-btn"
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
              className={`gfos-jdk-card-full ${jdk.isDefault ? 'gfos-jdk-is-default' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              layout
            >
              <div className="gfos-jdk-header">
                <div className="gfos-jdk-icon-lg">
                  <Coffee size={28} />
                </div>
                {jdk.isDefault && (
                  <span className="gfos-default-badge">
                    <Star size={12} />
                    Standard
                  </span>
                )}
              </div>

              <div className="gfos-jdk-body">
                <h3 className="gfos-jdk-version-lg">{jdk.version}</h3>
                <span className="gfos-jdk-vendor-lg">{jdk.vendor}</span>
              </div>

              <div className="gfos-jdk-path">
                <code>{jdk.path}</code>
                <button className="gfos-icon-btn-sm" title="Im Explorer öffnen">
                  <ExternalLink size={14} />
                </button>
              </div>

              <div className="gfos-jdk-actions">
                {!jdk.isDefault && (
                  <button 
                    className="gfos-secondary-btn gfos-btn-sm"
                    onClick={() => setDefaultJdk(jdk.id)}
                  >
                    <Star size={16} />
                    <span>Als Standard</span>
                  </button>
                )}
                <button 
                  className="gfos-danger-btn gfos-btn-sm"
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
            className="gfos-empty-state gfos-empty-full-width"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Coffee size={48} />
            <h3>Keine JDKs konfiguriert</h3>
            <p>Füge ein JDK hinzu um Builds auszuführen.</p>
            <button 
              className="gfos-primary-btn"
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
