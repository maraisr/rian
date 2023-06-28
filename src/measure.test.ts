import { spy } from 'nanospy';
import { suite, test } from 'uvu';
import * as assert from 'uvu/assert';

import * as utils from 'rian/utils';

const mock_scope = () => ({
	span: spy(mock_scope),
	end: spy(),
	set_context: spy(),
	__add_promise: spy(),
});

test('exports', () => {
	assert.type(utils.measure, 'function');
});

test('should retain `this` context', async () => {
	const scope = mock_scope();

	const fn = {
		val: 'foobar',
		run() {
			return this.val;
		},
	};

	const result = utils.measure((scope as any).span('test'), fn.run.bind(fn));
	assert.equal(result, 'foobar');
});

test('should call .end()', async () => {
	const scope = mock_scope();
	// @ts-expect-error
	scope.span = () => scope; // keep the current scope so we can assert it

	assert.equal(
		utils.measure((scope as any).span('test'), () => 'hello'),
		'hello',
	);
	assert.equal(scope.end.callCount, 1);

	assert.equal(
		await utils.measure(
			(scope as any).span('test'),
			() => new Promise((res) => setTimeout(() => res('hello'))),
		),
		'hello',
	);

	assert.equal(scope.__add_promise.callCount, 1);
	await scope.__add_promise.calls[0];
	assert.equal(scope.end.callCount, 2);
});

const returns = suite('returns');

returns('sync', () => {
	const scope = mock_scope();

	assert.equal(
		utils.measure((scope as any).span('test'), () => 'test'),
		'test',
	);
	assert.equal(
		utils.measure((scope as any).span('test'), () => 1),
		1,
	);
	assert.equal(
		utils.measure((scope as any).span('test'), () => false),
		false,
	);
	assert.instance(
		utils.measure((scope as any).span('test'), () => new Error('test')),
		Error,
		'error want thrown, so should just return',
	);
});

returns('async', async () => {
	const scope = mock_scope();

	assert.instance(
		utils.measure((scope as any).span('test'), async () => {}),
		Promise,
	);

	assert.not.equal(
		utils.measure((scope as any).span('test'), async () => 'test'),
		'test',
	);
	assert.equal(
		await utils.measure((scope as any).span('test'), async () => 'test'),
		'test',
	);
	assert.equal(
		await utils.measure((scope as any).span('test'), async () => 1),
		1,
	);
	assert.equal(
		await utils.measure((scope as any).span('test'), async () => false),
		false,
	);
	assert.instance(
		await utils.measure(
			(scope as any).span('test'),
			async () => new Error('test'),
		),
		Error,
		'error want thrown, so should just return',
	);
});

const errors = suite('errors');

errors('sync', () => {
	const scope = mock_scope();

	assert.throws(() => {
		utils.measure((scope as any).span('test'), () => {
			throw new Error('test');
		});
	});
});

errors('async', async () => {
	const scope = mock_scope();

	try {
		await utils.measure((scope as any).span('test'), async () => {
			return new Promise((_resolve, rejects) => {
				rejects('test');
			});
		});
		assert.unreachable();
	} catch (e) {
		assert.type(e, 'string');
	}

	try {
		await utils.measure((scope as any).span('test'), async () => {
			throw new Error('test');
		});
		assert.unreachable();
	} catch (e) {
		assert.instance(e, Error);
	}
});

test.run();
returns.run();
errors.run();
