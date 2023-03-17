import { spy, spyOn } from 'nanospy';
import { is_sampled } from 'tctx';
import { suite, test } from 'uvu';
import * as assert from 'uvu/assert';

import * as rian from 'rian';
import * as utils from 'rian/utils';

const noop = () => {};

const returns: rian.Exporter = (resources) => {
	return [...resources];
};

test('exports', () => {
	assert.type(rian.tracer, 'function');
	assert.type(rian.report, 'function');
});

test('api', async () => {
	const tracer = rian.tracer('test');

	const scope = tracer.span('some-name');

	scope.set_context({
		baz: 'qux',
	});

	scope((span) => {
		span.set_context({
			foo: 'bar',
		});

		return 'test';
	});

	const exporter = spy(returns);
	const resources: rian.Resource[] = await rian.report(exporter);

	assert.equal(exporter.callCount, 1);
	assert.equal(resources.length, 1);
});

test('context', async () => {
	const tracer = rian.tracer('test');

	const span = tracer.span('context');

	span.set_context({
		one: 'one',
	});

	span.set_context((ctx) => ({ [ctx.one]: 'two' }));

	span.set_context({
		three: 'three',
	});

	span.end();

	const resources: rian.Resource[] = await rian.report(returns);
	assert.equal(resources.length, 1);
	const spans = resources[0].spans;

	assert.instance(spans, Set);
	assert.equal(spans.size, 1);
	assert.equal(Array.from(spans)[0].context, {
		one: 'two',
		three: 'three',
	});
});

test('has offset start and end times', async () => {
	let called = -1;
	spyOn(Date, 'now', () => ++called);

	const tracer = rian.tracer('test', {
		clock: { now: () => Date.now() + 5 },
	});

	tracer.span('test')(() => {
		tracer.span('test')(() => {});
	});

	const resources: rian.Resource[] = await rian.report(returns);
	assert.equal(resources.length, 1);
	const spans = resources[0].spans;

	assert.equal(spans.size, 2);
	const arr = Array.from(spans);

	// 2 spans, 2 calls per span
	assert.equal(arr[0].start, 5);
	assert.equal(arr[0].end, 8);
	assert.equal(arr[1].start, 6);
	assert.equal(arr[1].end, 7);
});

test('promise returns', async () => {
	const tracer = rian.tracer('test');

	const prom = new Promise((resolve) => setTimeout(resolve, 0));

	// Don't await here so we can assert the __add__promise worked
	tracer.span('test')(() => prom);

	const resources: rian.Resource[] = await rian.report(returns);
	assert.equal(resources.length, 1);
	const spans = resources[0].spans;

	assert.equal(spans.size, 1);
});

const fn = suite('fn mode');

fn('api', async () => {
	const tracer = rian.tracer('test');

	tracer.span('forked')(spy());

	const exporter = spy<rian.Exporter>(returns);
	const resources: rian.Resource[] = await rian.report(exporter);
	assert.equal(resources.length, 1);

	const spans = resources[0].spans;
	assert.equal(exporter.callCount, 1);

	assert.instance(spans, Set);
	assert.equal(spans.size, 1);
});

const measure = suite('measure');

measure('throw context', async () => {
	const tracer = rian.tracer('test');

	assert.throws(() =>
		utils.measure(tracer.span('test'), () => {
			throw new Error('test');
		}),
	);

	const exporter = spy<rian.Exporter>(returns);
	const resources: rian.Resource[] = await rian.report(exporter);
	assert.equal(resources.length, 1);

	const spans = resources[0].spans;
	assert.equal(exporter.callCount, 1);

	assert.instance(spans, Set);
	assert.equal(spans.size, 1);

	assert.instance(Array.from(spans)[0].context.error, Error);
});

const sampled = suite('sampling');

sampled('default :: no parent should be sampled', async () => {
	const tracer = rian.tracer('test');

	tracer.span('test')(noop);

	const exporter = spy<rian.Exporter>(returns);
	const resources: rian.Resource[] = await rian.report(exporter);
	assert.equal(resources.length, 1);

	const spans = resources[0].spans;
	assert.equal(exporter.callCount, 1);

	assert.equal(spans.size, 1);
	assert.ok(
		Array.from(spans).every((i) => is_sampled(i.id)),
		'every id should be sampled',
	);
});

const events = suite('events');

events('api', async () => {
	const tracer = rian.tracer('test');

	const span = tracer.span('work');

	span.add_event('work');
	span.add_event('work', {
		foo: 'bar',
	});

	span.end();

	const exporter = spy<rian.Exporter>(returns);
	const resources: rian.Resource[] = await rian.report(exporter);
	assert.equal(resources.length, 1);

	const spans = Array.from(resources[0].spans);
	assert.equal(exporter.callCount, 1);

	assert.equal(spans.length, 1);
	assert.equal(spans[0].events.length, 2);
	assert.equal(spans[0].events[0].attributes, {});
	assert.equal(spans[0].events[1].attributes, { foo: 'bar' });
});

const buffer = suite('buffer');

buffer('flush all', async () => {
	const first = rian.tracer('first');
	first.span('span 1').end();

	{
		const resources: rian.Resource[] = await rian.report(returns);

		assert.equal(resources.length, 1);
		const spans = resources[0].spans;
		assert.equal(spans.size, 1);
	}

	first.span('span 1.1').end();

	const second = rian.tracer('second');
	second.span('span 2').end();

	{
		const resources: rian.Resource[] = await rian.report(returns);

		assert.equal(resources.length, 2);
		var spans = resources.flatMap((i) => Array.from(i.spans));
		assert.equal(spans.length, 2);
	}

	assert.equal(spans[0].name, 'span 1.1');
	assert.equal(spans[1].name, 'span 2');
});

test.run();
fn.run();
measure.run();
sampled.run();
events.run();
buffer.run();
