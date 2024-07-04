// TODO: Name TBD

import type { Traceparent } from 'tctx/traceparent';
import * as traceparent from 'tctx/traceparent';

import { span_buffer, wait_promises } from './_internal.ts';

import type { NewSpanFn, Options, Span, SpanBuilder } from './mod.ts';
import { measure } from './utils.ts';

/**
 * TODO: write jsdoc
 * 
 * A tracer is a logical unit in your application. This alleviates the need to pass around a tracer instance.
 *
 * All spans produced by a tracer will all collect into a single span collection that is given to {@link report}.
 *
 * @example
 *
 * ```ts
 * // file: server.ts
 * const trace = tracer('server');
 *
 * // file: orm.ts
 * const trace = tracer('orm');
 *
 * // file: api.ts
 * const trace = tracer('api');
 * ```
 */
export function tracer(name: string, options?: Options): { span: NewSpanFn } {
	const should_sample = options?.sampler ?? true;
	const clock = options?.clock ?? Date;

	const scope = { name };

	const ps: Set<Promise<unknown>> = new Set();
	wait_promises.set(scope, ps);

	const span = (
		name: string,
		parent_id?: Traceparent | null |  string,
	): SpanBuilder => {
		// ---
		const parent = (typeof parent_id === 'string' ? traceparent.parse(parent_id) : parent_id) ?? undefined;
		const id = parent?.child() || traceparent.make();

		const is_sampling = typeof should_sample == 'boolean' ? should_sample : should_sample(id.parent_id, parent, name, scope);
		if (is_sampling) traceparent.sample(id);
		else traceparent.unsample(id);

		const span_obj: Span = {
			id, parent, name,
			start: clock.now(),
			events: [],
			context: {},
		};

		is_sampling && span_buffer.add([span_obj, scope]);
		// ---

		const $: SpanBuilder = (cb) => measure($, cb);

		$.traceparent = id;
		$.span = (name, p_id) => span(name, p_id || id);
		$.set_context = (ctx) => {
			if (typeof ctx === 'function')
                // @ts-expect-error
				return void (span_obj.context = ctx(span_obj.context));
			return void Object.assign(span_obj.context, ctx);
		};
		$.add_event = (name, attributes) => {
            // @ts-expect-error
			span_obj.events.push({
				name,
				timestamp: clock.now(),
				attributes: attributes || {},
			});
		};
		$.end = () => {
            // @ts-expect-error
			if (span_obj.end == null) span_obj.end = clock.now();
		};

		// @ts-expect-error
		$.__add_promise = (p) => {
			ps.add(p);
			p.then(() => ps.delete(p));
		};

		return $;
	};

	return {
		span,
	};
}
