import type { Traceparent } from 'tctx/traceparent';
import { span_buffer, wait_promises } from './_internal.ts';

export type Attributes = {
	[property: string]: unknown;
};

// ------------------------------------------------
// #region Configure
// ------------------------------------------------

export type Resource = {
	'service.name': string;
	'telemetry.sdk.name': string;
	'telemetry.sdk.version': string;
} & Attributes;

let resource = {} as Resource;

/**
 * TODO: write jsdoc
 * 
 * Calling this method will set the resource attributes for this runtime. This is useful for things like:
 * - setting the deployment environment of the application
 * - setting the k8s namespace
 * - ...
 *
 * The `name` argument will set the `service.name` attribute. And is required.
 *
 * The fields can be whatever you want, but it is recommended to follow the {@link https://opentelemetry.io/docs/reference/specification/resource/semantic_conventions/|OpenTelemetry Resource Semantic Conventions}.
 *
 * @example
 *
 * ```ts
 * configure('my-service', { 'deployment.environment': 'production', 'k8s.namespace.name': 'default' });
 * ```
 */
export function configure(name: string, attributes: Attributes = {}) {
	resource = {
		...attributes,
		['service.name']: name,
		['telemetry.sdk.name']: 'rian',
		['telemetry.sdk.version']: '0.0.0', // TODO
	};
}

// ------------------------------------------------
// #region Spans
// ------------------------------------------------

// TODO: Write jsdoc
export type SpanEvent = {
	readonly name: string;
	readonly timestamp: number;
	readonly attributes: Readonly<Attributes>
};

// TODO: Write jsdoc
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
	readonly name: string;

	/**
	 * A w3c trace context compatible id for this span. Will .toString() into an injectable header.
	 *
	 * @see https://www.w3.org/TR/trace-context/#traceparent-header
	 * @see https://github.com/maraisr/tctx
	 */
	readonly id: Traceparent;

	/**
	 * Is the id of the parent of the parent {@link Span}.
	 */
	readonly parent: Traceparent | undefined;

	/**
	 * The time represented as a UNIX epoch timestamp in milliseconds when this span was created.
	 * Typically, via {@link Scope.span|scope.span()}.
	 */
	readonly start: number;

	/**
	 * The UNIX epoch timestamp in milliseconds when the span ended, or undefined if ending was not
	 * captured during the current trace. Time should then be assumed as current time.
	 */
	readonly end?: number;

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
	readonly context: Attributes;

	/**
	 * Events are user-defined timestamped annotations of "events" that happened during the
	 * lifetime of a span. Consisting of a textual message, and optional attributes.
	 *
	 * As a rule-of-thumb use events to attach verbose information about a span, than an entirely
	 * new span.
	 */
	readonly events: ReadonlyArray<SpanEvent>;
};

export type NewSpanFn = (
	/**
	 * The name of the span.
	 */
	name: string,
	/**
	 * The parent id of the span.
	 */
	parent_id?: Traceparent | string,
) => SpanBuilder;

// TODO: Write jsdoc
export type SpanBuilder = {
	<Fn extends (span: Omit<SpanBuilder, 'end'>) => unknown>(cb: Fn): ReturnType<Fn>;

	/**
	 * A W3C traceparent. One can .toString() this if you want to cross a network.
	 */
	traceparent: Traceparent;

	/**
	 * Forks the span into a new child span.
	 */
	span: NewSpanFn;

	/**
	 * Allows the span's context to be set. Passing an object will be `Object.assign`ed into the
	 * current context.
	 *
	 * Passing a function will be available to return a new context.
	 */
	set_context(contextFn: Attributes | ((context: Attributes) => Attributes)): void;

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

// ------------------------------------------------
// #region Scopes
// ------------------------------------------------

// TODO: Write jsdoc
export type Scope = { readonly name: string; }

// TODO: Write jsdoc
export type ScopedSpans = {
	readonly scope: Scope;
	readonly spans: ReadonlyArray<Readonly<Span>>;
};

// ------------------------------------------------
// #region Tracer
// ------------------------------------------------

/**
 * Allows a sampling decision to be made. This method will influence the {@link Span.id|traceparent} sampling flag.
 *
 * Return true if the span should be sampled, and reported to the {@link Exporter}.
 * Return false if the span should not be sampled, and not reported to the {@link Exporter}.
 */
export type Sampler = (
	/**
	 * The id of the new span looking for a sampling decision.
 	*/
	id: string,
	/**
	 * The parent id of the new span looking for a sampling decision.
	 */
	parent: Traceparent | undefined,
	/**
	 * The name of the span.
	 */
	name: string,
	/**
	 * The tracer this span belongs to.
	 */
	tracer: { readonly name: string },
) => boolean;

/**
 * Provinding a clock allows you to control the timeing of a span.
 */
export type ClockLike = {
	/**
	 * Must return the number of milliseconds since the epoch.
	 */
	now(): number;
};

// TODO: Write jsdoc
export type Options = {
	sampler?: Sampler | boolean;

	clock?: ClockLike;
};

// ------------------------------------------------
// #region Reporters
// ------------------------------------------------

// TODO: Write jsdoc
export type Trace = {
	resource: Readonly<Resource>;
	scopeSpans: ReadonlyArray<ScopedSpans>;
};

/**
 * The exporter is called when the {@link report} method is called.
 */
export type Exporter = (trace: Trace) => unknown;

// TODO: Write jsdoc
export async function report(exporter: Exporter) {
	const ps = [];
	const scopes = new Map<Scope, ScopedSpans>();
	const scoped_spans: Array<ScopedSpans> = [];

	for (let [span, scope] of span_buffer) {
		let scope_spans = scopes.get(scope);

		if (scope_spans == null) {
			scoped_spans.push(scope_spans = { scope, spans: [] });
			scopes.set(scope, scope_spans);
		}

		(scope_spans.spans as Span[]).push(span);

		if (wait_promises.has(scope)) {
			const pss = wait_promises.get(scope)!;
			ps.push(...pss);
			pss.clear();
		}
	}

	span_buffer.clear();

	if (ps.length) await Promise.all(ps);

	return exporter({
		resource,
		scopeSpans: scoped_spans,
	});
}