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
		['telemetry.sdk.version']: RIAN_VERSION,
	};
}

// ------------------------------------------------
// #region Spans
// ------------------------------------------------

// TODO: Write jsdoc
export type Span = {}

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