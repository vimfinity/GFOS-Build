/**
 * UI Components Index
 * 
 * Central export point for all reusable UI components.
 */

// Layout Components
export { ScreenContainer, useTerminalSize } from './ScreenContainer.js';
export type { ScreenContainerProps } from './ScreenContainer.js';

export { FullscreenContainer } from './FullscreenContainer.js';
export type { FullscreenContainerProps } from './FullscreenContainer.js';

export { ScrollBox } from './ScrollBox.js';
export type { ScrollBoxProps } from './ScrollBox.js';

// Interactive Components
export { ActionList } from './ActionList.js';
export type { ActionListProps, ActionItem } from './ActionList.js';

export { SimpleList } from './SimpleList.js';
export type { SimpleListProps, SimpleListItem } from './SimpleList.js';

export { SearchInput } from './SearchInput.js';
export type { SearchInputProps } from './SearchInput.js';

export { CheckboxList } from './CheckboxList.js';
export type { CheckboxListProps, CheckboxItem } from './CheckboxList.js';

// Display Components
export { 
  Badge, 
  JavaBadge, 
  StatusBadge, 
  MavenBadge,
  getJavaBadgeVariant,
  getStatusBadgeVariant,
} from './Badge.js';
export type { BadgeProps, BadgeVariant } from './Badge.js';

export { StatusBar, HomeStatusBar, ListStatusBar, BuildStatusBar, QueueStatusBar } from './StatusBar.js';
export type { StatusBarProps, Shortcut } from './StatusBar.js';

export { Header } from './Header.js';
export type { HeaderProps } from './Header.js';

export { Spinner } from './Spinner.js';
export type { SpinnerProps } from './Spinner.js';

export { KeyValue, KeyValueList } from './KeyValue.js';
export type { KeyValueProps, KeyValueListProps } from './KeyValue.js';

export { ProgressBar, ProgressIndicator } from './ProgressBar.js';
export type { ProgressBarProps } from './ProgressBar.js';
