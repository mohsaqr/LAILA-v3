/**
 * R preamble that makes remote data loading work inside webR.
 *
 * Two independent things break notebooks copied from published course
 * material, and both report the same misleading error:
 *
 *   Error: Timeout was reached [github.com]:
 *   Connection timed out after 10000 milliseconds
 *
 * 1. webR has no sockets. Only R's own `download.file()` is wired to the
 *    browser's `fetch()`. Anything that reaches the network through curl or
 *    httr — `rio::import(<url>)` among them — cannot fetch at all. Verified
 *    against a correct, CSP-permitted URL: it still failed after the full ten
 *    seconds. The fix is to download first and read the local path.
 *
 * 2. `github.com/<owner>/<repo>/raw/<ref>/<path>` answers with a 302 whose
 *    `access-control-allow-origin` is present but EMPTY, so the browser drops
 *    it whatever the CSP allows. `raw.githubusercontent.com` sends `*`.
 *
 * Neither surfaces as CORS or CSP: R's libcurl is shimmed over `fetch`, gets
 * nothing back to report, and blames the network after its full timeout.
 *
 * Shimming the environment rather than rewriting notebooks is deliberate. The
 * `lamethods` book — and the courses built on it — use
 * `import("<github url>")` as the idiom. Editing every lab would work but
 * would fork them from the published material, and would have to be redone for
 * each new notebook pasted in. This makes the copied-in form work as written.
 *
 * Definitions land in the global environment, which R searches before any
 * attached package, so these win even if a later cell calls `library(rio)`.
 * Non-URL arguments pass through untouched.
 */
export const NETWORK_SHIM = `
.laila_fix_url <- function(u) {
  if (!is.character(u) || length(u) != 1L) return(u)
  sub("^(https?://)(www\\\\.)?github\\\\.com/([^/]+)/([^/]+)/raw/",
      "\\\\1raw.githubusercontent.com/\\\\3/\\\\4/", u)
}

# Fetch a URL into the virtual filesystem and return its local path. Anything
# that is not a URL is returned unchanged, so this is safe to wrap around any
# file argument.
.laila_localize <- function(path) {
  if (!is.character(path) || length(path) != 1L) return(path)
  if (!grepl("^https?://", path)) return(path)
  u <- .laila_fix_url(path)
  dest <- file.path(tempdir(), basename(sub("[?#].*$", "", u)))
  utils::download.file(u, dest, mode = "wb", quiet = TRUE)
  dest
}

# mode = "wb" by default: without it binary formats (xlsx, rds, parquet)
# arrive corrupted, and that failure appears much later as an unreadable file.
download.file <- function(url, destfile, ..., mode = "wb") {
  utils::download.file(.laila_fix_url(url), destfile, ..., mode = mode)
}

url <- function(description, ...) base::url(.laila_fix_url(description), ...)

# rio::import cannot fetch a URL here at all, so localize first. rio is
# installed on demand rather than up front: most labs never call this, and the
# install is not cheap.
import <- function(file, ...) {
  p <- .laila_localize(file)
  if (!requireNamespace("rio", quietly = TRUE)) webr::install("rio")
  rio::import(p, ...)
}
`;
