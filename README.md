# JSON Data Stream Parser

A fast, efficient JSON data stream parser for processing large datasets in Node.js. It provides a streaming API to read JSON objects line-by-line or in chunks.


-----


## Table of Contents

1. [Installation](#installation)
2. [Usage](#usage)
3. [Notes](#notes)


----


## Installation


To install the package, use npm:

```bash
npm install json-data-stream-parser
```


## Usage

# Extract Name From List of Object

Example Large JSON File
```json
[
    {
        "id": "1",
        "name": "Alice",
        "hobby": [
            "Video Games"
        ]
    },
    {
        "id": "2",
        "name": "Bob",
        "hobby": [
            "Watching Movies",
            "Playing Football"
        ]
    }
    ...
]
```

```javascript
const { StreamProcessing } = require('json-data-stream-parser');
const fs = require('fs');

// Create a stream from a large JSON file
const stream = fs.createReadStream('large-json.json');

// Pipe the stream through the parser
stream.pipe(new StreamProcessing().parseStream('*.name'))
  .on('data', (json) => {
    console.log('Name:', json.toString());
  })
  .on('error', (err) => {
    console.error('Error parsing JSON:', err);
  });
```

## Notes
**Path Syntax List**:

A simple list provides an overview of the different path formats that can be used to extract data from various levels of nesting.

- `*.name`: Matches `name` at the top level of the JSON object.
- `data.*.name`: Matches `name` inside the `data` object, even if `data` contains nested arrays or objects.
- `*`: Expects a JSON file containing an array and processes each object within the array individually.
- Other Example - `reponse.data.*`, `reponse.data.*.name` ....

