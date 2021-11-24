// @ts-check

import { readdir } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { join } from 'node:path';

import { OutputOptions, rollup } from 'rollup';
import dts from 'rollup-plugin-dts';

import typescript from 'typescript';
import tsconfig from '../tsconfig.json';

// @ts-ignore
const __dirname = new URL('.', import.meta.url).pathname;

const packages_dir = join(__dirname, '../packages');

function bail(message: string) {
	console.error(message);
	process.exit(1);
}

async function build(name: string) {
	const pkg_dir = join(packages_dir, name);
	const pkg = await import(join(pkg_dir, './package.json'));

	const files = await readdir(join(pkg_dir, 'src'));

	const external = [
		pkg.name,
		...builtinModules,
		...Object.keys(pkg.dependencies || {}),
		...Object.keys(pkg.peerDependencies || {}),
	];

	let i = 0,
		tasks = [];

	for (files.sort(); i < files.length; i++) {
		let file = files[i],
			key = '';

		if (!key && file === 'index.ts') key = '.';
		else if (!key) key = './' + file.replace(/\.ts$/, '');

		const entry = pkg.exports[key];
		if (!entry) return bail(`Missing "exports" entry: ${key}`);

		const input = join(pkg_dir, 'src', file);

		const bundle = async () => {
			const output = (is_esm: boolean): OutputOptions => {
				const output = join(
					pkg_dir,
					entry[is_esm ? 'import' : 'require'],
				);

				return {
					format: is_esm ? 'esm' : 'cjs',
					file: output,
					preferConst: true,
					esModule: false,
					freeze: false,
					strict: true,
				};
			};

			return rollup({
				input,
				external,
				output: [output(true), output(false)],
				plugins: [
					{
						name: 'typescript',
						transform(code, file) {
							if (!/\.ts$/.test(file)) return code;
							// @ts-ignore
							let output = typescript.transpileModule(code, {
								...tsconfig,
								fileName: file,
							});
							return {
								code: output.outputText,
								map: output.sourceMapText || null,
							};
						},
					},
				],
			}).then((r) =>
				Promise.all([r.write(output(true)), r.write(output(false))]),
			);
		};

		const types = async () => {
			const output = join(pkg_dir, file.replace(/\.ts$/, '.d.ts'));

			return rollup({
				input,
				plugins: [dts()],
			}).then((r) =>
				r.write({
					file: output,
					format: 'esm',
				}),
			);
		};

		tasks.push(bundle(), types());
	}

	await Promise.all(tasks);
}

Promise.all([build('rian')]);
