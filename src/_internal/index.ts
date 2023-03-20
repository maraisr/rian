// 🚨 WARNING THIS FILE WILL DUPLICATE ITSELF WITH EACH ENTRYPOINT

import type {
	Attributes,
	Exporter,
	Scope,
	ScopedSpans,
	Span,
	SpanFn,
} from 'rian';

// ---

let resource: Attributes = {};

export function configure(name: string, attributes?: Attributes) {
	resource = {
		...(attributes || {}),
		['service.name']: name,
		['telemetry.sdk.name']: 'rian',
		['telemetry.sdk.version']: RIAN_VERSION,
	};
}

// ---

export const span_buffer = new Set<[Span, Scope]>();
export const wait_promises = new WeakMap<Scope, Set<Promise<any>>>();

export async function report(exporter: Exporter) {
	const ps = [];
	const scopes = new Map<Scope, ScopedSpans>();

	for (let [span, scope] of span_buffer) {
		let spans: Span[];
		if (scopes.has(scope)) {
			spans = scopes.get(scope)!.spans;
		} else {
			scopes.set(scope, {
				scope,
				spans: (spans = []),
			});
			if (wait_promises.has(scope)) ps.push(...wait_promises.get(scope)!);
		}

		spans.push(span);
	}

	span_buffer.clear();

	if (ps.length) await Promise.all(ps);

	return exporter({
		resource,
		scopeSpans: [...scopes.values()],
	});
}

// --

export function measure<T extends (span: SpanFn) => any>(
	scope: Scope,
	spanFn: SpanFn,
	fn: T,
): ReturnType<T> {
	try {
		var r = fn(spanFn),
			is_promise = r instanceof Promise;

		if (is_promise) {
			let item = wait_promises.get(scope)!;
			let p = r
				.catch((e: Error) =>
					spanFn.set_attributes({
						error: e,
					}),
				)
				.finally(() => {
					spanFn.end();
					item.delete(p);
				});
			item.add(p);
		}

		return r;
	} catch (e) {
		if (e instanceof Error)
			spanFn.set_attributes({
				error: e,
			});
		throw e;
	} finally {
		// @ts-expect-error TS2454
		if (is_promise !== true) spanFn.end();
	}
}
