import * as async_hooks from 'node:async_hooks';

import type { Attributes, Options, Sampler, Scope, Span, SpanFn } from 'rian';
import type { Tracer } from 'rian/async';
import { make, parse, SAMPLED_FLAG, type Traceparent } from 'tctx';
import { measure, span_buffer, wait_promises } from './_internal';

export { configure, report } from './_internal';

type API = {
	sample: boolean | Sampler;
	scope: Scope;
};

const resourceStore = new async_hooks.AsyncLocalStorage<
	[API, SpanFn | null] | null
>();

export function currentSpan() {
	const scope = resourceStore.getStore()?.[1];
	if (scope == null) throw new Error('no current span');
	return scope;
}

export function span<T extends (s: SpanFn) => any>(
	label: string,
	arg1?: T | string | Traceparent,
	arg2?: T,
): typeof arg1 extends T ? ReturnType<T> : SpanFn {
	const context = resourceStore.getStore();
	if (!context) throw Error('TODO');

	let parent = typeof arg1 === 'function' ? undefined : arg1;
	let fn = typeof arg1 === 'function' ? arg1 : arg2!;

	const api = context[0];
	const scope = api.scope;
	const current_span = context[1];
	const sampler = api.sample;

	parent ||= current_span?.id;
	if (typeof parent === 'string') parent = parse(parent);

	let id = parent ? parent.child() : make();
	let should_sample =
		typeof sampler === 'boolean' ? sampler : sampler(scope, label, id);
	if (should_sample) id.flags |= SAMPLED_FLAG;
	else id.flags &= ~SAMPLED_FLAG;

	let c: Span = {
		label,
		id,
		parent,
		attributes: {},
		start: Date.now(),
		end: undefined,
		events: [],
	};

	should_sample && span_buffer.add([c, scope]);

	const $: SpanFn = {
		id: String(c.id),
		span(label: string, parent?: Traceparent | string) {
			return resourceStore.run([api, $], span, label, parent);
		},
		end() {
			c.end ||= Date.now();
		},
		set_attributes(a: Attributes | ((a: Attributes) => void)) {
			if (typeof a === 'function')
				return void (c.attributes = a(c.attributes));
			return void Object.assign(c.attributes, a);
		},
		add_event(label: string, attributes?: Attributes) {
			c.events.push({
				label,
				timestamp: Date.now(),
				attributes,
			});
		},
	};

	// @ts-expect-error
	if (fn == null) return $;

	return resourceStore.run([api, $], measure, scope, $, fn);
}

export function tracer<T extends () => any>(
	label: string,
	options?: Options,
): Tracer<T> {
	const sampler = options?.sample ?? true;

	const scope = { label };
	wait_promises.set(scope, new Set());

	const api: API = {
		scope,
		sample: sampler,
	};

	return function (cb) {
		const parent = resourceStore.getStore();
		return resourceStore.run([api, parent?.[1] || null], cb);
	};
}
