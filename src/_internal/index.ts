// 🚨 WARNING THIS FILE WILL DUPLICATE ITSELF WITH EACH ENTRYPOINT

import type {
	Resource,
	Context,
	Exporter,
	ScopedSpans,
	Span,
	Scope,
} from 'rian';

export const span_buffer = new Set<[Span, Scope]>();
export const wait_promises = new WeakMap<Scope, Set<Promise<any>>>();

// ---

let resource = {} as Resource;

export function configure(name: string, attributes: Context = {}) {
	resource = {
		...attributes,
		['service.name']: name,
		['telemetry.sdk.name']: 'rian',
		['telemetry.sdk.version']: RIAN_VERSION,
	};
}

// ---

export async function report(exporter: Exporter) {
	const ps = [];
	const scopes = new Map<Scope, ScopedSpans>();
	const scopeSpans: Array<ScopedSpans> = [];

	for (let [span, scope] of span_buffer) {
		let scope_spans = scopes.get(scope);

		if (scope_spans == null) {
			scope_spans = { scope, spans: [] };
			scopeSpans.push(scope_spans);
			scopes.set(scope, scope_spans);

			// If we are in here, we have not seen this scope yet, so also enque all of its wait_promises
			if (wait_promises.has(scope)) {
				const pss = wait_promises.get(scope)!;
				ps.push(...pss);
				pss.clear();
			}
		}

		(scope_spans.spans as Span[]).push(span);
	}

	if (ps.length) await Promise.all(ps);

	span_buffer.clear();

	return exporter({ resource, scopeSpans });
}
