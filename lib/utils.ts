import type { Scope, SpanBuilder } from './mod.ts';

// TODO: write jsdoc
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
// deno-lint-ignore no-explicit-any
export function measure<Fn extends (...args: any[]) => any>(
	span: SpanBuilder,
	fn: Fn,
): ReturnType<Fn> {
	try {
		var r = fn(span),
			is_promise = r instanceof Promise;

		if (is_promise) {
			// @ts-expect-error
			span.__add_promise(
				r
					.catch(
						(e: Error): void =>
							void span.set_context({
								error: e,
							}),
					)
					.finally(() => span.end()),
			);
		}

		return r;
	} catch (e) {
		if (e instanceof Error)
			span.set_context({
				error: e,
			});
		throw e;
	} finally {
		// @ts-expect-error
		if (is_promise !== true) span.end();
	}
}
