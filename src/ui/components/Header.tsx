/**
 * Header Component
 * 
 * App header/title bar with branding and status indicators.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';
import { useTerminalSize } from './ScreenContainer.js';

export interface HeaderProps {
  /** Main title */
  title?: string;
  /** Version string */
  version?: string;
  /** Whether mock mode is active */
  isMockMode?: boolean;
  /** Show the decorative logo */
  showLogo?: boolean;
}

/**
 * Header - App title bar component.
 */
export function Header({
  title = 'GFOS-Build',
  version = '1.0.0',
  isMockMode = false,
  showLogo = true,
}: HeaderProps): React.ReactElement {
  const { width } = useTerminalSize();

  return (
    <Box flexDirection="column" width={width}>
      <Box justifyContent="space-between" paddingX={1}>
        {/* Left: Logo and title */}
        <Box>
          {showLogo && (
            <Text color={colors.primary} bold>
              🏗️{' '}
            </Text>
          )}
          <Text color={colors.primaryBright} bold>
            {title}
          </Text>
          <Text color={colors.textDim}> v{version}</Text>
        </Box>

        {/* Right: Mode indicator */}
        <Box>
          {isMockMode && (
            <Text backgroundColor="yellow" color="black" bold>
              {' MOCK MODE '}
            </Text>
          )}
        </Box>
      </Box>

      {/* Separator */}
      <Text color={colors.border}>{'─'.repeat(width)}</Text>
    </Box>
  );
}

export default Header;
