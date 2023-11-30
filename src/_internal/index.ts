// 🚨 WARNING THIS FILE WILL DUPLICATE ITSELF WITH EACH ENTRYPOINT

import type { Resource, Context, Exporter, ScopedSpans, Span } from 'rian';
import { is_sampled, type Traceparent } from 'tctx';

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

export const span_buffer = new Set<[Span, { name: string }]>();
export const wait_promises = new WeakMap<{ name: string }, Set<Promise<any>>>();

export async function report(exporter: Exporter) {
	const ps = [];
	const scopes = new Map<{ name: string }, ScopedSpans>();

	for (let [span, scope] of span_buffer) {
		let spans: Span[];
		if (scopes.has(scope)) {
			// @ts-expect-error
			spans = scopes.get(scope)!.spans;
		} else {
			scopes.set(scope, {
				scope,
				spans: (spans = []),
			});
		}

		spans.push(span);

		if (wait_promises.has(scope)) {
			const pss = wait_promises.get(scope)!;
			ps.push(...pss);
			pss.clear();
		}
	}

	span_buffer.clear();

	if (ps.length) await Promise.all(ps);

	return exporter({
		resource,
		scopeSpans: scopes.values(),
	});
}

/*#__INLINE__*/
export function defaultSampler(_name: string, id: Traceparent) {
	return is_sampled(id);
}
