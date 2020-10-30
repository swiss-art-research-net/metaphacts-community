const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3001');

const onFailedToConnect = () => {
  clearTimeout(timeoutHandle);
  ws.close();
  console.log('Webpack server failed to respond. Is a webpack server running?');
};
// set connect timeout to 5 second
const timeoutHandle = setTimeout(onFailedToConnect, 5000);

ws.on('error', onFailedToConnect);
ws.on('open', () => {
  // socket connected successfully, clear the timer
  clearTimeout(timeoutHandle);
  ws.send('stop');
  ws.close();
  setTimeout(() => process.exit(0), 1000);
});
