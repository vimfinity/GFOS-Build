/**
 * Shared UI Components - Tailwind v4
 */

import { motion } from 'framer-motion';

/* Status Indicator */
export function StatusIndicator({ 
  status, 
  size = 'default' 
}: { 
  status: string; 
  size?: 'default' | 'small' | 'large';
}) {
  const colorClasses: Record<string, string> = {
    success: 'bg-success-500',
    failed: 'bg-error-500',
    running: 'bg-petrol-500 animate-pulse',
    pending: 'bg-dark-300 dark:bg-dark-400',
    cancelled: 'bg-gray-400',
  };
  
  const sizeClasses = {
    small: 'w-2 h-2',
    default: 'w-2.5 h-2.5',
    large: 'w-3.5 h-3.5',
  };
  
  return (
    <div 
      className={`rounded-full ${sizeClasses[size]} ${colorClasses[status] || colorClasses.pending}`}
    />
  );
}

/* Flowing Stat (Stats River) */
export function FlowingStat({ 
  icon, 
  value, 
  label, 
  variant,
  onClick
}: { 
  icon: React.ReactNode; 
  value: number; 
  label: string; 
  variant?: 'success' | 'error';
  onClick?: () => void;
}) {
  const variantClasses = {
    success: 'text-success-500',
    error: 'text-error-500',
  };
  
  return (
    <motion.div 
      className={`flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/60 dark:bg-dark-800/60 backdrop-blur-lg border border-white/80 dark:border-white/10 ${onClick ? 'cursor-pointer hover:bg-white dark:hover:bg-dark-700' : ''} transition-all duration-200`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.02 } : undefined}
    >
      <div className={`${variant ? variantClasses[variant] : 'text-petrol-500'}`}>{icon}</div>
      <span className={`text-2xl font-bold ${variant ? variantClasses[variant] : 'text-dark-500 dark:text-light-100'}`}>{value}</span>
      <span className="text-sm text-dark-300 dark:text-light-400">{label}</span>
    </motion.div>
  );
}

/* Glass Panel */
export function GlassPanel({ 
  children, 
  className = '',
  animate = true
}: { 
  children: React.ReactNode; 
  className?: string;
  animate?: boolean;
}) {
  const baseClasses = "bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border border-white/80 dark:border-white/10 shadow-[0_8px_32px_rgba(0,125,143,0.08)]";
  
  if (!animate) {
    return <section className={`${baseClasses} ${className}`}>{children}</section>;
  }
  
  return (
    <motion.section 
      className={`${baseClasses} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.section>
  );
}

/* Panel Header */
export function PanelHeader({ 
  title, 
  action,
  badge
}: { 
  title: string; 
  action?: { label: string; onClick: () => void };
  badge?: number | string;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-light-300 dark:border-dark-600">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-dark-500 dark:text-light-100">{title}</h2>
        {badge !== undefined && (
          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-petrol-50 dark:bg-petrol-900/30 text-petrol-600 dark:text-petrol-300">
            {badge}
          </span>
        )}
      </div>
      {action && (
        <button 
          className="text-sm font-medium text-petrol-500 hover:text-petrol-600 transition-colors"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/* Empty State */
export function EmptyState({ 
  icon, 
  title, 
  description,
  action
}: { 
  icon: React.ReactNode; 
  title: string; 
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-2xl bg-light-200 dark:bg-dark-700 text-dark-300 dark:text-light-400">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-dark-500 dark:text-light-100 mb-1">{title}</h3>
      {description && <p className="text-sm text-dark-300 dark:text-light-400 max-w-xs">{description}</p>}
      {action && (
        <button 
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/* Confirm Dialog */
export function ConfirmDialog({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  variant = 'default'
}: { 
  isOpen: boolean;
  title: string; 
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}) {
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-dark-900/40 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={onCancel}
    >
      <motion.div 
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-dark-500 dark:text-light-100 mb-2">{title}</h3>
        <p className="text-dark-300 dark:text-light-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button 
            className="px-4 py-2 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button 
            className={`px-4 py-2 font-medium rounded-xl transition-colors ${
              variant === 'danger' 
                ? 'bg-error-500 text-white hover:bg-error-600' 
                : 'bg-petrol-500 text-white hover:bg-petrol-600'
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* Progress Ring */
export function ProgressRing({ progress }: { progress: number }) {
  const circumference = 2 * Math.PI * 15.9;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  return (
    <div className="relative w-10 h-10">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle 
          cx="18" cy="18" r="15.9"
          fill="none"
          strokeWidth="2"
          className="stroke-light-300 dark:stroke-dark-600"
        />
        <circle
          cx="18" cy="18" r="15.9"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-petrol-500"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
            transition: 'stroke-dashoffset 0.3s ease'
          }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-dark-500 dark:text-light-100">
        {progress}%
      </span>
    </div>
  );
}

/* Badge */
export function Badge({ 
  children, 
  variant = 'default' 
}: { 
  children: React.ReactNode; 
  variant?: 'default' | 'success' | 'error' | 'warning';
}) {
  const variantClasses = {
    default: 'bg-light-200 dark:bg-dark-600 text-dark-400 dark:text-light-300',
    success: 'bg-success-50 dark:bg-success-900/30 text-success-600 dark:text-success-400',
    error: 'bg-error-50 dark:bg-error-900/30 text-error-600 dark:text-error-400',
    warning: 'bg-warning-50 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400',
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}

/* Spinner */
export function Spinner({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
  const sizeClasses = {
    small: 'w-4 h-4',
    default: 'w-6 h-6',
    large: 'w-8 h-8',
  };
  
  return (
    <div className={`${sizeClasses[size]} animate-spin`}>
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="opacity-25" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-75" />
      </svg>
    </div>
  );
}
