const { MongoClient, ObjectId } = require('mongodb');
const { pbkdf2Sync } = require("crypto");
const jwt = require("jsonwebtoken");
const AWS = require("aws-sdk");
const { formatResponse } = require("./utils/request");
const { validateToken, generateHashPassword, generateToken } = require("./utils/auth");

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

module.exports.login = async (event) => {
  const { username, password } = JSON.parse(event.body);
  const hashedPassword = generateHashPassword(password);

  const connection = await connectToDatabase();
  const user = await connection.collection("users").findOne({
    username,
    password: hashedPassword
  });

  if (!user) {
    return formatResponse({
      statusCode: 400,
      response: { message: "invalid login or password" }
    });
  }

  const token = generateToken(user);

  return formatResponse({
    statusCode: 200,
    response: { token }
  });
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

  return formatResponse({
    statusCode: 200,
    response: insertedId, ...result
  });
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
    return formatResponse({
      statusCode: 404,
      response: { message: "result not found" }
    });
  }

  return formatResponse({
    statusCode: 200,
    response: result
  })
}

module.exports.uploadStudents = async (event) => {
  try {
    const client = new AWS.S3({
      s3ForcePathStyle: true,
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
      endpoint: new AWS.Endpoint(process.env.S3_ENDPOINT),
    });

    client.putObject({
      Bucket: "students-bucket",
      Key: "teste1.csv",
      Body: Buffer.from("generic message to test")
    }, () => "ok");

    return formatResponse({
      statusCode: 200,
      response: { message: "Upload with success!" }
    })
  } catch (error) {
    return formatResponse({
      statusCode: error.statusCode || 500,
      response: { message: error.message || "Ocorreu um erro" }
    })
  }

}