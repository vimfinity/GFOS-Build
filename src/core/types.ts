// All domain types live in the shared package so they can be used by both the
// server and the Electron renderer without duplication.
// type-only re-export — fully erased at runtime, no external module import generated.
export type * from '@gfos-build/shared';
