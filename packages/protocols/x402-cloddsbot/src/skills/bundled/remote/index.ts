/**
 * Remote CLI Skill
 *
 * Commands:
 * /remote status - Show active tunnels
 * /remote ssh <host> - Create SSH tunnel
 * /remote ngrok <port> - Start ngrok tunnel
 * /remote cloudflare <port> - Start Cloudflare tunnel
 * /remote stop <id> - Stop tunnel
 * /remote stop-all - Stop all tunnels
 */

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'help';

  try {
    const { tunnels } = await import('../../../remote/index');

    switch (cmd) {
      case 'status':
      case 'list':
      case 'ls': {
        const allTunnels = tunnels.list();
        if (allTunnels.length === 0) {
          return '**Active Tunnels**\n\nNo active tunnels.';
        }

        let output = '**Active Tunnels**\n\n| ID | Type | Local Port | Public URL | Status | Started |\n|-----|------|------------|------------|--------|----------|\n';
        for (const t of allTunnels) {
          const elapsed = Math.round((Date.now() - t.startedAt.getTime()) / 1000);
          const duration = elapsed < 60 ? `${elapsed}s` : `${Math.round(elapsed / 60)}m`;
          output += `| ${t.id} | ${t.type} | ${t.localPort} | ${t.publicUrl || 'N/A'} | ${t.status} | ${duration} ago |\n`;
        }

        const active = tunnels.getActive();
        output += `\n**${active.length}** connected, **${allTunnels.length}** total`;
        return output;
      }

      case 'ssh': {
        if (!parts[1]) {
          return 'Usage: /remote ssh <sshHost> --local <port> --remote-host <host> --remote-port <port>\n\nExample: /remote ssh user@server --local 8080 --remote-host localhost --remote-port 3000';
        }

        const sshHost = parts[1];
        const localPort = parseInt(getFlag(parts, '--local') || getFlag(parts, '--port') || '8080', 10);
        if (isNaN(localPort)) return 'Local port must be a number.';
        const remoteHost = getFlag(parts, '--remote-host') || 'localhost';
        const remotePort = parseInt(getFlag(parts, '--remote-port') || '80', 10);
        if (isNaN(remotePort)) return 'Remote port must be a number.';
        const sshUser = getFlag(parts, '--user');
        const sshKey = getFlag(parts, '--key');

        const tunnel = await tunnels.createSshTunnel({
          localPort,
          remoteHost,
          remotePort,
          sshHost,
          sshUser: sshUser || undefined,
          sshKey: sshKey || undefined,
        });

        return `**SSH Tunnel Created**\n\nID: ${tunnel.id}\nLocal: localhost:${tunnel.localPort}\nRemote: ${remoteHost}:${remotePort}\nSSH Host: ${sshHost}\nStatus: ${tunnel.status}\nPublic URL: ${tunnel.publicUrl || 'N/A'}`;
      }

      case 'ngrok': {
        if (!parts[1]) {
          return 'Usage: /remote ngrok <port> [--subdomain <name>] [--region <region>]\n\nExample: /remote ngrok 3000 --subdomain myapp';
        }

        const localPort = parseInt(parts[1], 10);
        if (isNaN(localPort)) {
          return 'Port must be a number. Usage: /remote ngrok <port>';
        }

        const subdomain = getFlag(parts, '--subdomain');
        const region = getFlag(parts, '--region');
        const authToken = getFlag(parts, '--token');

        const tunnel = await tunnels.createNgrokTunnel({
          localPort,
          authToken: authToken || undefined,
          subdomain: subdomain || undefined,
          region: region || undefined,
        });

        return `**ngrok Tunnel Created**\n\nID: ${tunnel.id}\nLocal: localhost:${localPort}\nPublic URL: ${tunnel.publicUrl || 'pending...'}\nStatus: ${tunnel.status}`;
      }

      case 'cloudflare':
      case 'cf': {
        if (!parts[1]) {
          return 'Usage: /remote cloudflare <port> [--hostname <domain>]\n\nExample: /remote cloudflare 3000';
        }

        const localPort = parseInt(parts[1], 10);
        if (isNaN(localPort)) {
          return 'Port must be a number. Usage: /remote cloudflare <port>';
        }

        const hostname = getFlag(parts, '--hostname');

        const tunnel = await tunnels.createCloudflareTunnel({
          localPort,
          hostname: hostname || undefined,
        });

        return `**Cloudflare Tunnel Created**\n\nID: ${tunnel.id}\nLocal: localhost:${localPort}\nPublic URL: ${tunnel.publicUrl || 'pending...'}\nStatus: ${tunnel.status}`;
      }

      case 'stop':
      case 'close': {
        if (!parts[1]) {
          return 'Usage: /remote stop <tunnel-id>\n\nUse `/remote status` to see tunnel IDs.';
        }
        const id = parts[1];
        const tunnel = tunnels.get(id);
        if (!tunnel) {
          return `Tunnel \`${id}\` not found. Use \`/remote status\` to see active tunnels.`;
        }
        tunnels.close(id);
        return `Tunnel \`${id}\` (${tunnel.type}, port ${tunnel.localPort}) stopped.`;
      }

      case 'stop-all':
      case 'close-all': {
        const count = tunnels.list().length;
        tunnels.closeAll();
        return count > 0
          ? `Closed **${count}** tunnel(s).`
          : 'No active tunnels to close.';
      }

      default:
        return helpText();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // If it's a known operational error (not an import failure), show it
    if (msg.includes('not installed') || msg.includes('failed to start')) {
      return `**Error:** ${msg}`;
    }
    return helpText();
  }
}

/** Extract --flag value from args array */
function getFlag(parts: string[], flag: string): string | null {
  const idx = parts.indexOf(flag);
  if (idx !== -1 && idx + 1 < parts.length) {
    return parts[idx + 1];
  }
  return null;
}

function helpText(): string {
  return `**Remote Access Commands**

  /remote status                         - Show active tunnels
  /remote ssh <host> [--local <port>]    - Create SSH tunnel
  /remote ngrok <port>                   - Start ngrok tunnel
  /remote cloudflare <port>              - Start Cloudflare tunnel
  /remote stop <id>                      - Stop a tunnel
  /remote stop-all                       - Stop all tunnels

**SSH example:** /remote ssh user@server --local 8080 --remote-host localhost --remote-port 3000
**ngrok example:** /remote ngrok 3000 --subdomain myapp`;
}

export default {
  name: 'remote',
  description: 'SSH tunnels, ngrok, and remote access management',
  commands: ['/remote', '/tunnel'],
  handle: execute,
};
