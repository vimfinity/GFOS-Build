/**
 * ScreenContainer Component
 * 
 * Layout wrapper with border, title, and responsive sizing.
 * Handles terminal window resizing automatically.
 */

import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { colors, type BorderStyle } from '../theme.js';

/**
 * Hook to get terminal dimensions with live updates.
 */
export function useTerminalSize(): { width: number; height: number } {
  const { stdout } = useStdout();
  const [size, setSize] = React.useState({
    width: stdout?.columns ?? 80,
    height: stdout?.rows ?? 24,
  });

  React.useEffect(() => {
    if (!stdout) return;

    const handleResize = () => {
      setSize({
        width: stdout.columns,
        height: stdout.rows,
      });
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  return size;
}

export interface ScreenContainerProps {
  /** Screen title displayed in the top border */
  title?: string;
  /** Optional subtitle displayed after the title */
  subtitle?: string;
  /** Border style variant */
  borderStyle?: BorderStyle;
  /** Whether to show the border */
  showBorder?: boolean;
  /** Padding inside the container */
  padding?: number;
  /** Whether to fill available height */
  fillHeight?: boolean;
  /** Fixed height (overrides fillHeight) */
  height?: number;
  /** Fixed width (default: terminal width) */
  width?: number;
  /** Content to render inside */
  children: React.ReactNode;
}

// Map our border style names to Ink's borderStyle prop
const inkBorderStyleMap: Record<BorderStyle, 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic'> = {
  single: 'single',
  double: 'double',
  rounded: 'round',
};

/**
 * ScreenContainer - A responsive layout wrapper with decorative border and title.
 * Uses Ink's native borderStyle for reliable border rendering.
 */
export function ScreenContainer({
  title,
  subtitle,
  borderStyle = 'rounded',
  showBorder = true,
  padding = 1,
  fillHeight = false,
  height,
  width,
  children,
}: ScreenContainerProps): React.ReactElement {
  const terminalSize = useTerminalSize();
  
  const containerWidth = width ?? terminalSize.width;
  const containerHeight = height ?? (fillHeight ? terminalSize.height - 2 : undefined);

  if (!showBorder) {
    return (
      <Box
        flexDirection="column"
        width={containerWidth}
        height={containerHeight}
        paddingX={padding}
        paddingY={padding}
        overflow="hidden"
      >
        {children}
      </Box>
    );
  }

  // Build title with subtitle
  const fullTitle = title 
    ? subtitle 
      ? `${title} · ${subtitle}` 
      : title
    : undefined;

  return (
    <Box
      flexDirection="column"
      width={containerWidth}
      height={containerHeight}
      borderStyle={inkBorderStyleMap[borderStyle]}
      borderColor={colors.border}
      paddingX={padding}
      paddingY={padding > 0 ? 1 : 0}
      overflow="hidden"
    >
      {fullTitle && (
        <Box marginTop={-2} marginLeft={1} marginBottom={1}>
          <Text color={colors.primaryBright} bold>{title}</Text>
          {subtitle && <Text color={colors.textDim}> · {subtitle}</Text>}
        </Box>
      )}
      {children}
    </Box>
  );
}

export default ScreenContainer;
