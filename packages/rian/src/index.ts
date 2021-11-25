import type { Traceparent } from 'tctx';
import * as tctx from 'tctx';

export type Span = {
	name: string;
	id: Traceparent;
	parent?: Traceparent;
	start: number;
	end: number;
	attributes: Attributes;
};

export type Collector = (spans: ReadonlySet<Span>) => any;

export type Attributes = {
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
		fn: Fn,
		...args: OmitScopeParam<Params>
	): ReturnType<Fn>;

	set_attributes(attributes: Attributes): void;

	end(): void;
}

export interface Tracer extends Scope {
	end(): ReturnType<Collector>;
}

const measure = (cb: () => any, scope: Scope, promises: Promise<any>[]) => {
	const set_error = (error: Error) => {
		scope.set_attributes({
			error,
		});
	};

	try {
		var r = cb(),
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

export const create = (name: string, options: Options): Tracer => {
	const spans: Set<Span> = new Set();
	const promises: Promise<any>[] = [];

	const scope = (name: string, parent?: Traceparent): CallableScope => {
		const me = parent ? parent.child() : tctx.make(true);
		const attributes: Attributes = {};

		const start = Date.now();
		let ended = false;

		const $: Scope = {
			get traceparent() {
				return me;
			},
			fork(name) {
				return scope(name, me);
			},
			measure(name, cb, ...args) {
				const scope = this.fork(name);

				return measure(() => cb(...args, scope), scope, promises);
			},
			set_attributes(attr) {
				Object.assign(attributes, attr);
			},
			end() {
				if (ended) return void 0;

				spans.add({
					id: me,
					parent,
					start,
					end: Date.now(),
					name,
					attributes,
				});

				ended = true;
			},
		};

		return Object.setPrototypeOf((cb: any) => measure(cb, $, promises), $);
	};

	const me = scope(
		name,
		typeof options.traceparent === 'string'
			? tctx.parse(options.traceparent)
			: undefined,
	);
	const meEnd = me.end.bind(me);

	me.end = async () => {
		await Promise.all(promises);
		meEnd();

		return options.collector(spans);
	};

	return me;
};
