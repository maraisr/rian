import * as tctx from 'tctx';

import type { Attributes, Options, Scope, Span, SpanFn } from 'rian';
import { measure, span_buffer, wait_promises } from './_internal';

export { configure, report } from './_internal';

function toSpan(
	scope: Scope,
	label: string,
	sampler: boolean | ((label: string, id: tctx.Traceparent) => boolean),
	parent?: tctx.Traceparent,
): SpanFn {
	let id = parent ? parent.child() : tctx.make();
	let should_sample =
		typeof sampler === 'boolean' ? sampler : sampler(label, id);
	if (should_sample) id.flags |= tctx.SAMPLED_FLAG;
	else id.flags &= ~tctx.SAMPLED_FLAG;

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

	return {
		id: String(c.id),
		span(label: string) {
			return toSpan(scope, label, sampler, id);
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
}

export function tracer(label: string, options?: Options) {
	let scope: Scope = { label };
	wait_promises.set(scope, new Set());

	let sampler = options?.sample ?? true;
	let s = typeof sampler === 'function' ? sampler.bind(null, scope) : sampler;

	return {
		span(label: string, parent_id?: string | tctx.Traceparent) {
			return toSpan(
				scope,
				label,
				s,
				typeof parent_id === 'string'
					? tctx.parse(parent_id)
					: parent_id,
			);
		},
		time<T extends (span: SpanFn) => any>(
			label: string,
			arg1: T | string | tctx.Traceparent,
			arg2?: T,
		): ReturnType<T> {
			let parent_id = typeof arg1 === 'function' ? undefined : arg1;
			let span = this.span(label, parent_id);
			let fn = typeof arg1 === 'function' ? arg1 : arg2!;
			return measure(scope, span, fn);
		},
	};
}
