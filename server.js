
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
console.log("MONGO_URI exists:", !!process.env.MONGO_URI);

// Check for Pushover environment variables with detailed logging
console.log("\n=== PUSHOVER CONFIGURATION ====");
console.log("PUSHOVER_USER_KEY exists:", !!process.env.PUSHOVER_USER_KEY);
console.log("PUSHOVER_APP_TOKEN exists:", !!process.env.PUSHOVER_APP_TOKEN);

// Log partial values of Pushover credentials for debugging (safely)
if (process.env.PUSHOVER_USER_KEY) {
  const userKey = process.env.PUSHOVER_USER_KEY;
  console.log("PUSHOVER_USER_KEY length:", userKey.length);
  console.log("PUSHOVER_USER_KEY first 3 chars:", userKey.substring(0, 3) + "...");
  console.log("PUSHOVER_USER_KEY last 3 chars:", "..." + userKey.substring(userKey.length - 3));
}

if (process.env.PUSHOVER_APP_TOKEN) {
  const appToken = process.env.PUSHOVER_APP_TOKEN;
  console.log("PUSHOVER_APP_TOKEN length:", appToken.length);
  console.log("PUSHOVER_APP_TOKEN first 3 chars:", appToken.substring(0, 3) + "...");
  console.log("PUSHOVER_APP_TOKEN last 3 chars:", "..." + appToken.substring(appToken.length - 3));
}

// Check for a test environment variable
console.log("\nTEST_VARIABLE exists:", !!process.env.TEST_VARIABLE);
if (process.env.TEST_VARIABLE) {
  console.log("TEST_VARIABLE value:", process.env.TEST_VARIABLE);
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
  
  // Validate Pushover credentials before initializing
  if (!process.env.PUSHOVER_USER_KEY) {
    throw new Error("PUSHOVER_USER_KEY is missing or empty");
  }
  
  if (!process.env.PUSHOVER_APP_TOKEN) {
    throw new Error("PUSHOVER_APP_TOKEN is missing or empty");
  }
  
  // Log validation checks
  console.log("Pushover credentials validation passed");
  
  // Initialize the client
  pushoverClient = new Push({
    user: process.env.PUSHOVER_USER_KEY,
    token: process.env.PUSHOVER_APP_TOKEN
  });
  
  console.log("Pushover client initialized successfully");
} catch (error) {
  console.error("ERROR INITIALIZING PUSHOVER CLIENT:", error.message);
  console.error("Error stack:", error.stack);
  console.error("Pushover notifications will not work until this is resolved");
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
  console.log("\n=== STARTING PUSHOVER NOTIFICATION PROCESS ===");
  
  // Check if Pushover client is initialized
  if (!pushoverClient) {
    console.error("ERROR: Pushover client is not initialized. Cannot send notification.");
    return;
  }
  
  // Verify MongoDB URI exists
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("ERROR: MONGO_URI is missing or empty. Cannot connect to database.");
    return;
  }
  
  console.log("Connecting to MongoDB...");
  // Connecting to the MongoDB client
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Successfully connected to MongoDB");
    
    const database = client.db("test");
    const collection = database.collection("questions");

    console.log("Fetching random question from database...");
    // Fetch a random document from the collection using the aggregation framework
    const randomDocument = await collection
      .aggregate([{ $sample: { size: 1 } }])
      .toArray();
      
    if (randomDocument.length === 0) {
      throw new Error("No documents found in the collection.");
    }
    
    const infoToBeSent = randomDocument[0].questionText;
    console.log("Successfully retrieved question from database");
    console.log("Question length:", infoToBeSent.length, "characters");

    // Use the Pushover client to send a notification
    const msg = {
      message: infoToBeSent,
      title: "Daily Development Question",
      sound: "magic",
      priority: 0
    };

    console.log("Sending Pushover notification...");
    console.log("Notification details:", {
      title: msg.title,
      messageLength: msg.message.length,
      sound: msg.sound,
      priority: msg.priority
    });
    
    // Print Pushover credentials being used (safely)
    console.log("Using Pushover credentials:");
    if (process.env.PUSHOVER_USER_KEY) {
      const userKey = process.env.PUSHOVER_USER_KEY;
      console.log("- User key (first/last 3 chars):", 
        userKey.substring(0, 3) + "..." + userKey.substring(userKey.length - 3));
    }
    
    pushoverClient.send(msg, function(err, result) {
      if (err) {
        console.error("\n!!! ERROR SENDING PUSHOVER NOTIFICATION !!!");
        console.error("Error details:", err);
        if (err.stack) {
          console.error("Error stack:", err.stack);
        }
        
        // Try to provide more helpful error information
        if (err.message && err.message.includes("user identifier is not a valid")) {
          console.error("\nPOSSIBLE SOLUTION: Your Pushover user key appears to be invalid.");
          console.error("1. Verify the key at https://pushover.net/ dashboard");
          console.error("2. Ensure the PUSHOVER_USER_KEY environment variable is set correctly in Railway");
          console.error("3. Check for any whitespace or special characters that might have been included by mistake");
        }
      } else {
        console.log("\n✓ PUSHOVER NOTIFICATION SENT SUCCESSFULLY!");
        console.log("Response from Pushover API:", result);
      }
    });

  } catch (err) {
    console.error("\n!!! ERROR IN PUSHOVER NOTIFICATION PROCESS !!!");
    console.error("Error details:", err.message);
    console.error("Error stack:", err.stack);
  } finally {
    console.log("Closing MongoDB connection...");
    await client.close();
    console.log("MongoDB connection closed");
    console.log("=== PUSHOVER NOTIFICATION PROCESS COMPLETE ===\n");
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
  "05 13 * * *",
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
