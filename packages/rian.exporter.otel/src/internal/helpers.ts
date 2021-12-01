import type { AnyValue, KeyValue } from './types';

export const convert_value_to_anyvalue = (value: any) => {
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
	else any_value.kvlistValue = { values: convert_object_to_kv(value) };

	return any_value;
};

export const convert_object_to_kv = (input: any) => {
	const value: KeyValue[] = [];

	for (let key of Object.keys(input)) {
		value.push({
			key,
			value: convert_value_to_anyvalue(input[key]),
		});
	}

	return value;
};
