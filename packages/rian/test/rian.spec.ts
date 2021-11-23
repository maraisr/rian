import { restoreAll, spy } from 'nanospy';
import { test } from 'uvu';
import * as assert from 'uvu/assert';

import * as rian from '../src';

test.after.each(() => {
	restoreAll();
});

test('exports', () => {
	assert.type(rian.create, 'function');
});

test('api', async () => {
	const agent = spy<rian.Collector>();
	const tracer = rian.create('simple', {
		collector: agent,
	});

	const scope = tracer.fork('some-name');

	scope.setAttributes({
		baz: 'qux',
	});

	scope.measure('test', (scope) => {
		scope.setAttributes({
			foo: 'bar',
		});

		return 'test';
	});

	scope.end();

	await tracer.end();

	assert.equal(agent.callCount, 1);
	const items = agent.calls[0][0] as Set<rian.Span>;
	assert.instance(items, Set);
	assert.equal(items.size, 3);
});

test('measure::throw', async () => {
	const tracer = rian.create('simple', {
		collector: spy(),
	});

	assert.throws(() =>
		tracer.measure('test', () => {
			throw new Error('test');
		}),
	);

	// TODO: Replace with assert.rejects
	try {
		const prom = tracer.measure('test', () => Promise.reject('test'));
		assert.instance(prom, Promise);
		await prom;
		assert.unreachable('promise should throw');
	} catch (e) {
		assert.ok('promise throw');
	}

	tracer.end();
});

test.run();
