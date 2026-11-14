# Despliegue automático y alertas

## 1. Despliegue automático desde GitHub

Cada push a `master` pasa por la CI. Si todo compila y los tests pasan, el flujo
`.github/workflows/deploy.yml` entra por SSH al VPS y ejecuta `deploy/deploy.sh`.

La llave que usa GitHub está **limitada**: en el VPS solo puede ejecutar el despliegue,
no abrir una terminal ni hacer nada más.

### En tu PC (Git Bash o PowerShell)

```bash
ssh-keygen -t ed25519 -f massup_deploy -N "" -C "github-deploy-massup"
```

Crea `massup_deploy` (privada) y `massup_deploy.pub` (pública).

### En el VPS, como usuario `massup`

Añade la llave pública a `~/.ssh/authorized_keys` **con la restricción delante**, en una sola línea:

```
command="cd ~/massup && bash deploy/deploy.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA...(contenido de massup_deploy.pub)... github-deploy-massup
```

### En GitHub

Repositorio → Settings → Secrets and variables → Actions → New repository secret:

| Secreto           | Valor                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| `VPS_HOST`        | IP o dominio del VPS                                                   |
| `VPS_USER`        | `massup`                                                               |
| `VPS_SSH_KEY`     | contenido completo de `massup_deploy` (la privada)                     |
| `VPS_KNOWN_HOSTS` | salida de `ssh-keyscan -t ed25519 <IP del VPS>` ejecutado desde tu PC   |

Después borra `massup_deploy` de tu PC (GitHub ya la guarda cifrada).

Para probarlo sin hacer push: GitHub → Actions → Despliegue → Run workflow.

Sin estos secretos el flujo se salta sin fallar, y puedes seguir desplegando a mano con
`bash deploy/deploy.sh`.

## 2. Alertas de errores en Discord

1. En tu servidor de Discord, crea un canal privado (p. ej. `#alertas-massup`).
2. Ajustes del canal → Integraciones → Webhooks → Nuevo webhook → Copiar URL.
3. En el `.env` del VPS añade `ALERT_WEBHOOK_URL=<esa URL>` y redespliega.

Llegará un aviso cada vez que el bot arranque (si no lo reiniciaste tú, es que se cayó) y
cuando haya errores en comandos, en el panel, en los pagos o en la conexión con Discord.

## 3. Monitor de caídas

`https://panel.massup.shop/health` responde 200 si el bot está conectado a Discord y 503 si no.
Crea un monitor HTTP gratuito en UptimeRobot (o Better Stack) con esa URL cada 5 minutos.
