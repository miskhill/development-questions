require('dotenv').config();
const http = require('http');
const Twilio = require('twilio');

const twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const sendMessage = () => {
  // Fetch information from MongoDB and send a message
  // You'll need to implement the logic to retrieve data from your collection
  const infoToBeSent = '...'; // Placeholder for actual info from MongoDB
  // Send a message
  twilioClient.messages.create({
    to: process.env.MY_PHONE_NUMBER,
    from: process.env.TWILIO_PHONE_NUMBER,
    body: `Here is your daily update: ${infoToBeSent}`,
  })
    .then((message) => console.log(message.sid))
    .catch((error) => console.error(error));
};

const server = http.createServer((req, res) => {
  if (req.url === '/send-test-message' && req.method === 'GET') {
    sendMessage();  // Call the sendMessage function when this route is accessed
    
    res.setHeader('Content-Type', 'text/plain');
    res.end('Triggered sendMessage function!');
  } else {
    // Handle other routes or methods
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(3001, 'localhost', () => {
  console.log('listening for requests on port 3001!');
});
  

