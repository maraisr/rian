// @ts-check

import { spy } from 'nanospy';
import { test, suite } from 'uvu';
import * as assert from 'uvu/assert';

import { measure } from '../src/internal/measure';

const mock_scope = () => ({
	end: spy(),
	set_context: spy(),
});

test('exports', () => {
	assert.type(measure, 'function');
});

test('api', () => {
	const scope = mock_scope();
	measure(() => {}, scope as any, []);

	assert.equal(scope.set_context.callCount, 0);

	assert.throws(() => {
		measure(
			() => {
				throw new Error('test');
			},
			scope as any,
			[],
		);
	});

	assert.equal(scope.set_context.callCount, 1);
	assert.instance(scope.set_context.calls[0][0].error, Error);
});

test('args', () => {
	const scope = mock_scope();

	const sum_base = (a: number, b: number) => a + b;

	measure(sum_base, scope as any, [], 1, 2);

	// @ts-expect-error
	measure(sum_base, scope as any, [], 'test'); // tests typescript

	const sum = spy(sum_base);
	const r = measure(sum, scope as any, [], 1, 2);

	assert.equal(r, 3);
	assert.equal(sum.callCount, 1);
	assert.equal(sum.calls[0][0], 1);
	assert.equal(sum.calls[0][1], 2);
});

test.run();

const returns = suite('returns');

returns('sync', () => {
	const scope = mock_scope();

	assert.equal(
		measure(() => 'test', scope as any, []),
		'test',
	);
	assert.equal(
		measure(() => 1, scope as any, []),
		1,
	);
	assert.equal(
		measure(() => false, scope as any, []),
		false,
	);
	assert.instance(
		measure(() => new Error('test'), scope as any, []),
		Error,
		'error wasnt thrown, so should just return',
	);
});

returns('async', async () => {
	const scope = mock_scope();

	assert.instance(
		measure(async () => {}, scope as any, []),
		Promise,
	);

	assert.not.equal(
		measure(async () => 'test', scope as any, []),
		'test',
	);
	assert.equal(await measure(async () => 'test', scope as any, []), 'test');
	assert.equal(await measure(async () => 1, scope as any, []), 1);
	assert.equal(await measure(async () => false, scope as any, []), false);
	assert.instance(
		await measure(async () => new Error('test'), scope as any, []),
		Error,
		'error wasnt thrown, so should just return',
	);
});

returns.run();

const errors = suite('errors');

errors('sync', () => {
	const scope = mock_scope();

	assert.throws(() => {
		measure(
			() => {
				throw new Error('test');
			},
			scope as any,
			[],
		);
	});
});

errors('async', async () => {
	const scope = mock_scope();

	try {
		await measure(
			async () => {
				return new Promise((_resolve, rejects) => {
					rejects('test');
				});
			},
			scope as any,
			[],
		);
		assert.unreachable();
	} catch (e) {
		assert.type(e, 'string');
	}

	try {
		await measure(
			async () => {
				throw new Error('test');
			},
			scope as any,
			[],
		);
		assert.unreachable();
	} catch (e) {
		assert.instance(e, Error);
	}
});

errors.run();
