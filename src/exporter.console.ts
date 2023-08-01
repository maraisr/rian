import type * as rian from 'rian';

export function exporter(max_cols = 120) {
	return function (trace: rian.Trace) {
		for (let scope of trace.scopeSpans) {
			let spans = scope.spans;

			if (!spans.length) return;

			let tmp, i;

			let out = '';
			let max_time = 0;
			let min_time = spans[0].start;

			for (i = 0; (tmp = scope.spans[i++]); ) {
				max_time = Math.max(max_time, tmp.end ?? tmp.start);
				min_time = Math.min(min_time, tmp.start);
			}

			let dur = max_time - min_time;

			/*
            [ cols                           ]
            [ time ] [ trace        ] [ name ]
            [ time ] [ trace        ] [ name ]
            */
			let max_time_length = String(dur).length;
			let max_time_col = max_time_length + 7; // [..ms.]
			let max_trace_col =
				Math.ceil((2 / 3) * (max_cols - max_time_col)) - 2; // . .
			let max_name_col = max_cols - max_time_col - max_trace_col;

			for (i = 0; (tmp = scope.spans[i++]); ) {
				let time = 0;
				let end = tmp.end ?? false;
				if (end !== false) time = end - tmp.start;

				let start = Math.ceil(
					((tmp.start - min_time) / (max_time - min_time)) *
						max_trace_col,
				);
				end = end
					? Math.ceil(
							((tmp.end! - min_time) / (max_time - min_time)) *
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
				out += ' > ';
				out +=
					tmp.name.length + 3 > max_name_col
						? tmp.name.substring(0, max_name_col - 7) + '... '
						: tmp.name;
				out += '\n';
			}

			console.log(out);
		}
	};
}
