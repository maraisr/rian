import { spy, spyOn } from 'nanospy';
import { is_sampled } from 'tctx';
import { suite, test } from 'uvu';
import * as assert from 'uvu/assert';

import * as rian from 'rian';

const noop = () => {};

const returns: rian.Exporter = (traces) => {
	return Array.from(traces.scopeSpans);
};

test('exports', () => {
	assert.type(rian.configure, 'function');
	assert.type(rian.tracer, 'function');
	assert.type(rian.report, 'function');
});

test('api', async () => {
	const tracer = rian.tracer('test');

	const scope = tracer.span('some-name');

	scope.set_attributes({
		baz: 'qux',
	});
	scope.end();

	const exporter = spy(returns);
	const scopedSpans: rian.ScopedSpans[] = await rian.report(exporter);

	assert.equal(exporter.callCount, 1);
	assert.equal(scopedSpans.length, 1);
});

test('context', async () => {
	const tracer = rian.tracer('test');

	const span = tracer.span('context');

	span.set_attributes({
		one: 'one',
	});

	span.set_attributes((ctx) => ({ [ctx.one]: 'two' }));

	span.set_attributes({
		three: 'three',
	});

	span.end();

	const scopedSpans: rian.ScopedSpans[] = await rian.report(returns);
	assert.equal(scopedSpans.length, 1);
	const spans = scopedSpans[0].spans;

	assert.equal(spans.length, 1);
	assert.equal(Array.from(spans)[0].attributes, {
		one: 'two',
		three: 'three',
	});
});

test('has offset start and end times', async () => {
	let called = -1;
	spyOn(Date, 'now', () => ++called);

	const tracer = rian.tracer('test');

	tracer.time('test', () => {
		tracer.time('test', () => {});
	});

	const scopedSpans: rian.ScopedSpans[] = await rian.report(returns);
	assert.equal(scopedSpans.length, 1);
	const spans = scopedSpans[0].spans;

	assert.equal(spans.length, 2);
	const arr = Array.from(spans);

	// 2 spans, 2 calls per span
	assert.equal(arr[0].start, 0);
	assert.equal(arr[0].end, 3);
	assert.equal(arr[1].start, 1);
	assert.equal(arr[1].end, 2);
});

test('promise returns', async () => {
	const tracer = rian.tracer('test');

	const prom = new Promise((resolve) => setTimeout(resolve, 0));

	// Don't await here so we can assert the __add__promise worked
	tracer.time('test', () => prom);

	const scopedSpans: rian.ScopedSpans[] = await rian.report(returns);
	assert.equal(scopedSpans.length, 1);
	const spans = scopedSpans[0].spans;

	assert.equal(spans.length, 1);
});

const measure = suite('measure');

measure('throw context', async () => {
	const tracer = rian.tracer('test');

	assert.throws(() =>
		tracer.time('test', () => {
			throw new Error('test');
		}),
	);

	const exporter = spy<rian.Exporter>(returns);
	const scopedSpans: rian.ScopedSpans[] = await rian.report(exporter);
	assert.equal(scopedSpans.length, 1);

	const spans = scopedSpans[0].spans;
	assert.equal(exporter.callCount, 1);

	assert.equal(spans.length, 1);

	assert.instance(Array.from(spans)[0].attributes.error, Error);
});

const sampled = suite('sampling');

sampled('default :: no parent should be sampled', async () => {
	const tracer = rian.tracer('test');

	tracer.time('test', noop);

	const exporter = spy<rian.Exporter>(returns);
	const scopedSpans: rian.ScopedSpans[] = await rian.report(exporter);
	assert.equal(scopedSpans.length, 1);

	const spans = scopedSpans[0].spans;
	assert.equal(exporter.callCount, 1);

	assert.equal(spans.length, 1);
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
	const scopedSpans: rian.ScopedSpans[] = await rian.report(exporter);
	assert.equal(scopedSpans.length, 1);

	const spans = Array.from(scopedSpans[0].spans);
	assert.equal(exporter.callCount, 1);

	assert.equal(spans.length, 1);
	assert.equal(spans[0].events.length, 2);
	assert.equal(spans[0].events[0].attributes, undefined);
	assert.equal(spans[0].events[1].attributes, { foo: 'bar' });
});

const buffer = suite('buffer');

buffer('flush all', async () => {
	const first = rian.tracer('first');
	first.span('span 1').end();

	{
		const scopedSpans: rian.ScopedSpans[] = await rian.report(returns);

		assert.equal(scopedSpans.length, 1);
		const spans = scopedSpans[0].spans;
		assert.equal(spans.length, 1);
	}

	first.span('span 1.1').end();

	const second = rian.tracer('second');
	second.span('span 2').end();

	{
		const scopedSpans: rian.ScopedSpans[] = await rian.report(returns);

		assert.equal(scopedSpans.length, 2);
		var spans = scopedSpans.flatMap((i) => Array.from(i.spans));
		assert.equal(spans.length, 2);
	}

	assert.equal(spans[0].label, 'span 1.1');
	assert.equal(spans[1].label, 'span 2');
});

test.run();
measure.run();
sampled.run();
events.run();
buffer.run();
