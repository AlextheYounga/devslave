SSH between n8n and app containers

Overview

- n8n connects to the `app` container over Docker’s internal network via SSH on port 2222.
- The app container runs `sshd` and auto-generates an ED25519 keypair on first start.
- The private key is stored in a shared named volume and mounted read-only into n8n.

What changed

- App image now includes `openssh-server` and an entrypoint that:
    - Creates user `automation` and its `authorized_keys` from `/ssh/id_ed25519.pub`.
    - Generates `/ssh/id_ed25519` if missing and chowns it to uid 1000 for n8n.
    - Starts `sshd` on port 2222 before exec’ing the original app command.
- n8n image is built with `openssh-client` and mounts the same `/ssh` volume.
- Compose defines a shared volume `ssh_shared` and ensures `n8n` depends on `app`.

How to use in n8n

- Execute Command node example:
  Command:
  ssh -i /ssh/id_ed25519 -o StrictHostKeyChecking=no -p 2222 automation@app "whoami && hostname && uname -a"

- SSH node (built-in) option:
    - Host: `app`
    - Port: `2222`
    - User: `automation`
    - Auth: `Private Key`
    - Private Key: paste contents of `/ssh/id_ed25519` (from container)

Security notes

- SSH is not published to the host; it’s only reachable within the Compose network.
- Password login is disabled; only public key auth is allowed.
- The private key is generated once and stored in a named volume; rotate by removing the `ssh_shared` volume.

Troubleshooting

- If n8n starts before the key is generated, it still works; the key is generated as soon as `app` starts. Re-run the n8n node once `app` is up.
- Verify sshd is running in `app`: `docker compose exec app bash -lc 'ss -tlpn | grep 2222'`.
- Test manually from n8n container: `ssh -i /ssh/id_ed25519 -o StrictHostKeyChecking=no -p 2222 automation@app 'echo ok'`.
