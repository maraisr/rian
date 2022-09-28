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
	parent: Traceparent | undefined;

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

export const create: (name: string, options: Options) => Tracer;

// ==> internals

/** @internal */
export interface CallableScope extends Scope {
	(cb: (scope: Omit<Scope, 'end'>) => void): ReturnType<typeof cb>;
}

/** @internal */
export const PROMISES: WeakMap<Scope, Promise<any>[]>;

/** @internal */
export const ADD_PROMISE: (scope: Scope, promise: Promise<any>) => void;
