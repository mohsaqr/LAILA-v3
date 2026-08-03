import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  BookOpenCheck,
  Bot,
  ChevronDown,
  ChevronRight,
  Fingerprint,
  Package,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { useTheme } from '../hooks/useTheme';
import thirdParty from '../data/third-party-licenses.json';
import pkg from '../../package.json';

interface Dependency {
  name: string;
  version: string | null;
  license: string;
  homepage: string | null;
  note?: string;
}

const CAPABILITIES = [
  {
    title: 'AI tutoring and agents',
    icon: Bot,
    items: [
      'Configurable tutors with their own persona, instructions, rules, prompt blocks and permitted tools',
      'Course-scoped tutor assignment, student-configured task tutors and agent design logging',
      'Streaming dialogue across OpenAI, Gemini and OpenAI-compatible providers',
      'Chatbot registry, prompt blocks and reusable agent configurations',
    ],
  },
  {
    title: 'Learning design and delivery',
    icon: BookOpenCheck,
    items: [
      'Courses, modules, lectures, sections, activation codes and prerequisite chains',
      'Assignments, quizzes, rubrics, surveys, forums and certificates',
      'Interactive code labs and custom labs running R in the browser',
      'Enrolment management, batch enrolment, course roles and delegated teaching',
    ],
  },
  {
    title: 'Learning analytics',
    icon: Activity,
    items: [
      'Activity, content, assessment, authentication and agent-design event logs',
      'Transition network analysis and sequence-pattern exercises over learner activity',
      'Per-student, per-course and cohort analytics with gradebook and progress views',
      'Emotional pulse check-ins and filtered research-data export',
    ],
  },
  {
    title: 'Governance and identity',
    icon: ShieldCheck,
    items: [
      'Configurable registration policy: open, approval, invite-only or closed, with email-domain rules',
      'Admin approval queue, invitation links and codes, and course-code sponsored signup',
      'Acts as an OpenID Connect provider so other applications can accept LAILA logins',
      'Role management, account lifecycle, admin audit trail and revocable sessions',
    ],
  },
] as const;

export const About = () => {
  const { t } = useTranslation(['common']);
  const { isDark } = useTheme();
  const [showDeps, setShowDeps] = useState(false);

  const deps = thirdParty as unknown as {
    carmLicense: string;
    carmLicenseVersion: string;
    counts: { total: number; client: number; server: number };
    byLicense: Record<string, number>;
    client: Dependency[];
    server: Dependency[];
  };

  // Injected by `define` in vite.config.ts at build time — see vite-env.d.ts.
  const build = __BUILD_INFO__;

  // One list, alphabetical — which workspace a package sits in is a build
  // detail, not something an attribution reader cares about.
  const allDeps = useMemo(
    () => [...deps.client, ...deps.server].sort((a, b) => a.name.localeCompare(b.name)),
    [deps.client, deps.server]
  );

  const muted = isDark ? 'text-gray-400' : 'text-gray-500';
  const body = isDark ? 'text-gray-300' : 'text-gray-700';
  const heading = isDark ? 'text-gray-100' : 'text-gray-900';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Breadcrumb items={[{ label: t('common:about', { defaultValue: 'About' }) }]} />

      <header className="space-y-1">
        <h1 className={`text-2xl font-semibold tracking-tight ${heading}`}>About LAILA</h1>
        <p className={`text-sm ${muted}`}>
          Overview, capabilities, release identity and licensing.
        </p>
      </header>

      {/* ── Overview + release identity ─────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <p className={`text-sm leading-6 ${body}`}>
              LAILA is an AI-powered learning management system built for teaching and for
              research on how people learn. Alongside the usual course machinery — modules,
              lectures, assignments, quizzes, forums and certificates — it lets instructors
              deploy configurable AI tutors, each with its own persona, instructions, domain
              knowledge and permitted tools, and attach them to specific courses and tasks.
            </p>
            <p className={`mt-3 text-sm leading-6 ${body}`}>
              Every interaction is recorded as structured events, so the same platform that
              delivers the teaching also supports its study: activity, content, assessment and
              agent-design logs feed transition network analysis, sequence-pattern exercises and
              cohort analytics. Learners can run R directly in the browser through interactive
              code labs.
            </p>
            <p className={`mt-3 text-sm leading-6 ${body}`}>
              LAILA is part of the LACARM ecosystem and can act as an OpenID Connect provider,
              letting sibling applications accept a LAILA login instead of maintaining their own
              accounts.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className={`flex items-center gap-2 text-sm font-medium ${heading}`}>
              <Fingerprint className="w-4 h-4" aria-hidden="true" />
              Release
            </div>
          </CardHeader>
          <CardBody>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className={muted}>Version</dt>
                <dd className={`font-mono ${body}`}>{pkg.version}</dd>
              </div>
              {/*
                The commit, not the version, is what identifies a build: the
                version only moves when someone bumps it, so two deployments
                can report the same one while serving different code. Shown
                only when the build had git available (a tarball build has not).
              */}
              {build.gitSha && (
                <div className="flex justify-between gap-3">
                  <dt className={muted}>Build</dt>
                  <dd className={`font-mono ${body}`}>
                    {build.gitSha}
                    {build.gitDirty ? '-dirty' : ''}
                  </dd>
                </div>
              )}
              {build.builtAt && (
                <div className="flex justify-between gap-3">
                  <dt className={muted}>Built</dt>
                  <dd className={body}>{new Date(build.builtAt).toLocaleString()}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className={muted}>License</dt>
                <dd className={body}>{deps.carmLicenseVersion}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className={muted}>Open-source packages</dt>
                <dd className={body}>{deps.counts.total}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>

      {/* ── Capabilities ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className={`text-lg font-semibold tracking-tight ${heading}`}>Capabilities</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {CAPABILITIES.map(({ title, icon: Icon, items }) => (
            <Card key={title}>
              <CardHeader>
                <div className={`flex items-center gap-2 text-sm font-medium ${heading}`}>
                  <Icon className="w-4 h-4 text-indigo-500" aria-hidden="true" />
                  {title}
                </div>
              </CardHeader>
              <CardBody>
                <ul className={`list-disc pl-5 space-y-1.5 text-sm leading-5 ${body}`}>
                  {items.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Carm license ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className={`text-lg font-semibold tracking-tight ${heading}`}>License</h2>
        <Card>
          <CardHeader>
            <div className={`flex items-center gap-2 text-sm font-medium ${heading}`}>
              <Scale className="w-4 h-4" aria-hidden="true" />
              {deps.carmLicenseVersion}
            </div>
            <p className={`mt-0.5 text-xs ${muted}`}>2025–2026 Professor Mohammed Saqr, PhD</p>
          </CardHeader>
          <CardBody>
            <pre
              className={`overflow-x-auto whitespace-pre-wrap rounded-lg border p-4 font-mono text-xs leading-5 ${
                isDark
                  ? 'border-gray-700 bg-gray-900/40 text-gray-300'
                  : 'border-gray-200 bg-gray-50 text-gray-700'
              }`}
            >
              {deps.carmLicense}
            </pre>
          </CardBody>
        </Card>
      </section>

      {/* ── Third-party attribution ─────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className={`text-lg font-semibold tracking-tight ${heading}`}>Open-source software</h2>
        <Card>
          <CardHeader>
            <div className={`flex items-center gap-2 text-sm font-medium ${heading}`}>
              <Package className="w-4 h-4" aria-hidden="true" />
              {deps.counts.total} direct dependencies
            </div>
            <p className={`mt-0.5 text-xs ${muted}`}>
              LAILA is built on open-source software. Listed below are the direct dependencies of
              the client and server, with the license each one declares.
            </p>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {Object.entries(deps.byLicense).map(([license, count]) => (
                <span
                  key={license}
                  className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${
                    isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {license}
                  <span className={muted}>{count}</span>
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowDeps(v => !v)}
              aria-expanded={showDeps}
              className={`mt-4 inline-flex items-center gap-1.5 text-sm font-medium ${
                isDark ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-700'
              }`}
            >
              {showDeps ? (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              )}
              {showDeps ? 'Hide' : 'Show'} all {deps.counts.total} packages
            </button>

            {showDeps && (
              <ul className="mt-3 space-y-1.5">
                {allDeps.map(dep => (
                  <li
                    key={`${dep.name}@${dep.version}`}
                    className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b py-1.5 text-sm last:border-0 ${
                      isDark ? 'border-gray-700' : 'border-gray-100'
                    }`}
                  >
                    <span className="min-w-0">
                      {dep.homepage ? (
                        <a
                          href={dep.homepage}
                          target="_blank"
                          rel="noreferrer noopener"
                          className={`font-mono ${
                            isDark ? 'text-indigo-300 hover:underline' : 'text-indigo-600 hover:underline'
                          }`}
                        >
                          {dep.name}
                        </a>
                      ) : (
                        <span className={`font-mono ${body}`}>{dep.name}</span>
                      )}
                      {dep.version && <span className={`ml-2 text-xs ${muted}`}>{dep.version}</span>}
                      {dep.note && <p className={`mt-0.5 text-xs ${muted}`}>{dep.note}</p>}
                    </span>
                    <span className={`text-xs ${muted}`}>{dep.license}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
};

export default About;
