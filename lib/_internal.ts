import type { Span, Scope } from './mod.ts';

export const span_buffer = new Set<[Span, Scope]>();
export const wait_promises = new WeakMap<Scope, Set<Promise<unknown>>>();