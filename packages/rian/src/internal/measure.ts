import { type Scope } from 'rian';

export type MeasureFn =
	| ((...args: [...args: any[]]) => any)
	| ((...args: [...args: any[], scope: Scope]) => any);

export type RealMeasureFnParams<T extends unknown[]> = T extends []
	? []
	: T extends [...rest: infer U, scope: Scope]
	? U
	: T;

const set_error = (scope: Scope, error: Error) => {
	scope.set_context({
		error,
	});
};

export const measure = <Fn extends MeasureFn>(
	fn: Fn, // TODO: fn doesnt see scope correctly
	scope: Scope,
	promises: Promise<any>[],
	...args: RealMeasureFnParams<Parameters<Fn>>
): ReturnType<Fn> => {
	try {
		var r = fn(...args, scope),
			is_promise = r instanceof Promise;

		if (is_promise)
			promises.push(
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
