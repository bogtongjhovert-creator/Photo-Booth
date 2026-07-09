import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Create HTTP server to attach both Express and WebSockets
  const server = http.createServer(app);

  // Initialize WebSocket Server
  const wss = new WebSocketServer({ server });

  // Event-specific simulated camera roll (high-res Unsplash photos)
  const cameraRolls: Record<string, string[]> = {
    wedding: [
      'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1519225495810-7512c696505a?w=800&auto=format&fit=crop&q=80'
    ],
    birthday: [
      'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80'
    ],
    default: [
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&auto=format&fit=crop&q=80'
    ]
  };

  // Live hardware state tracking
  let stats = {
    cameraConnected: true,
    cameraModel: 'Canon EOS R5',
    cameraBattery: 88,
    printerConnected: true,
    printerModel: 'DNP DS620 (USB)',
    printerStatus: 'Idle Ready',
    storageUsage: '1.4 GB',
    totalPrints: 145,
    totalEmails: 98,
    devMode: false
  };

  wss.on('connection', (ws: WebSocket) => {
    console.log('Companion Server: Client connected via WebSocket.');

    // Sync current hardware status immediately
    ws.send(JSON.stringify({
      type: 'status:sync',
      status: stats
    }));

    ws.on('message', (message: string) => {
      try {
        const payload = JSON.parse(message);
        console.log(`Companion Server received event: ${payload.type}`);

        if (payload.type === 'shutter:trigger') {
          // DSLR capture command!
          const step = payload.step || 1;
          const eventId = payload.event || '';

          // Match image theme
          let roll = cameraRolls.default;
          if (eventId.includes('wedding')) roll = cameraRolls.wedding;
          if (eventId.includes('birthday')) roll = cameraRolls.birthday;

          const imageUrl = roll[(step - 1) % roll.length];

          // Simulate shutter processing delay
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'dslr:captured',
              step,
              imageUrl
            }));
            console.log(`DSLR capture step ${step} dispatched back to kiosk: ${imageUrl}`);
          }, 1500);

        } else if (payload.type === 'email:send') {
          // Send Email command
          console.log(`[SMTP SPOOL] Dispatched photostrip mail to: ${payload.email}`);
          stats.totalEmails += 1;

          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'email:sent', email: payload.email }));
          }, 1000);

        } else if (payload.type === 'print:send') {
          // Print command
          const copies = payload.copies || 1;
          console.log(`[PRINTER QUEUE] Enqueued job: ${copies}x copies on ${payload.printer || 'DNP DS620'}`);
          stats.totalPrints += copies;

          // Broadcast updated status with new counters
          ws.send(JSON.stringify({
            type: 'status:sync',
            status: stats
          }));
        } else if (payload.type === 'camera:test') {
          console.log('[CALIBRATION] Executed hardware shutter test beep.');
        }

      } catch (err) {
        console.error('WebSocket payload parsing failed:', err);
      }
    });

    ws.on('close', () => {
      console.log('Companion Server: Client connection closed.');
    });
  });

  // Health API route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', companion: 'online', stats });
  });

  // Mount Vite development middleware or static production dist folder
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Photobooth Pro Companion Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
