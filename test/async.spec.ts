import { AsyncLocalStorage } from 'node:async_hooks';

import { suite, test } from 'uvu';
import * as assert from 'uvu/assert';

import { make } from 'tctx';

import type { Exporter } from 'rian';
import * as rian from 'rian/async';

const scope_spans = (scopes: Parameters<Exporter>[0]) => {
	return Array.from(scopes.scopeSpans).flatMap((scope) => scope.spans);
};

test('api', () => {
	assert.type(rian.currentSpan, 'function');
	assert.type(rian.report, 'function');
	assert.type(rian.tracer, 'function');
	assert.type(rian.span, 'function');
	assert.type(rian.configure, 'function');
});

test('works', async () => {
	const value = await rian.tracer('tracer')(() => {
		const scope = rian.span('span 1');

		scope.set_context({
			baz: 'qux',
		});

		return scope(() => {
			const span = rian.currentSpan();

			span.set_context({
				foo: 'bar',
			});

			rian.span('span 2')(() => {});

			return 'test';
		});
	});

	assert.is(value, 'test');

	const spans = await rian.report(scope_spans);

	assert.is(spans.length, 2);
	assert.is(spans[0].name, 'span 1');
	assert.is(spans[1].name, 'span 2');
});

test('can mix with third-party async_hooks', async () => {
	const store = new AsyncLocalStorage();

	const value = await rian.tracer('tracer')(() => {
		return rian.span('span 1')(() => {
			return store.run('frank', () => {
				const span = rian.currentSpan();

				span.set_context({
					foo: 'bar',
				});

				return rian.span('read')(() => store.getStore());
			});
		});
	});

	assert.is(value, 'frank');

	const spans = await rian.report(scope_spans);

	assert.is(spans.length, 2);
	assert.is(spans[0].name, 'span 1');
	assert.is(spans[1].name, 'read');

	assert.is(spans[0].context.foo, 'bar');
});

const tracer = suite('tracer');

tracer('api', () => {
	assert.type(rian.tracer('test'), 'function');
});

tracer('can create spans', async () => {
	rian.tracer('test')(() => {
		rian.span('some-name')(() => {});
		rian.span('some-other-name').end();
	});

	const spans = await rian.report(scope_spans);
	assert.is(spans.length, 2);
});

tracer('can recieve a root_id', async () => {
	const id = make();
	const one = rian.tracer('one');
	const two = rian.tracer('two');

	one(() => {
		rian.span('child 1')(() => {});

		two(() => {
			rian.span(
				'child 2',
				id,
			)(() => {
				one(() => {
					rian.span('child 3')(() => {});
				});
			});
		});
	});

	const spans = await rian.report(scope_spans);
	assert.is(spans.length, 3);
	assert.is(spans[0].name, 'child 1');
	assert.is(spans[1].name, 'child 3');
	assert.is(spans[2].name, 'child 2');

	assert.is(spans[0].parent, undefined);
	assert.is(String(spans[2].parent), String(id), 'was given id, use it');
	assert.is(spans[1].parent, spans[2].id);
});

tracer('can nest spans', async () => {
	rian.tracer('test')(() => {
		rian.span('parent')(() => {
			rian.span('child')(() => {});
		});
	});

	const spans = await rian.report(scope_spans);
	assert.is(spans.length, 2);
	assert.is(spans[0].name, 'parent');
	assert.is(spans[1].name, 'child');

	assert.is(spans[0].parent, undefined);
	assert.is(spans[1].parent, spans[0].id);
});

tracer('correctly parents tracers', async () => {
	const one = rian.tracer('one');
	const two = rian.tracer('two');

	one(() => {
		rian.span('child 1')(() => {
			two(() => {
				rian.span('child 2')(() => {});
			});
		});

		rian.span('child 3')(() => {});
	});

	const scopes = await rian.report((scopes) => scopes);
	const scoped_spans = Array.from(scopes.scopeSpans);
	const spans = scoped_spans.flatMap((scope) => scope.spans);

	assert.is(spans.length, 3);
	assert.is(spans[0].name, 'child 1');
	assert.is(spans[1].name, 'child 3');
	assert.is(spans[2].name, 'child 2');

	assert.is(scoped_spans.length, 2);
	assert.is(scoped_spans[0].scope.name, 'one');
	assert.is(scoped_spans[0].spans.length, 2);
	assert.is(scoped_spans[1].scope.name, 'two');
	assert.is(scoped_spans[1].spans.length, 1);

	assert.is(spans[0].parent, undefined);
	assert.is(spans[2].parent, spans[0].id, 'should pierce tracers');
	assert.is(spans[1].parent, undefined);
});

tracer('can be called again', async () => {
	const one = rian.tracer('one');
	const two = rian.tracer('two');

	one(() => {
		rian.span('child 1')(() => {
			two(() => {
				one(() => {
					rian.span('child 2')(() => {});
				});
			});
		});

		two(() => {
			rian.span('child 3')(() => {});
		});
	});

	const spans = await rian.report(scope_spans);
	assert.is(spans.length, 3);
	assert.is(spans[0].name, 'child 1');
	assert.is(spans[1].name, 'child 2');
	assert.is(spans[2].name, 'child 3');

	assert.is(spans[0].parent, undefined);
	assert.is(spans[1].parent, spans[0].id, 'should pierce tracers');
	assert.is(spans[2].parent, undefined);
});

tracer('collects spans between reports', async () => {
	const one = rian.tracer('one');
	one(() => {
		rian.span('span 1').end();
	});

	{
		const spans = await rian.report(scope_spans);
		assert.is(spans.length, 1);
		assert.is(spans[0].name, 'span 1');
	}

	one(() => {
		rian.span('span 2').end();
	});

	{
		const spans = await rian.report(scope_spans);
		assert.is(spans.length, 1);
		assert.is(spans[0].name, 'span 2');
	}
});

tracer('.span should nest', async () => {
	rian.tracer('test')(() => {
		rian.span('parent1')((s) => {
			s.span('child1').end();
		});
		const s = rian.span('parent2');
		s.span('child2').end();
		s.end();
	});

	const spans = await rian.report(scope_spans);
	assert.is(spans.length, 4);
	assert.is(spans[0].name, 'parent1');
	assert.is(spans[1].name, 'child1');
	assert.is(spans[2].name, 'parent2');
	assert.is(spans[3].name, 'child2');

	assert.is(spans[0].parent, undefined);
	assert.is(spans[1].parent, spans[0].id);
	assert.is(spans[2].parent, undefined);
	assert.is(spans[3].parent, spans[2].id);
});

test.run();
tracer.run();
