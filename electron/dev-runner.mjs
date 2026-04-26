import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

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

const viteProcess = spawn('npm.cmd', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '3000'], {
    cwd: rootDir,
    stdio: 'inherit',
});

viteProcess.on('exit', (code) => {
    terminate(code ?? 0);
});

setTimeout(() => {
    electronProcess = spawn('npx.cmd', ['electron', '.'], {
        cwd: rootDir,
        stdio: 'inherit',
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
