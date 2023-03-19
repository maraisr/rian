import type { CallableScope, Options, Span, Tracer } from 'rian';
import { measure } from 'rian/utils';
import { make, parse, SAMPLED_FLAG, type Traceparent } from 'tctx';
import { defaultSampler, span_buffer, wait_promises } from './_internal';

export { report, configure } from './_internal';

export function tracer(name: string, options?: Options): Tracer {
	const sampler = options?.sampler ?? defaultSampler;

	const scope = { name };

	const ps: Set<Promise<any>> = new Set();
	wait_promises.set(scope, ps);

	const root_id =
		typeof options?.traceparent === 'string'
			? parse(options.traceparent)
			: undefined;

	const span = (name: string, parent?: Traceparent): CallableScope => {
		const id = parent ? parent.child() : make();

		const should_sample =
			typeof sampler !== 'boolean' ? sampler(name, id, scope) : sampler;

		if (should_sample) id.flags | SAMPLED_FLAG;
		else id.flags & ~SAMPLED_FLAG;

		const span_obj: Span = {
			id,
			parent,
			start: Date.now(),
			name,
			events: [],
			context: {},
		};

		should_sample && span_buffer.add([span_obj, scope]);

		const $: CallableScope = (cb: any) => measure($, cb);

		$.traceparent = id;
		$.span = (name) => span(name, id);
		$.set_context = (ctx) => {
			if (typeof ctx === 'function')
				return void (span_obj.context = ctx(span_obj.context));
			return void Object.assign(span_obj.context, ctx);
		};
		$.add_event = (name, attributes) => {
			span_obj.events.push({
				name,
				timestamp: Date.now(),
				attributes: attributes || {},
			});
		};
		$.end = () => {
			if (span_obj.end == null) span_obj.end = Date.now();
		};

		// @ts-expect-error
		$.__add_promise = (p) => {
			ps.add(p);
			p.then(() => ps.delete(p));
		};

		return $;
	};

	return {
		span(name) {
			return span(name, root_id);
		},
	};
}
