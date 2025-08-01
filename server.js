
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
const https = require("https");
const querystring = require("querystring");

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

// Function to send Pushover notification using direct HTTPS request
const sendPushoverDirectly = (message, title = "Daily Development Question") => {
  return new Promise((resolve, reject) => {
    console.log("\n=== SENDING PUSHOVER NOTIFICATION DIRECTLY VIA HTTPS ===");
    
    // Trim any whitespace from credentials
    const userKey = process.env.PUSHOVER_USER_KEY ? process.env.PUSHOVER_USER_KEY.trim() : null;
    const appToken = process.env.PUSHOVER_APP_TOKEN ? process.env.PUSHOVER_APP_TOKEN.trim() : null;
    
    // Log credential information (safely)
    console.log("Pushover credentials check:");
    console.log("- User key exists:", !!userKey);
    console.log("- App token exists:", !!appToken);
    
    if (userKey) {
      console.log("- User key length:", userKey.length);
      console.log("- User key first/last 3 chars:", 
        userKey.substring(0, 3) + "..." + userKey.substring(userKey.length - 3));
    }
    
    if (!userKey || !appToken) {
      const error = new Error("Missing Pushover credentials");
      console.error("ERROR:", error.message);
      return reject(error);
    }
    
    // Prepare the POST data
    const postData = querystring.stringify({
      token: appToken,
      user: userKey,
      title: title,
      message: message,
      sound: "magic",
      priority: 0
    });
    
    console.log("Request details:");
    console.log("- Endpoint: https://api.pushover.net/1/messages.json");
    console.log("- Message length:", message.length);
    console.log("- Title:", title);
    
    // Set up the request options
    const options = {
      hostname: 'api.pushover.net',
      port: 443,
      path: '/1/messages.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    // Send the request
    const req = https.request(options, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Headers: ${JSON.stringify(res.headers)}`);
      
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log("Response data:", responseData);
        
        try {
          const parsedData = JSON.parse(responseData);
          
          if (res.statusCode === 200 && parsedData.status === 1) {
            console.log("\n✓ PUSHOVER NOTIFICATION SENT SUCCESSFULLY!");
            resolve(parsedData);
          } else {
            console.error("\n!!! ERROR SENDING PUSHOVER NOTIFICATION !!!");
            console.error("API Error:", parsedData.errors || parsedData);
            
            // Provide helpful error information
            if (parsedData.errors && parsedData.errors[0].includes("user identifier is not a valid")) {
              console.error("\nPOSSIBLE SOLUTION: Your Pushover user key appears to be invalid.");
              console.error("1. Verify the key at https://pushover.net/ dashboard");
              console.error("2. Ensure there are no whitespace or special characters in the key");
              console.error("3. Check if you're using the correct key type (user key vs. group key)");
            }
            
            reject(new Error(parsedData.errors ? parsedData.errors[0] : "Unknown API error"));
          }
        } catch (error) {
          console.error("Error parsing response:", error);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error("Request error:", error);
      reject(error);
    });
    
    // Write the data and end the request
    req.write(postData);
    req.end();
    console.log("Request sent, waiting for response...");
  });
};

// Function to fetch random data from MongoDB and send via Pushover
const sendPushoverWithDatabaseInfo = async () => {
  console.log("\n=== STARTING PUSHOVER NOTIFICATION PROCESS ===");
  
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

    // Use the direct HTTPS method to send notification
    try {
      await sendPushoverDirectly(infoToBeSent, "Daily Development Question");
      console.log("Notification sent successfully");
    } catch (error) {
      console.error("Failed to send notification:", error.message);
      
      // If direct method fails, try with the library as fallback
      if (pushoverClient) {
        console.log("\nAttempting to send with pushover-notifications library as fallback...");
        
        const msg = {
          message: infoToBeSent,
          title: "Daily Development Question",
          sound: "magic",
          priority: 0
        };
        
        pushoverClient.send(msg, function(err, result) {
          if (err) {
            console.error("Fallback also failed:", err.message);
          } else {
            console.log("Fallback method succeeded:", result);
          }
        });
      }
    }

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

// Pushover cron job at 13:05
cron.schedule(
  "24 13 * * *",
  () => {
    console.log("Running Pushover notification job at 12:25 every day!");
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
