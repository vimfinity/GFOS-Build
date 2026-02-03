/**
 * Setup Wizard View
 * 
 * First-run setup experience with animated mascot and atmospheric scenery.
 * Each step has a unique themed scene:
 * - Welcome: Night sky with moon, stars, clouds
 * - Scan Root: Forest/trees scene
 * - JDK Paths: City skyline scene  
 * - Maven Home: Mountains scene
 * - Confirm: Sunrise/dawn scene
 * - Complete: Celebration scene
 * 
 * Features:
 * - Spawn-pulse-fade star animation
 * - Beautiful block-art scenery
 * - "Buildy" mascot in primary color
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';

import { LOGO, MASCOTS, PRIMARY_COLOR, PRIMARY_COLOR_BRIGHT, palette } from '../theme/index.js';
import { useAppStore, type AppSettings } from '../../core/store/useAppStore.js';
import { getConfigService } from '../../core/services/ConfigService.js';
import { useInterval, useTerminalSize } from '../hooks/index.js';

// ============================================================================
// Types
// ============================================================================

type SetupStep = 
  | 'welcome'
  | 'scan-root'
  | 'jdk-paths'
  | 'maven-home'
  | 'confirm'
  | 'complete';

type MascotMood = 'neutral' | 'happy' | 'thinking' | 'waving' | 'working';

interface StepConfig {
  title: string;
  description: string;
  mascotMood: MascotMood;
}

const STEP_CONFIGS: Record<SetupStep, StepConfig> = {
  welcome: {
    title: 'Welcome to GFOS Build',
    description: 'Let\'s set up your build environment',
    mascotMood: 'waving',
  },
  'scan-root': {
    title: 'Project Location',
    description: 'Where are your Maven projects located?',
    mascotMood: 'thinking',
  },
  'jdk-paths': {
    title: 'JDK Location',
    description: 'Where are your JDK installations?',
    mascotMood: 'neutral',
  },
  'maven-home': {
    title: 'Maven Home',
    description: 'Where is Maven installed?',
    mascotMood: 'working',
  },
  confirm: {
    title: 'Ready to Build',
    description: 'Review your settings',
    mascotMood: 'happy',
  },
  complete: {
    title: 'Setup Complete!',
    description: 'Your build environment is ready',
    mascotMood: 'happy',
  },
};

const STEPS: SetupStep[] = [
  'welcome',
  'scan-root',
  'jdk-paths',
  'maven-home',
  'confirm',
  'complete',
];

// ============================================================================
// Recommended Settings (Windows defaults for GFOS)
// ============================================================================

const RECOMMENDED_SETTINGS: Partial<AppSettings> = {
  scanRootPath: 'C:\\dev\\quellen',
  jdkScanPaths: 'C:\\dev\\java',
  defaultMavenHome: 'C:\\dev\\maven\\mvn3',
  defaultMavenGoal: 'clean install',
  maxParallelBuilds: 2,
  skipTestsByDefault: false,
  offlineMode: false,
  enableThreads: false,
  threadCount: '1C',
};

// ============================================================================
// Block Art Scenery Elements
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Moon - Crescent moon
// ─────────────────────────────────────────────────────────────────────────────
const MOON = [
  '    ▄▄███▄▄    ',
  '  ▄███████▀▀   ',
  ' ███████▀      ',
  ' ██████▌       ',
  ' ███████▄      ',
  '  ▀███████▄▄   ',
  '    ▀▀███▀▀    ',
];

// ─────────────────────────────────────────────────────────────────────────────
// Clouds - Various sizes
// ─────────────────────────────────────────────────────────────────────────────
const CLOUD_LARGE = [
  '        ▄▄▄▄▄        ',
  '     ▄▄█████████▄    ',
  '  ▄██████████████▄   ',
  ' ████████████████████',
  '▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀',
];

const CLOUD_MEDIUM = [
  '     ▄▄▄▄▄     ',
  '  ▄████████▄   ',
  ' ██████████████',
  '▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀',
];

const CLOUD_SMALL = [
  '   ▄▄▄   ',
  ' ▄█████▄ ',
  '█████████',
  '▀▀▀▀▀▀▀▀▀',
];

// ─────────────────────────────────────────────────────────────────────────────
// Trees - Forest elements
// ─────────────────────────────────────────────────────────────────────────────
const TREE_PINE = [
  '     ▲     ',
  '    ▲▲▲    ',
  '   ▲▲▲▲▲   ',
  '  ▲▲▲▲▲▲▲  ',
  ' ▲▲▲▲▲▲▲▲▲ ',
  '     █     ',
  '     █     ',
];

const TREE_SMALL = [
  '    ▲    ',
  '   ▲▲▲   ',
  '  ▲▲▲▲▲  ',
  '    █    ',
];

const BUSH = [
  '  ▄███▄  ',
  ' ███████ ',
  '█████████',
];

// ─────────────────────────────────────────────────────────────────────────────
// City - Skyline buildings
// ─────────────────────────────────────────────────────────────────────────────
const BUILDING_TALL = [
  '  ████  ',
  '  █▓▓█  ',
  '  █▓▓█  ',
  '  █▓▓█  ',
  '  █▓▓█  ',
  '  █▓▓█  ',
  '  ████  ',
];

const BUILDING_MEDIUM = [
  ' ██████ ',
  ' █▓▓▓▓█ ',
  ' █▓▓▓▓█ ',
  ' █▓▓▓▓█ ',
  ' ██████ ',
];

const BUILDING_SMALL = [
  '████████',
  '█▓▓▓▓▓▓█',
  '█▓▓▓▓▓▓█',
  '████████',
];

const TOWER = [
  '   ▲   ',
  '  ███  ',
  '  █▓█  ',
  '  █▓█  ',
  '  █▓█  ',
  '  █▓█  ',
  ' █████ ',
];

// ─────────────────────────────────────────────────────────────────────────────
// Mountains
// ─────────────────────────────────────────────────────────────────────────────
const MOUNTAIN_LARGE = [
  '         ▲         ',
  '        ▲▲▲        ',
  '       ▲▲░▲▲       ',
  '      ▲▲░░░▲▲      ',
  '     ▲▲▲░░░▲▲▲     ',
  '    ▲▲▲▲▲▲▲▲▲▲▲    ',
  '   ▲▲▲▲▲▲▲▲▲▲▲▲▲   ',
  '  ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲  ',
];

const MOUNTAIN_SMALL = [
  '     ▲     ',
  '    ▲▲▲    ',
  '   ▲▲░▲▲   ',
  '  ▲▲▲▲▲▲▲  ',
  ' ▲▲▲▲▲▲▲▲▲ ',
];

// ─────────────────────────────────────────────────────────────────────────────
// Sun elements
// ─────────────────────────────────────────────────────────────────────────────
const SUN = [
  '    \\  |  /    ',
  '   -- ◯ --   ',
  '    /  |  \\    ',
];

const SUN_RISING = [
  '  ─────────  ',
  ' ╱ · · · · ╲ ',
  '╱  ◠◠◠◠◠◠◠  ╲',
];

// ============================================================================
// Spawn-Pulse-Fade Star Animation
// Stars spawn at random positions, pulse to full brightness, then fade out
// ============================================================================

interface TwinkleStar {
  id: number;
  x: number;
  y: number;
  phase: 'spawning' | 'bright' | 'fading' | 'dead';
  brightness: number; // 0-4
  lifetime: number;
}

function useTwinkleStars(
  width: number, 
  height: number, 
  maxStars: number = 6,
  excludeZones: Array<{x: number, y: number, w: number, h: number}> = []
) {
  const [stars, setStars] = useState<TwinkleStar[]>([]);
  const nextIdRef = useRef(0);
  
  // Check if position collides with excluded zones
  const isPositionFree = useCallback((x: number, y: number): boolean => {
    for (const zone of excludeZones) {
      if (x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h) {
        return false;
      }
    }
    return true;
  }, [excludeZones]);
  
  useInterval(() => {
    setStars(currentStars => {
      // Update existing stars
      const updatedStars = currentStars.map(star => {
        const newStar = { ...star };
        newStar.lifetime++;
        
        switch (star.phase) {
          case 'spawning':
            // Pulse up: 0 -> 4 over ~4 ticks
            newStar.brightness = Math.min(4, star.brightness + 1);
            if (newStar.brightness >= 4) {
              newStar.phase = 'bright';
              newStar.lifetime = 0;
            }
            break;
          case 'bright':
            // Stay bright for a few ticks
            if (newStar.lifetime > 2) {
              newStar.phase = 'fading';
              newStar.lifetime = 0;
            }
            break;
          case 'fading':
            // Fade out: 4 -> 0 over ~4 ticks
            newStar.brightness = Math.max(0, star.brightness - 1);
            if (newStar.brightness <= 0) {
              newStar.phase = 'dead';
            }
            break;
        }
        return newStar;
      }).filter(star => star.phase !== 'dead');
      
      // Maybe spawn a new star
      const activeStars = updatedStars.length;
      const spawnChance = Math.random();
      
      if (activeStars < maxStars && spawnChance > 0.6) {
        // Find a free position
        let attempts = 0;
        let x = 0, y = 0;
        
        do {
          x = Math.floor(Math.random() * Math.max(1, width - 2)) + 1;
          y = Math.floor(Math.random() * Math.max(1, height));
          attempts++;
        } while (!isPositionFree(x, y) && attempts < 10);
        
        if (attempts < 10) {
          updatedStars.push({
            id: nextIdRef.current++,
            x,
            y,
            phase: 'spawning',
            brightness: 0,
            lifetime: 0,
          });
        }
      }
      
      return updatedStars;
    });
  }, 150);
  
  return stars;
}

// Star character based on brightness
function getStarChar(brightness: number): string {
  switch (brightness) {
    case 0: return ' ';
    case 1: return '·';
    case 2: return '∙';
    case 3: return '✦';
    case 4: return '★';
    default: return ' ';
  }
}

// ============================================================================
// Mascot Component - Uses MASCOTS from theme, renders in PRIMARY_COLOR
// ============================================================================

interface MascotProps {
  mood: MascotMood;
}

function Mascot({ mood }: MascotProps): React.ReactElement {
  const lines = MASCOTS[mood] || MASCOTS.neutral;
  
  return (
    <Box flexDirection="column" alignItems="center">
      {lines.map((line, i) => (
        <Text key={i} color={PRIMARY_COLOR}>{line}</Text>
      ))}
    </Box>
  );
}

// ============================================================================
// Scene Components - Each step has a unique themed scene
// ============================================================================

interface SceneProps {
  width: number;
  mascotMood: MascotMood;
}

// ─────────────────────────────────────────────────────────────────────────────
// Welcome Scene - Night sky with moon, stars, clouds (full atmospheric)
// ─────────────────────────────────────────────────────────────────────────────
function WelcomeScene({ width, mascotMood }: SceneProps): React.ReactElement {
  const sceneWidth = Math.min(85, width - 4);
  const sceneHeight = 8;
  
  // Exclude zones where clouds, moon, mascot are
  const excludeZones = [
    { x: 0, y: 2, w: 22, h: 5 },      // Left cloud
    { x: sceneWidth - 18, y: 0, w: 18, h: 7 }, // Moon
    { x: Math.floor(sceneWidth / 2) - 6, y: sceneHeight - 2, w: 12, h: 5 }, // Mascot
  ];
  
  const stars = useTwinkleStars(sceneWidth, sceneHeight, 8, excludeZones);
  const groundLine = '━'.repeat(sceneWidth);
  
  // Build star field as a 2D grid
  const starGrid: string[][] = Array(sceneHeight).fill(null).map(() => 
    Array(sceneWidth).fill(' ')
  );
  
  stars.forEach(star => {
    if (star.y < sceneHeight && star.x < sceneWidth) {
      starGrid[star.y]![star.x] = getStarChar(star.brightness);
    }
  });
  
  return (
    <Box flexDirection="column" alignItems="center" width={sceneWidth}>
      {/* Sky with stars, clouds, moon */}
      <Box width={sceneWidth} height={sceneHeight}>
        {/* Background stars */}
        <Box position="absolute" flexDirection="column">
          {starGrid.map((row, i) => (
            <Text key={i} color={palette.primary300}>{row.join('')}</Text>
          ))}
        </Box>
        
        {/* Left: Large Cloud */}
        <Box position="absolute" marginTop={2}>
          <Box flexDirection="column">
            {CLOUD_LARGE.map((line, i) => (
              <Text key={i} color={palette.gray600}>{line}</Text>
            ))}
          </Box>
        </Box>
        
        {/* Center top: Small cloud */}
        <Box position="absolute" marginLeft={Math.floor(sceneWidth * 0.4)} marginTop={1}>
          <Box flexDirection="column">
            {CLOUD_SMALL.map((line, i) => (
              <Text key={i} color={palette.gray700}>{line}</Text>
            ))}
          </Box>
        </Box>
        
        {/* Right: Moon */}
        <Box position="absolute" marginLeft={sceneWidth - 18}>
          <Box flexDirection="column">
            {MOON.map((line, i) => (
              <Text key={i} color={palette.gray300}>{line}</Text>
            ))}
          </Box>
        </Box>
      </Box>
      
      {/* Medium cloud floating */}
      <Box marginLeft={Math.floor(sceneWidth * 0.25)}>
        <Box flexDirection="column">
          {CLOUD_MEDIUM.map((line, i) => (
            <Text key={i} color={palette.gray600}>{line}</Text>
          ))}
        </Box>
      </Box>
      
      {/* Mascot on ground */}
      <Box marginTop={1}>
        <Mascot mood={mascotMood} />
      </Box>
      
      {/* Ground line */}
      <Box marginTop={1}>
        <Text color={palette.gray600}>{groundLine}</Text>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Forest Scene - For project location step (trees, bushes, nature)
// ─────────────────────────────────────────────────────────────────────────────
function ForestScene({ width, mascotMood }: SceneProps): React.ReactElement {
  const sceneWidth = Math.min(75, width - 4);
  const groundLine = '═'.repeat(sceneWidth);
  
  return (
    <Box flexDirection="column" alignItems="center" width={sceneWidth}>
      {/* Trees background */}
      <Box justifyContent="space-between" width={sceneWidth} paddingX={2}>
        {/* Left trees */}
        <Box gap={1}>
          <Box flexDirection="column">
            {TREE_PINE.map((line, i) => (
              <Text key={i} color={palette.success700}>{line}</Text>
            ))}
          </Box>
          <Box flexDirection="column" marginTop={3}>
            {TREE_SMALL.map((line, i) => (
              <Text key={i} color={palette.success600}>{line}</Text>
            ))}
          </Box>
        </Box>
        
        {/* Center - Mascot with bushes */}
        <Box flexDirection="column" alignItems="center">
          <Box marginBottom={1}>
            <Mascot mood={mascotMood} />
          </Box>
          <Box gap={2}>
            <Box flexDirection="column">
              {BUSH.map((line, i) => (
                <Text key={i} color={palette.success600}>{line}</Text>
              ))}
            </Box>
            <Box flexDirection="column">
              {BUSH.map((line, i) => (
                <Text key={i} color={palette.success700}>{line}</Text>
              ))}
            </Box>
          </Box>
        </Box>
        
        {/* Right trees */}
        <Box gap={1}>
          <Box flexDirection="column" marginTop={3}>
            {TREE_SMALL.map((line, i) => (
              <Text key={i} color={palette.success600}>{line}</Text>
            ))}
          </Box>
          <Box flexDirection="column">
            {TREE_PINE.map((line, i) => (
              <Text key={i} color={palette.success700}>{line}</Text>
            ))}
          </Box>
        </Box>
      </Box>
      
      {/* Ground */}
      <Box marginTop={1}>
        <Text color={palette.success900 || palette.success700}>{groundLine}</Text>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// City Scene - For JDK location step (skyline, buildings)
// ─────────────────────────────────────────────────────────────────────────────
function CityScene({ width, mascotMood }: SceneProps): React.ReactElement {
  const sceneWidth = Math.min(75, width - 4);
  const sceneHeight = 5;
  
  // Night city - has stars
  const excludeZones = [
    { x: 5, y: 0, w: 10, h: 7 },
    { x: 20, y: 0, w: 8, h: 5 },
    { x: sceneWidth - 20, y: 0, w: 10, h: 7 },
  ];
  
  const stars = useTwinkleStars(sceneWidth, sceneHeight, 6, excludeZones);
  const groundLine = '▀'.repeat(sceneWidth);
  
  // Star grid
  const starGrid: string[][] = Array(sceneHeight).fill(null).map(() => 
    Array(sceneWidth).fill(' ')
  );
  
  stars.forEach(star => {
    if (star.y < sceneHeight && star.x < sceneWidth) {
      starGrid[star.y]![star.x] = getStarChar(star.brightness);
    }
  });
  
  return (
    <Box flexDirection="column" alignItems="center" width={sceneWidth}>
      {/* Sky with stars */}
      <Box width={sceneWidth} height={sceneHeight}>
        <Box position="absolute" flexDirection="column">
          {starGrid.map((row, i) => (
            <Text key={i} color={palette.info300}>{row.join('')}</Text>
          ))}
        </Box>
      </Box>
      
      {/* Skyline */}
      <Box justifyContent="space-around" width={sceneWidth}>
        <Box flexDirection="column">
          {BUILDING_TALL.map((line, i) => (
            <Text key={i} color={palette.gray500}>{line}</Text>
          ))}
        </Box>
        <Box flexDirection="column" marginTop={2}>
          {BUILDING_MEDIUM.map((line, i) => (
            <Text key={i} color={palette.gray600}>{line}</Text>
          ))}
        </Box>
        <Box flexDirection="column">
          {TOWER.map((line, i) => (
            <Text key={i} color={palette.gray500}>{line}</Text>
          ))}
        </Box>
        
        {/* Mascot */}
        <Mascot mood={mascotMood} />
        
        <Box flexDirection="column" marginTop={3}>
          {BUILDING_SMALL.map((line, i) => (
            <Text key={i} color={palette.gray600}>{line}</Text>
          ))}
        </Box>
        <Box flexDirection="column" marginTop={1}>
          {BUILDING_MEDIUM.map((line, i) => (
            <Text key={i} color={palette.gray500}>{line}</Text>
          ))}
        </Box>
      </Box>
      
      {/* Ground */}
      <Text color={palette.gray700}>{groundLine}</Text>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mountain Scene - For Maven home step
// ─────────────────────────────────────────────────────────────────────────────
function MountainScene({ width, mascotMood }: SceneProps): React.ReactElement {
  const sceneWidth = Math.min(75, width - 4);
  const groundLine = '▓'.repeat(sceneWidth);
  
  return (
    <Box flexDirection="column" alignItems="center" width={sceneWidth}>
      {/* Mountains background */}
      <Box justifyContent="center" gap={2} width={sceneWidth}>
        <Box flexDirection="column">
          {MOUNTAIN_SMALL.map((line, i) => (
            <Text key={i} color={palette.gray500}>{line}</Text>
          ))}
        </Box>
        <Box flexDirection="column">
          {MOUNTAIN_LARGE.map((line, i) => (
            <Text key={i} color={palette.gray400}>{line}</Text>
          ))}
        </Box>
        <Box flexDirection="column">
          {MOUNTAIN_SMALL.map((line, i) => (
            <Text key={i} color={palette.gray600}>{line}</Text>
          ))}
        </Box>
      </Box>
      
      {/* Mascot in front */}
      <Box marginTop={-1}>
        <Mascot mood={mascotMood} />
      </Box>
      
      {/* Ground */}
      <Box marginTop={1}>
        <Text color={palette.gray600}>{groundLine}</Text>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sunrise Scene - For confirm step (dawn, hope, new beginning)
// ─────────────────────────────────────────────────────────────────────────────
function SunriseScene({ width, mascotMood }: SceneProps): React.ReactElement {
  const sceneWidth = Math.min(75, width - 4);
  const horizonLine = '─'.repeat(sceneWidth);
  
  // Animated sun rays
  const [rayFrame, setRayFrame] = useState(0);
  useInterval(() => {
    setRayFrame(f => (f + 1) % 3);
  }, 400);
  
  const rays = ['·', '✦', '★'][rayFrame] || '·';
  
  return (
    <Box flexDirection="column" alignItems="center" width={sceneWidth}>
      {/* Sun rays */}
      <Text color={palette.warning300}>
        {'    '}{'    '}{rays}{'  '}{rays}{'  '}{rays}{'  '}{rays}{'  '}{rays}{'    '}{'    '}
      </Text>
      
      {/* Rising sun */}
      <Box flexDirection="column" alignItems="center">
        {SUN_RISING.map((line, i) => (
          <Text key={i} color={palette.warning400}>{line}</Text>
        ))}
      </Box>
      
      {/* Horizon */}
      <Text color={palette.warning600}>{horizonLine}</Text>
      
      {/* Mascot */}
      <Box marginTop={1}>
        <Mascot mood={mascotMood} />
      </Box>
      
      {/* Ground gradient */}
      <Box flexDirection="column" alignItems="center" marginTop={1}>
        <Text color={palette.success700}>{'▄'.repeat(Math.floor(sceneWidth * 0.8))}</Text>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Complete Scene - Celebration with sparkles
// ─────────────────────────────────────────────────────────────────────────────
function CompleteScene({ width }: { width: number }): React.ReactElement {
  const sceneWidth = Math.min(70, width - 4);
  const [sparkle, setSparkle] = useState(0);
  
  useInterval(() => {
    setSparkle(s => (s + 1) % 8);
  }, 120);
  
  // Rotating sparkle characters
  const sparkleChars = ['✦', '✧', '★', '✧', '✦', '·', '✦', '✧'];
  const s = sparkleChars[sparkle] || '✦';
  
  const celebrationLine = `${s}   ${s}   ${s}   ${s}   ${s}   ${s}   ${s}`;
  
  return (
    <Box flexDirection="column" alignItems="center" width={sceneWidth}>
      {/* Top celebration */}
      <Text color={palette.warning400}>{celebrationLine}</Text>
      <Text color={PRIMARY_COLOR_BRIGHT}>{celebrationLine}</Text>
      
      {/* Happy mascot */}
      <Box marginY={1}>
        <Mascot mood="happy" />
      </Box>
      
      {/* Success message */}
      <Box flexDirection="column" alignItems="center" marginY={1}>
        <Text color={palette.success400} bold>
          ✓ Setup Complete! ✓
        </Text>
        <Text color="white">
          Your build environment is ready.
        </Text>
        <Text color={palette.gray400}>
          Starting GFOS Build...
        </Text>
      </Box>
      
      {/* Bottom celebration */}
      <Text color={PRIMARY_COLOR_BRIGHT}>{celebrationLine}</Text>
      <Text color={palette.warning400}>{celebrationLine}</Text>
    </Box>
  );
}

// ============================================================================
// Progress Indicator
// ============================================================================

interface ProgressDotsProps {
  current: number;
  total: number;
}

function ProgressDots({ current, total }: ProgressDotsProps): React.ReactElement {
  return (
    <Box gap={1} justifyContent="center">
      {Array.from({ length: total }).map((_, i) => (
        <Text 
          key={i} 
          color={i < current ? PRIMARY_COLOR : i === current ? 'white' : palette.gray600}
        >
          {i < current ? '●' : i === current ? '◉' : '○'}
        </Text>
      ))}
    </Box>
  );
}

// ============================================================================
// Input Components
// ============================================================================

interface PathInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onSubmit: () => void;
  icon?: string;
}

function PathInput({ value, onChange, placeholder, onSubmit, icon = '▸' }: PathInputProps): React.ReactElement {
  return (
    <Box flexDirection="column" gap={1} alignItems="center">
      <Box 
        borderStyle="round" 
        borderColor={PRIMARY_COLOR}
        paddingX={1}
        width={60}
      >
        <Text color={PRIMARY_COLOR}>{icon} </Text>
        <TextInput 
          value={value} 
          onChange={onChange}
          placeholder={placeholder}
          onSubmit={onSubmit}
        />
      </Box>
      <Text color={palette.gray400}>
        Press <Text color={PRIMARY_COLOR}>Enter</Text> to continue
      </Text>
    </Box>
  );
}

// ============================================================================
// Settings Preview
// ============================================================================

interface SettingsPreviewProps {
  settings: Partial<AppSettings>;
}

function SettingsPreview({ settings }: SettingsPreviewProps): React.ReactElement {
  const rows = [
    { label: 'Projects', value: settings.scanRootPath, icon: '▸' },
    { label: 'JDKs', value: settings.jdkScanPaths, icon: '◆' },
    { label: 'Maven', value: settings.defaultMavenHome, icon: '▶' },
  ];
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={palette.gray600}
      paddingX={2}
      paddingY={1}
    >
      {rows.map((row, i) => (
        <Box key={i} gap={1}>
          <Text color={PRIMARY_COLOR}>{row.icon}</Text>
          <Box width={10}>
            <Text color={palette.gray400}>{row.label}:</Text>
          </Box>
          <Text color="white">{row.value || '-'}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ============================================================================
// Welcome Step - Full screen with options
// ============================================================================

interface WelcomeStepProps {
  onNext: () => void;
  onQuickSetup: () => void;
  width: number;
}

function WelcomeStep({ onNext, onQuickSetup, width }: WelcomeStepProps): React.ReactElement {
  const [selectedOption, setSelectedOption] = useState<'custom' | 'recommended'>('recommended');
  
  useInput((input, key) => {
    if (key.upArrow || key.downArrow) {
      setSelectedOption(s => s === 'custom' ? 'recommended' : 'custom');
    } else if (key.return) {
      if (selectedOption === 'recommended') {
        onQuickSetup();
      } else {
        onNext();
      }
    }
  });
  
  return (
    <Box flexDirection="column" gap={1} alignItems="center">
      {/* Logo */}
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        {LOGO.map((line, i) => (
          <Text key={i} color={PRIMARY_COLOR}>{line}</Text>
        ))}
      </Box>
      
      {/* Scene */}
      <WelcomeScene width={width} mascotMood="waving" />
      
      {/* Welcome message */}
      <Box marginTop={1}>
        <Text color="white" bold>
          Welcome! Let's configure your build environment.
        </Text>
      </Box>
      
      {/* Options */}
      <Box flexDirection="column" gap={1} marginTop={1}>
        <Box gap={1}>
          <Text color={selectedOption === 'recommended' ? palette.success400 : palette.gray500}>
            {selectedOption === 'recommended' ? '◉' : '○'}
          </Text>
          <Text color={selectedOption === 'recommended' ? 'white' : palette.gray400}>
            Use recommended settings <Text color={palette.success400}>(quick setup)</Text>
          </Text>
        </Box>
        <Box gap={1}>
          <Text color={selectedOption === 'custom' ? palette.success400 : palette.gray500}>
            {selectedOption === 'custom' ? '◉' : '○'}
          </Text>
          <Text color={selectedOption === 'custom' ? 'white' : palette.gray400}>
            Custom configuration <Text color={palette.info400}>(step by step)</Text>
          </Text>
        </Box>
      </Box>
      
      {/* Hint */}
      <Box marginTop={2}>
        <Text color={palette.gray400}>
          Use <Text color={PRIMARY_COLOR}>↑/↓</Text> to select, <Text color={PRIMARY_COLOR}>Enter</Text> to continue
        </Text>
      </Box>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface SetupWizardViewProps {
  onComplete: () => void;
}

export function SetupWizardView({ onComplete }: SetupWizardViewProps): React.ReactElement {
  const { exit } = useApp();
  const { width } = useTerminalSize();
  
  const [currentStep, setCurrentStep] = useState<SetupStep>('welcome');
  const [settings, setSettings] = useState<Partial<AppSettings>>({
    ...RECOMMENDED_SETTINGS,
  });
  
  const stepConfig = STEP_CONFIGS[currentStep];
  const stepIndex = STEPS.indexOf(currentStep);
  
  // Update a single setting
  const updateSetting = useCallback(<K extends keyof AppSettings>(
    key: K, 
    value: AppSettings[K]
  ) => {
    setSettings(s => ({ ...s, [key]: value }));
  }, []);
  
  // Navigate to next step
  const nextStep = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) {
      const next = STEPS[idx + 1];
      if (next) setCurrentStep(next);
    }
  }, [currentStep]);
  
  // Navigate to previous step
  const prevStep = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) {
      const prev = STEPS[idx - 1];
      if (prev) setCurrentStep(prev);
    }
  }, [currentStep]);
  
  // Quick setup with recommended settings
  const handleQuickSetup = useCallback(() => {
    setSettings(RECOMMENDED_SETTINGS);
    setCurrentStep('confirm');
  }, []);
  
  // Save settings and complete
  const handleComplete = useCallback(async () => {
    try {
      const configService = getConfigService();
      const store = useAppStore.getState();
      
      const finalSettings: AppSettings = {
        defaultMavenGoal: settings.defaultMavenGoal || 'clean install',
        defaultJavaHome: settings.defaultJavaHome || '',
        defaultMavenHome: settings.defaultMavenHome || '',
        scanRootPath: settings.scanRootPath || '',
        jdkScanPaths: settings.jdkScanPaths || '',
        maxParallelBuilds: settings.maxParallelBuilds || 2,
        skipTestsByDefault: settings.skipTestsByDefault || false,
        offlineMode: settings.offlineMode || false,
        enableThreads: settings.enableThreads || false,
        threadCount: settings.threadCount || '1C',
      };
      
      store.updateSettings(finalSettings);
      await configService.saveSettings(finalSettings);
      
      setCurrentStep('complete');
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error) {
      // Silently handle errors
    }
  }, [settings, onComplete]);
  
  // Global input handling
  useInput((input, key) => {
    if (key.escape) {
      if (currentStep === 'welcome') {
        exit();
      } else {
        prevStep();
      }
      return;
    }
    
    if (currentStep === 'confirm' && key.return) {
      handleComplete();
    }
  });
  
  // Render scene for current step
  const renderScene = useCallback(() => {
    switch (currentStep) {
      case 'scan-root':
        return <ForestScene width={width} mascotMood={stepConfig.mascotMood} />;
      case 'jdk-paths':
        return <CityScene width={width} mascotMood={stepConfig.mascotMood} />;
      case 'maven-home':
        return <MountainScene width={width} mascotMood={stepConfig.mascotMood} />;
      case 'confirm':
        return <SunriseScene width={width} mascotMood={stepConfig.mascotMood} />;
      default:
        return null;
    }
  }, [currentStep, width, stepConfig.mascotMood]);
  
  // Render step content
  const renderStepContent = useCallback(() => {
    switch (currentStep) {
      case 'welcome':
        return (
          <WelcomeStep 
            onNext={nextStep} 
            onQuickSetup={handleQuickSetup}
            width={width}
          />
        );
      
      case 'scan-root':
        return (
          <Box flexDirection="column" gap={1} alignItems="center">
            {renderScene()}
            <Box marginTop={1} flexDirection="column" alignItems="center">
              <Text color="white">
                Enter the root directory where your Maven projects are located:
              </Text>
              <Text color={palette.gray400}>
                GFOS Build will scan this folder for repositories containing pom.xml files.
              </Text>
            </Box>
            <Box marginTop={1}>
              <PathInput
                value={settings.scanRootPath || ''}
                onChange={v => updateSetting('scanRootPath', v)}
                placeholder="C:\dev\quellen"
                onSubmit={nextStep}
              />
            </Box>
          </Box>
        );
      
      case 'jdk-paths':
        return (
          <Box flexDirection="column" gap={1} alignItems="center">
            {renderScene()}
            <Box marginTop={1} flexDirection="column" alignItems="center">
              <Text color="white">
                Enter the directory containing your JDK installations:
              </Text>
              <Text color={palette.gray400}>
                Multiple paths can be separated by semicolon (;)
              </Text>
            </Box>
            <Box marginTop={1}>
              <PathInput
                value={settings.jdkScanPaths || ''}
                onChange={v => updateSetting('jdkScanPaths', v)}
                placeholder="C:\dev\java"
                onSubmit={nextStep}
                icon="◆"
              />
            </Box>
          </Box>
        );
      
      case 'maven-home':
        return (
          <Box flexDirection="column" gap={1} alignItems="center">
            {renderScene()}
            <Box marginTop={1} flexDirection="column" alignItems="center">
              <Text color="white">
                Enter the path to your Maven installation:
              </Text>
              <Text color={palette.gray400}>
                This should point to the Maven home directory (containing /bin/mvn)
              </Text>
            </Box>
            <Box marginTop={1}>
              <PathInput
                value={settings.defaultMavenHome || ''}
                onChange={v => updateSetting('defaultMavenHome', v)}
                placeholder="C:\dev\maven\mvn3"
                onSubmit={nextStep}
                icon="▶"
              />
            </Box>
          </Box>
        );
      
      case 'confirm':
        return (
          <Box flexDirection="column" gap={1} alignItems="center">
            {renderScene()}
            <Box marginTop={1}>
              <Text color="white" bold>
                Review your settings:
              </Text>
            </Box>
            <SettingsPreview settings={settings} />
            <Box marginTop={1} flexDirection="column" alignItems="center">
              <Text color={palette.success400} bold>
                Press <Text color="white">Enter</Text> to save and start
              </Text>
              <Text color={palette.gray400}>
                Press <Text color={PRIMARY_COLOR}>Esc</Text> to go back and modify
              </Text>
            </Box>
          </Box>
        );
      
      case 'complete':
        return <CompleteScene width={width} />;
      
      default:
        return null;
    }
  }, [currentStep, settings, width, nextStep, handleQuickSetup, updateSetting, renderScene]);
  
  return (
    <Box 
      flexDirection="column" 
      width="100%" 
      height="100%"
      paddingX={2}
      paddingY={1}
    >
      {/* Step Header (except welcome and complete) */}
      {currentStep !== 'welcome' && currentStep !== 'complete' && (
        <Box flexDirection="column" alignItems="center" marginBottom={1}>
          <Text color={PRIMARY_COLOR} bold>
            {stepConfig.title}
          </Text>
          <Text color={palette.gray400}>
            {stepConfig.description}
          </Text>
        </Box>
      )}
      
      {/* Main Content Area */}
      <Box 
        flexDirection="column" 
        alignItems="center" 
        justifyContent="center"
        flexGrow={1}
      >
        {renderStepContent()}
      </Box>
      
      {/* Progress Indicator */}
      {currentStep !== 'complete' && (
        <Box marginTop={2} justifyContent="center">
          <ProgressDots current={stepIndex} total={STEPS.length - 1} />
        </Box>
      )}
      
      {/* Footer */}
      <Box 
        justifyContent="space-between" 
        marginTop={1} 
        paddingTop={1}
        borderStyle="single" 
        borderTop 
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderColor={palette.gray600}
      >
        <Text color={palette.gray400}>
          {currentStep === 'welcome' 
            ? <><Text color={palette.warning400}>Esc</Text> Exit</> 
            : <><Text color={PRIMARY_COLOR}>Esc</Text> Back</>}
        </Text>
        <Text color={palette.gray400}>
          Step {stepIndex + 1} of {STEPS.length}
        </Text>
      </Box>
    </Box>
  );
}

export default SetupWizardView;
