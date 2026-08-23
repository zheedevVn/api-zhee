exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  const username = params.user || "zheedevVn";

  try {
    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        "User-Agent": "Netlify-Serverless-Function"
      }
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          status: "error",
          message: "User not found or GitHub API limit reached"
        })
      };
    }

    const data = await response.json();

    const result = {
      status: "success",
      data: {
        id: data.id,
        username: data.login,
        name: data.name,
        avatar_url: data.avatar_url,
        html_url: data.html_url,
        bio: data.bio,
        location: data.location,
        public_repos: data.public_repos,
        followers: data.followers,
        following: data.following
      }
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(result, null, 2)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        status: "error",
        message: error.message
      })
    };
  }
};