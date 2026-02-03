// Test script to debug startup issues
import { writeSync } from 'fs';

const log = (msg: string) => {
  writeSync(1, msg + '\n');
};

log('Starting import test...');

async function test() {
  try {
    log('1. Testing theme imports...');
    const theme = await import('./src/ui/theme/index.js');
    log('   ✓ Theme loaded: ' + Object.keys(theme).join(', '));
    
    log('2. Testing hooks imports...');
    const hooks = await import('./src/ui/hooks/index.js');
    log('   ✓ Hooks loaded: ' + Object.keys(hooks).join(', '));
    
    log('3. Testing primitives imports...');
    const primitives = await import('./src/ui/primitives/index.js');
    log('   ✓ Primitives loaded: ' + Object.keys(primitives).join(', '));
    
    log('4. Testing system imports...');
    const system = await import('./src/ui/system/index.js');
    log('   ✓ System loaded: ' + Object.keys(system).join(', '));

    log('5. Testing views-v2 imports...');
    const views = await import('./src/ui/views-v2/index.js');
    log('   ✓ Views loaded: ' + Object.keys(views).join(', '));
    
    log('6. Testing AppV2 import...');
    const app = await import('./src/ui/AppV2.js');
    log('   ✓ AppV2 loaded: ' + Object.keys(app).join(', '));
    
    log('\n✅ All imports successful!');
  } catch (error: any) {
    log('\n❌ Import failed: ' + error.message);
    log('Stack: ' + error.stack);
  }
}

test();

}
