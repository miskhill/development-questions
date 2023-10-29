const http = require('http');

const server = http.createServer((req, res) => {
  console.log('request made');
  res.setHeader('Content-Type', 'text/plain');
  res.write('Twilio!');


  res.end();
});

server.listen(3001, 'localhost', () => {
  console.log('listening for requests on port 3001');
});
  

