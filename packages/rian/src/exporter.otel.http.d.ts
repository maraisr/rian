import type { Exporter } from 'rian';

export const exporter: (request: (payload: any) => any) => Exporter;
