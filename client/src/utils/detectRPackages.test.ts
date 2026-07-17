import { describe, it, expect } from 'vitest';
import { detectRPackages } from './detectRPackages';

describe('detectRPackages', () => {
  it('detects bare and quoted library/require calls', () => {
    const cells = [
      'library(dplyr)',
      'library("ggplot2")',
      "require('igraph')",
    ];
    expect(detectRPackages(cells).sort()).toEqual(['dplyr', 'ggplot2', 'igraph']);
  });

  it('de-duplicates across cells and lines', () => {
    const cells = ['library(tna)\nlibrary(dplyr)', 'library(tna)'];
    expect(detectRPackages(cells).sort()).toEqual(['dplyr', 'tna']);
  });

  it('ignores calls inside a line comment', () => {
    expect(detectRPackages(['# library(oldpkg)\nlibrary(tna)'])).toEqual(['tna']);
  });

  it('handles a trailing comment on a real call', () => {
    expect(detectRPackages(['library(tidyverse) # the whole thing'])).toEqual(['tidyverse']);
  });

  it('handles the package= argument form', () => {
    expect(detectRPackages(['library(package = "purrr")'])).toEqual(['purrr']);
  });

  it('does not match requireNamespace or similar words', () => {
    expect(detectRPackages(['requireNamespace("foo")', 'librarything(bar)'])).toEqual([]);
  });

  it('returns empty for code with no package loads', () => {
    expect(detectRPackages(['x <- 1\nplot(x)'])).toEqual([]);
  });

  it('picks up dotted package names', () => {
    expect(detectRPackages(['library(data.table)'])).toEqual(['data.table']);
  });
});
