import type * as rian from 'rian';

import { Span } from './internal/types';

export interface Config {
	onRequest(payload: any): void;
}

export const exporter =
	(config: Config): rian.Exporter =>
	(spans, context) => {
		const zipkin: Span[] = [];

		for (let span of spans) {
			zipkin.push({
				id: span.id.parent_id,
				traceId: span.id.trace_id,
				parentId: span.parent?.parent_id,

				name: span.name,
				kind: span.kind === 'INTERNAL' ? undefined : span.kind,

				timestamp: span.start * 1000,

				duration: span.end ? (span.end - span.start) * 1000 : undefined,

				tags: Object.assign({}, context, span.context),
			});
		}

		return config.onRequest(zipkin);
	};
