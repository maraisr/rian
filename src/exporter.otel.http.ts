import type * as rian from 'rian';

type KeyValue = {
	key: string;
	value: AnyValue;
};

type ArrayValue = {
	values: AnyValue[];
};

type KeyValueList = {
	values: KeyValue[];
};

type AnyValue = {
	stringValue?: string;
	boolValue?: boolean;
	intValue?: number;
	doubleValue?: number;
	arrayValue?: ArrayValue;
	kvlistValue?: KeyValueList;
};

const SpanStatusCode_UNSET = 0;
const SpanStatusCode_OK = 1;
const SpanStatusCode_ERROR = 2;

type Status = {
	code:
		| typeof SpanStatusCode_UNSET
		| typeof SpanStatusCode_OK
		| typeof SpanStatusCode_ERROR;
	message?: string;
};

interface Span {
	traceId: string;
	spanId: string;
	parentSpanId: string | undefined;

	traceState?: string;

	name?: string;
	kind?: number;

	startTimeUnixNano?: number;
	endTimeUnixNano: number | undefined;
	attributes?: KeyValue[] | Record<string, any>;

	status?: Status;

	events?: {
		timeUnixNano: number;
		name: string;
		droppedAttributesCount: number;
		attributes?: KeyValue[];
	}[];

	droppedAttributesCount: number;
	droppedEventsCount: number;
	droppedLinksCount: number;
}

const convert_value_to_anyvalue = (value: any) => {
	let type = typeof value,
		any_value: AnyValue = {};

	if (type === 'string') any_value.stringValue = value;
	else if (type === 'number')
		if (Number.isInteger(value)) any_value.intValue = value;
		else any_value.doubleValue = value;
	else if (type === 'boolean') any_value.boolValue = value;
	else if (Array.isArray(value))
		any_value.arrayValue = {
			values: value.map((i) => convert_value_to_anyvalue(i)),
		};
	else if (value)
		any_value.kvlistValue = { values: convert_object_to_kv(value) };

	return any_value;
};

const convert_object_to_kv = (input: any) => {
	const value: KeyValue[] = [];

	for (let key of Object.keys(input)) {
		value.push({
			key,
			value: convert_value_to_anyvalue(input[key]),
		});
	}

	return value;
};

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
	(request: (payload: any) => any): rian.Exporter =>
	(spans, context) => {
		const otel_spans: Span[] = [];

		for (let span of spans) {
			const { kind, error, ...span_ctx } = span.context;

			let status: Status;
			if (error) {
				status = {
					code: SpanStatusCode_ERROR,
				};

				if ('message' in (error as Error)) {
					status.message = error.message;
				}
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

				attributes: convert_object_to_kv(span_ctx),

				// @ts-expect-error TS2454
				status: status || { code: SpanStatusCode_UNSET },

				events: span.events.map((i) => ({
					name: i.name,
					attributes: convert_object_to_kv(i.attributes),
					droppedAttributesCount: 0,
					timeUnixNano: i.timestamp * 1000000,
				})),
			});
		}

		return request({
			resourceSpans: [
				{
					resource: {
						attributes: convert_object_to_kv(context),
						droppedAttributesCount: 0,
					},
					instrumentationLibrarySpans: [
						{
							instrumentationLibrary: {
								name: 'rian',
								version: RIAN_VERSION,
							},
							spans: otel_spans,
						},
					],
				},
			],
		});
	};
