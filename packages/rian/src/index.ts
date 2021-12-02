import type { Traceparent } from 'tctx';
import * as tctx from 'tctx';

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
	 */
	context: Context;

	kind: Kind;
}

export type Kind = 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';

/**
 * An exporter is a method called when the parent scope ends, gets given a Set of all spans traced
 * during this execution.
 */
export type Exporter = (spans: ReadonlySet<Span>, context: Context) => any;

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

export interface Options {
	/**
	 * @borrows {@link Exporter}
	 */
	exporter: Exporter;

	/**
	 * @borrows {@link Sampler}
	 */
	sampler?: Sampler;

	context?: Context;

	/**
	 * A root, or extracted w3c traceparent stringed header.
	 *
	 * If the id is malformed, the {@link create} method will throw an exception. If no root is
	 * provided then one will be created obeying the {@link Options.sampler|sampling} rules.
	 */
	traceparent?: string;
}

type OmitScopeParam<T extends unknown[]> = T extends []
	? []
	: T extends [infer H, ...infer R]
	? H extends Scope
		? OmitScopeParam<R>
		: [H, ...OmitScopeParam<R>]
	: T;

interface CallableScope extends Scope {
	(cb: (scope: Omit<Scope, 'end'>) => void): ReturnType<typeof cb>;
}

export interface Scope {
	traceparent: Traceparent;

	fork(name: string, kind?: Kind): CallableScope;

	measure<Fn extends (...args: any[]) => any, Params extends Parameters<Fn>>(
		name: string,
		fn: Fn, // TODO Fix types here
		...args: OmitScopeParam<Params>
	): ReturnType<Fn>;

	set_context(contextFn: (context: Context) => Context): void;

	set_context(context: Context): void;

	end(): void;
}

export interface Tracer {
	/**
	 * @borrows {@link Scope.fork}
	 */
	span: Scope['fork'];

	/**
	 * @borrows {@link Scope.measure}
	 */
	measure: Scope['measure'];

	end(): ReturnType<Exporter>;
}

const measure = (
	cb: (...args: any[]) => any,
	scope: Scope,
	promises: Promise<any>[],
) => {
	const set_error = (error: Error) => {
		scope.set_context({
			error,
		});
	};

	return (...args: any[]) => {
		try {
			var r = cb(...args, scope),
				is_promise = r instanceof Promise;

			if (is_promise)
				promises.push(r.catch(set_error).finally(() => scope.end()));

			return r;
		} catch (e) {
			set_error(e);
			throw e;
		} finally {
			if (is_promise !== true) scope.end();
		}
	};
};

export const create = (options: Options): Tracer => {
	const spans: Set<Span> = new Set();
	const promises: Promise<any>[] = [];

	const span = (
		name: string,
		kind?: Kind,
		parent?: Traceparent,
	): CallableScope => {
		const should_sample = (options.sampler || defaultSampler)(
			name,
			parent,
			options.context,
		);
		const id = parent
			? parent.child(should_sample)
			: tctx.make(should_sample);

		const start = Date.now();

		const span_obj: Span = {
			id,
			parent,
			start,
			name,
			kind: kind || 'INTERNAL',
			context: {},
		};

		spans.add(span_obj);

		const $: CallableScope = (cb: any) => measure(cb, $, promises)();

		$.traceparent = id;
		$.fork = (name, kind) => span(name, kind, id);
		$.measure = (name, cb, ...args) =>
			// TODO: Should all measures be internal?
			measure(cb, span(name, 'INTERNAL', id), promises)(...args);
		$.set_context = (ctx) => {
			if (typeof ctx === 'function')
				return void (span_obj.context = ctx(span_obj.context));
			Object.assign(span_obj.context, ctx);
		};
		$.end = () => {
			if (span_obj.end) return void 0;

			span_obj.end = Date.now();
		};

		return $;
	};

	const root_id =
		typeof options.traceparent === 'string'
			? tctx.parse(options.traceparent)
			: undefined;

	return {
		span: (name, kind) => span(name, kind, root_id),
		measure: (name, cb, ...args) =>
			// TODO: Should all measures be internal?
			measure(cb, span(name, 'INTERNAL', root_id), promises)(...args),
		async end() {
			await Promise.all(promises);

			return options.exporter(spans, options.context || {});
		},
	};
};
