require('dotenv').config();
const http = require('http');
const Twilio = require('twilio');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');

const twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
// const sendMessage = () => {
//   // Fetch information from MongoDB and send a message
//   // You'll need to implement the logic to retrieve data from your collection
//   const infoToBeSent = '...'; // Placeholder for actual info from MongoDB
//   // Send a message
//   twilioClient.messages.create({
//     to: process.env.MY_PHONE_NUMBER,
//     from: process.env.TWILIO_PHONE_NUMBER,
//     body: `Here is your daily update: ${infoToBeSent}`,
//   })
//     .then((message) => console.log(message.sid))
//     .catch((error) => console.error(error));
// };


// Function to fetch data from MongoDB and send a message
const sendMessageWithDatabaseInfo = async () => {
  const uri = process.env.MONGO_URI;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await client.connect();
    const database = client.db('test');
    const collection = database.collection('questions');
    
    // Fetch the document containing the information
    const document = await collection.findOne({});
    const infoToBeSent = document.questionText; 

    // Use the Twilio client to send a message
    const message = await twilioClient.messages.create({
      to: process.env.MY_PHONE_NUMBER,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: `Here is your daily update: ${infoToBeSent}`,
    });

    console.log('Message sent with ID:', message.sid);
  } catch (err) {
    console.error('Failed to retrieve data or send message:', err);
  } finally {
    await client.close();
  }
};

cron.schedule('45 20 * * *', () => {
  console.log('Running a job at 09:00 every day!');
  sendMessageWithDatabaseInfo();
}, {
  scheduled: true,
  timezone: "Europe/London",
});

const server = http.createServer((req, res) => {
  if (req.url === '/send-test-message' && req.method === 'GET') {
    sendMessageWithDatabaseInfo();  // Call the sendMessage function when this route is accessed
    
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
  

