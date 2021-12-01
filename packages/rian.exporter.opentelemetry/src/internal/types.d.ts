export type KeyValue = {
	key: string;
	value: AnyValue;
};

export type ArrayValue = {
	values: AnyValue[];
};

export type KeyValueList = {
	values: KeyValue[];
};

export type AnyValue = {
	stringValue?: string;
	boolValue?: boolean;
	intValue?: number;
	doubleValue?: number;
	arrayValue?: ArrayValue;
	kvlistValue?: KeyValueList;
};

export interface Span {
	traceId: string;
	spanId: string;
	parentSpanId?: string;

	traceState?: string;

	name?: string;
	kind?: string;

	startTimeUnixNano?: number;
	endTimeUnixNano?: number;
	attributes?: KeyValue[] | Record<string, any>;
	droppedAttributesCount: number;
	droppedEventsCount: number;
	droppedLinksCount: number;
}
