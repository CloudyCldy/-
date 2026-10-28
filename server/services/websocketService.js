const WebSocket = require('ws');
const signature = require('cookie-signature');

class WebSocketHub {
  constructor() {
    this.userSockets = new Map(); // userId -> Set<WebSocket>
    this.orgUsers = new Map();    // orgId -> Set<userId> (online users)
    this.callClients = new Map(); // userId -> WebSocket (backward compatibility for calls)
    this.offlineTimeouts = new Map(); // userId -> timeoutId
    this.wss = null;
    this.database = null;
  }

  init(server, app, database) {
    this.database = database;
    this.wss = new WebSocket.Server({ server });
    app.locals.wsHub = this;

    this.wss.on('connection', async (socket, request) => {
      try {
        const session = await this.resolveSession(request);
        if (!session || !session.user?.id) {
          socket.close(1008, 'Sesión requerida');
          return;
        }

        const user = session.user;
        const userId = Number(user.id);
        const orgId = Number(user.organization_id);

        socket.userId = userId;
        socket.organizationId = orgId;
        socket.userName = user.name || user.username || 'Usuario';
        socket.isAlive = true;

        // Cancel any pending offline timeout for this user (e.g. quick refresh)
        if (this.offlineTimeouts.has(userId)) {
          clearTimeout(this.offlineTimeouts.get(userId));
          this.offlineTimeouts.delete(userId);
        }

        // Register socket
        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, new Set());
        }
        const userSocketSet = this.userSockets.get(userId);
        const wasOffline = userSocketSet.size === 0;
        userSocketSet.add(socket);

        // Register organization presence
        if (!this.orgUsers.has(orgId)) {
          this.orgUsers.set(orgId, new Set());
        }
        this.orgUsers.get(orgId).add(userId);

        // Call client backward compatibility
        this.callClients.set(userId, socket);

        // If user just came online, notify organization and update DB
        if (wasOffline) {
          this.broadcastToOrganization(orgId, {
            type: 'presence:update',
            userId,
            status: 'online'
          }, userId);

          // Update last_seen_at in DB
          if (this.database?.prepare) {
            this.database.prepare('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId).catch?.(() => {});
          }
        }

        // Send connection ack with current online users list in org
        const onlineUsersInOrg = Array.from(this.orgUsers.get(orgId) || []);
        socket.send(JSON.stringify({
          type: 'connected',
          userId,
          onlineUsers: onlineUsersInOrg
        }));

        // Handle messages
        socket.on('message', raw => {
          this.handleSocketMessage(socket, raw);
        });

        socket.on('pong', () => {
          socket.isAlive = true;
        });

        socket.on('close', () => {
          this.handleSocketClose(socket);
        });

        socket.on('error', () => {
          this.handleSocketClose(socket);
        });
      } catch (err) {
        try { socket.close(1011, 'Error al inicializar conexión'); } catch {}
      }
    });

    // Heartbeat to prune dead sockets
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      for (const client of this.wss.clients) {
        if (!client.isAlive) {
          client.terminate();
          continue;
        }
        client.isAlive = false;
        try { client.ping(); } catch {}
      }
    }, 30000);
    this.heartbeatInterval.unref();

    return this;
  }

  async resolveSession(request) {
    // 1. Check cookies
    const cookieHeader = request.headers.cookie;
    let sessionId = null;
    if (cookieHeader) {
      const rawCookie = cookieHeader
        .split(';')
        .map(item => item.trim())
        .find(item => item.startsWith('connect.sid='))
        ?.split('=')
        .slice(1)
        .join('=');

      if (rawCookie && rawCookie.startsWith('s:')) {
        const secret = process.env.SESSION_SECRET || 'change-this-secret';
        sessionId = signature.unsign(decodeURIComponent(rawCookie.slice(2)), secret);
      }
    }

    // 2. Query param or header fallback (helpful for tests / tokens)
    if (!sessionId) {
      try {
        const url = new URL(request.url, 'http://127.0.0.1');
        sessionId = url.searchParams.get('sessionId') || url.searchParams.get('token');
      } catch {}
    }

    if (!sessionId && process.env.NODE_ENV === 'test') {
      try {
        const url = new URL(request.url, 'http://127.0.0.1');
        const testUserId = url.searchParams.get('userId') || request.headers['x-test-user-id'];
        if (testUserId) {
          return {
            user: {
              id: Number(testUserId),
              organization_id: Number(url.searchParams.get('orgId') || 1),
              name: `Test User ${testUserId}`,
              role: 'member'
            }
          };
        }
      } catch {}
    }

    if (!sessionId) return null;

    // Fetch session from PostgreSQL pool or database abstraction
    try {
      if (this.database?.pool?.query) {
        const result = await this.database.pool.query('SELECT sess FROM user_sessions WHERE sid = $1', [sessionId]);
        if (result.rows?.[0]?.sess) {
          return typeof result.rows[0].sess === 'string'
            ? JSON.parse(result.rows[0].sess)
            : result.rows[0].sess;
        }
      }
    } catch {}

    return null;
  }

  handleSocketMessage(socket, raw) {
    try {
      const message = JSON.parse(raw.toString());
      const { type } = message;

      // Heartbeat ping
      if (type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', time: Date.now() }));
        return;
      }

      // Backward compatible WebRTC call signaling
      if (type === 'register') {
        // Already registered on connection
        return;
      }
      if (['offer', 'answer', 'ice', 'hangup'].includes(type)) {
        const recipientSockets = this.userSockets.get(Number(message.to));
        if (recipientSockets) {
          for (const s of recipientSockets) {
            if (s.readyState === WebSocket.OPEN) {
              s.send(JSON.stringify({ ...message, from: socket.userId }));
            }
          }
        } else if (type === 'offer' && this.database?.prepare) {
          this.database.prepare('UPDATE calls SET status = ? WHERE id = ? AND status = ?')
            .run('missed', message.callId, 'initiated')
            .catch?.(() => {});
        }
        return;
      }

      // Real-time typing indicators
      if (type === 'typing:start' || type === 'typing:stop') {
        const { conversationType, targetId } = message;
        if (!conversationType || !targetId) return;

        if (conversationType === 'direct') {
          this.broadcastToUser(socket.organizationId, Number(targetId), {
            type,
            conversationType: 'direct',
            senderId: socket.userId,
            senderName: socket.userName
          });
        } else if (conversationType === 'group') {
          this.broadcastToGroup(socket.organizationId, Number(targetId), {
            type,
            conversationType: 'group',
            groupId: Number(targetId),
            senderId: socket.userId,
            senderName: socket.userName
          }, socket.userId);
        }
        return;
      }

      // Real-time read receipt acknowledgement
      if (type === 'message:read') {
        const { conversationType, targetId, messageIds } = message;
        if (conversationType === 'direct') {
          this.broadcastToUser(socket.organizationId, Number(targetId), {
            type: 'message:read',
            conversationType: 'direct',
            readerId: socket.userId,
            messageIds: messageIds || []
          });
        } else if (conversationType === 'group') {
          this.broadcastToGroup(socket.organizationId, Number(targetId), {
            type: 'message:read',
            conversationType: 'group',
            groupId: Number(targetId),
            readerId: socket.userId,
            messageIds: messageIds || []
          }, socket.userId);
        }
      }
    } catch {}
  }

  handleSocketClose(socket) {
    const userId = socket.userId;
    const orgId = socket.organizationId;
    if (!userId) return;

    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socket);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
        if (this.callClients.get(userId) === socket) {
          this.callClients.delete(userId);
        }

        // Set short grace period before broadcasting offline to prevent blink on page refresh
        const timeout = setTimeout(() => {
          this.offlineTimeouts.delete(userId);
          const orgSet = this.orgUsers.get(orgId);
          if (orgSet) {
            orgSet.delete(userId);
            if (orgSet.size === 0) this.orgUsers.delete(orgId);
          }

          const lastSeen = new Date().toISOString();
          this.broadcastToOrganization(orgId, {
            type: 'presence:update',
            userId,
            status: 'offline',
            last_seen_at: lastSeen
          });

          if (this.database?.prepare) {
            this.database.prepare('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId).catch?.(() => {});
          }
        }, 3000);

        this.offlineTimeouts.set(userId, timeout);
      }
    }
  }

  isUserOnline(userId) {
    const sockets = this.userSockets.get(Number(userId));
    if (!sockets || sockets.size === 0) return false;
    for (const s of sockets) {
      if (s.readyState === WebSocket.OPEN) return true;
    }
    return false;
  }

  getOnlineUsers(organizationId) {
    const orgSet = this.orgUsers.get(Number(organizationId));
    if (!orgSet) return [];
    return Array.from(orgSet).filter(uid => this.isUserOnline(uid));
  }

  broadcastToUser(organizationId, userId, payload) {
    const sockets = this.userSockets.get(Number(userId));
    if (!sockets) return;
    const data = JSON.stringify(payload);
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN && socket.organizationId === Number(organizationId)) {
        try { socket.send(data); } catch {}
      }
    }
  }

  async broadcastToGroup(organizationId, groupId, payload, excludeUserId = null) {
    try {
      if (!this.database?.prepare) return;
      const members = await this.database.prepare(
        'SELECT user_id FROM chat_group_members WHERE group_id = ? AND organization_id = ?'
      ).all(Number(groupId), Number(organizationId));

      const data = JSON.stringify(payload);
      for (const m of members) {
        if (excludeUserId && m.user_id === Number(excludeUserId)) continue;
        const sockets = this.userSockets.get(Number(m.user_id));
        if (sockets) {
          for (const socket of sockets) {
            if (socket.readyState === WebSocket.OPEN && socket.organizationId === Number(organizationId)) {
              try { socket.send(data); } catch {}
            }
          }
        }
      }
    } catch {}
  }

  broadcastToOrganization(organizationId, payload, excludeUserId = null) {
    const orgSet = this.orgUsers.get(Number(organizationId));
    if (!orgSet) return;
    const data = JSON.stringify(payload);
    for (const uid of orgSet) {
      if (excludeUserId && uid === Number(excludeUserId)) continue;
      const sockets = this.userSockets.get(uid);
      if (sockets) {
        for (const socket of sockets) {
          if (socket.readyState === WebSocket.OPEN && socket.organizationId === Number(organizationId)) {
            try { socket.send(data); } catch {}
          }
        }
      }
    }
  }
}

const wsHub = new WebSocketHub();
module.exports = wsHub;
