import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { About } from './About';
import pkg from '../../package.json';
import thirdParty from '../data/third-party-licenses.json';

/**
 * The About page is where LAILA states its licence, its version and the
 * open-source software it is built on. A production deployment shipped without
 * it and nothing noticed, so these assert the page keeps saying who it is.
 */

// Mock i18n — returns the key, which is enough here: everything asserted below
// is data (version, licence, dependency counts) rather than translated copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const manifest = thirdParty as unknown as {
  carmLicenseVersion: string;
  counts: { total: number };
};

const renderAbout = () =>
  render(
    <MemoryRouter>
      <About />
    </MemoryRouter>
  );

describe('About page', () => {
  it('shows the application version', () => {
    renderAbout();
    expect(screen.getByText(pkg.version)).toBeInTheDocument();
  });

  // Parsed from the LICENSE heading rather than hardcoded, so a stale "v1.3"
  // label can never sit beside v1.4 text.
  it('shows the Carm licence version from the manifest', () => {
    renderAbout();
    // Rendered in both the Release card and the licence section, so match all.
    expect(screen.getAllByText(manifest.carmLicenseVersion).length).toBeGreaterThan(0);
    expect(manifest.carmLicenseVersion).toMatch(/^Carm Research License v\d+\.\d+$/);
  });

  it('shows how many open-source packages are attributed', () => {
    renderAbout();
    expect(screen.getByText(String(manifest.counts.total))).toBeInTheDocument();
    expect(manifest.counts.total).toBeGreaterThan(0);
  });

  // Injected by `define` in vite.config.ts, mirrored in vitest.config.ts. The
  // commit is what actually identifies a build — the version only moves when
  // someone bumps it, so two deployments can share one while differing.
  it('shows the build commit when git was available at build time', () => {
    renderAbout();
    if (__BUILD_INFO__.gitSha) {
      const shown = new RegExp(`^${__BUILD_INFO__.gitSha}(-dirty)?$`);
      expect(screen.getByText(shown)).toBeInTheDocument();
    }
    expect(__BUILD_INFO__.version).toBe(pkg.version);
  });
});
