import type * as rian from 'rian';

let p = 1;

export function exporter(max_cols = 120) {
	if (max_cols < 24) throw new Error('max_cols must be at least 24');

	return function (trace: rian.Trace) {
		for (let scope of trace.scopeSpans) {
			let spans = scope.spans;

			if (!spans.length) return;

			let out = '';

			let tmp, i;

			let max_time = 0;
			let min_time = spans[0].start;

			for (i = 0; (tmp = scope.spans[i++]); ) {
				max_time = Math.max(max_time, tmp.end ?? tmp.start);
				min_time = Math.min(min_time, tmp.start);
			}

			let t_dur = max_time - min_time;
			let t_dur_str = format(t_dur);

			// [ cols                            ]
			// { time }
			let max_time_length = t_dur_str.length;
			let max_time_col = max_time_length + 2; // .|

			// [ time ] { trace       }
			let max_trace_col = Math.floor((2 / 3) * (max_cols - max_time_col));
			let trace_cols = max_trace_col - (p * 2 + 2);

			// [ time ] [ trace       ] { name   }
			let max_name_col = max_cols - max_time_col - max_trace_col;

			// [...^...]
			let mid = Math.floor(trace_cols / 2);
			let mid_str = format(t_dur / 2);
			let mid_str_anchor = Math.floor(mid_str.length / 2);

			// spans top border
			out += '╭'.padStart(max_time_col);
			out += '─'.repeat(max_trace_col);
			out += '╮\n';

			// render spans
			for (i = 0; (tmp = scope.spans[i++]); ) {
				let start_time = tmp.start - min_time;
				let end_time = (tmp.end ?? max_time) - min_time;

				let start_trace = Math.floor((start_time / t_dur) * trace_cols);
				let end_trace = Math.floor((end_time / t_dur) * trace_cols);

				let dur = end_time - start_time;
				let dur_str = format(dur);

				// time
				out += dur_str.padStart(max_time_length);
				out += ' │';

				// trace
				out += ' '.repeat(start_trace + p);
				out += '┣';
				out += (tmp.end ? '━' : '╍').repeat(end_trace - start_trace);
				out += '┫';
				out += ' '.repeat(max_trace_col - end_trace - (p + 2));

				// name
				out += '│◗ ';
				out +=
					tmp.name.length + 4 > max_name_col
						? tmp.name.substring(0, max_name_col - 4) + '…'
						: tmp.name;

				out += '\n';
			}

			// spans bottom border
			out += '╰'.padStart(max_time_col);
			out += '┼';
			out += '┴'.repeat(mid - 2);
			out += '┼';
			out += '┴'.repeat(max_trace_col - mid - 1);
			out += '┼';
			out += '╯\n';

			// legend
			out += '0 ms'.padStart(max_time_length + 2 + 4); // .[0 ms
			out += mid_str.padStart(mid + mid_str_anchor - 4); // 0 ms
			out += t_dur_str.padStart(
				trace_cols -
					mid +
					2 - // . .
					(mid_str_anchor + 4) + // 0 ms
					t_dur_str.length,
			);

			// trailer
			out += '\n\n';
			let t_dur_str_seg = format(t_dur / trace_cols);
			let t_max_len = Math.max(t_dur_str_seg.length, t_dur_str.length);
			out += tmp = `one └┘ unit is less than: ${t_dur_str_seg}\n`;
			out += `total time: ${t_dur_str.padStart(t_max_len)}`.padStart(
				tmp.length - 1,
			);

			console.log(out);
		}
	};
}

// --

let MIN = 60e3;
let HOUR = MIN * 60;
let SEC = 1e3;

function dec_str(num: number) {
	return num % 1 === 0 ? String(num) : num.toFixed(3);
}

function format(num: number) {
	if (num < 0) return '0 ms';
	if (num < SEC) return `${dec_str(num)} ms`;
	if (num < MIN) return `${dec_str(num / SEC)} s`;
	if (num < HOUR) {
		let m = Math.floor(num / MIN);
		let s = Math.floor((num % MIN) / SEC);
		let ms = dec_str(num % SEC);
		return `${m} m ${s} s ${ms} ms`;
	}

	return '> 1hr';
}
