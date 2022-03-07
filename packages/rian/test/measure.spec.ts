import { spy } from 'nanospy';
import { suite, test } from 'uvu';
import * as assert from 'uvu/assert';

import { measure } from '../src/utils.js';

const mock_scope = () => ({
	end: spy(),
	set_context: spy(),
});

test('exports', () => {
	assert.type(measure, 'function');
});

test('api', () => {
	const scope = mock_scope();
	measure(scope as any, () => {});

	assert.equal(scope.set_context.callCount, 0);

	assert.throws(() => {
		measure(scope as any, () => {
			throw new Error('test');
		});
	});

	assert.equal(scope.set_context.callCount, 1);
	assert.instance(scope.set_context.calls[0][0].error, Error);
});

test('args', () => {
	const scope = mock_scope();

	const sum_base = (a: number, b: number) => a + b;

	measure(scope as any, sum_base, 1, 2);

	// @ts-expect-error
	measure(scope as any, sum_base, 'test'); // tests typescript

	const sum = spy(sum_base);
	const r = measure(scope as any, sum, 1, 2);

	assert.equal(r, 3);
	assert.equal(sum.callCount, 1);
	assert.equal(sum.calls[0][0], 1);
	assert.equal(sum.calls[0][1], 2);
});

test('should retain `this` context', async () => {
	const scope = mock_scope();

	const fn = {
		val: 'foobar',
		run() {
			return this.val;
		},
	};

	const result = measure(scope as any, fn.run.bind(fn));
	assert.equal(result, 'foobar');
});

test.run();

const returns = suite('returns');

returns('sync', () => {
	const scope = mock_scope();

	assert.equal(
		measure(scope as any, () => 'test'),
		'test',
	);
	assert.equal(
		measure(scope as any, () => 1),
		1,
	);
	assert.equal(
		measure(scope as any, () => false),
		false,
	);
	assert.instance(
		measure(scope as any, () => new Error('test')),
		Error,
		'error want thrown, so should just return',
	);
});

returns('async', async () => {
	const scope = mock_scope();

	assert.instance(
		measure(scope as any, async () => {}),
		Promise,
	);

	assert.not.equal(
		measure(scope as any, async () => 'test'),
		'test',
	);
	assert.equal(await measure(scope as any, async () => 'test'), 'test');
	assert.equal(await measure(scope as any, async () => 1), 1);
	assert.equal(await measure(scope as any, async () => false), false);
	assert.instance(
		await measure(scope as any, async () => new Error('test')),
		Error,
		'error want thrown, so should just return',
	);
});

returns.run();

const errors = suite('errors');

errors('sync', () => {
	const scope = mock_scope();

	assert.throws(() => {
		measure(scope as any, () => {
			throw new Error('test');
		});
	});
});

errors('async', async () => {
	const scope = mock_scope();

	try {
		await measure(scope as any, async () => {
			return new Promise((_resolve, rejects) => {
				rejects('test');
			});
		});
		assert.unreachable();
	} catch (e) {
		assert.type(e, 'string');
	}

	try {
		await measure(scope as any, async () => {
			throw new Error('test');
		});
		assert.unreachable();
	} catch (e) {
		assert.instance(e, Error);
	}
});

errors.run();
