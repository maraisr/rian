import type { SpanBuilder } from 'rian';

export function measure<Fn extends (span: SpanBuilder) => any>(
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
		// @ts-expect-error TS2454
		if (is_promise !== true) span.end();
	}
}
