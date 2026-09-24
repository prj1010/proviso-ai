import Markitdown from "markitdown-js";

const filePath = process.argv[2];
if (!filePath) {
  process.stderr.write("Missing file path.\n");
  process.exit(1);
}

const result = await new Markitdown().convert(filePath);
process.stdout.write(String(result?.textContent ?? ""));
