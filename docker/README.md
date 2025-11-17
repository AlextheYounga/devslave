# n8n with PostgreSQL and Worker

Starts n8n with PostgreSQL as database, and the Worker as a separate container.

## Start

To start n8n simply start docker-compose by executing the following
command in the current folder.

**IMPORTANT:** But before you do that change the default users and passwords in the [`.env`](.env) file!

```
docker-compose up -d
```

To stop it execute:

```
docker-compose stop
```

## Environment Configuration

### Host Machine (`.env`)

The root `.env` file is used when running the application on your **host machine**. This file should have:

- `MACHINE_CONTEXT=host`
- Local paths and URLs (e.g., `http://localhost:3000`)

### Docker Container (`.env.docker`)

Create a `.env.docker` file (copy from `.env.docker.example`) for the **Docker container environment**. This file should have:

- `MACHINE_CONTEXT=docker`
- Container-internal paths and service names (e.g., `http://n8n:5678`, `/app/api`)

The entrypoint script automatically uses `.env.docker` if it exists, falling back to `.env` otherwise.

## Configuration

The default name of the database, user and password for PostgreSQL can be changed in the [`.env`](.env) file in the current directory.

## Codex Login

Run `docker/codex-login.sh` to do a port forwarding of the url that codex spins up on the server.
