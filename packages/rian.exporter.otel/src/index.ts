import type * as rian from 'rian';

import { name as rian_name, version as rian_version } from 'rian/package.json';
import { convert_object_to_kv } from './internal/helpers';

import {
	type Span,
	SpanStatusCode_ERROR,
	SpanStatusCode_UNSET,
	type Status,
} from './internal/types';

export interface Config {
	onRequest(payload: any): void;
}

// https://github.com/open-telemetry/opentelemetry-proto/blob/b43e9b18b76abf3ee040164b55b9c355217151f3/opentelemetry/proto/trace/v1/trace.proto#L127-L155
const map_kind = (kind: any): number => {
	switch (kind) {
		default:
		case 'INTERNAL': {
			return 1;
		}
		case 'SERVER': {
			return 2;
		}
		case 'CLIENT': {
			return 3;
		}
		case 'PRODUCER': {
			return 4;
		}
		case 'CONSUMER': {
			return 5;
		}
	}
};

export const exporter =
	(config: Config): rian.Exporter =>
	(spans, context) => {
		const otel_spans: Span[] = [];

		for (let span of spans) {
			const kind = span.context.kind;
			//	delete span.context.kind;

			let status: Status;
			if ('error' in span.context) {
				status = {
					code: SpanStatusCode_ERROR,
					message: (span.context.error as Error).message,
				};
				delete span.context.error;
			}

			otel_spans.push({
				traceId: span.id.trace_id,
				spanId: span.id.parent_id,
				parentSpanId: span.parent?.parent_id,

				name: span.name,
				kind: map_kind(kind || 'INTERNAL'),

				startTimeUnixNano: span.start * 1000000,
				endTimeUnixNano: span.end ? span.end * 1000000 : undefined,

				droppedAttributesCount: 0,
				droppedEventsCount: 0,
				droppedLinksCount: 0,

				attributes: convert_object_to_kv(span.context),

				status: status || { code: SpanStatusCode_UNSET },
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
