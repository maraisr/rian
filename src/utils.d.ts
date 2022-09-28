import type { Scope } from 'rian';

export type MeasureFn =
	| ((...args: [...args: any[]]) => any)
	| ((...args: [...args: any[], scope: Scope]) => any);

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
export const measure: <Fn extends MeasureFn>(
	scope: Scope,
	name: string,
	fn: Fn, // TODO: fn doesnt see scope correctly
	...args: RealMeasureFnParams<Parameters<Fn>>
) => ReturnType<Fn>;

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
export const wrap: <Fn extends MeasureFn>(
	scope: Scope,
	name: string,
	fn: Fn, // TODO: fn doesnt see scope correctly
) => Fn;

// ==> internals

/** @internal */
export type RealMeasureFnParams<T extends unknown[]> = T extends []
	? []
	: T extends [...rest: infer U, scope: Scope]
	? U
	: T;

/** @internal */
export const measureFn: (scope: Scope, fn: any, ...args: any[]) => any;
