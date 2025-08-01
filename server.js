
try {
  require("dotenv").config();
  console.log("Dotenv config loaded");
} catch (err) {
  console.error("Error loading dotenv:", err.message);
}

const http = require("http");
const Twilio = require("twilio");
const { MongoClient } = require("mongodb");
const cron = require("node-cron");

// Log the entire process.env object keys (no values for security)
console.log("Available environment variables:", Object.keys(process.env));
console.log("Total number of environment variables:", Object.keys(process.env).length);

// Add detailed logging for environment variables
console.log("Environment Variables Check:");
console.log("TWILIO_ACCOUNT_SID exists:", !!process.env.TWILIO_ACCOUNT_SID);
console.log("TWILIO_AUTH_TOKEN exists:", !!process.env.TWILIO_AUTH_TOKEN);
console.log("MONGO_URI exists:", !!process.env.MONGO_URI);
console.log("MY_PHONE_NUMBER exists:", !!process.env.MY_PHONE_NUMBER);
console.log("TWILIO_PHONE_NUMBER exists:", !!process.env.TWILIO_PHONE_NUMBER);
// Check for a test environment variable
console.log("TEST_VARIABLE exists:", !!process.env.TEST_VARIABLE);
if (process.env.TEST_VARIABLE) {
  console.log("TEST_VARIABLE value:", process.env.TEST_VARIABLE);
}

// Log the first few characters of each variable (for security)
if (process.env.TWILIO_ACCOUNT_SID) {
  console.log("TWILIO_ACCOUNT_SID starts with:", process.env.TWILIO_ACCOUNT_SID.substring(0, 5) + "...");
}
if (process.env.TWILIO_AUTH_TOKEN) {
  console.log("TWILIO_AUTH_TOKEN starts with:", process.env.TWILIO_AUTH_TOKEN.substring(0, 3) + "...");
}

// Global twilioClient variable
let twilioClient;

try {
  console.log("Initializing Twilio client...");
  twilioClient = new Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  console.log("Twilio client initialized successfully");
} catch (error) {
  console.error("Error initializing Twilio client:", error.message);
  console.error("Error stack:", error.stack);
}

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
  "00 11 * * *",
  () => {
    console.log("Running a job at 09:30 every day!");
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
    // Handle other routes or methods
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(3001, "0.0.0.0", () => {
  console.log("Server listening for requests on port 3001.");
});
