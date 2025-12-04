/**
 * UI Component Demo
 * 
 * Interactive demonstration of all UI components.
 * Run with: bun run src/ui/demo.tsx
 */

import React, { useState } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import {
  ScreenContainer,
  ActionList,
  Badge,
  JavaBadge,
  StatusBadge,
  MavenBadge,
  StatusBar,
  Header,
  Spinner,
  KeyValue,
  KeyValueList,
  ProgressBar,
  ProgressIndicator,
} from './components/index.js';
import { colors } from './theme.js';
import type { ActionItem, Shortcut } from './components/index.js';

type DemoScreen = 'menu' | 'badges' | 'actionlist' | 'progress' | 'layout';

function App(): React.ReactElement {
  const { exit } = useApp();
  const [screen, setScreen] = useState<DemoScreen>('menu');
  const [progress, setProgress] = useState(45);

  // Handle keyboard input
  useInput((input, key) => {
    if (input === 'q') {
      exit();
    }
    if (input === 'b' || key.escape) {
      setScreen('menu');
    }
    // Progress demo controls
    if (screen === 'progress') {
      if (key.leftArrow) setProgress((p) => Math.max(0, p - 10));
      if (key.rightArrow) setProgress((p) => Math.min(100, p + 10));
    }
  });

  const menuItems: ActionItem[] = [
    { 
      value: 'badges', 
      label: 'Badge Components', 
    },
    { 
      value: 'actionlist', 
      label: 'Action List', 
    },
    { 
      value: 'progress', 
      label: 'Progress Indicators', 
    },
    { 
      value: 'layout', 
      label: 'Layout Components', 
    },
    { 
      value: 'quit', 
      label: 'Quit Demo', 
      badge: 'Q',
      badgeColor: colors.error,
    },
  ];

  const shortcuts: Shortcut[] = [
    { key: 'B', label: 'Back' },
    { key: 'Q', label: 'Quit' },
  ];

  const renderContent = () => {
    switch (screen) {
      case 'badges':
        return <BadgesDemo />;
      case 'actionlist':
        return <ActionListDemo />;
      case 'progress':
        return <ProgressDemo progress={progress} />;
      case 'layout':
        return <LayoutDemo />;
      default:
        return (
          <ActionList
            items={menuItems}
            onSelect={(item) => {
              if (item.value === 'quit') {
                exit();
              } else {
                setScreen(item.value as DemoScreen);
              }
            }}
          />
        );
    }
  };

  return (
    <Box flexDirection="column">
      <Header 
        title="GFOS-Build" 
        version="1.0.0" 
        isMockMode={true} 
      />
      
      <ScreenContainer 
        title={screen === 'menu' ? 'Component Demo' : screen.toUpperCase()}
        subtitle={screen === 'menu' ? 'Select a component to preview' : 'Press B to go back'}
        padding={1}
      >
        {renderContent()}
      </ScreenContainer>

      <StatusBar
        shortcuts={shortcuts}
        pendingJobs={2}
        runningJobs={1}
        mode="DEMO"
      />
    </Box>
  );
}

function BadgesDemo(): React.ReactElement {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={colors.primaryBright}>Badge Variants</Text>
      
      <Box flexDirection="column" gap={0}>
        <Text color={colors.textDim}>Java Version Badges:</Text>
        <Box gap={1}>
          <JavaBadge version={8} />
          <JavaBadge version={11} />
          <JavaBadge version={17} />
          <JavaBadge version={21} />
        </Box>
      </Box>

      <Box flexDirection="column" gap={0}>
        <Text color={colors.textDim}>Status Badges:</Text>
        <Box gap={1}>
          <StatusBadge status="pending" />
          <StatusBadge status="running" />
          <StatusBadge status="success" />
          <StatusBadge status="failed" />
        </Box>
      </Box>

      <Box flexDirection="column" gap={0}>
        <Text color={colors.textDim}>Custom Badges:</Text>
        <Box gap={1}>
          <Badge variant="primary">PRIMARY</Badge>
          <Badge variant="secondary">SECONDARY</Badge>
          <Badge variant="info">INFO</Badge>
          <MavenBadge />
        </Box>
      </Box>

      <Box flexDirection="column" gap={0}>
        <Text color={colors.textDim}>Without Brackets:</Text>
        <Box gap={1}>
          <Badge variant="success" brackets={false}>SUCCESS</Badge>
          <Badge variant="error" brackets={false}>ERROR</Badge>
          <Badge variant="warning" brackets={false}>WARNING</Badge>
        </Box>
      </Box>
    </Box>
  );
}

function ActionListDemo(): React.ReactElement {
  const items: ActionItem[] = [
    { 
      value: 'gfosweb', 
      label: 'gfosweb', 
      badge: 'JAVA 21',
      badgeColor: colors.success,
    },
    { 
      value: 'gfoshg', 
      label: 'gfoshg', 
      badge: 'JAVA 17',
      badgeColor: colors.info,
    },
    { 
      value: 'gfosshared', 
      label: 'gfosshared', 
      badge: 'JAVA 11',
      badgeColor: colors.warning,
    },
    { 
      value: 'disabled', 
      label: 'disabled-module', 
      disabled: true,
    },
  ];

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={colors.primaryBright}>Action List Demo</Text>
      <Text color={colors.textDim}>Use ↑↓ to navigate, Enter to select</Text>
      <Box marginTop={1}>
        <ActionList 
          items={items} 
          onSelect={(item) => console.log('Selected:', item.value)}
          showIndex={true}
        />
      </Box>
    </Box>
  );
}

function ProgressDemo({ progress }: { progress: number }): React.ReactElement {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={colors.primaryBright}>Progress Indicators</Text>
      <Text color={colors.textDim}>Use ←→ to adjust progress</Text>
      
      <Box flexDirection="column" gap={0} marginTop={1}>
        <Text color={colors.textDim}>Standard Progress Bar:</Text>
        <ProgressBar value={progress} width={40} />
      </Box>

      <Box flexDirection="column" gap={0}>
        <Text color={colors.textDim}>With Label:</Text>
        <ProgressBar value={progress} width={30} label="Building:" />
      </Box>

      <Box flexDirection="column" gap={0}>
        <Text color={colors.textDim}>Compact Indicator:</Text>
        <Box>
          <Text color={colors.textDim}>Status: </Text>
          <ProgressIndicator value={progress} size={15} />
          <Text color={colors.textDim}> {progress}%</Text>
        </Box>
      </Box>

      <Box flexDirection="column" gap={0}>
        <Text color={colors.textDim}>Spinner:</Text>
        <Spinner message="Processing build..." />
      </Box>

      <Box flexDirection="column" gap={0}>
        <Text color={colors.textDim}>Different Progress Values:</Text>
        <ProgressBar value={25} width={20} label="25%" />
        <ProgressBar value={50} width={20} label="50%" />
        <ProgressBar value={75} width={20} label="75%" />
        <ProgressBar value={100} width={20} label="100%" />
      </Box>
    </Box>
  );
}

function LayoutDemo(): React.ReactElement {
  const kvItems = [
    { label: 'Project', value: 'gfosweb' },
    { label: 'Version', value: '2025.1.0-SNAPSHOT' },
    { label: 'Java Version', value: <JavaBadge version={21} /> },
    { label: 'Status', value: <StatusBadge status="success" /> },
    { label: 'Build Time', value: '2m 34s' },
  ];

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={colors.primaryBright}>Layout Components</Text>
      
      <Box flexDirection="column" gap={0}>
        <Text color={colors.textDim}>Key-Value Display:</Text>
        <Box marginLeft={2} marginTop={1}>
          <KeyValueList items={kvItems} labelWidth={14} />
        </Box>
      </Box>

      <Box flexDirection="column" gap={0} marginTop={1}>
        <Text color={colors.textDim}>Single Key-Value:</Text>
        <Box marginLeft={2}>
          <KeyValue label="Path" value="C:\dev\quellen\2025\gfosweb" labelWidth={14} />
        </Box>
      </Box>

      <Box flexDirection="column" gap={0} marginTop={1}>
        <Text color={colors.textDim}>Nested Container:</Text>
        <Box marginLeft={2} marginTop={1}>
          <ScreenContainer title="Nested Box" borderStyle="single" width={40}>
            <Text>Content inside nested container</Text>
          </ScreenContainer>
        </Box>
      </Box>
    </Box>
  );
}

// Run the demo
render(<App />);
