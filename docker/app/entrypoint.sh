#!/usr/bin/env bash
set -euo pipefail

# This entrypoint starts sshd for intra-network SSH access from n8n,
# then execs the original app command (default: npm run server).

# Configure SSH server if present
if command -v sshd >/dev/null 2>&1; then
  mkdir -p /run/sshd

  # Create shared volume for key exchange if mounted
  SSH_VOL_DIR=${SSH_VOL_DIR:-/ssh}
  mkdir -p "$SSH_VOL_DIR"

  # Create host user for SSH access
  SSH_USER=${SSH_USER:-automation}
  SSH_UID=${SSH_UID:-1001}
  SSH_GID=${SSH_GID:-1001}
  if ! id "$SSH_USER" >/dev/null 2>&1; then
    groupadd -g "$SSH_GID" "$SSH_USER" || true
    useradd -m -u "$SSH_UID" -g "$SSH_GID" -s /bin/bash "$SSH_USER"
  fi

  # Generate client keypair on first run into shared volume (so n8n can use it)
  if [ ! -f "$SSH_VOL_DIR/id_ed25519" ]; then
    ssh-keygen -q -t ed25519 -N '' -f "$SSH_VOL_DIR/id_ed25519"
    # Make private key readable by n8n's node user (uid 1000) while keeping strict perms
    chown 1000:1000 "$SSH_VOL_DIR/id_ed25519" "$SSH_VOL_DIR/id_ed25519.pub" || true
    chmod 600 "$SSH_VOL_DIR/id_ed25519"
    chmod 644 "$SSH_VOL_DIR/id_ed25519.pub"
  fi

  # Install public key for SSH_USER
  install -d -m 700 "/home/$SSH_USER/.ssh"
  cat "$SSH_VOL_DIR/id_ed25519.pub" > "/home/$SSH_USER/.ssh/authorized_keys"
  chown -R "$SSH_USER:$SSH_USER" "/home/$SSH_USER/.ssh"
  chmod 600 "/home/$SSH_USER/.ssh/authorized_keys"

  # Minimal sshd_config tuned for container use
  cat >/etc/ssh/sshd_config <<CFG
Port 2222
Protocol 2
HostKey /etc/ssh/ssh_host_ed25519_key
HostKey /etc/ssh/ssh_host_rsa_key
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
ChallengeResponseAuthentication no
UsePAM no
AllowUsers ${SSH_USER}
Subsystem sftp /usr/lib/openssh/sftp-server
LogLevel VERBOSE
CFG

  # Generate host keys if missing
  ssh-keygen -A >/dev/null 2>&1 || true

  # Start sshd in background
  /usr/sbin/sshd -D &
fi

# Finally execute the original command
exec "$@"
