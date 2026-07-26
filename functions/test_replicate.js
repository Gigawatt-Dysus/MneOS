const axios = require('axios');
const key = "r8_HbgpP18DGb6og82sYgzjRb2LtlsYRrl2qoFcu";
const versionId = "b1b9449a1277e10402781c5d41eb30c0a0683504fb23fab591ca9dfc2aabe1cb";

async function testPrediction() {
  try {
    const res = await axios.post(`https://api.replicate.com/v1/predictions`, {
      version: versionId,
      input: {
        image: "https://replicate.delivery/pbxt/L1DxyA6oM1Y5CqX89yMh2rKkP2WJjH9x1qLq3n4f5R6s7T8u/input.png"
      }
    }, {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
    });
    console.log("SUCCESS:", res.data);
  } catch (e) {
    console.log("FAILED POST /predictions:", e.response?.status, e.response?.data);
  }
}

testPrediction();
