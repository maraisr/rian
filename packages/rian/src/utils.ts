import { type Scope } from 'rian';
import { add, promises } from './internal/promises';

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
 * const data = await measure(scope, get_data, 'user_id_123');
 *        ^                           ^        ^
 *        |                           |        |
 *        |                           |        the first argument to get_data
 *        |                           function to be called
 *        return value from get_data
 * ```
 */
export const measure = <Fn extends MeasureFn>(
	scope: Scope,
	fn: Fn, // TODO: fn doesnt see scope correctly
	...args: RealMeasureFnParams<Parameters<Fn>>
): ReturnType<Fn> => {
	try {
		var r = fn(...args, scope),
			is_promise = r instanceof Promise;

		if (is_promise && promises.has(scope))
			add(
				scope,
				r
					.catch((e: Error): void => void set_error(scope, e))
					.finally(() => scope.end()),
			);

		return r;
	} catch (e) {
		set_error(scope, e);
		throw e;
	} finally {
		if (is_promise !== true) scope.end();
	}
};
