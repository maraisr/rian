declare const RIAN_VERSION: string;

declare module 'node:async_hooks' {
	export class AsyncLocalStorage<T> {
		public run<R>(
			store: T,
			fn: (...args: any[]) => R,
			...args: Parameters<typeof fn>
		): R;
		public getStore(): T;
	}
}
