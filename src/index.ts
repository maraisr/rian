import type { CallableScope, Options, Span, Tracer } from 'rian';
import { measure } from 'rian/utils';
import { span_buffer, wait_promises } from './_internal';

import { type Traceparent } from 'tctx';
import * as tctx from 'tctx';

export { report, configure } from './_internal';

export function tracer(name: string, options?: Options): Tracer {
	const should_sample = options?.sampler ?? true;
	const clock = options?.clock ?? Date;

	const scope = { name };

	const ps: Set<Promise<any>> = new Set();
	wait_promises.set(scope, ps);

	const span = (
		name: string,
		parent_id?: Traceparent | string,
	): CallableScope => {
		// ---
		const parent = (typeof parent_id === 'string' ? tctx.parse(parent_id) : parent_id);
		const id = parent?.child() || tctx.make();

		const is_sampling = typeof should_sample == 'boolean' ? should_sample : should_sample(id.parent_id, parent, name, scope);
		if (is_sampling) tctx.sample(id);
		else tctx.unsample(id);

		const span_obj: Span = {
			id, parent, name,
			start: clock.now(),
			events: [],
			context: {},
		};

		is_sampling && span_buffer.add([span_obj, scope]);
		// ---

		const $: CallableScope = (cb: any) => measure($, cb);

		$.traceparent = id;
		$.span = (name, p_id) => span(name, p_id || id);
		$.set_context = (ctx) => {
			if (typeof ctx === 'function')
				return void (span_obj.context = ctx(span_obj.context));
			return void Object.assign(span_obj.context, ctx);
		};
		$.add_event = (name, attributes) => {
			span_obj.events.push({
				name,
				timestamp: clock.now(),
				attributes: attributes || {},
			});
		};
		$.end = () => {
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
