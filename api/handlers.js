const { MongoClient, ObjectId } = require('mongodb')

async function connectToDatabase() {
  const client = new MongoClient(process.env.MONGODB_CONNECTIONSTRING);
  const connection = await client.connect();
  return connection.db(process.env.MONGODB_DB_NAME);
}

function mapCorrectAnswers(answers) {
  const correctQuestions = [3, 1, 0, 2];

  const correctAnswers = answers.reduce((acc, answer, index) => {
    if (answer === correctQuestions[index]) {
      acc++
    }
    return acc
  }, 0);

  return correctAnswers;
}

module.exports.sendResults = async (event) => {
  const { name, answers } = JSON.parse(event.body);

  const connection = await connectToDatabase();

  const correctAnswers = mapCorrectAnswers(answers);

  const result = {
    name,
    correctAnswers,
    totalAnswers: answers.length
  }
  const { insertedId } = await connection.collection('user-answers').insertOne(result);

  return {
    statusCode: 200,
    body: JSON.stringify(
      { insertedId, ...result }
    ),
  };
};

module.exports.getResult = async (event) => {
  const { id } = event.pathParameters;

  const connection = await connectToDatabase();
  const result = await connection.collection("user-answers").findOne({ _id: ObjectId(id) });
  if (!result) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "result not found" })
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result)
  }
}
