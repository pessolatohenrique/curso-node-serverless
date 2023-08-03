const { MongoClient, ObjectId } = require('mongodb');
const { pbkdf2Sync } = require("crypto");
const jwt = require("jsonwebtoken");

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

function validateToken(event) {
  const fullTokenHeader = event?.headers?.authorization;
  console.log("token header:::", fullTokenHeader);
  if (!fullTokenHeader) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "not a valid bearer token format" })
    }
  }
  const tokenHeaderValue = fullTokenHeader.split(" ")[1];
  jwt.verify(tokenHeaderValue, process.env.JWT_SECRET, {
    audience: "curso-node-serverless"
  });
}

module.exports.login = async (event) => {
  const { username, password } = JSON.parse(event.body);

  const connection = await connectToDatabase();

  const hashedPassword = pbkdf2Sync(password, process.env.SALT, 100000, 64, 'sha512').toString('hex');

  const user = await connection.collection("users").findOne({
    username,
    password: hashedPassword
  });

  if (!user) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "invalid login or password" })
    }
  }

  const token = jwt.sign({ username, id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '24h',
    audience: 'curso-node-serverless'
  })

  return {
    statusCode: 200,
    body: JSON.stringify({ token }),
  };
}

module.exports.sendResults = async (event) => {
  const error = validateToken(event);
  if (error) {
    return {
      statusCode: error.statusCode,
      body: error.body
    }
  }

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
  const error = validateToken(event);
  if (error) {
    return {
      statusCode: error.statusCode,
      body: error.body
    }
  }

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
