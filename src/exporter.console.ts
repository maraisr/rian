///<reference types="node" />

import type * as rian from 'rian';

export function exporter(trace: rian.Trace) {
	let max_cols = process.stdout.columns || 80;

	for (let scope of trace.scopeSpans) {
		let spans = Array.from(scope.spans);

		const [max_time, min_time] = spans.reduce(
			(col, span) => {
				col[0] = Math.max(col[0], span.end || span.start);
				col[1] = Math.min(col[1], span.start);
				return col;
			},
			[Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER] as [
				max_time: number,
				min_time: number,
			],
		);

		let dur = max_time - min_time;

		let max_time_length = String(dur).length;
		let max_time_col = max_time_length + 7; // [..ms.]
		let max_trace_col = Math.ceil((2 / 3) * (max_cols - max_time_col)) - 2; // . .
		let max_name_col = max_cols - max_time_col - max_trace_col;

		let out = '';

		for (let span of spans) {
			let time = 0;
			let end = span.end ?? false;
			if (end !== false) time = end - span.start;

			let start = Math.ceil(
				((span.start - min_time) / (max_time - min_time)) *
					max_trace_col,
			);
			end = end
				? Math.ceil(
						((span.end! - min_time) / (max_time - min_time)) *
							max_trace_col,
				  )
				: start;

			if (end - start < 1) continue;

			// time
			out += '[ ';
			out += String(time).padStart(max_time_length, ' ');
			out += ' ms';
			out += ' ]';

			// tracer
			out += ' ';

			for (let i = 0; i <= max_trace_col; i++) {
				if (i === start) {
					out += '';
				} else if (i < start) {
					out += ' ';
				} else if (i >= start && i < end) {
					out += '▇';
				} else if (i === end) {
					out += '';
				} else if (i > end) {
					out += ' ';
				}
			}

			out += ' ';

			// name
			if (span.name.length + 3 > max_name_col) {
				out += ' > ' + span.name.slice(0, max_name_col - 7) + '... ';
			} else {
				out += ' > ' + span.name + ' ';
			}

			out += '\n';
		}

		console.log(out);
	}
}
