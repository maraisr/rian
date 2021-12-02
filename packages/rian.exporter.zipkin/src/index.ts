import type * as rian from 'rian';

import { flattie } from 'flattie';

import { type Span } from './internal/types';

export interface Config {
	onRequest(payload: any): void;
}

const map_kind = (kind: any): any => {
	switch (kind) {
		default:
		case 'INTERNAL': {
			return undefined;
		}
		case 'SERVER': {
			return 'SERVER';
		}
		case 'CLIENT': {
			return 'CLIENT';
		}
		case 'PRODUCER': {
			return 'PRODUCER';
		}
		case 'CONSUMER': {
			return 'CONSUMER';
		}
	}
};

export const exporter =
	(config: Config): rian.Exporter =>
	(spans, context) => {
		const zipkin: Span[] = [];

		for (let span of spans) {
			const kind = span.context.kind;
			//delete span.context.kind;

			zipkin.push({
				id: span.id.parent_id,
				traceId: span.id.trace_id,
				parentId: span.parent?.parent_id,

				name: span.name,
				// @ts-ignore
				kind: kind === 'INTERNAL' ? undefined : map_kind(kind),

				timestamp: span.start * 1000,

				duration: span.end ? (span.end - span.start) * 1000 : undefined,

				localEndpoint: context.localEndpoint,

				tags: flattie(Object.assign({}, context, span.context), '.'),
			});
		}

		return config.onRequest(zipkin);
	};
