import GLib from 'gi://GLib';

const decoder = new TextDecoder();

export function exec(cmd) {
    try {
        let [, out] = GLib.spawn_command_line_sync(cmd);
        const response = decoder.decode(out);
        return response;
    } catch (err) {
        return null;
    }
}

export function execAsync(cmd) {
    try {
        let [, out] = GLib.spawn_command_line_async(cmd);
        const response = decoder.decode(out);
        return response;
    } catch (err) {
        return null;
    }
}
