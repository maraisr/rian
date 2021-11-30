import type { Traceparent } from 'tctx';
import * as tctx from 'tctx';

export type Span = {
	name: string;
	id: Traceparent;
	parent?: Traceparent;
	start: number;
	end?: number;
	context: Context;
};

export type Collector = (spans: ReadonlySet<Span>) => any;

export type Context = {
	[property: string]: any;
};

export type Options = {
	collector: Collector;
	traceparent?: string;
};

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

	fork(name: string, traceparent?: Traceparent): CallableScope;

	measure<Fn extends (...args: any[]) => any, Params extends Parameters<Fn>>(
		name: string,
		fn: Fn, // TODO Fix types here
		...args: OmitScopeParam<Params>
	): ReturnType<Fn>;

	set_context(contextFn: (context: Context) => Context): void;

	set_context(context: Context): void;

	end(): void;
}

export interface Tracer extends Scope {
	end(): ReturnType<Collector>;
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

export const create = (name: string, options: Options): Tracer => {
	const spans: Set<Span> = new Set();
	const promises: Promise<any>[] = [];

	const span = (name: string, parent?: Traceparent): CallableScope => {
		const id = parent ? parent.child() : tctx.make(true);

		const start = Date.now();

		const span_obj: Span = {
			id,
			parent,
			start,
			name,
			context: {},
		};

		spans.add(span_obj);

		// @ts-ignore
		const $: CallableScope = (cb: any) => measure(cb, $, promises)();

		$.traceparent = id;
		$.fork = (name) => span(name, id);
		$.measure = (name, cb, ...args) =>
			measure(cb, span(name, id), promises)(...args);
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

	const root = span(
		name,
		typeof options.traceparent === 'string'
			? tctx.parse(options.traceparent)
			: undefined,
	);
	const meEnd = root.end.bind(root);

	root.end = async () => {
		meEnd();
		await Promise.all(promises);

		return options.collector(spans);
	};

	return root;
};
