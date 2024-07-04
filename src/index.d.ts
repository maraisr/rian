

/**
 * Spans are units within a distributed trace. Spans encapsulate mainly 3 pieces of information, a
 * {@link Span.name|name}, and a {@link Span.start|start} and {@link Span.end|end} time.
 *
 * Each span should be named, not too vague, and not too precise. For example, "resolve_user_ids"
 * and not "resolver_user_ids[1,2,3]" nor "resolver".
 *
 * A span forms part of a wider trace, and can be visualized like:
 *
 * ```plain
 *  [Span A················································(2ms)]
 *    [Span B·········································(1.7ms)]
 *       [Span D···············(0.8ms)] [Span C......(0.6ms)]
 * ```
 */
export type Span = {
	/**
	 * A human-readable name for this span. For example the function name, the name of a subtask,
	 * or stage of the larger stack.
	 *
	 * @example
	 *
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
	 * {@link Scope.span|scope.span()}.
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
	 * {@link https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/|OpenTelemetry Trace Semantic Conventions}.
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
};

// --- scopes

export type Scope = {
	/**
	 * A W3C traceparent. One can .toString() this if you want to cross a network.
	 */
	traceparent: Traceparent;

	/**
	 * Forks the span into a new child span.
	 */
	span(
		/**
		 * @borrows {@link Span.name}
		 */
		name: string,
		parent_id?: Traceparent | string,
	): CallableScope;

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
};

export type CallableScope = Scope & {
	<Fn extends (scope: Omit<Scope, 'end'>) => any>(cb: Fn): ReturnType<Fn>;
};

// --- main api

/**
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
export function tracer(name: string, options?: Options): Tracer;