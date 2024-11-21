import { JSONParseProcessing } from "./json-parse-processing";

const jsonParseProcessing = new JSONParseProcessing((value) => {
	console.log(JSON.stringify(jsonParseProcessing.stack));

	if (jsonParseProcessing.stack.length === 0) {
		// Check if the value is a complete JSON object
		console.log("Parsed object:", value);
	}

	console.log(JSON.stringify(jsonParseProcessing.stack));
});

const complicated = [
	'{"test":{"keval":{"results":[{"name"',
	':"Keval Thakarar","age":"23","hobby":',
	'["Finance","Politics"]},{"name":"Krisha ',
	'Thakarar","age":"18","hobbies":',
	'["Luxary","Beauty Products"]}]}}}',
];

for (const chunk of complicated) {
	jsonParseProcessing.writeJsonString(chunk);
}
