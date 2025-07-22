import type { CallableSpanBuilder, Options, SpanBuilder } from 'rian';
import type { Traceparent } from 'tctx/traceparent';

export { report, configure } from 'rian';

/**
 * Returns the current span in the current execution context.
 *
 * This will throw an error if there is no current span.
 *
 * @example
 *
 * ```ts
 * function doWork() {
 *   const span = currentSpan();
 *   span.set_context({ foo: 'bar' });
 * }
 *
 * span('some-name')(() => {
 *   doWork(); // will guarantee `currentSpan` returns this span
 * });
 * ```
 */
export function currentSpan(): SpanBuilder;

/**
 * Creates a new span for the currently active tracer.
 *
 * @example
 *
 * ```ts
 * tracer('some-name')(() => {
 *    // some deeply nested moments later
 *    const s = span('my-span');
 * });
 * ```
 */
export function span(
	name: string,
	parent_id?: Traceparent | string,
): CallableSpanBuilder;

export type Tracer<T> = (cb: T) => ReturnType<T>;

/**
 * A tracer is a logical unit in your application. This alleviates the need to pass around a tracer instance.
 *
 * All spans produced by a tracer will all collect into a single span collection that is given to {@link report}.
 *
 * @example
 *
 * ```ts
 * const trace = tracer('server');
 *
 * trace(() => {
 *  // application logic
 * });
 * ```
 */
export function tracer<T extends () => any>(
	name: string,
	options?: Options,
): Tracer<T>;
