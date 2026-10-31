const socks = require('socksv5');
const net = require('net');

class ProxyServer {
  constructor(port = 1080, host = '0.0.0.0') {
    this.port = port;
    this.host = host;
    this.server = null;
    this.connections = new Set();
    this.onLog = null; // callback para enviar logs ao main.js
  }

  log(msg) {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log(line);
    if (this.onLog) this.onLog(line);
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = socks.createServer((info, accept, deny) => {
        const dst = `${info.dstAddr}:${info.dstPort}`;
        this.log(`Conexão → ${dst} (${info.srcAddr}:${info.srcPort})`);

        const socket = accept();
        if (!socket) {
          this.log(`❌ Negado: ${dst}`);
          deny();
          return;
        }

        // Tunneling TCP real
        const remote = net.createConnection(
          { host: info.dstAddr, port: info.dstPort },
          () => {
            this.log(`✅ Conectado → ${dst}`);
            socket.pipe(remote);
            remote.pipe(socket);
          }
        );

        remote.on('error', (err) => {
          this.log(`❌ Erro em ${dst}: ${err.message}`);
          socket.end();
        });

        socket.on('error', (err) => {
          this.log(`❌ Erro socket ${dst}: ${err.message}`);
          remote.end();
        });

        this.connections.add(socket);
        socket.on('close', () => this.connections.delete(socket));
      });

      this.server.useAuth(socks.auth.None());

      this.server.listen(this.port, this.host, () => {
        this.log(`🟢 Proxy SOCKS5 ouvindo em ${this.host}:${this.port}`);
        resolve();
      });

      this.server.on('error', (err) => {
        this.log(`🔴 Erro do servidor: ${err.message}`);
        reject(err);
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.connections.forEach((c) => c.destroy());
      this.connections.clear();
      this.server.close(() => {
        try {
          this.log('🔴 Proxy parado');
        } catch (e) {
          // ignora erro de log durante shutdown
        }
        this.server = null;
        resolve();
      });
    });
  }
}

module.exports = ProxyServer;
