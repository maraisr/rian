import { restoreAll, spy, spyOn } from 'nanospy';
import { is_sampled, make } from 'tctx';
import { suite, test } from 'uvu';
import * as assert from 'uvu/assert';

import * as rian from 'rian';
import * as utils from 'rian/utils';

import type { Exporter, Span } from 'rian';

const noop = () => {};

test.after.each(() => {
	restoreAll();
});

test('exports', () => {
	assert.type(rian.create, 'function');
});

test('api', async () => {
	const exporter = spy<Exporter>();
	const tracer = rian.create('test', {
		exporter,
	});

	const scope = tracer.fork('some-name');

	scope.set_context({
		baz: 'qux',
	});

	scope((span) => {
		span.set_context({
			foo: 'bar',
		});

		return 'test';
	});

	await tracer.end();

	assert.equal(exporter.callCount, 1);
	const items = exporter.calls[0][0] as Set<Span>;
	assert.instance(items, Set);
	assert.equal(items.size, 2);
});

test('context', async () => {
	const exporter = spy<Exporter>();
	const tracer = rian.create('test', {
		exporter,
	});

	const span = tracer.fork('context');

	span.set_context({
		one: 'one',
	});

	span.set_context((ctx) => ({ [ctx.one]: 'two' }));

	span.set_context({
		three: 'three',
	});

	span.end();

	await tracer.end();

	const items = exporter.calls[0][0] as Set<Span>;
	assert.instance(items, Set);
	assert.equal(items.size, 2);
	assert.equal(Array.from(items)[1].context, {
		one: 'two',
		three: 'three',
	});
});

test('has offset start and end times', async () => {
	let called = -1;
	spyOn(Date, 'now', () => ++called);

	let spans: ReadonlySet<Span>;
	const tracer = rian.create('test', {
		exporter: (x) => (spans = x),
		clock: { now: () => Date.now() + 5 },
	});

	tracer.fork('test')(spy());

	await tracer.end();

	// @ts-expect-error TS2454
	assert.equal(spans.size, 2);
	// @ts-expect-error TS2454
	const arr = Array.from(spans);

	// 2 spans, 2 calls per span
	assert.equal(arr[0].start, 5);
	assert.equal(arr[0].end, 8);
	assert.equal(arr[1].start, 6);
	assert.equal(arr[1].end, 7);
});

test('promise returns', async () => {
	let spans: ReadonlySet<Span>;
	const tracer = rian.create('test', {
		exporter: (x) => (spans = x),
	});

	const prom = new Promise((resolve) => setTimeout(resolve, 0));

	// Don't await here so we can assert the __add__promise worked
	tracer.fork('test')(() => prom);

	await tracer.end();

	assert.equal(spans!.size, 2);
});

test.run();

const fn = suite('fn mode');

fn('api', async () => {
	const exporter = spy<Exporter>();

	const tracer = rian.create('test', {
		exporter,
	});

	tracer.fork('forked')(spy());

	await tracer.end();

	assert.equal(exporter.callCount, 1);
	const items = exporter.calls[0][0] as Set<Span>;
	assert.instance(items, Set);
	assert.equal(items.size, 2);
});

fn.run();

const measure = suite('measure');

measure('throw context', async () => {
	const exporter = spy<Exporter>();

	const tracer = rian.create('test', {
		exporter,
	});

	assert.throws(() =>
		utils.measure(tracer, 'test', () => {
			throw new Error('test');
		}),
	);

	await tracer.end();

	assert.equal(exporter.callCount, 1);
	const items = exporter.calls[0][0] as Set<Span>;
	assert.instance(items, Set);
	assert.equal(items.size, 2);

	assert.instance(Array.from(items)[1].context.error, Error);
});

const sampled = suite('sampling');

sampled('default :: no parent should be sampled', async () => {
	const exporter = spy<Exporter>();
	const tracer = rian.create('test', {
		exporter,
	});

	tracer.fork('test')(noop);

	await tracer.end();

	assert.equal(exporter.callCount, 1);

	const spans: Set<Span> = exporter.calls[0][0];
	assert.equal(spans.size, 2);
	assert.ok(
		Array.from(spans).every((i) => is_sampled(i.id)),
		'every id should be sampled',
	);
});

// TODO: We don't add spans when we shouldn't sample, so there is no span to test against
sampled.skip('default :: should obey parent', async () => {
	const exporter = spy<Exporter>();
	const tracer = rian.create('test', {
		exporter,
		traceparent: String(make(false)),
	});

	tracer.fork('test')(noop);

	await tracer.end();

	assert.equal(exporter.callCount, 1);

	const spans: Set<Span> = exporter.calls[0][0];
	assert.equal(spans.size, 2);
	assert.not.ok(
		Array.from(spans).every((i) => is_sampled(i.id)),
		'every id should not be sampled',
	);
});

sampled.run();

const events = suite('events');

events('api', async () => {
	const exporter = spy<Exporter>();
	const tracer = rian.create('test', {
		exporter,
	});

	tracer.add_event('work');
	tracer.add_event('work', {
		foo: 'bar',
	});

	await tracer.end();

	assert.equal(exporter.callCount, 1);

	const spans: Array<Span> = Array.from(exporter.calls[0][0]);
	assert.equal(spans.length, 1);
	assert.equal(spans[0].events.length, 2);
	assert.equal(spans[0].events[0].attributes, {});
	assert.equal(spans[0].events[1].attributes, { foo: 'bar' });
});

events.run();
