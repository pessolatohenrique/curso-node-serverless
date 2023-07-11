const { MongoClient } = require('mongodb')

async function connectToDatabase() {
  console.log("test string:", process.env.MONGODB_CONNECTIONSTRING);
  console.log("db name:", process.env.MONGODB_DB_NAME);
}

module.exports.sendResults = async (event) => {
  const { name, answers } = JSON.parse(event.body);

  const connection = await connectToDatabase();

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: "Success Message!",
        connection,
        name,
        answers
      },
      null,
      2
    ),
  };
};
