import { type Scope } from 'rian';

const set_error = (scope: Scope, error: Error) => {
	scope.set_context({
		error,
	});
};

export const measure = (
	cb: (...args: any[]) => any,
	scope: Scope,
	promises: Promise<any>[],
	...args: any[]
) => {
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
