/**
 * Settings View - Premium Terminal Edition
 * 
 * System configuration interface with advanced animations.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';
import { Settings, Folder, Save, RotateCcw, Check } from 'lucide-react';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

export function SettingsView() {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setProjects = useAppStore((state) => state.setProjects);
  const setJdks = useAppStore((state) => state.setJdks);

  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (key: keyof typeof settings, value: string | number | boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSelectFolder = async (key: 'scanRootPath' | 'defaultMavenHome') => {
    const path = await api.selectFolder();
    if (path) {
      handleChange(key, path);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveConfig(localSettings);
      updateSettings(localSettings);
      setSaved(true);
      
      // Re-scan with new paths
      const projects = await api.scanProjects(localSettings.scanRootPath);
      setProjects(projects);
      
      const jdks = await api.scanJDKs(localSettings.jdkScanPaths);
      setJdks(jdks);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(localSettings);

  return (
    <motion.div 
      className="max-w-3xl mx-auto space-y-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div 
        className="terminal-window overflow-hidden"
        variants={itemVariants}
      >
        <div className="terminal-header flex items-center gap-2">
          <motion.span 
            className="text-neon-cyan"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            <Settings size={14} />
          </motion.span>
          <span>SYSTEM_CONFIG</span>
          <span className="text-zinc-700">//</span>
          <span className="text-zinc-500">v1.0.0</span>
        </div>
      </motion.div>

      {/* Paths Section */}
      <ConfigSection 
        title="PATH_CONFIG" 
        description="Configure scan paths for projects and JDKs"
        index={0}
      >
        <div className="space-y-4">
          <ConfigInput
            label="SCAN_ROOT"
            value={localSettings.scanRootPath}
            onChange={(v) => handleChange('scanRootPath', v)}
            placeholder="C:\dev\quellen"
            hint="Root directory for project discovery"
            onBrowse={() => handleSelectFolder('scanRootPath')}
          />

          <ConfigInput
            label="JDK_PATHS"
            value={localSettings.jdkScanPaths}
            onChange={(v) => handleChange('jdkScanPaths', v)}
            placeholder="C:\dev\java"
            hint="Multiple paths separated by semicolon"
          />

          <ConfigInput
            label="MAVEN_HOME"
            value={localSettings.defaultMavenHome}
            onChange={(v) => handleChange('defaultMavenHome', v)}
            placeholder="C:\dev\maven\mvn3"
            onBrowse={() => handleSelectFolder('defaultMavenHome')}
          />
        </div>
      </ConfigSection>

      {/* Build Defaults Section */}
      <ConfigSection 
        title="BUILD_DEFAULTS" 
        description="Default settings for new build jobs"
        index={1}
      >
        <div className="space-y-4">
          <ConfigInput
            label="DEFAULT_GOALS"
            value={localSettings.defaultMavenGoal}
            onChange={(v) => handleChange('defaultMavenGoal', v)}
            placeholder="clean install"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">
                MAX_PARALLEL
              </label>
              <motion.input
                type="number"
                min={1}
                max={8}
                value={localSettings.maxParallelBuilds}
                onChange={(e) => handleChange('maxParallelBuilds', parseInt(e.target.value) || 1)}
                className="terminal-input w-full"
                whileFocus={{ scale: 1.01, borderColor: "rgba(0, 255, 136, 0.5)" }}
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">
                THREAD_COUNT
              </label>
              <motion.input
                type="text"
                value={localSettings.threadCount}
                onChange={(e) => handleChange('threadCount', e.target.value)}
                placeholder="1C"
                disabled={!localSettings.enableThreads}
                className={`terminal-input w-full ${!localSettings.enableThreads ? 'opacity-50' : ''}`}
                whileFocus={{ scale: 1.01 }}
              />
            </div>
          </div>

          <div className="border-t border-terminal-border pt-4 space-y-3">
            <ConfigToggle
              label="SKIP_TESTS"
              description="-DskipTests on all builds"
              checked={localSettings.skipTestsByDefault}
              onChange={(v) => handleChange('skipTestsByDefault', v)}
            />

            <ConfigToggle
              label="OFFLINE_MODE"
              description="No network access during builds"
              checked={localSettings.offlineMode}
              onChange={(v) => handleChange('offlineMode', v)}
            />

            <ConfigToggle
              label="ENABLE_THREADS"
              description="Maven multi-threading (-T)"
              checked={localSettings.enableThreads}
              onChange={(v) => handleChange('enableThreads', v)}
            />
          </div>
        </div>
      </ConfigSection>

      {/* Actions */}
      <motion.div 
        className="terminal-window overflow-hidden"
        variants={itemVariants}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AnimatePresence mode="wait">
              {hasChanges && (
                <motion.span 
                  className="text-neon-orange text-xs font-mono flex items-center gap-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  <motion.span 
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    ●
                  </motion.span>
                  UNSAVED_CHANGES
                </motion.span>
              )}
              {saved && !hasChanges && (
                <motion.span 
                  className="text-neon-green text-xs font-mono flex items-center gap-2"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Check size={12} /> CONFIG_SAVED
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setLocalSettings(settings)}
              disabled={!hasChanges}
              className="btn-ghost text-xs disabled:opacity-30 flex items-center gap-2"
              whileHover={hasChanges ? { scale: 1.02 } : {}}
              whileTap={hasChanges ? { scale: 0.98 } : {}}
            >
              <RotateCcw size={12} />
              RESET
            </motion.button>
            <motion.button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`text-xs font-mono px-4 py-2 border transition-all flex items-center gap-2 ${
                hasChanges && !saving
                  ? 'border-neon-green text-terminal-black bg-neon-green hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]'
                  : 'border-zinc-700 text-zinc-600 cursor-not-allowed'
              }`}
              whileHover={hasChanges && !saving ? { scale: 1.02, y: -1 } : {}}
              whileTap={hasChanges && !saving ? { scale: 0.98 } : {}}
            >
              {saving ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    ◐
                  </motion.span>
                  SAVING...
                </>
              ) : (
                <>
                  <Save size={12} />
                  SAVE_CONFIG
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Debug Info */}
      <motion.div 
        className="text-[10px] font-mono text-zinc-700 text-right px-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        CONFIG_PATH: ~/.gfos-build/config.json
      </motion.div>
    </motion.div>
  );
}

interface ConfigSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
  index: number;
}

function ConfigSection({ title, description, children, index }: ConfigSectionProps) {
  return (
    <motion.div 
      className="terminal-window overflow-hidden"
      variants={itemVariants}
    >
      <div className="terminal-header flex items-center gap-2">
        <motion.span 
          className="text-neon-green"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
        >
          ▸
        </motion.span>
        <span>{title}</span>
      </div>
      <div className="px-4 py-1 border-b border-terminal-border bg-terminal-mid/30">
        <p className="text-xs text-zinc-500 font-mono"># {description}</p>
      </div>
      <div className="p-4">
        {children}
      </div>
    </motion.div>
  );
}

interface ConfigInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  onBrowse?: () => void;
}

function ConfigInput({ label, value, onChange, placeholder, hint, onBrowse }: ConfigInputProps) {
  const [focused, setFocused] = useState(false);
  
  return (
    <motion.div
      animate={focused ? { x: 2 } : { x: 0 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <motion.span 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 font-mono text-sm"
            animate={{ color: focused ? "#00ff88" : "#52525b" }}
          >
            $
          </motion.span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            className={`terminal-input w-full pl-7 transition-all duration-200 ${
              focused ? 'border-neon-green/50 shadow-[0_0_10px_rgba(0,255,136,0.1)]' : ''
            }`}
          />
        </div>
        {onBrowse && (
          <motion.button
            onClick={onBrowse}
            className="px-3 py-2 bg-terminal-mid border border-terminal-border text-zinc-400 
                       hover:text-neon-cyan hover:border-neon-cyan/50 transition-colors font-mono text-xs
                       flex items-center gap-1"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <Folder size={12} />
          </motion.button>
        )}
      </div>
      {hint && (
        <motion.p 
          className="text-[10px] text-zinc-600 font-mono mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          // {hint}
        </motion.p>
      )}
    </motion.div>
  );
}

interface ConfigToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ConfigToggle({ label, description, checked, onChange }: ConfigToggleProps) {
  return (
    <motion.label 
      className="flex items-center gap-3 cursor-pointer group"
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.995 }}
    >
      <motion.div 
        className={`w-10 h-5 border relative transition-colors ${
          checked 
            ? 'border-neon-green bg-neon-green/20' 
            : 'border-zinc-600 bg-zinc-900 hover:border-zinc-500'
        }`}
        onClick={() => onChange(!checked)}
        whileHover={{ scale: 1.05 }}
      >
        <motion.div 
          className="absolute top-0.5 w-4 h-4"
          animate={{
            x: checked ? 20 : 2,
            backgroundColor: checked ? "#00ff88" : "#52525b",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        />
      </motion.div>
      <div className="flex-1">
        <p className={`text-sm font-mono transition-colors ${
          checked ? 'text-neon-green' : 'text-zinc-300 group-hover:text-zinc-100'
        }`}>
          {label}
        </p>
        <p className="text-xs text-zinc-600 font-mono">{description}</p>
      </div>
      <motion.span 
        className="text-xs font-mono"
        animate={{ 
          color: checked ? "#00ff88" : "#52525b",
        }}
      >
        {checked ? '[ON]' : '[OFF]'}
      </motion.span>
    </motion.label>
  );
}
