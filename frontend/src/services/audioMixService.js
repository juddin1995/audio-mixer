const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");

exports.mixWithFfmpeg = (originalPath, micPath) => {
  return new Promise((resolve, reject) => {
    const output = path.join(
      "uploads",
      `mix-${Date.now()}.mp3`
    );

    ffmpeg()
      .input(originalPath)
      .input(micPath)
      .complexFilter([
        { filter: "amix", options: { inputs: 2, dropout_transition: 0 } },
      ])
      .output(output)
      .on("end", () => resolve(output))
      .on("error", reject)
      .run();
  });
};
