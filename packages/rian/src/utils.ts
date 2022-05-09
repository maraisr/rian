import type { Scope } from 'rian';
import type { MeasureFn, RealMeasureFnParams } from 'rian/utils';
import { ADD_PROMISE, PROMISES } from 'rian';

export const measureFn = (scope: Scope, fn: any, ...args: any[]) => {
	try {
		var r = fn(...args, scope),
			is_promise = r instanceof Promise;

		if (is_promise && PROMISES.has(scope))
			ADD_PROMISE(
				scope,
				r
					.catch(
						(e: Error): void =>
							void scope.set_context({
								error: e,
							}),
					)
					.finally(() => scope.end()),
			);

		return r;
	} catch (e) {
		if (e instanceof Error)
			scope.set_context({
				error: e,
			});
		throw e;
	} finally {
		// @ts-expect-error TS2454
		if (is_promise !== true) scope.end();
	}
};

export const measure = <Fn extends MeasureFn>(
	scope: Scope,
	name: string,
	fn: Fn,
	...args: RealMeasureFnParams<Parameters<Fn>>
): ReturnType<Fn> => measureFn(scope.fork(name), fn, ...args);

export const wrap = <Fn extends MeasureFn>(
	scope: Scope,
	name: string,
	fn: Fn,
): Fn =>
	function () {
		return measureFn(scope.fork(name), fn, ...arguments);
	} as Fn;
