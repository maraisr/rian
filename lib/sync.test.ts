import { assert, assertEquals, assertInstanceOf, assertMatch, assertNotEquals } from '@std/assert';
import {spy, assertSpyCallArg} from '@std/testing/mock';

import type { ScopedSpans, Trace } from './mod.ts';
import {report} from './mod.ts'
import * as rian from './sync.ts';

Deno.test('api', async () => {
	const tracer = rian.tracer('test');

	const span = tracer.span('some-name');

	span.set_context({
		baz: 'qux',
	});

	span((s) => {
		s.set_context({
			foo: 'bar',
		});

		return 'test';
	});

	const exporter = spy<any, [trace: Trace]>();
	await report(exporter);

    console.log(exporter.calls[0])
});