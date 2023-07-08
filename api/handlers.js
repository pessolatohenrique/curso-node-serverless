module.exports.sendResults = async (event) => {
  const { name, answers } = JSON.parse(event.body);

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: "Success Message!",
        name,
        answers
      },
      null,
      2
    ),
  };
};
