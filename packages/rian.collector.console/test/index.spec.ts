import { restoreAll, spyOn } from "nanospy";
import type { Span } from "rian";
import { make } from "tctx";
import { test } from "uvu";

import * as lib from "../src/index.js";

test.after.each(() => {
	restoreAll();
});

test("simple", async () => {
	const out = spyOn(console, "log");

	const spans = new Set<Span>();

	const A = make(true);
	spans.add({
		id: A,
		name: 'A',
		parent: null,
		start: 1,
		end: 10,
		context: {}
	});

	const B = A.child();

	spans.add({
		id: B,
		name: 'B',
		parent: A,
		start: 2,
		end: 9,
		context: {}
	});

	const C = B.child();
	const D = B.child();

	spans.add({
		id: C,
		name: 'C',
		parent: B,
		start: 3,
		end: 5,
		context: {}
	});

	spans.add({
		id: D,
		name: 'D',
		parent: B,
		start: 6,
		end: 8,
		context: {}
	});

	lib.collector(spans);
	out.restore();

	//console.log(out);
});

test.run();
