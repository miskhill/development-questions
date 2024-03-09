require("dotenv").config();
const http = require("http");
const Twilio = require("twilio");
const { MongoClient } = require("mongodb");
const cron = require("node-cron");

const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Function to fetch random data from MongoDB and send a message
const sendMessageWithDatabaseInfo = async () => {
  const uri = process.env.MONGO_URI;
  // Connecting to the MongoDB client without deprecated options
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db("test");
    const collection = database.collection("questions");

    // Fetch a random document from the collection using the aggregation framework
    const randomDocument = await collection
      .aggregate([{ $sample: { size: 1 } }])
      .toArray();
    if (randomDocument.length === 0) {
      throw new Error("No documents found in the collection.");
    }
    const infoToBeSent = randomDocument[0].questionText;

    // Use the Twilio client to send a message
    const message = await twilioClient.messages.create({
      to: process.env.MY_PHONE_NUMBER,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: ` ${infoToBeSent}`,
    });

    console.log("Message sent with ID:", message.sid);
  } catch (err) {
    console.error("Failed to retrieve data or send message:", err);
  } finally {
    await client.close();
  }
};

cron.schedule(
  "00 09 * * *",
  () => {
    console.log("Running a job at 09:00 every day!");
    sendMessageWithDatabaseInfo();
  },
  {
    scheduled: true,
    timezone: "Europe/London",
  }
);

const server = http.createServer((req, res) => {
  if (req.url === "/send-test-message" && req.method === "GET") {
    sendMessageWithDatabaseInfo(); // Call the sendMessageWithDatabaseInfo function when this route is accessed

    res.setHeader("Content-Type", "text/plain");
    res.end("Triggered sendMessageWithDatabaseInfo function!");
  } else {
    // Handle other routes or methods.
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(3001, "localhost", () => {
  console.log("Server listening for requests on port 3001.");
});
