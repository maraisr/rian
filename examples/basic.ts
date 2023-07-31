import * as Rian from '../async.mjs'
import { exporter } from '../exporter.console.mjs'

Rian.configure('basic')

await Rian.tracer('basic')(async () => {
	Rian.span('go');
    await Promise.all([
        Rian.span('setup')(() => sleep(93)),
        Rian.span('bootstrap')(() => sleep(41)),
        Rian.span('building')(() => sleep(31)),
    ]);

    await Promise.all([
        Rian.span('precompile')(() => sleep(59)),
        sleep(10).then(() => Rian.span('verify')(() => sleep(79))),
    ]);

    await Rian.span('running')(() => {
        return Rian.span('e2e')(async () => {
            await sleep(301);
            return Rian.span('snapshot')(() => sleep(36));
        })
    })

    await sleep(10)

    await Rian.span('report with a really long name to test the wrapping')(() => sleep(11));
});

Rian.report(exporter(process.stdout.columns))

// --

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
