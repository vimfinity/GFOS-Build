// All shared execution and model types live in the contracts package so they
// can be used by the desktop UI, CLI, and runtime without duplication.
// type-only re-export — fully erased at runtime, no external module import generated.
export type * from '@gfos-build/contracts';
