import { type Scope } from 'rian';

const set_error = (scope: Scope, error: Error) => {
	scope.set_context({
		error,
	});
};

export const measure = <
	Fn extends (...args: any[]) => any,
	Params extends Parameters<Fn>,
>(
	cb: Fn,
	scope: Scope,
	promises: Promise<any>[],
	...args: Params
): ReturnType<Fn> => {
	try {
		var r = cb(...args, scope),
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
