import http from 'http';
import app from '..';

const port = Number(process.env.PORT || 3000);
const server = http.createServer(app);
const handleListening = () => {
  console.log(`Starting at http://localhost:${port}`);
};
const handleError = (error: Error) => {
  console.error(`${error.message}`);
};

server.listen(port);
server.on('listening', handleListening);
server.on('error', handleError);
