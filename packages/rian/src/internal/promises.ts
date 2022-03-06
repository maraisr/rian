import type { Scope } from 'rian';

export const promises = new WeakMap<Scope, Promise<any>[]>();

export const add = (scope: Scope, promise: Promise<any>) => {
	if (promises.has(scope)) promises.get(scope).push(promise);
	else promises.set(scope, [promise]);
};
