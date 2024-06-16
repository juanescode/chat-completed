// index.js
import express from 'express';
import morgan from 'morgan';
import { PORT } from './config.js';
import { pool } from './db.js';
import { Server } from 'socket.io';
import { createServer } from 'node:http';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {},
});

pool.getConnection()
  .then(connection => {
    console.log('Database connected');
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to database', err);
  });

io.on('connection', (socket) => {
  console.log('User connected');

  // Enviar todos los mensajes almacenados cuando un cliente se conecta
  socket.on('request messages', async () => {
    try {
      const [messages] = await pool.query('SELECT * FROM messages');
      // Enviar todos los mensajes al cliente
      socket.emit('all messages', messages);
    } catch (error) {
      console.error('Error retrieving messages:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });

  socket.on('chat message', async (msg) => {
    try {
      const [result] = await pool.query(
        'INSERT INTO messages (content) VALUES (?)', 
        [msg]
      );
      // Emitir mensaje a todos los clientes con el nuevo ID
      io.emit('chat message', msg, result.insertId);
    } catch (error) {
      console.error('Error inserting message:', error);
    }
  });

  socket.on('recover messages', async (lastMessageId) => {
    try {
      const [results] = await pool.query(
        'SELECT * FROM messages WHERE id > ?', 
        [lastMessageId]
      );
      // Envía los mensajes recuperados al cliente
      results.forEach(message => {
        socket.emit('chat message', message.content, message.id);
      });
    } catch (error) {
      console.error('Error recovering messages:', error);
    }
  });
});

app.use(morgan('dev'));
app.use(express.static('client')); // Sirve archivos estáticos desde la carpeta "client"

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html');
});

server.listen(PORT, () => {
  console.log('Server is running on port', PORT);
});
