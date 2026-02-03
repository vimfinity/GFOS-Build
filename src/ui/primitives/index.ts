/**
 * Primitives Index
 * 
 * Re-exports all primitive UI components.
 */

// Box
export { StyledBox, type StyledBoxProps, type BorderStyle, type BoxVariant } from './Box.js';

// Text
export {
  StyledText,
  Heading,
  Code,
  Label,
  KeyHint,
  Truncate,
  type TextProps,
  type TextVariant,
  type HeadingProps,
  type CodeProps,
  type LabelProps,
} from './Text.js';

// List
export {
  List,
  CompactList,
  type ListItem,
  type ListProps,
  type CompactListProps,
} from './List.js';

// Input
export {
  TextInput,
  SearchInput,
  SelectInput,
  Checkbox,
  type TextInputProps,
  type SearchInputProps,
  type SelectInputProps,
  type SelectOption,
  type CheckboxProps,
} from './Input.js';

// Progress
export {
  ProgressBar,
  Spinner,
  StatusBadge,
  StatusLine,
  Badge,
  type ProgressBarProps,
  type SpinnerProps,
  type StatusBadgeProps,
  type StatusLineProps,
  type BadgeProps,
  type BadgeVariant,
  type StatusType,
} from './Progress.js';

// ItemSelector
export {
  ItemSelector,
  type SelectableItem,
  type ItemSelectorProps,
} from './ItemSelector.js';

// Layout
export {
  Screen,
  Header,
  StatusBar,
  Panel,
  SplitLayout,
  Divider,
  EmptyState,
  type ScreenProps,
  type PanelProps,
  type SplitLayoutProps,
  type DividerProps,
  type EmptyStateProps,
} from './Layout.js';

// Dialog
export {
  Dialog,
  ConfirmDialog,
  Toast,
  CommandPalette,
  type DialogProps,
  type ConfirmDialogProps,
  type ToastProps,
  type CommandPaletteProps,
  type CommandItem,
} from './Dialog.js';

