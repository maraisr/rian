import * as async_hooks from 'node:async_hooks';

import type {
	CallableScope,
	ClockLike,
	Options,
	Sampler,
	Scope,
	Span,
} from 'rian';
import type { Tracer } from 'rian/async';
import { measure } from 'rian/utils';
import { make, parse, SAMPLED_FLAG, type Traceparent } from 'tctx';
import { defaultSampler, span_buffer, wait_promises } from './_internal';

export { configure, report } from './_internal';

type API = {
	sampler: Sampler | boolean;
	scope: { name: string };
	clock: ClockLike;
};

const resourceStore = new async_hooks.AsyncLocalStorage<
	[API, Scope | null] | null
>();

export function currentSpan() {
	const scope = resourceStore.getStore()?.[1];
	if (scope == null) throw new Error('no current span');
	return scope;
}

export function span(name: string, parent_id?: Traceparent | string) {
	const context = resourceStore.getStore();
	if (!context) throw Error('no current tracer');

	const api = context[0];
	const scope = api.scope;
	const current_span = context[1];
	const sampler = api.sampler;

	// ---
	const parent =
		parent_id != null
			? typeof parent_id === 'string'
				? parse(parent_id)
				: parent_id
			: current_span?.traceparent;
	const id = parent ? parent.child() : make();

	const should_sample =
		typeof sampler !== 'boolean' ? sampler(name, id, scope) : sampler;

	if (should_sample) id.flags |= SAMPLED_FLAG;
	else id.flags &= ~SAMPLED_FLAG;

	const span_obj: Span = {
		id,
		parent,
		start: api.clock.now(),
		name,
		events: [],
		context: {},
	};

	should_sample && span_buffer.add([span_obj, scope]);
	// ---

	const $: CallableScope = (cb: any) =>
		resourceStore.run([api, $], measure, $, cb);

	$.traceparent = id;
	$.span = (name: string) => resourceStore.run([api, $], span, name);
	$.set_context = (ctx) => {
		if (typeof ctx === 'function')
			return void (span_obj.context = ctx(span_obj.context));
		Object.assign(span_obj.context, ctx);
	};
	$.add_event = (name, attributes) => {
		span_obj.events.push({
			name,
			timestamp: api.clock.now(),
			attributes: attributes || {},
		});
	};
	$.end = () => {
		if (span_obj.end == null) span_obj.end = api.clock.now();
	};

	const ps = wait_promises.get(scope)!;
	// @ts-expect-error
	$.__add_promise = (p) => {
		ps.add(p);
		p.then(() => ps.delete(p));
	};

	return $;
}

export function tracer<T extends () => any>(
	name: string,
	options?: Options,
): Tracer<T> {
	const sampler = options?.sampler ?? defaultSampler;

	const scope = { name };

	const api: API = {
		scope,
		sampler,
		clock: options?.clock ?? Date,
	};

	wait_promises.set(scope, new Set());

	return function (cb) {
		const parent = resourceStore.getStore();
		return resourceStore.run([api, parent?.[1] || null], cb);
	};
}
