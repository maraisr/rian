import type {
	CallableScope,
	Context,
	Exporter,
	Options,
	Resource,
	Sampler,
	Span,
	Tracer,
} from 'rian';
import { measureFn } from 'rian/utils';

import type { Traceparent } from 'tctx';
import * as tctx from 'tctx';

/**
 * The default sampler;
 *
 * If no parent
 * ~> sample
 * if parent was off
 * ~> never sample
 * if parent was on
 * ~> always sample
 */
const defaultSampler: Sampler = (_name, parentId) => {
	if (!parentId) return true;
	return tctx.is_sampled(parentId);
};

const span_buffer = new Set<[Span, Context]>();
const wait_promises = new WeakMap<Context, Set<Promise<any>>>();

export function tracer(name: string, options?: Options): Tracer {
	const sampler = options?.sampler ?? defaultSampler;

	const clock = options?.clock || Date;

	const resource = options?.context || {};
	resource['service.name'] = name;
	resource['telemetry.sdk.name'] = 'rian';
	resource['telemetry.sdk.version'] = RIAN_VERSION;

	const ps: Set<Promise<any>> = new Set();
	wait_promises.set(resource, ps);

	const root_id =
		typeof options?.traceparent === 'string'
			? tctx.parse(options.traceparent)
			: undefined;

	const span = (name: string, parent?: Traceparent): CallableScope => {
		const should_sample =
			typeof sampler !== 'boolean'
				? sampler(name, parent, resource)
				: sampler;

		const id = parent
			? parent.child(should_sample)
			: tctx.make(should_sample);

		const span_obj: Span = {
			id,
			parent,
			start: clock.now(),
			name,
			events: [],
			context: {},
		};

		should_sample && span_buffer.add([span_obj, resource]);

		const $: CallableScope = (cb: any) => measureFn($, cb);

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
		span(name) {
			return span(name, root_id);
		},
	};
}

export async function report(exporter: Exporter) {
	const ps = [];
	const resources = new Map<Context, Resource>();

	for (let [span, resource] of span_buffer) {
		let spans: Set<Span>;
		if (resources.has(resource)) {
			// @ts-expect-error
			spans = resources.get(resource)!.spans;
		} else {
			resources.set(resource, {
				resource,
				spans: (spans = new Set()),
			});
		}

		spans.add(span);

		if (wait_promises.has(resource)) {
			ps.push(...wait_promises.get(resource)!);
			wait_promises.delete(resource);
		}
	}

	span_buffer.clear();

	if (ps.length) await Promise.all(ps);

	return exporter(resources.values());
}
