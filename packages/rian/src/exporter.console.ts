// @ts-nocheck

import type * as rian from "rian";

// Find the parent _or_ the first span
const find_root = (spans: ReadonlySet<rian.Span>) => {
	let parent: rian.Span;
	for (let span of spans) {
		if (!parent) parent = span; // the first loop will get the first node
		if (!span.parent) {
			parent = span;
			break;
		}
	}

	return parent;
};

const topology_sort = ()

export const exporter: rian.Exporter = (spans, context) => {
	const root = find_root(spans);
	const loop_spans = Array.from(spans);

	const lines = recurse(root, loop_spans);
};
