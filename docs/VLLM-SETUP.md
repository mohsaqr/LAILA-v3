# vLLM on CPU — install, service, and wiring it into LAILA

Stands up a local OpenAI-compatible inference server and registers it as a LAILA
LLM provider. Supersedes the earlier `_LAILA.md` note, which stopped at "vLLM
runs" and never connected it to the application.

**Scope:** one-time provisioning. For *updating* a running LAILA host see
[DEPLOYMENT.md → Rebuild and redeploy](./DEPLOYMENT.md#rebuild-and-redeploy) —
do not hand-type that procedure, and never run `deploy/deploy.sh` on an existing
host (it is an installer and overwrites `server/.env`).

---

## 0. Decide the version first

```bash
git ls-remote --tags --refs https://github.com/vllm-project/vllm.git \
  | awk -F'refs/tags/' '{print $2}' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -5
```

Pin a tag deliberately and record it here. An unpinned `git clone` gives you
whatever `main` was that morning, which makes the install unreproducible and any
bug report unanswerable.

| | |
|---|---|
| Pinned for this deployment | `v0.17.1` |
| Latest stable at time of writing | `v0.26.0` |

Nine releases of drift is a choice, not an accident — either confirm v0.17.1 is
required for a reason, or upgrade.

## 1. OS prerequisites

The CPU backend is **compiled from source**. Without a toolchain the build fails
partway with a CMake error.

```bash
sudo apt-get update -y
sudo apt-get install -y gcc-12 g++-12 cmake libnuma-dev python3-dev libtcmalloc-minimal4
sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-12 10 \
                         --slave  /usr/bin/g++ g++ /usr/bin/g++-12
```

`libtcmalloc-minimal4` is what the service unit's `LD_PRELOAD` points at. Verify
the file exists, or every process start logs a loader error:

```bash
ls -l /usr/lib/x86_64-linux-gnu/libtcmalloc_minimal.so.4
```

## 2. A dedicated service account

Do not run inference as `ubuntu` — that account can `sudo`.

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin vllm
sudo -u vllm -H bash            # everything below runs as this user
```

## 3. Miniconda

```bash
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh
source ~/.bashrc
```

Accept the Terms of Service for **both** default channels. Accepting only
`pkgs/r` leaves `conda create` failing on `pkgs/main`:

```bash
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r
```

## 4. Environment

```bash
conda create -n vllm python=3.12 -y
conda activate vllm
```

## 5. Clone at the pinned tag

```bash
git clone --branch v0.17.1 --depth 1 https://github.com/vllm-project/vllm.git ~/vllm_source
cd ~/vllm_source
```

## 6. Install dependencies **and build**

```bash
pip install --upgrade pip
pip install -v -r requirements/cpu-build.txt --extra-index-url https://download.pytorch.org/whl/cpu
pip install -v -r requirements/cpu.txt       --extra-index-url https://download.pytorch.org/whl/cpu

# The step that actually produces the `vllm` command:
VLLM_TARGET_DEVICE=cpu pip install -e . --no-build-isolation
```

> Installing the two requirements files alone installs vLLM's **dependencies**,
> not vLLM. Skip the last line and `vllm serve` does not exist; systemd then
> fails with `status=203/EXEC`, which reads like a permissions problem.
>
> Requirement filenames move between versions — if `requirements/cpu.txt` is
> absent, check the paths in your tag's own CPU installation docs.

**Verify before going further.** This is the checkpoint the old runbook lacked:

```bash
which vllm && vllm --version
python -c "import vllm; print(vllm.__version__)"
```

## 7. Size the service

Two numbers in the unit file have to agree with the hardware.

**Memory.** `VLLM_CPU_KVCACHE_SPACE` is in GiB and is reserved *on top of* model
weights and the PyTorch runtime:

```
MemoryMax  >=  KV cache  +  model weights  +  6-8 GiB runtime headroom
```

A 20 GiB KV cache under a 24 GiB `MemoryMax` leaves ~4 GiB for everything else
and will OOM under load. Paired with `Restart=always` and no `RestartSec`, that
becomes a restart loop that saturates the box — which is why the shipped unit
uses `Restart=on-failure` with `RestartSec=15` and a start limit.

**CPU.** Bind physical cores only:

```bash
lscpu -e=CPU,CORE,SOCKET | head -20     # pick one CPU per CORE
```

`VLLM_CPU_OMP_THREADS_BIND=0-3` binds four. If you also set `CPUQuota`, the two
must not contradict each other.

## 8. Install the service

```bash
sudo cp deploy/systemd/vllm.service /etc/systemd/system/vllm.service
sudo nano /etc/systemd/system/vllm.service      # fill in every __PLACEHOLDER__
sudo systemctl daemon-reload
sudo systemctl enable --now vllm                # enable, or it is gone at reboot
systemctl status vllm
journalctl -u vllm -f
```

`enable` is not optional. The old runbook's "Enable and Start" section only ran
`daemon-reload` and `restart`, so the service did not survive a reboot.

The unit binds `127.0.0.1:8000` explicitly and sets no API key, which is safe
**only** because it is loopback-only. If you ever add `--host 0.0.0.0`, add
`--api-key` in the same edit and set the matching key on the LAILA provider —
otherwise you have published an unauthenticated inference endpoint.

Pre-download the model once so the first boot does not block on HuggingFace:

```bash
sudo -u vllm HF_HOME=/home/vllm/vllm_source/.hf \
  python -c "from huggingface_hub import snapshot_download; snapshot_download('Qwen/Qwen2.5-0.5B-Instruct')"
```

Confirm it is serving, and note the model id it reports — that is the name
LAILA has to send:

```bash
curl -s localhost:8000/v1/models | jq -r '.data[].id'
```

## 9. Register the provider in LAILA

**Without this step nothing above affects the application.** LAILA's LLM
providers are database rows, not environment variables — there is no env var
that points LAILA at vLLM.

Admin → Settings → LLM → Add Provider:

| Field | Value |
|---|---|
| Provider | **vLLM (Local)** — a first-class type, not "OpenAI-compatible" |
| Base URL | `http://localhost:8000/v1` (prefilled) |
| API key | leave blank unless you passed `--api-key` |
| Model | `default` (auto-detect) — see below |

Then set it as the default provider for the purposes you want it to serve.

### About the `default` model id

`default` is a placeholder meaning "whatever this server has loaded".
`llm.service.ts` resolves it by calling the server's own `/v1/models` and
caching the answer, so `vllm serve Qwen/Qwen2.5-0.5B-Instruct` works without any
extra configuration.

Two things worth knowing:

- The shipped unit also passes `--served-model-name default`, which makes the
  DB row independent of which model is loaded. Belt and braces; either alone is
  sufficient.
- If vLLM is unreachable you now get `PROVIDER_UNREACHABLE` naming the base URL,
  rather than a 404 from vLLM about a model called `default`. The old behaviour
  sent people to debug the model when the server was simply down.

Verify end to end with the **Test Connection** button on the provider, then send
one real message through a tutor.

## 10. About the model

`Qwen/Qwen2.5-0.5B-Instruct` is a **connectivity smoke test**, not a tutoring
model. At 0.5B parameters on CPU it will produce output that is fast to generate
and pedagogically useless — LAILA is a multi-agent tutoring platform, and this
model cannot sustain that role.

Use it to prove the pipeline works, then decide honestly:

- a larger model on CPU: expect single-digit tokens/sec, and raise
  `VLLM_CPU_KVCACHE_SPACE`, `MemoryMax` and `TimeoutStartSec` to match;
- a GPU host, which is what production tutoring workloads actually want;
- or keep a hosted provider for tutoring and use vLLM for cheap, bulk,
  latency-tolerant work.

## 11. Operating it

```bash
systemctl is-active vllm
journalctl -u vllm -n 50 --no-pager
curl -s localhost:8000/v1/models | jq -r '.data[].id'
systemctl restart vllm                     # model swap = restart
```

After swapping the model, either restart LAILA or edit and re-save the provider
— the detected model name is cached for five minutes and cleared whenever a
provider row is written.
