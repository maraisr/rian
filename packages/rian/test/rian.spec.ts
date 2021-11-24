import { restoreAll, spy } from 'nanospy';
import { suite, test } from 'uvu';
import * as assert from 'uvu/assert';

import * as rian from '../src';

test.after.each(() => {
	restoreAll();
});

test('exports', () => {
	assert.type(rian.create, 'function');
});

test('api', async () => {
	const collector = spy<rian.Collector>();
	const tracer = rian.create('simple', {
		collector,
	});

	const scope = tracer.fork('some-name');

	scope.set_attributes({
		baz: 'qux',
	});

	scope.measure('test', (scope) => {
		scope.set_attributes({
			foo: 'bar',
		});

		return 'test';
	});

	scope.end();
	scope.end(); // tests ended

	await tracer.end();

	assert.equal(collector.callCount, 1);
	const items = collector.calls[0][0] as Set<rian.Span>;
	assert.instance(items, Set);
	assert.equal(items.size, 3);
});

test('allow for fn api', async () => {
	const collector = spy<rian.Collector>();

	const tracer = rian.create('simple', {
		collector,
	});

	tracer.measure('test', spy());
	tracer.fork('forked')(spy());

	await tracer.end();

	assert.equal(collector.callCount, 1);
	const items = collector.calls[0][0] as Set<rian.Span>;
	assert.instance(items, Set);
	assert.equal(items.size, 3);
});

test.run();

const measure = suite('measure');

measure('accepts arguments', async () => {
	const tracer = rian.create('simple', {
		collector: spy(),
	});

	const fn = spy<(a: string, b: string) => string>();

	tracer.measure('test', fn, 'arg a', 'arg b');

	await tracer.end();

	assert.equal(fn.callCount, 1);
	const args = fn.calls[0];
	args.pop();
	assert.equal(args, ['arg a', 'arg b']);
});

measure('throw context', async () => {
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

measure.run();
