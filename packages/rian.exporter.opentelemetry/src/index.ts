import type * as rian from 'rian';

import { name as rian_name, version as rian_version } from 'rian/package.json';
import { convert_object_to_kv } from './internal/helpers';

import { Span } from './internal/types';

export interface Config {
	onRequest(payload: any): void;
}

export const exporter =
	(config: Config): rian.Exporter =>
	(spans, context) => {
		const otel_spans: Span[] = [];

		for (let span of spans) {
			const kind = span.context.kind;
			delete span.context.kind;

			otel_spans.push({
				traceId: span.id.trace_id,
				spanId: span.id.parent_id,
				parentSpanId: span.parent?.parent_id,

				name: span.name,
				kind: kind || 0,

				startTimeUnixNano: span.start * 1000000,
				endTimeUnixNano: span.end ? span.end * 1000000 : undefined,

				droppedAttributesCount: 0,
				droppedEventsCount: 0,
				droppedLinksCount: 0,

				attributes: convert_object_to_kv(span.context),
			});
		}

		return config.onRequest({
			resourceSpans: [
				{
					resource: {
						attributes: convert_object_to_kv(context),
						droppedAttributesCount: 0,
					},
					instrumentationLibrarySpans: [
						{
							instrumentationLibrary: {
								name: rian_name,
								version: rian_version,
							},
							spans: otel_spans,
						},
					],
				},
			],
		});
	};
