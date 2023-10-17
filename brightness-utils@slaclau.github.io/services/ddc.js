import * as MyShell from './shell.js';

function getValueFromString(value, key, idx) {
    if (value != null) {
        if (value.includes(key)) {
            if (idx != null) {
                return value.split(key)[idx].trim();
            } else {
                return value.split(key);
            }
        }
    }
    return null;
}

function getValueFromArray(array, key, idx) {
    if (array != null) {
        for (const value of array) {
            let rv = getValueFromString(value, key, idx);
            if (rv != null) {
                return rv;
            }
        }
    }
    return null;
}

export function getDisplays() {
    const result = MyShell.exec('ddcutil detect --brief');
    if (result == null) {
        return null;
    }

    console.log(`getDisplays - ${result}`);
    const displays = [];

    result.split('Display ').forEach(group => {
        const lines = group.split('\n');
        if (2 < lines.length) {
            const bus = getValueFromArray(lines, '/dev/i2c-', 1);
            const description = getValueFromArray(lines, 'Monitor:', 1);
            const name = getValueFromString(description, ':', 1);
            //const serialNumber = description ? description.split(':')[2] : null;

            if (bus && name) {
                let rv = getDisplayBrightness(bus);
                let current = rv.current;
                let max = rv.max;

                if (current == null || max == null) {
                    console.log(
                        `getDisplays - ERR ${bus}, ${description}, ${name}, ${current}, ${max}`
                    );
                    current = 0;
                    max = 100;
                } else {
                    console.log(
                        `getDisplays - OK ${bus}, ${description}, ${name}, ${current}, ${max}`
                    );
                }

                displays.push({
                    bus,
                    name,
                    //serialNumber,
                    current,
                    max,
                });
            } else {
                console.log(
                    `getDisplays - ERR ${bus}, ${description}, ${name}`
                );
            }
        }
    });

    return displays;
}

export function getDisplayBrightness(bus) {
    const result = MyShell.exec(`ddcutil getvcp 10 --bus ${bus} --brief`);
    console.log(`getDisplayBrightness - bus: ${bus}, result: ${result}`);

    let values = getValueFromString(
        getValueFromString(result, 'VCP ', 1),
        ' ',
        null
    );

    if (values == null || values.length < 4) {
        return {
            current: null,
            max: null,
        };
    }
    return {
        current: values[2].trim(),
        max: values[3].trim(),
    };
}

export function setDisplayBrightness(bus, value) {
    const result = MyShell.execAsync(`ddcutil setvcp 10 ${value} --bus ${bus}`);
    console.log(
        `setDisplayBrightness - value: ${value}, bus: ${bus}, result: ${result}`
    );
}
