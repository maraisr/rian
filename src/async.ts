import * as async_hooks from 'node:async_hooks';

import type {
	CallableSpanBuilder,
	ClockLike,
	Options,
	Sampler,
	SpanBuilder,
	Span,
} from 'rian';
import type { Tracer } from 'rian/async';
import { measure } from 'rian/utils';

import { type Traceparent } from 'tctx/traceparent';
import * as traceparent from 'tctx/traceparent';

import { span_buffer, wait_promises } from './_internal';

export { configure, report } from './_internal';

type API = {
	sampler: Sampler | boolean;
	scope: { name: string };
	clock: ClockLike;
};

const resourceStore = new async_hooks.AsyncLocalStorage<
	[API, SpanBuilder | null] | null
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
	const should_sample = api.sampler;

	// ---
	const parent =
		typeof parent_id === 'string'
			? traceparent.parse(parent_id) || undefined
			: parent_id || current_span?.traceparent;
	const id = parent?.child() || traceparent.make();

	const is_sampling =
		typeof should_sample == 'boolean'
			? should_sample
			: should_sample(id.parent_id, parent, name, scope);
	if (is_sampling) traceparent.sample(id);
	else traceparent.unsample(id);

	// prettier-ignore
	const span_obj: Span = {
		id, parent, name,
		start: api.clock.now(),
		events: [],
		context: {},
	};

	is_sampling && span_buffer.add([span_obj, scope]);
	// ---

	const $: CallableSpanBuilder = (cb: any) =>
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
	const sampler = options?.sampler ?? true;

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
