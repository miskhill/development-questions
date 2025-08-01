
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
const Push = require("pushover-notifications");

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
// Check for Pushover environment variables
console.log("PUSHOVER_USER_KEY exists:", !!process.env.PUSHOVER_USER_KEY);
console.log("PUSHOVER_APP_TOKEN exists:", !!process.env.PUSHOVER_APP_TOKEN);
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

// Global client variables
let twilioClient;
let pushoverClient;

// Initialize Twilio client
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

// Initialize Pushover client
try {
  console.log("Initializing Pushover client...");
  pushoverClient = new Push({
    user: process.env.PUSHOVER_USER_KEY,
    token: process.env.PUSHOVER_APP_TOKEN
  });
  console.log("Pushover client initialized successfully");
} catch (error) {
  console.error("Error initializing Pushover client:", error.message);
  console.error("Error stack:", error.stack);
}

// Function to fetch random data from MongoDB and send via Twilio
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

// Function to fetch random data from MongoDB and send via Pushover
const sendPushoverWithDatabaseInfo = async () => {
  const uri = process.env.MONGO_URI;
  // Connecting to the MongoDB client
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

    // Use the Pushover client to send a notification
    const msg = {
      message: infoToBeSent,
      title: "Daily Development Question",
      sound: "magic",
      priority: 0
    };

    pushoverClient.send(msg, function(err, result) {
      if (err) {
        console.error("Error sending Pushover notification:", err);
      } else {
        console.log("Pushover notification sent successfully:", result);
      }
    });

  } catch (err) {
    console.error("Failed to retrieve data or send notification:", err);
  } finally {
    await client.close();
  }
};

// Twilio cron job (commented out for now)
/*
cron.schedule(
  "17 11 * * *",
  () => {
    console.log("Running Twilio job at 11:17 every day!");
    sendMessageWithDatabaseInfo();
  },
  {
    scheduled: true,
    timezone: "Europe/London",
  }
);
*/

// Pushover cron job at 12:30
cron.schedule(
  "51 12 * * *",
  () => {
    console.log("Running Pushover notification job at 12:30 every day!");
    sendPushoverWithDatabaseInfo();
  },
  {
    scheduled: true,
    timezone: "Europe/London",
  }
);

// Create HTTP server with endpoints for both Twilio and Pushover testing
const server = http.createServer((req, res) => {
  if (req.url === "/send-test-twilio" && req.method === "GET") {
    // Call the Twilio function when this route is accessed
    sendMessageWithDatabaseInfo();
    res.setHeader("Content-Type", "text/plain");
    res.end("Triggered Twilio SMS function!");
  } 
  else if (req.url === "/send-test-pushover" && req.method === "GET") {
    // Call the Pushover function when this route is accessed
    sendPushoverWithDatabaseInfo();
    res.setHeader("Content-Type", "text/plain");
    res.end("Triggered Pushover notification function!");
  }
  else if (req.url === "/" && req.method === "GET") {
    // Simple status page
    res.setHeader("Content-Type", "text/html");
    res.end(`
      <html>
        <head><title>Notification Service</title></head>
        <body>
          <h1>Notification Service</h1>
          <p>Server is running. Available endpoints:</p>
          <ul>
            <li><a href="/send-test-pushover">Test Pushover notification</a></li>
            <li><a href="/send-test-twilio">Test Twilio SMS</a> (if configured)</li>
          </ul>
        </body>
      </html>
    `);
  } else {
    // Handle other routes or methods
    res.writeHead(404);
    res.end("Not Found");
  }
});

// Get the port from the environment variable or use 3000 as default
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening for requests on port ${PORT}.`);
});
