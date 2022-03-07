import { type Scope } from 'rian';
import { ADD_PROMISE, PROMISES } from 'rian';

export type MeasureFn =
	| ((...args: [...args: any[]]) => any)
	| ((...args: [...args: any[], scope: Scope]) => any);

type RealMeasureFnParams<T extends unknown[]> = T extends []
	? []
	: T extends [...rest: infer U, scope: Scope]
	? U
	: T;

const set_error = (scope: Scope, error: Error) => {
	scope.set_context({
		error,
	});
};

/**
 * @internal
 */
export const measureFn = (scope: Scope, fn: any, ...args: any[]) => {
	try {
		var r = fn(...args, scope),
			is_promise = r instanceof Promise;

		if (is_promise && PROMISES.has(scope))
			ADD_PROMISE(
				scope,
				r
					.catch((e: Error): void => void set_error(scope, e))
					.finally(() => scope.end()),
			);

		return r;
	} catch (e) {
		if (e instanceof Error) set_error(scope, e);
		throw e;
	} finally {
		// @ts-expect-error TS2454
		if (is_promise !== true) scope.end();
	}
};

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
 * const data = await measure(scope, 'name', get_data, 'user_id_123');
 *        ^                    ^      ^       ^          ^
 *        |                    |      |       |          |
 *        |                    |      |       |          the first argument to get_data
 *        |                    |      |       function to be called
 *        |                    |      the name of the sub scope
 *        |                    |
 *        |                    the parent scope
 *         return value from get_data
 * ```
 */
export const measure = <Fn extends MeasureFn>(
	scope: Scope,
	name: string,
	fn: Fn, // TODO: fn doesnt see scope correctly
	...args: RealMeasureFnParams<Parameters<Fn>>
): ReturnType<Fn> => measureFn(scope.fork(name), fn, ...args);

/**
 * Wraps any function with a measured scoped function. Useful for when defer function execution
 * till a later time.
 *
 * @example
 *
 * ```js
 * const wrapped = wrap(scope, "run something", my_function);
 *
 * // ... lots of things, where the access to `scope` is lost.
 *
 * wrapped();
 * ```
 */
export const wrap = <Fn extends MeasureFn>(
	scope: Scope,
	name: string,
	fn: Fn, // TODO: fn doesnt see scope correctly
): Fn =>
	function () {
		return measureFn(scope.fork(name), fn, ...arguments);
	} as Fn;
