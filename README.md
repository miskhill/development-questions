# development-questions
NodeJs backend to send flash card style questions from a Mongo database to my phone

# Why make this Node.js project?

I want to be a knowledge leader but in my day to day work I probably am not expected to be chatting about the definition of a node.js event loop or how I would actually describe correctly a useEffect in React.
This server will solve this for me by sending me a text message daily at 9am. This forces me to look and answer that question until it becomes so obvious to me that I can just delete it from the db and replace it with another.

# How does it work?

I attach the Node.js server to my MongoDb collections and using aggregation randomise a document from that question daily. Using a Twilio developer account I can send myself a free text every day at a time of my choice (9am). I set the time using a cron job.
Updated in 2025 to remove but keep Twilio code and go to pushover notifications instead. Additionally send more often as I am no longer considering SMS costs.

# Improvements

Moving forward I will make a front end to this to add questions, find questions and delete them CRUD style. Currently it is easy enough for me to simply add my questions directly to the database.
I wrote the server for this in one evening and in one file so I will structure the file system as an improvement. 
Updated in 2025 to remove but keep Twilio code and go to pushover notifications instead. Additionally send more often as I am no longer considering SMS costs.
