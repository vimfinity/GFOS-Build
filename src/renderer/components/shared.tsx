/**
 * Shared UI Components
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
  const colors: Record<string, string> = {
    success: '#10b981',
    failed: '#ef4444',
    running: '#007d8f',
    pending: '#94a3b8',
    cancelled: '#6b7280',
  };
  
  const sizeClasses = {
    small: 'gfos-status-sm',
    default: '',
    large: 'gfos-status-lg',
  };
  
  return (
    <div 
      className={`gfos-status ${sizeClasses[size]} ${status === 'running' ? 'gfos-status-pulse' : ''}`}
      style={{ '--status-color': colors[status] || colors.pending } as React.CSSProperties}
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
  return (
    <motion.div 
      className={`gfos-flowing-stat ${variant ? `gfos-stat-${variant}` : ''} ${onClick ? 'gfos-stat-clickable' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.02 } : undefined}
    >
      <div className="gfos-stat-icon">{icon}</div>
      <span className="gfos-stat-value">{value}</span>
      <span className="gfos-stat-label">{label}</span>
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
  if (!animate) {
    return <section className={`gfos-glass-panel ${className}`}>{children}</section>;
  }
  
  return (
    <motion.section 
      className={`gfos-glass-panel ${className}`}
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
    <div className="gfos-panel-header">
      <div className="gfos-panel-title-row">
        <h2>{title}</h2>
        {badge !== undefined && <span className="gfos-badge">{badge}</span>}
      </div>
      {action && (
        <button className="gfos-text-btn" onClick={action.onClick}>
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
    <div className="gfos-empty-state">
      <div className="gfos-empty-icon">{icon}</div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && (
        <button className="gfos-primary-btn gfos-btn-sm" onClick={action.onClick}>
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
    <div className="gfos-dialog-overlay" onClick={onCancel}>
      <motion.div 
        className="gfos-dialog"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="gfos-dialog-actions">
          <button className="gfos-btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button 
            className={`gfos-primary-btn ${variant === 'danger' ? 'gfos-btn-danger' : ''}`}
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
  return (
    <div className="gfos-progress-ring">
      <svg viewBox="0 0 36 36">
        <circle className="gfos-ring-bg" cx="18" cy="18" r="15.9" />
        <circle
          className="gfos-ring-progress"
          cx="18" cy="18" r="15.9"
          strokeDasharray={`${progress}, 100`}
        />
      </svg>
      <span>{progress}%</span>
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
  return (
    <span className={`gfos-badge gfos-badge-${variant}`}>
      {children}
    </span>
  );
}
