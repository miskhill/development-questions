require("dotenv").config();
const { MongoClient } = require("mongodb");
const cron = require("node-cron");
const http = require("http");
const Push = require("pushover-notifications");

let pushover;
try {
  console.log("Initializing Pushover client...");
  pushover = new Push({
    user: process.env.PUSHOVER_USER_KEY,
    token: process.env.PUSHOVER_APP_TOKEN
  });
  console.log("Pushover client initialized successfully");
} catch (error) {
  console.error("Error initializing Pushover client:", error.message);
  console.error("Error stack:", error.stack);
}

const sendPushoverWithDatabaseInfo = async () => {
  const uri = process.env.MONGO_URI;
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

    pushover.send(msg, function(err, result) {
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

cron.schedule(
  "25 12 * * *",
  () => {
    console.log("Running Pushover notification job at 11:30 every day!");
    sendPushoverWithDatabaseInfo();
  },
  {
    scheduled: true,
    timezone: "Europe/London",
  }
);

const server = http.createServer((req, res) => {
  if (req.url === "/send-test-pushover" && req.method === "GET") {
    sendPushoverWithDatabaseInfo();
    res.setHeader("Content-Type", "text/plain");
    res.end("Triggered Pushover notification!");
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

const PORT = process.env.PUSHOVER_PORT || 3002;
server.listen(PORT, () => {
  console.log(`Pushover server listening for requests on port ${PORT}.`);
});

module.exports = { sendPushoverWithDatabaseInfo };
