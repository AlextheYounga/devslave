import process from "process";
import util from "util";

function inspect(thing: any) {
    return util.inspect(thing, {
        showHidden: true,
        depth: null,
        colors: true,
    });
}

export default function dd(...args: any[]) {
    // eslint-disable-next-line prefer-rest-params
    Array.prototype.slice.call(args).forEach((thing) => {
        console.log(inspect(thing));
    });

    process.exit(1);
}
