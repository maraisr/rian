export interface Span {
	id: string;
	traceId: string;
	parentId?: string;

	name?: string;
	kind?: string;

	timestamp: number;
	duration?: number;

	tags?: Record<string, string | number | boolean | null>;

	localEndpoint?: {
		serviceName: string;
	};
}
