import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const binDir = path.join(rootDir, 'node_modules', '.bin');
const isWindows = process.platform === 'win32';
const viteCommand = path.join(binDir, isWindows ? 'vite.cmd' : 'vite');
const electronCommand = path.join(binDir, isWindows ? 'electron.cmd' : 'electron');
const baseSpawnOptions = {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
};

const spawnLocalCommand = (command, args, options = {}) => {
    if (isWindows) {
        // On Windows we use PowerShell to avoid cmd.exe quoting issues
        // with paths that contain spaces.
        const quotedArgs = args.map(a => (a.includes(' ') ? `'${a}'` : a));
        const psCommand = `& '${command}' ${quotedArgs.join(' ')}`;
        return spawn('powershell.exe', ['-NoLogo', '-NonInteractive', '-Command', psCommand], {
            ...baseSpawnOptions,
            ...options,
        });
    }

    return spawn(command, args, {
        ...baseSpawnOptions,
        ...options,
    });
};

let electronProcess = null;
let exited = false;

const terminate = (code = 0) => {
    if (exited) return;
    exited = true;

    if (electronProcess && !electronProcess.killed) {
        electronProcess.kill();
    }

    if (!viteProcess.killed) {
        viteProcess.kill();
    }

    process.exit(code);
};

const viteProcess = spawnLocalCommand(viteCommand, ['--host', '127.0.0.1', '--port', '3000']);

viteProcess.on('exit', (code) => {
    terminate(code ?? 0);
});

setTimeout(() => {
    electronProcess = spawnLocalCommand(electronCommand, ['.'], {
        env: {
            ...process.env,
            ELECTRON_START_URL: 'http://127.0.0.1:3000',
        },
    });

    electronProcess.on('exit', (code) => {
        terminate(code ?? 0);
    });
}, 5000);

process.on('SIGINT', () => terminate(0));
process.on('SIGTERM', () => terminate(0));
