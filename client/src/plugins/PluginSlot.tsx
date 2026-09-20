/**
 * Renders a plugin extension at a placement, and contains its failures.
 *
 * A plugin component is foreign code inside LAILA's own React tree — which is
 * the point, and also the risk. React's contract is unforgiving here: an error
 * thrown during render unmounts **the whole tree** up to the nearest error
 * boundary. Without one, a single broken plugin block blanks the entire
 * lesson, the navigation and the page around it.
 *
 * So every plugin component is wrapped in a boundary that renders a small
 * inline notice instead. A student loses one block; the lesson keeps working.
 * This is the client-side counterpart of the server's rule that one plugin's
 * load failure never stops the others.
 */

import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { pluginRegistry, type LoadedExtension, type PluginComponentProps } from './registry';
import { createPluginApi, type PluginInstance } from './api';

interface BoundaryProps {
  children: ReactNode;
  label: string;
  onError?: (error: Error) => void;
}

interface BoundaryState {
  error: Error | null;
}

/**
 * A class component because `componentDidCatch` has no hook equivalent — React
 * still offers no way to catch a render error from a function component.
 */
class PluginErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error);
    // eslint-disable-next-line no-console
    console.error(`[laila] plugin "${this.props.label}" crashed while rendering`, error);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="my-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">{this.props.label}</p>
              <p className="opacity-80">
                This block could not be displayed. The rest of the page is unaffected.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface PluginSlotProps {
  /** `plugin:<pluginId>:<extensionId>` — what the content row stores. */
  extensionKey: string;
  /** Which placement this is: the section, lab, tool or course it belongs to. */
  instance: PluginInstance;
  /** Render the authoring view when the plugin ships one. */
  editing?: boolean;
  courseId?: number | null;
  /** Shown when no plugin provides this key (uninstalled, disabled, failed). */
  fallback?: ReactNode;
}

/**
 * Look up an extension and render it.
 *
 * Subscribes to the registry so a block appears as soon as its plugin finishes
 * loading, rather than needing a navigation to show up.
 */
export const PluginSlot = ({
  extensionKey,
  instance,
  editing = false,
  courseId = null,
  fallback,
}: PluginSlotProps) => {
  const { t, i18n } = useTranslation(['common']);
  const user = useAuthStore((s) => s.user);
  const [extension, setExtension] = useState<LoadedExtension | undefined>(() =>
    pluginRegistry.get(extensionKey),
  );
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setExtension(pluginRegistry.get(extensionKey));
    return pluginRegistry.subscribe(() => setExtension(pluginRegistry.get(extensionKey)));
  }, [extensionKey]);

  const role: 'student' | 'instructor' | 'admin' = user?.isAdmin
    ? 'admin'
    : user?.isInstructor
      ? 'instructor'
      : 'student';

  const laila = useMemo(() => {
    if (!extension || !user) return null;
    return createPluginApi(
      {
        pluginId: extension.pluginId,
        extensionId: extension.id,
        context: {
          userId: user.id,
          fullname: user.fullname ?? '',
          role,
          locale: i18n.language,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          courseId,
          instanceKey: `${instance.kind}:${instance.id}`,
        },
      },
      instance,
    );
    // `instance` is an object literal at most call sites, so depend on its
    // fields rather than its identity or the api is rebuilt every render and
    // any effect a plugin keys on it runs forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extension, user?.id, role, i18n.language, courseId, instance.kind, instance.id]);

  // The config is fetched once per placement and handed down, so a plugin does
  // not have to manage a loading state for something the host already knows how
  // to get.
  useEffect(() => {
    let cancelled = false;
    if (!laila) return;
    laila
      .getConfig()
      .then((c) => {
        if (!cancelled) setConfig(c as Record<string, unknown>);
      })
      .catch(() => {
        // A missing config is an empty config; the plugin's own defaults apply.
        if (!cancelled) setConfig({});
      });
    return () => {
      cancelled = true;
    };
  }, [laila]);

  if (!extension) {
    return (
      <>
        {fallback ?? (
          <div className="my-3 rounded-lg border border-dashed border-gray-300 py-6 text-center text-sm text-gray-400 dark:border-gray-600">
            {t('plugin_unavailable', {
              defaultValue: 'This content needs a plugin that is not currently available.',
            })}
          </div>
        )}
      </>
    );
  }

  if (!laila || config === null) {
    return <div className="my-3 h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />;
  }

  const Chosen: React.ComponentType<PluginComponentProps> =
    editing && extension.Editor ? extension.Editor : extension.Component;

  return (
    <PluginErrorBoundary label={extension.label}>
      <Suspense
        fallback={<div className="my-3 h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}
      >
        <Chosen laila={laila} config={config} editing={editing} />
      </Suspense>
    </PluginErrorBoundary>
  );
};

export default PluginSlot;
