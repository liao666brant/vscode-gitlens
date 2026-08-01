import * as assert from 'node:assert';
import { commands } from 'vscode';
import type { GlCommands, GlWebviewCommands } from '../../../constants.commands.js';
import type { Container } from '../../../container.js';
import { Container as ContainerClass } from '../../../container.js';
import { registerCommand, registerWebviewCommand } from '../command.js';

// Unique per run to avoid clashing with other suites in the same test window
const prefix = `gitlens.test.command.${Date.now()}`;

suite('command', () => {
	let disposed: { dispose(): unknown }[] = [];
	let originalInstanceDescriptor: PropertyDescriptor | undefined;

	suiteSetup(() => {
		// `registerCommand`/`registerWebviewCommand` only touch telemetry + usage on the container;
		// stub the static instance instead of building the full (heavy) Container.
		const container = {
			telemetry: { sendEvent: () => undefined },
			usage: { track: async () => undefined },
		} as unknown as Container;

		originalInstanceDescriptor = Object.getOwnPropertyDescriptor(ContainerClass, 'instance');
		assert.ok(originalInstanceDescriptor, 'Container.instance descriptor should exist');
		Object.defineProperty(ContainerClass, 'instance', {
			configurable: true,
			get: () => container,
		});
	});

	suiteTeardown(() => {
		if (originalInstanceDescriptor != null) {
			Object.defineProperty(ContainerClass, 'instance', originalInstanceDescriptor);
		}
	});

	teardown(() => {
		for (const d of disposed) {
			d.dispose();
		}
		disposed = [];
	});

	test('registerCommand: sync return value is returned to executeCommand', async () => {
		const id = `${prefix}.sync` as GlCommands;
		disposed.push(registerCommand(id, (x: number) => x * 2));

		const result = await commands.executeCommand<number>(id, 21);
		assert.strictEqual(result, 42);
	});

	test('registerCommand: async promise result is awaited by executeCommand', async () => {
		const id = `${prefix}.async` as GlCommands;
		disposed.push(registerCommand(id, async (x: number) => x * 2));

		const result = await commands.executeCommand<number>(id, 21);
		assert.strictEqual(result, 42);
	});

	test('registerCommand: callback rejection propagates to executeCommand (no unhandled rejection)', async () => {
		const id = `${prefix}.reject` as GlCommands;
		disposed.push(
			registerCommand(id, async () => {
				throw new Error('boom');
			}),
		);

		await assert.rejects(Promise.resolve(commands.executeCommand(id)), /boom/);
	});

	test('registerWebviewCommand: async promise result is returned to executeCommand', async () => {
		const id = `${prefix}.webview` as GlWebviewCommands;
		disposed.push(registerWebviewCommand(id, async () => 'done'));

		const result = await commands.executeCommand<string>(id);
		assert.strictEqual(result, 'done');
	});
});
