/**
 * A tracer is a logical unit in your application. This alleviates the need to pass around a tracer instance.
 *
 * All spans produced by a tracer will all collect into a single span collection that is given to {@link report}.
 *
 * @example
 *
 * ```ts
 * // file: server.ts
 * const trace = tracer('server');
 *
 * // file: orm.ts
 * const trace = tracer('orm');
 *
 * // file: api.ts
 * const trace = tracer('api');
 * ```
 */
export function tracer(name: string, options?: Options): Tracer;
