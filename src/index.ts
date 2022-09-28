import type { Traceparent } from 'tctx';
import * as tctx from 'tctx';
import { measureFn } from 'rian/utils';

declare const RIAN_VERSION: string;

import type {
	Scope,
	Sampler,
	Span,
	Options,
	Tracer,
	CallableScope,
} from 'rian';

// ==> impl

export const PROMISES = new WeakMap<Scope, Promise<any>[]>();
export const ADD_PROMISE = (scope: Scope, promise: Promise<any>) => {
	if (PROMISES.has(scope)) PROMISES.get(scope)!.push(promise);
	else PROMISES.set(scope, [promise]);
};

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

const sdk_object = {
	'telemetry.sdk.name': 'rian',
	'telemetry.sdk.version': RIAN_VERSION,
};

export const create = (name: string, options: Options): Tracer => {
	const spans: Set<Span> = new Set();

	const sampler = options.sampler || defaultSampler;
	const sampler_callable = typeof sampler !== 'boolean';

	const span = (name: string, parent?: Traceparent): CallableScope => {
		const should_sample = sampler_callable
			? sampler(name, parent, options.context)
			: sampler;

		const id = parent
			? parent.child(should_sample)
			: tctx.make(should_sample);

		const span_obj: Span = {
			id,
			parent,
			start: Date.now(),
			name,
			events: [],
			context: {},
		};

		if (should_sample) spans.add(span_obj);

		const $: CallableScope = (cb: any) => measureFn($, cb);

		$.traceparent = id;
		$.fork = (name) => span(name, id);
		// @ts-expect-error TS7030 its always undefined ts :eye-roll:
		$.set_context = (ctx) => {
			if (typeof ctx === 'function')
				return void (span_obj.context = ctx(span_obj.context));
			Object.assign(span_obj.context, ctx);
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

		return $;
	};

	const root = span(
		name,
		typeof options.traceparent === 'string'
			? tctx.parse(options.traceparent)
			: undefined,
	);

	const endRoot = root.end.bind(root);

	root.end = async () => {
		endRoot();
		if (PROMISES.has(root)) await Promise.all(PROMISES.get(root)!);

		return options.exporter(spans, {
			...(options.context || {}),
			...sdk_object,
		});
	};

	return root;
};
