/**
 * Sidebar Component - Enhanced with Framer Motion
 * 
 * Terminal-style navigation with premium animations and micro-interactions.
 */

import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useAppStore, type AppScreen } from '../store/useAppStore';
import { 
  Terminal, 
  FolderGit2, 
  Activity, 
  Sliders,
  ChevronRight,
  Cpu,
  Hexagon
} from 'lucide-react';

interface NavItem {
  id: AppScreen;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'HOME', label: 'Terminal', shortcut: '01', icon: <Terminal size={18} strokeWidth={1.5} /> },
  { id: 'PROJECTS', label: 'Projekte', shortcut: '02', icon: <FolderGit2 size={18} strokeWidth={1.5} /> },
  { id: 'JOBS', label: 'Prozesse', shortcut: '03', icon: <Activity size={18} strokeWidth={1.5} /> },
  { id: 'SETTINGS', label: 'System', shortcut: '04', icon: <Sliders size={18} strokeWidth={1.5} /> },
];

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

export function Sidebar() {
  const currentScreen = useAppStore((state) => state.navigation.currentScreen);
  const setScreen = useAppStore((state) => state.setScreen);
  const jobs = useAppStore((state) => state.jobs);
  
  const runningJobs = jobs.filter((j) => j.status === 'running').length;
  const pendingJobs = jobs.filter((j) => j.status === 'pending').length;

  return (
    <motion.aside 
      className="w-56 bg-terminal-dark border-r border-terminal-border flex flex-col relative overflow-hidden"
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Animated corner decorations */}
      <motion.div 
        className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-neon-green"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      />
      <motion.div 
        className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-neon-green"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      />
      
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-neon-green/[0.02] to-transparent pointer-events-none" />
      
      {/* Logo Section */}
      <motion.div 
        className="p-5 border-b border-terminal-border relative"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <div className="flex items-center gap-3">
          <motion.div 
            className="w-11 h-11 border border-neon-green/60 flex items-center justify-center relative group cursor-pointer"
            whileHover={{ 
              scale: 1.05, 
              borderColor: "var(--neon-green)",
              boxShadow: "0 0 20px rgba(0, 255, 136, 0.2)"
            }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 opacity-20"
            >
              <Hexagon size={44} className="text-neon-green absolute -top-[2px] -left-[2px]" strokeWidth={0.5} />
            </motion.div>
            <Cpu size={20} className="text-neon-green relative z-10" />
            {/* Corner accents */}
            <div className="absolute -top-[1px] -left-[1px] w-2 h-2 bg-neon-green" />
            <div className="absolute -bottom-[1px] -right-[1px] w-2 h-2 bg-neon-green" />
          </motion.div>
          <div>
            <motion.h1 
              className="font-display text-sm font-bold tracking-[0.25em] uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <span className="text-neon-green">GFOS</span>
            </motion.h1>
            <motion.p 
              className="text-[9px] text-zinc-600 tracking-[0.3em] uppercase mt-0.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Build System
            </motion.p>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
        <motion.div 
          className="text-[9px] text-zinc-600 uppercase tracking-[0.25em] px-3 mb-3 font-display flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="w-2 h-[1px] bg-zinc-700" />
          Navigation
          <div className="flex-1 h-[1px] bg-zinc-700/50" />
        </motion.div>
        
        <motion.div 
          className="space-y-1"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {navItems.map((item) => {
            const isActive = currentScreen === item.id || 
              (item.id === 'PROJECTS' && currentScreen === 'PROJECT_DETAIL') ||
              (item.id === 'PROJECTS' && currentScreen === 'BUILD_CONFIG') ||
              (item.id === 'JOBS' && currentScreen === 'JOB_DETAIL');
            
            return (
              <motion.button
                key={item.id}
                variants={itemVariants}
                onClick={() => setScreen(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 
                  transition-colors duration-150 group relative overflow-hidden
                  ${isActive 
                    ? 'text-neon-green' 
                    : 'text-zinc-500 hover:text-zinc-200'
                  }
                `}
                whileHover={{ 
                  backgroundColor: isActive ? "rgba(0, 255, 136, 0.1)" : "rgba(255, 255, 255, 0.03)",
                  x: 4,
                }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Background glow for active */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-neon-green/10 to-transparent"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </AnimatePresence>
                
                {/* Active indicator line */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div 
                      className="absolute left-0 top-1/2 w-[3px] bg-neon-green"
                      initial={{ height: 0, y: "-50%" }}
                      animate={{ height: 20, y: "-50%" }}
                      exit={{ height: 0, y: "-50%" }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      style={{ boxShadow: "0 0 10px var(--neon-green)" }}
                    />
                  )}
                </AnimatePresence>
                
                {/* Shortcut number */}
                <span className={`text-[10px] font-mono relative z-10 transition-colors ${
                  isActive ? 'text-neon-green/60' : 'text-zinc-700 group-hover:text-zinc-500'
                }`}>
                  {item.shortcut}
                </span>
                
                {/* Icon */}
                <motion.span 
                  className={`relative z-10 transition-colors ${
                    isActive ? 'text-neon-green' : 'text-zinc-600 group-hover:text-zinc-400'
                  }`}
                  animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {item.icon}
                </motion.span>
                
                {/* Label */}
                <span className="flex-1 text-left text-xs font-medium tracking-wide uppercase relative z-10">
                  {item.label}
                </span>
                
                {/* Job counter badge */}
                <AnimatePresence>
                  {item.id === 'JOBS' && runningJobs > 0 && (
                    <motion.span 
                      className="px-1.5 py-0.5 text-[10px] font-bold bg-neon-green text-terminal-black relative z-10"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    >
                      {runningJobs}
                    </motion.span>
                  )}
                </AnimatePresence>
                
                {/* Arrow indicator */}
                <motion.span
                  className="relative z-10"
                  animate={{ x: isActive ? 0 : -5, opacity: isActive ? 1 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight size={12} className="text-neon-green/60" />
                </motion.span>
              </motion.button>
            );
          })}
        </motion.div>
      </nav>

      {/* Status Footer */}
      <motion.div 
        className="p-4 border-t border-terminal-border relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <div className="text-[9px] text-zinc-600 uppercase tracking-[0.25em] mb-3 font-display flex items-center gap-2">
          <div className="w-2 h-[1px] bg-zinc-700" />
          System Status
        </div>
        
        <div className="space-y-2.5">
          <StatusRow 
            label="Aktiv" 
            value={runningJobs} 
            isActive={runningJobs > 0}
            color="green"
          />
          <StatusRow 
            label="Queue" 
            value={pendingJobs} 
            isActive={pendingJobs > 0}
            color="orange"
          />
        </div>
        
        {/* Version info with subtle animation */}
        <motion.div 
          className="mt-4 pt-3 border-t border-terminal-border/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <p className="text-[9px] text-zinc-700 font-mono flex items-center gap-1.5">
            <motion.span 
              className="inline-block w-1.5 h-1.5 bg-neon-green/30"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            v1.0.0 // BUILD_2026
          </p>
        </motion.div>
      </motion.div>
    </motion.aside>
  );
}

interface StatusRowProps {
  label: string;
  value: number;
  isActive: boolean;
  color: 'green' | 'orange';
}

function StatusRow({ label, value, isActive, color }: StatusRowProps) {
  const colorClasses = {
    green: 'bg-neon-green text-neon-green',
    orange: 'bg-neon-orange text-neon-orange',
  };

  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-2">
        <motion.div 
          className={`w-1.5 h-1.5 ${isActive ? colorClasses[color].split(' ')[0] : 'bg-zinc-700'}`}
          animate={isActive ? { 
            boxShadow: [
              `0 0 0 0 ${color === 'green' ? 'rgba(0, 255, 136, 0.4)' : 'rgba(255, 149, 0, 0.4)'}`,
              `0 0 0 4px ${color === 'green' ? 'rgba(0, 255, 136, 0)' : 'rgba(255, 149, 0, 0)'}`,
            ],
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider group-hover:text-zinc-400 transition-colors">
          {label}
        </span>
      </div>
      <motion.span 
        className={`text-xs font-mono tabular-nums ${isActive ? colorClasses[color].split(' ')[1] : 'text-zinc-600'}`}
        key={value}
        initial={{ scale: 1.2, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
      >
        {value}
      </motion.span>
    </div>
  );
}
