import type { Scope } from 'rian';

export function measure<Fn extends (scope: Scope) => any>(
	scope: Scope,
	fn: Fn,
): ReturnType<Fn> {
	try {
		var r = fn(scope),
			is_promise = r instanceof Promise;

		if (is_promise) {
			// @ts-expect-error
			scope.__add_promise(
				r
					.catch(
						(e: Error): void =>
							void scope.set_context({
								error: e,
							}),
					)
					.finally(() => scope.end()),
			);
		}

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
}
