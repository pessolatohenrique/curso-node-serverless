const { pbkdf2Sync } = require("crypto");
const jwt = require("jsonwebtoken");
const { formatResponse } = require("./request");

function validateToken(event) {
  const fullTokenHeader = event?.headers?.authorization;
  if (!fullTokenHeader) {
    return formatResponse({ statusCode: 400, response: { message: "not a valid bearer token format" } })
  }
  const tokenHeaderValue = fullTokenHeader.split(" ")[1];
  jwt.verify(tokenHeaderValue, process.env.JWT_SECRET, {
    audience: "curso-node-serverless"
  });
}

function generateHashPassword(password) {
  const hashedPassword = pbkdf2Sync(password, process.env.SALT, 100000, 64, 'sha512').toString('hex');
  return hashedPassword;
}

function generateToken(user) {
  const { username, _id } = user;
  const token = jwt.sign({ username, id: _id }, process.env.JWT_SECRET, {
    expiresIn: '24h',
    audience: 'curso-node-serverless'
  });

  return token;
}

module.exports = { validateToken, generateHashPassword, generateToken }