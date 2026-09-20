import { describe, it, expect, beforeEach } from 'vitest';
import { parsePluginKey, pluginKey } from './keys';
import { pluginRegistry } from './registry';
import { installPluginHost, resolveHostModule, HOST_GLOBAL, CLIENT_API_VERSION } from './host';

describe('plugin keys', () => {
  it('round-trips', () => {
    const key = pluginKey('org.example.demo', 'block');
    expect(key).toBe('plugin:org.example.demo:block');
    expect(parsePluginKey(key)).toEqual({ pluginId: 'org.example.demo', extensionId: 'block' });
  });

  // The property the whole additive design rests on: every type that exists
  // today must keep parsing as "not a plugin", or the renderers would divert
  // real content down the plugin path.
  it('returns null for every built-in section type', () => {
    const builtins = [
      'text', 'file', 'ai-generated', 'chatbot', 'assignment', 'video', 'quiz',
      'folder', 'url', 'embed', 'survey', 'forum', 'poll', 'page', 'codelab',
      'interactivelab', 'labtemplate', 'lecture', 'message', 'plot', 'tna',
      'stdout', 'stderr',
    ];
    builtins.forEach((t) => {
      expect(parsePluginKey(t), `"${t}" must not parse as a plugin key`).toBeNull();
    });
  });

  it('returns null for malformed keys', () => {
    expect(parsePluginKey('')).toBeNull();
    expect(parsePluginKey(null)).toBeNull();
    expect(parsePluginKey(undefined)).toBeNull();
    expect(parsePluginKey('plugin:only-two')).toBeNull();
    expect(parsePluginKey('plugin:a:b:c')).toBeNull();
    expect(parsePluginKey('plugin::b')).toBeNull();
    expect(parsePluginKey('plugin:a:')).toBeNull();
    expect(parsePluginKey('notplugin:a:b')).toBeNull();
  });
});

describe('host module registry', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>)[HOST_GLOBAL];
  });

  it('publishes React on the global the SDK shim reads', () => {
    const host = installPluginHost();
    expect(host.apiVersion).toBe(CLIENT_API_VERSION);
    expect((window as unknown as Record<string, unknown>)[HOST_GLOBAL]).toBe(host);
    expect(resolveHostModule('react')).toBeTruthy();
    expect(resolveHostModule('react/jsx-runtime')).toBeTruthy();
  });

  // The single React instance is the reason plugin components can use hooks.
  it('shares the very same React instance the app uses', async () => {
    installPluginHost();
    const appReact = await import('react');
    expect(resolveHostModule('react')).toBe(appReact);
  });

  it('is idempotent, so a dev hot reload does not wedge the page', () => {
    const first = installPluginHost();
    const second = installPluginHost();
    expect(second).not.toBe(first);
    expect(resolveHostModule('react')).toBeTruthy();
  });

  // Loud at load beats "undefined is not a function" three clicks later.
  it('throws for a module it does not share', () => {
    installPluginHost();
    expect(() => resolveHostModule('lodash')).toThrow(/does not share "lodash"/);
  });

  it('throws when the host was never installed', () => {
    expect(() => resolveHostModule('react')).toThrow(/host is not installed/);
  });
});

describe('client plugin registry', () => {
  const ext = (over: Partial<Parameters<typeof pluginRegistry.register>[0]> = {}) =>
    ({
      pluginId: 'org.example.demo',
      pluginName: 'Demo',
      point: 'lecture.block' as const,
      key: 'plugin:org.example.demo:block',
      id: 'block',
      label: 'Demo Block',
      settings: [],
      Component: (() => null) as never,
      ...over,
    }) as Parameters<typeof pluginRegistry.register>[0];

  beforeEach(() => {
    pluginRegistry.clear();
  });

  it('registers and finds by key', () => {
    pluginRegistry.register(ext());
    expect(pluginRegistry.get('plugin:org.example.demo:block')?.label).toBe('Demo Block');
    expect(pluginRegistry.at('lecture.block')).toHaveLength(1);
    expect(pluginRegistry.at('lab')).toHaveLength(0);
  });

  it('sorts a point by label for a stable picker order', () => {
    pluginRegistry.register(ext({ key: 'plugin:a.b:z', label: 'Zebra' }));
    pluginRegistry.register(ext({ key: 'plugin:a.b:a', label: 'Apple' }));
    expect(pluginRegistry.at('lecture.block').map((e) => e.label)).toEqual(['Apple', 'Zebra']);
  });

  it('drops everything one plugin registered', () => {
    pluginRegistry.register(ext({ key: 'plugin:a.b:one', pluginId: 'a.b' }));
    pluginRegistry.register(ext({ key: 'plugin:a.b:two', pluginId: 'a.b' }));
    pluginRegistry.register(ext({ key: 'plugin:c.d:one', pluginId: 'c.d' }));
    pluginRegistry.unregisterPlugin('a.b');
    expect(pluginRegistry.all()).toHaveLength(1);
    expect(pluginRegistry.all()[0].pluginId).toBe('c.d');
  });

  it('notifies subscribers on change', () => {
    let calls = 0;
    const unsubscribe = pluginRegistry.subscribe(() => {
      calls += 1;
    });
    const before = pluginRegistry.getSnapshot();
    pluginRegistry.register(ext());
    expect(calls).toBe(1);
    expect(pluginRegistry.getSnapshot()).not.toBe(before);
    unsubscribe();
    pluginRegistry.register(ext({ key: 'plugin:a.b:other' }));
    expect(calls).toBe(1);
  });

  // useSyncExternalStore compares snapshots with Object.is; a snapshot that
  // changed identity every call would re-render forever.
  it('returns a stable snapshot when nothing changed', () => {
    pluginRegistry.register(ext());
    const a = pluginRegistry.getSnapshot();
    const b = pluginRegistry.getSnapshot();
    expect(a).toBe(b);
  });
});

describe('lab extension point', () => {
  beforeEach(() => {
    pluginRegistry.clear();
  });

  // The whole additive premise for labs: every built-in lab type must keep
  // being dispatched to its language runtime, never to the plugin renderer.
  it('leaves every built-in lab type on the code-notebook path', () => {
    for (const t of ['r', 'python', 'sna', 'tna', 'network', 'python-data', 'python-ml', 'statistics']) {
      expect(parsePluginKey(t), `"${t}" must not be treated as a plugin lab`).toBeNull();
    }
  });

  it('recognises a plugin lab type', () => {
    const key = pluginKey('org.example.sim', 'market');
    expect(parsePluginKey(key)).toEqual({ pluginId: 'org.example.sim', extensionId: 'market' });
  });

  it('exposes plugin labs separately from blocks', () => {
    const base = {
      pluginId: 'org.example.sim',
      pluginName: 'Sim',
      settings: [],
      Component: (() => null) as never,
    };
    pluginRegistry.register({
      ...base,
      point: 'lab' as const,
      key: pluginKey('org.example.sim', 'market'),
      id: 'market',
      label: 'Market Sim',
    } as never);
    pluginRegistry.register({
      ...base,
      point: 'lecture.block' as const,
      key: pluginKey('org.example.sim', 'note'),
      id: 'note',
      label: 'Note',
    } as never);

    expect(pluginRegistry.at('lab').map((e) => e.label)).toEqual(['Market Sim']);
    expect(pluginRegistry.at('lecture.block').map((e) => e.label)).toEqual(['Note']);
  });
});
