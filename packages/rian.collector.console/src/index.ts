import { Collector } from "rian";

// 1/50
let max_distance = 50;
const _ = " ";

const mix = (a: number, b: number, amount: number) => (1 - amount) * a + amount * b;

export const collector: Collector = (spans) => {
	let out = "",
		maxima = 0, minima: number | null = null;

	const lines = new Map;

	for (let span of spans) {
		if (maxima <= span.end) maxima = span.end;
		if (minima === null || minima > span.start) minima = span.start;

		const id = span.parent || "root";
		let i = lines.get(id);
		if (!i) i = [];
		i.push(span);
		lines.set(id, i);
	}

	// 1/distance
	let distance = maxima - minima;

	for (let line of lines.values()) {
		out += "\n";

		for (let span of line) {
			const duration = (span.end - span.start).toFixed(2);

			const occupy = span.name.length + 4 + String(duration).length;
			let name = span.name;
			const start_x = mix(1, max_distance, (span.start - minima) / distance);
			const end_x = mix(1, max_distance, (span.start - minima) / distance);

			out += `${_.repeat(start_x)}[${span.name}${".".repeat(2)}`;
		}
	}

	out += "\n";

	console.log(out);
};

/*
[A.......................................(0.7ms)]
   [B..................................(0.5ms)]
    [C........(0.1ms)]  [D.............(0.4ms)]
 */
