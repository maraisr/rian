import type { Scope } from 'rian';

/**
 * With a passed function, `measure` will run the function and once finishes, will end the span.
 *
 * The measure method will return whatever the function is, so if it's a promise, it returns a
 * promise and so on. Any error is caught and re thrown, and automatically tracked in the
 * context under the `error` property.
 *
 * All promises are tracked, and awaited on a `report`.
 *
 * This is a utility method, but is functionally equivalent to `scope.span('name')(fn)`.
 *
 * @example
 *
 * ```text
 * const data = await measure(scope, get_data);
 * // or with arguments:
 * const data = await measure(scope, () => get_data('foo', 'bar'));
 * ```
 */
export function measure<Fn extends (scope: Scope) => any>(
	scope: Scope,
	fn: Fn,
): ReturnType<Fn>;
