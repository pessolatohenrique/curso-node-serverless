const { MongoClient, ObjectId } = require('mongodb');
const { pbkdf2Sync } = require("crypto");
const jwt = require("jsonwebtoken");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { formatResponse } = require("./utils/request");
const { validateToken, generateHashPassword, generateToken } = require("./utils/auth");
const { join, resolve } = require('path');
const { readFile } = require('fs/promises');
const { parse } = require('fast-csv');
const { error } = require('console');

const client = new S3Client({
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  },
  endpoint: "http://localhost:4569",
});

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

async function proccessCsvData(data) {
  const result = await new Promise((resolve, reject) => {
    const students = [];

    const stream = parse({ headers: ["nome", "email"], renameHeaders: true })
      .on("data", (student) => students.push(student))
      .on("error", (error) => reject(new Error(error)))
      .on("end", () => resolve(students));

    stream.write(data);
    stream.end();
  })

  if (result instanceof Error) throw result;

  return result;
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
    const filename = "students.csv";
    const pathFile = join(__dirname, '../tmp', filename);
    const dataCsv = await readFile(pathFile, "utf-8");

    const params = {
      Bucket: "students-bucket",
      Key: filename,
      Body: dataCsv
    };

    client
      .send(
        new PutObjectCommand(params)
      )
      .then(() => formatResponse({
        statusCode: 200,
        response: { message: "Upload with success!" }
      }));

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

module.exports.hookStudent = async (event, context) => {
  const eventS3 = event.Records[0].s3;

  const keyS3 = decodeURIComponent(eventS3.object.key.replace(/\+/g, " "));

  const command = new GetObjectCommand({
    Bucket: "students-bucket",
    Key: keyS3
  });

  const response = await client.send(command);
  const responseCSV = await response.Body.transformToString();
  const responseCSVMapped = await proccessCsvData(responseCSV);

  console.log("response mapped::", responseCSVMapped);

  return formatResponse({
    statusCode: 200,
    response: { students: responseCSVMapped }
  })
};