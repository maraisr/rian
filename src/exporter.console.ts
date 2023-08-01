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

			let t_dur = max_time - min_time;
			let t_dur_str = format(t_dur);

			/*
            [ cols                           ]
            [ time ] [ trace        ] [ name ]
            [ time ] [ trace        ] [ name ]
            */
			let max_time_length = t_dur_str.length;
			let max_time_col = max_time_length + 7; // [..ms.]
			let max_trace_col =
				Math.ceil((2 / 3) * (max_cols - max_time_col)) - 2; // . .
			let max_name_col = max_cols - max_time_col - max_trace_col;

			for (i = 0; (tmp = scope.spans[i++]); ) {
				let start_time = tmp.start - min_time;
				let end_time = (tmp.end ?? max_time) - min_time;

				let start_trace = Math.ceil(
					(start_time / t_dur) * max_trace_col,
				);
				let end_trace = Math.ceil((end_time / t_dur) * max_trace_col);

				let dur = end_time - start_time;
				let dur_str = format(dur);

				// time
				out += '[ ';
				out += dur_str.padStart(max_time_length);
				out += ' ]';

				// trace
				out += ' '.repeat(start_trace + 1); // +1 for leading space
				out += '❲';
				out += (tmp.end ? '•' : '◦').repeat(end_trace - start_trace);
				out += '❳';
				out += ' '.repeat(max_trace_col - end_trace);

				// name
				out += ' ◗ ';
				out +=
					tmp.name.length + 1 > max_name_col
						? tmp.name.substring(0, max_name_col - 5) + '… '
						: tmp.name;
				out += '\n';
			}

			// trailer
			out += '\n';
			let t_dur_str_seg = format(t_dur / max_trace_col);
			let t_max_len = Math.max(t_dur_str_seg.length, t_dur_str.length);
			out += tmp = `one '•' unit is less than: ${t_dur_str_seg}\n`;
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
