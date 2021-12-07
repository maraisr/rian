import { name as rian_name, version as rian_version } from 'rian/package.json';
import type { Traceparent } from 'tctx';
import * as tctx from 'tctx';
import {
	measure,
	type MeasureFn,
	type RealMeasureFnParams,
} from './internal/measure';

/**
 * Spans are units within a distributed trace. Spans encapsulate mainly 3 pieces of information, a
 * {@link Span.name|name}, and a {@link Span.start|start} and {@link Span.end|end} time.
 *
 * Each span should be named, not too vague, and not too precise. For example, "resolve_user_ids"
 * and not "resolver_user_ids[1,2,3]" nor "resolve".
 *
 * A span forms part of a wider trace, and can be visualized like:
 *
 * ```plain
 *  [Span A················································(2ms)]
 *    [Span B·········································(1.7ms)]
 *       [Span D···············(0.8ms)]  [Span C......(0.6ms)]
 * ```
 *
 * ---
 *
 * Spans are aimed to interoperate with
 * {@link https://github.com/opentracing/specification/blob/master/specification.md|OpenTracing's Spans}, albeit not entirely api compatible — they do share principles.
 */
export interface Span {
	/**
	 * A human-readable name for this span. For example the function name, the name of a subtask,
	 * or stage of the larger stack.
	 *
	 * @example
	 * "resolve_user_ids"
	 * "[POST] /api"
	 */
	name: string;

	/**
	 * A w3c trace context compatible id for this span. Will .toString() into an injectable header.
	 *
	 * @see https://www.w3.org/TR/trace-context/#traceparent-header
	 * @see https://github.com/maraisr/tctx
	 */
	id: Traceparent;

	/**
	 * Is the id of rhe parent if this is not the parent {@link Span}.
	 *
	 * @see {@link Span.id}
	 */
	parent?: Traceparent;

	/**
	 * The time represented as a UNIX epoch timestamp in milliseconds when this span was created.
	 * Typically, via
	 * {@link Scope.fork|tracer.fork()}.
	 */
	start: number;

	/**
	 * The UNIX epoch timestamp in milliseconds when the span ended, or undefined if ending was not
	 * captured during the current trace. Time should then be assumed as current time.
	 */
	end?: number;

	/**
	 * An arbitrary context object useful for storing information during a trace.
	 *
	 * Usually following a convention such as `tag.*`, `http.*` or any of the
	 * {@link https://github.com/opentracing/specification/blob/master/semantic_conventions.md|Semantic Conventions outlined by OpenTracing}.
	 *
	 * ### Note!
	 *
	 * There are a few keys with "powers"
	 *
	 * - `kind` when set will coerce into the exports scheme, aka INTERNAL in zipkin will be
	 * `"INTERNAL"`, or `1` in otel
	 * - `error` when set, will be assumed to be an `Error` instance, and thus its `.message` wil
	 * exist as `error.message` in zipkin, and `status: 2` in otel.
	 */
	context: Context;

	/**
	 * Events are user-defined timestamped annotations of "events" that happened during the
	 * lifetime of a span. Consisting of a textual message, and optional attributes.
	 *
	 * As a rule-of-thumb use events to attach verbose information about a span, than an entirely
	 * new span.
	 */
	events: { name: string; timestamp: number; attributes: Context }[];
}

export interface Scope {
	/**
	 * A W3C traceparent. One can .toString() this if you want to cross a network.
	 */
	traceparent: Traceparent;

	/**
	 * Forks the span into a new child span.
	 */
	fork(name: string): CallableScope;

	/**
	 * With a passed function — will start a span, and run the function, when the function finishes
	 * the span finishes.
	 *
	 * The measure method will return whatever the function is, so if it's a promise, it returns a
	 * promise and so on. Any error is caught and re thrown, and automatically tracked in the
	 * context under the `error` property.
	 *
	 * All promises are tracked, and awaited on a `tracer.end`.
	 *
	 * @example
	 *
	 * ```text
	 * const data = await scope.measure('name', get_data, 'user_id_123');
	 *        ^                           ^        ^          ^
	 *        |                           |        |          |
	 *        |                           |        |          the first argument to get_data
	 *        |                           |        function to be called
	 *        |                           the name of the sub scope
	 *        return value from get_data
	 * ```
	 */
	measure<Fn extends MeasureFn>(
		name: string,
		fn: Fn, // TODO: fn doesnt see scope correctly
		...args: RealMeasureFnParams<Parameters<Fn>>
	): ReturnType<Fn>;

	/**
	 * Allows the span's context to be set. Passing an object will be `Object.assign`ed into the
	 * current context.
	 *
	 * Passing a function will be available to return a new context.
	 */
	set_context(contextFn: Context | ((context: Context) => Context)): void;

	/**
	 * Adds a new event to the span. As a rule-of-thumb use events to attach verbose information
	 * about a span, than an entirely new span.
	 */
	add_event(name: string, attributes?: Record<string, any>): void;

	/**
	 * Ends the current span — setting its `end` timestamp. Not calling this, will have its `end`
	 * timestamp nulled out — when the tracer ends.
	 */
	end(): void;
}

export interface Tracer extends Omit<Scope, 'end'> {
	end(): ReturnType<Exporter>;
}

/**
 * An exporter is a method called when the parent scope ends, gets given a Set of all spans traced
 * during this execution.
 */
export type Exporter = (
	spans: ReadonlySet<Readonly<Span>>,
	context: Context,
) => any;

/**
 * @borrows {@link Span.context}
 */
export interface Context {
	[property: string]: any;
}

/**
 * Should return true when you want to sample the span, this is ran before the span is traced — so
 * decisions is made preemptively.
 *
 * The Span itself will still be included in the {@link Options.exporter|exporter}, and can be
 * filtered out there.
 *
 * Sampling does impact the traceparent, for injection — and is encoded there.
 */
export type Sampler = (
	name: string,
	parentId?: Traceparent,
	context?: Context,
) => boolean;

export interface Options {
	/**
	 * @borrows {@link Exporter}
	 */
	exporter: Exporter;

	/**
	 * @borrows {@link Sampler}
	 */
	sampler?: Sampler | boolean;

	context?: Context;

	/**
	 * A root, or extracted w3c traceparent stringed header.
	 *
	 * If the id is malformed, the {@link create} method will throw an exception. If no root is
	 * provided then one will be created obeying the {@link Options.sampler|sampling} rules.
	 */
	traceparent?: string;
}

interface CallableScope extends Scope {
	(cb: (scope: Omit<Scope, 'end'>) => void): ReturnType<typeof cb>;
}

// ==> impl

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
	'telemetry.sdk.name': rian_name,
	'telemetry.sdk.version': rian_version,
};

export const create = (name: string, options: Options): Tracer => {
	const spans: Set<Span> = new Set();
	const promises: Promise<any>[] = [];

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

		const $: CallableScope = (cb: any) => measure(cb, $, promises);

		$.traceparent = id;
		$.fork = (name) => span(name, id);
		$.measure = (name, cb, ...args) =>
			measure(cb, span(name, id), promises, ...args);
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
			if (span_obj.end) return void 0;

			span_obj.end = Date.now();
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
		if (promises.length) await Promise.all(promises);

		return options.exporter(spans, {
			...(options.context || {}),
			...sdk_object,
		});
	};

	return root;
};
