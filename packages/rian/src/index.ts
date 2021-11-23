import type { Traceparent } from './traceparent';
import { make, parse } from './traceparent';

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
	error?: Error;
} & {
	[property: string]: string | number | boolean | undefined;
};

export type Options = {
	collector: Collector;
	traceparent?: Traceparent;
};

type OmitScopeParam<T extends unknown[]> = T extends []
	? []
	: T extends [infer H, ...infer R]
	? H extends Scope
		? OmitScopeParam<R>
		: [H, ...OmitScopeParam<R>]
	: T;

export interface Scope {
	traceparent: Traceparent;

	fork(name: string, traceparent?: Traceparent): Scope;

	measure<Fn extends (...args: any[]) => any, Params extends Parameters<Fn>>(
		name: string,
		fn: Fn,
		...args: OmitScopeParam<Params>
	): ReturnType<Fn>;

	setAttributes(tags: Attributes): void;

	end(): void;
}

type ScopeParent = Scope;

export const create = (name: string, options: Options): ScopeParent => {
	const spans: Set<Span> = new Set();
	const promises = [];

	const scope = (name: string, parent?: Traceparent): Scope => {
		const me = parent ? parent.child() : make();
		const attributes: Attributes = {};

		const start = performance.now();
		let ended = false;

		return {
			get traceparent() {
				return me;
			},
			fork(name) {
				return scope(name, me);
			},
			measure(name, cb, ...args) {
				const scope = this.fork(name);

				const set_error = (error: Error) => {
					scope.setAttributes({
						error,
					});
				};

				try {
					const r = cb(...args, scope);

					if (r instanceof Promise)
						promises.push(
							r.catch(set_error).finally(() => scope.end()),
						);

					return r;
				} catch (e) {
					set_error(e);
					throw e;
				} finally {
					scope.end();
				}
			},
			setAttributes(attr) {
				Object.assign(attributes, attr);
			},
			end() {
				if (ended) return void 0;

				spans.add({
					id: me,
					parent,
					start,
					end: performance.now(),
					name,
					attributes,
				});

				ended = true;
			},
		};
	};

	const me = scope(
		name,
		typeof options.traceparent === 'string'
			? parse(options.traceparent)
			: options.traceparent,
	);
	const meEnd = me.end;

	me.end = async () => {
		await Promise.all(promises);
		meEnd();

		return options.collector(spans);
	};

	return me;
};
